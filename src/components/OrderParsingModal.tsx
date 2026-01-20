import { useState, useEffect, useMemo } from 'react';
import { X, FileText, ShoppingCart, AlertTriangle, Check, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import POSTerminal from './POSTerminal';

interface ParsedOrderItem {
  name: string;
  modifiers: string[];
  quantity: number;
  price: number;
  sum: number;
}

interface Product {
  id: string;
  poster_product_id: number;
  name: string;
  price: number;
}

interface Modifier {
  id: string;
  poster_modifier_id: number;
  name: string;
  price_change: number;
}

interface RecognizedItem {
  product: Product;
  quantity: number;
  modifiers: Array<{ modifier: Modifier; quantity: number }>;
  totalPrice: number;
  matched: boolean;
  originalText: string;
}

interface ParsedOrderData {
  address_city: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_entrance: string | null;
  address_floor: string | null;
  address_flat: string | null;
  address_domofon: string | null;
  address_office: string | null;
  address_full_for_maps: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  payment_method: string | null;
  payment_type_name: string | null;
  fulfillment_method: 'delivery' | 'pickup' | null;
  fulfillment_time_mode: string | null;
  fulfillment_time_value: string | null;
  order_content: string | null;
  total_sum: number | null;
  delivery_price: number | null;
  items_total: number | null;
  comment: string | null;
  persons_count: number | null;
  items: ParsedOrderItem[];
}

interface OrderParsingModalProps {
  partnerId: string;
  onClose: () => void;
  onParsed: (data: ParsedOrderData, recognizedItems: RecognizedItem[]) => void;
}

const fuzzyMatch = (text: string, patterns: string[]): boolean => {
  const lowerText = text.toLowerCase();
  for (const pattern of patterns) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return true;
    }
  }
  return false;
};

const extractValueAfterColon = (line: string): string | null => {
  const colonIndex = line.indexOf(':');
  if (colonIndex !== -1 && colonIndex < line.length - 1) {
    return line.substring(colonIndex + 1).trim();
  }
  return null;
};

const findLineWithKey = (lines: string[], keys: string[], usedIndices: Set<number>): { value: string | null; index: number } => {
  for (let i = 0; i < lines.length; i++) {
    if (usedIndices.has(i)) continue;
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    for (const key of keys) {
      const keyLower = key.toLowerCase();
      const keyBase = keyLower.replace(/[:\s]+$/, '');
      if (lowerLine.includes(keyBase) && line.includes(':')) {
        const value = extractValueAfterColon(line);
        if (value && value.length > 0) {
          return { value, index: i };
        }
      }
    }
  }
  return { value: null, index: -1 };
};

const normalizePhone = (phone: string): string | null => {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const match = cleaned.match(/\+?38?0?(\d{9})$/);
  if (match) {
    return `+380${match[1]}`;
  }
  const directMatch = cleaned.match(/(\d{10})$/);
  if (directMatch) {
    const digits = directMatch[1];
    if (digits.startsWith('0')) {
      return `+38${digits}`;
    }
    return `+380${digits.substring(1)}`;
  }
  return phone.trim() || null;
};

const extractNumber = (text: string): number | null => {
  const cleaned = text.replace(/[^\d,\.]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
};

interface CheckItem {
  id: string;
  product_poster_id: number;
  product_name: string;
  base_price: number;
  modifiers: Array<{
    modifier_poster_id: number;
    name: string;
    price: number;
    quantity: number;
  }>;
  quantity: number;
  total_price: number;
}

export default function OrderParsingModal({ partnerId, onClose, onParsed }: OrderParsingModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('₴');
  const [recognizedItems, setRecognizedItems] = useState<RecognizedItem[]>([]);
  const [showPOSTerminal, setShowPOSTerminal] = useState(false);

  useEffect(() => {
    loadProducts();
    loadModifiers();
    loadSettings();
  }, [partnerId]);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, poster_product_id, name, price')
      .eq('partner_id', partnerId)
      .order('name');
    if (data) setProducts(data);
  };

  const loadModifiers = async () => {
    const { data } = await supabase
      .from('modifiers')
      .select('id, poster_modifier_id, name, price_change')
      .eq('partner_id', partnerId)
      .order('name');
    if (data) setModifiers(data);
  };

  const loadSettings = async () => {
    const { data } = await supabase
      .from('partner_settings')
      .select('currency_symbol')
      .eq('partner_id', partnerId)
      .maybeSingle();
    if (data?.currency_symbol) setCurrencySymbol(data.currency_symbol);
  };

  const normalizeForSearch = (text: string): string => {
    return text.toLowerCase()
      .replace(/[ії]/g, 'и')
      .replace(/[єе]/g, 'е')
      .replace(/ґ/g, 'г')
      .replace(/'/g, '')
      .replace(/[-–—]/g, ' ')
      .replace(/[^\wа-яёa-z0-9\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const findBestProductMatch = (searchText: string, strict: boolean = false): Product | null => {
    const normalizedSearch = normalizeForSearch(searchText);
    if (!normalizedSearch || normalizedSearch.length < 2) return null;

    for (const product of products) {
      const normalizedName = normalizeForSearch(product.name);
      if (normalizedName === normalizedSearch) {
        return product;
      }
    }

    let bestMatch: Product | null = null;
    let bestScore = 0;
    const minScore = strict ? 0.5 : 0.4;

    for (const product of products) {
      const normalizedName = normalizeForSearch(product.name);

      if (normalizedName === normalizedSearch) {
        return product;
      }

      const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length >= 2 || /^\d+$/.test(w));
      const nameWords = normalizedName.split(/\s+/).filter(w => w.length >= 2 || /^\d+$/.test(w));

      if (searchWords.length === 0 || nameWords.length === 0) continue;

      let wordMatches = 0;
      for (const searchWord of searchWords) {
        for (const nameWord of nameWords) {
          if (nameWord === searchWord) {
            wordMatches += 2;
            break;
          }
          const minLen = Math.min(searchWord.length, nameWord.length);
          if (minLen >= 3) {
            if (nameWord.startsWith(searchWord) || searchWord.startsWith(nameWord)) {
              wordMatches += 1.5;
              break;
            }
            if (nameWord.includes(searchWord) || searchWord.includes(nameWord)) {
              wordMatches += 1;
              break;
            }
          }
        }
      }

      if (wordMatches > 0) {
        const score = wordMatches / (Math.max(searchWords.length, nameWords.length) * 2);
        if (score > bestScore && score >= minScore) {
          bestScore = score;
          bestMatch = product;
        }
      }

      if (!strict && normalizedName.startsWith(normalizedSearch) && normalizedSearch.length >= 3) {
        const score = normalizedSearch.length / normalizedName.length;
        if (score > bestScore && score >= 0.4) {
          bestScore = score;
          bestMatch = product;
        }
      }

      if (!strict && normalizedSearch.startsWith(normalizedName) && normalizedName.length >= 3) {
        const score = normalizedName.length / normalizedSearch.length;
        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          bestMatch = product;
        }
      }
    }

    return bestMatch;
  };

  const findModifierMatch = (searchText: string): Modifier | null => {
    const normalizedSearch = normalizeForSearch(searchText);
    if (!normalizedSearch || normalizedSearch.length < 2) return null;

    for (const modifier of modifiers) {
      const normalizedName = normalizeForSearch(modifier.name);
      if (normalizedName === normalizedSearch) {
        return modifier;
      }
    }

    for (const modifier of modifiers) {
      const normalizedName = normalizeForSearch(modifier.name);
      if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
        return modifier;
      }
    }

    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length >= 3);
    if (searchWords.length > 0) {
      for (const modifier of modifiers) {
        const normalizedName = normalizeForSearch(modifier.name);
        const nameWords = normalizedName.split(/\s+/).filter(w => w.length >= 3);

        for (const searchWord of searchWords) {
          for (const nameWord of nameWords) {
            if (nameWord.includes(searchWord) || searchWord.includes(nameWord)) {
              return modifier;
            }
            if (searchWord.length >= 4 && nameWord.length >= 4) {
              if (nameWord.startsWith(searchWord) || searchWord.startsWith(nameWord)) {
                return modifier;
              }
            }
          }
        }
      }
    }

    return null;
  };

  const isMetadataLine = (line: string): boolean => {
    const lowerLine = line.toLowerCase();
    const metadataKeywords = [
      'сума:', 'сумма:', 'sum:', 'total:',
      'доставка:', 'delivery:',
      'итого:', 'разом:', 'всего:', 'всього:'
    ];
    for (const keyword of metadataKeywords) {
      if (lowerLine.includes(keyword)) return true;
    }
    if (/^\d+[\s.,]*\d*\s*(грн|uah|₴)?\.?$/i.test(line.trim())) return true;
    if (/^(всего|всього|итого|разом|підсумок|сума|сумма)\s*:?\s*\d/i.test(line.trim())) return true;
    return false;
  };

  const parseOrderContent = (orderContent: string): RecognizedItem[] => {
    if (!orderContent || products.length === 0) return [];

    const lines = orderContent.split('\n').map(l => l.trim()).filter(l => l);
    const items: RecognizedItem[] = [];
    let currentItem: RecognizedItem | null = null;

    for (const line of lines) {
      if (line.startsWith('-') || line.startsWith('+') || line.startsWith('•') || /^\s{2,}/.test(line)) {
        if (currentItem) {
          let modText = line.replace(/^[-+•]\s*/, '').trim();

          if (modText.includes(':')) {
            const colonParts = modText.split(':');
            if (colonParts.length >= 2) {
              modText = colonParts[colonParts.length - 1].trim();
            }
          }

          const qtyMatch = modText.match(/(\d+)\s*$/);
          let modName = modText;
          let modQty = 1;

          if (qtyMatch) {
            modQty = parseInt(qtyMatch[1]) || 1;
            modName = modText.replace(/\s*\d+\s*$/, '').trim();
          }

          const modifier = findModifierMatch(modName);
          if (modifier) {
            currentItem.modifiers.push({ modifier, quantity: modQty });
            currentItem.totalPrice += modifier.price_change * modQty * currentItem.quantity;
          }
        }
        continue;
      }

      if (isMetadataLine(line)) {
        continue;
      }

      const qtyPriceMatch = line.match(/^(\d+)\s*[хx×*]\s*([\d.,]+)/i);
      if (qtyPriceMatch && currentItem) {
        const qty = parseInt(qtyPriceMatch[1]) || 1;
        currentItem.quantity = qty;
        currentItem.totalPrice = (currentItem.product.price +
          currentItem.modifiers.reduce((sum, m) => sum + m.modifier.price_change * m.quantity, 0)) * qty;
        continue;
      }

      if (currentItem) {
        items.push(currentItem);
        currentItem = null;
      }

      let productName = line;
      let qty = 1;

      const priceWithCurrencyMatch = productName.match(/^(.+?)\s+(\d+)\s+([\d.,]+)\s*(грн\.?|uah|₴)/i);
      if (priceWithCurrencyMatch) {
        productName = priceWithCurrencyMatch[1].trim();
        qty = parseInt(priceWithCurrencyMatch[2]) || 1;
      }

      const lineQtyMatch = productName.match(/^(.+?)\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)$/);
      if (lineQtyMatch) {
        productName = lineQtyMatch[1].trim();
        qty = parseInt(lineQtyMatch[2]) || 1;
      }

      const tabSeparatedMatch = productName.match(/^(.+?)[\t\s]{2,}(\d+)[\t\s]{2,}([\d.,]+)/);
      if (tabSeparatedMatch) {
        productName = tabSeparatedMatch[1].trim();
        qty = parseInt(tabSeparatedMatch[2]) || 1;
      }

      const simpleQtyMatch = productName.match(/^(\d+)\s*[хx×*]\s*(.+)/i);
      if (simpleQtyMatch) {
        qty = parseInt(simpleQtyMatch[1]) || 1;
        productName = simpleQtyMatch[2].trim();
      }

      const endQtyMatch = productName.match(/(.+?)\s*[хx×*]\s*(\d+)$/i);
      if (endQtyMatch) {
        productName = endQtyMatch[1].trim();
        qty = parseInt(endQtyMatch[2]) || 1;
      }

      productName = productName.replace(/\s*[\d.,]+\s*(грн\.?|uah|₴)\s*$/i, '').trim();
      productName = productName.replace(/\s+\d+\s*$/, '').trim();

      if (productName.includes(':') && !findBestProductMatch(productName, true)) {
        continue;
      }

      const product = findBestProductMatch(productName, true);

      if (product) {
        currentItem = {
          product,
          quantity: qty,
          modifiers: [],
          totalPrice: product.price * qty,
          matched: true,
          originalText: productName
        };
      }
    }

    if (currentItem) {
      items.push(currentItem);
    }

    return items;
  };

  const debouncedRecognize = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (rawText: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const parsedData = parseOrderText(rawText);
        if (parsedData.order_content) {
          const items = parseOrderContent(parsedData.order_content);
          setRecognizedItems(items);
        } else {
          setRecognizedItems([]);
        }
      }, 300);
    };
  }, [products, modifiers]);

  useEffect(() => {
    if (text.trim() && products.length > 0) {
      debouncedRecognize(text);
    } else {
      setRecognizedItems([]);
    }
  }, [text, products, modifiers]);

  const parseOrderText = (rawText: string): ParsedOrderData => {
    const lines = rawText.split('\n').map(line => line.trim());
    const nonEmptyLines = lines.filter(line => line.length > 0);

    const data: ParsedOrderData = {
      address_city: null,
      address_street: null,
      address_house_number: null,
      address_entrance: null,
      address_floor: null,
      address_flat: null,
      address_domofon: null,
      address_office: null,
      address_full_for_maps: null,
      customer_phone: null,
      customer_name: null,
      payment_method: null,
      payment_type_name: null,
      fulfillment_method: null,
      fulfillment_time_mode: null,
      fulfillment_time_value: null,
      order_content: null,
      total_sum: null,
      delivery_price: null,
      items_total: null,
      comment: null,
      persons_count: null,
      items: []
    };

    const usedIndices = new Set<number>();

    const deliveryTypeResult = findLineWithKey(nonEmptyLines, [
      'Способ доставки',
      'Спосіб доставки',
      'Метод доставки',
      'Метод доставк'
    ], usedIndices);

    if (deliveryTypeResult.value) {
      usedIndices.add(deliveryTypeResult.index);
      const lowerValue = deliveryTypeResult.value.toLowerCase();
      if (lowerValue.includes('самовывоз') || lowerValue.includes('самовиніс') || lowerValue.includes('самовынос') ||
          lowerValue.includes('pickup') || lowerValue.includes('самовив')) {
        data.fulfillment_method = 'pickup';
      } else if (lowerValue.includes('доставка') || lowerValue.includes('delivery')) {
        data.fulfillment_method = 'delivery';
      }
    }

    const paymentResult = findLineWithKey(nonEmptyLines, [
      'Способ оплаты',
      'Спосіб оплати',
      'Метод оплати',
      'Метод оплаты',
      'Оплата'
    ], usedIndices);

    if (paymentResult.value) {
      usedIndices.add(paymentResult.index);
      data.payment_method = paymentResult.value;
      data.payment_type_name = paymentResult.value;
    }

    for (let i = 0; i < nonEmptyLines.length; i++) {
      if (usedIndices.has(i)) continue;
      const line = nonEmptyLines[i];
      const phoneMatch = line.match(/(?:телефон|phone|тел\.?)\s*:?\s*(\+?\d[\d\s\-\(\)]{8,})/i);
      if (phoneMatch) {
        data.customer_phone = normalizePhone(phoneMatch[1]);
        usedIndices.add(i);
        break;
      }
      const standAlonePhone = line.match(/\+?38[\s\-\(\)]*0[\s\-\(\)]*\d{2}[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{2}[\s\-\(\)]*\d{2}/);
      if (standAlonePhone && !data.customer_phone) {
        data.customer_phone = normalizePhone(standAlonePhone[0]);
      }
    }

    const nameResult = findLineWithKey(nonEmptyLines, [
      'Имя',
      "Ім'я",
      'Клиент',
      'Клієнт',
      'Name'
    ], usedIndices);

    if (nameResult.value) {
      usedIndices.add(nameResult.index);
      data.customer_name = nameResult.value;
    }

    const streetResult = findLineWithKey(nonEmptyLines, [
      'Улица',
      'Вулиця',
      'Street'
    ], usedIndices);

    if (streetResult.value) {
      usedIndices.add(streetResult.index);
      data.address_street = streetResult.value;
    }

    const houseKeys = ['№ Дома', '№Дома', 'Дом:', 'Будинок', 'House', 'Дом'];
    const houseResult = findLineWithKey(nonEmptyLines, houseKeys, usedIndices);

    if (houseResult.value) {
      usedIndices.add(houseResult.index);
      data.address_house_number = houseResult.value;
    }

    const entranceKeys = [
      'Подъезд', "Під'їзд", 'Подьезд', 'Парадная', 'Entrance',
      'Под', 'Пiд', 'Підїзд'
    ];
    const entranceResult = findLineWithKey(nonEmptyLines, entranceKeys, usedIndices);

    if (entranceResult.value) {
      usedIndices.add(entranceResult.index);
      data.address_entrance = entranceResult.value;
    }

    const flatKeys = ['Квартира', 'Кв.', 'Flat', 'Apartment', 'Кварт'];
    const flatResult = findLineWithKey(nonEmptyLines, flatKeys, usedIndices);

    if (flatResult.value) {
      usedIndices.add(flatResult.index);
      data.address_flat = flatResult.value;
    }

    const intercomKeys = ['Домофон', 'Intercom', 'Домоф'];
    const intercomResult = findLineWithKey(nonEmptyLines, intercomKeys, usedIndices);

    if (intercomResult.value) {
      usedIndices.add(intercomResult.index);
      data.address_domofon = intercomResult.value;
    }

    const floorKeys = ['Этаж', 'Поверх', 'Floor', 'Эт'];
    const floorResult = findLineWithKey(nonEmptyLines, floorKeys, usedIndices);

    if (floorResult.value) {
      usedIndices.add(floorResult.index);
      data.address_floor = floorResult.value;
    }

    const cityKeys = ['Город', 'Місто', 'City'];
    const cityResult = findLineWithKey(nonEmptyLines, cityKeys, usedIndices);

    if (cityResult.value) {
      usedIndices.add(cityResult.index);
      data.address_city = cityResult.value;
    }

    const officeKeys = ['Офис', 'Офіс', 'Office'];
    const officeResult = findLineWithKey(nonEmptyLines, officeKeys, usedIndices);

    if (officeResult.value) {
      usedIndices.add(officeResult.index);
      data.address_office = officeResult.value;
    }

    let commentStartIndex = -1;
    let commentEndIndex = -1;

    for (let i = 0; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i].toLowerCase();
      if (fuzzyMatch(line, ['коммент', 'комент', 'comment'])) {
        commentStartIndex = i;
        break;
      }
    }

    if (commentStartIndex !== -1) {
      for (let i = commentStartIndex + 1; i < nonEmptyLines.length; i++) {
        const line = nonEmptyLines[i].toLowerCase();
        if (fuzzyMatch(line, ['кільк', 'персон', 'товар', 'количество', 'цена', 'всего'])) {
          commentEndIndex = i;
          break;
        }
      }

      const commentLine = nonEmptyLines[commentStartIndex];
      const colonIndex = commentLine.indexOf(':');
      if (colonIndex !== -1) {
        let comment = commentLine.substring(colonIndex + 1).trim();

        if (commentEndIndex === -1 || commentEndIndex === commentStartIndex + 1) {
        } else {
          for (let i = commentStartIndex + 1; i < commentEndIndex; i++) {
            comment += '\n' + nonEmptyLines[i];
          }
        }

        if (comment) {
          data.comment = comment;
          usedIndices.add(commentStartIndex);
        }
      }
    }

    const personsResult = findLineWithKey(nonEmptyLines, [
      'Кількість персон',
      'Количество персон',
      'Персон',
      'Persons'
    ], usedIndices);

    if (personsResult.value) {
      usedIndices.add(personsResult.index);
      const num = extractNumber(personsResult.value);
      if (num !== null) {
        data.persons_count = Math.floor(num);
      }
    }

    let itemsStartIndex = -1;
    let itemsEndIndex = -1;

    for (let i = 0; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i].toLowerCase();
      if (line.includes('товар') && (line.includes('количество') || line.includes('кількість') ||
          line.includes('цена') || line.includes('ціна') || line.includes('всего'))) {
        itemsStartIndex = i + 1;
        break;
      }
    }

    if (itemsStartIndex !== -1) {
      for (let i = itemsStartIndex; i < nonEmptyLines.length; i++) {
        const line = nonEmptyLines[i].toLowerCase();
        if (line.startsWith('итого') || line.startsWith('разом') || line.startsWith('підсумок')) {
          itemsEndIndex = i;
          break;
        }
      }

      if (itemsEndIndex === -1) {
        itemsEndIndex = nonEmptyLines.length;
      }

      const orderLines: string[] = [];
      for (let i = itemsStartIndex; i < itemsEndIndex; i++) {
        orderLines.push(nonEmptyLines[i]);
        usedIndices.add(i);
      }

      if (orderLines.length > 0) {
        data.order_content = orderLines.join('\n');
        parseOrderItems(orderLines, data);
      }
    }

    if (!data.order_content) {
      const potentialOrderLines: string[] = [];
      for (let i = 0; i < nonEmptyLines.length; i++) {
        if (usedIndices.has(i)) continue;
        const line = nonEmptyLines[i];
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes(':') && (
          lowerLine.includes('адрес') || lowerLine.includes('телефон') ||
          lowerLine.includes('email') || lowerLine.includes('статус') ||
          lowerLine.includes('метод') || lowerLine.includes('id ') ||
          lowerLine.includes('ip ') || lowerLine.includes('дата') ||
          lowerLine.includes('создан') || lowerLine.includes('створ') ||
          lowerLine.includes('коментар') || lowerLine.includes('комментарий') ||
          lowerLine.includes('оплат') || lowerLine.includes('доставка') ||
          lowerLine.includes('итого') || lowerLine.includes('разом') ||
          lowerLine.includes('всего') || lowerLine.includes('всього') ||
          lowerLine.includes('сума') || lowerLine.includes('сумма')
        )) continue;

        if (/^\d+[\s.,]*\d*\s*(грн|uah|₴)?\.?$/i.test(line.trim())) continue;

        const hasProductPattern = /^[а-яёіїєґa-z0-9\s"'«»-]+$/i.test(line.trim()) ||
          /^.+\s+\d+\s+[\d.,]+/.test(line.trim());

        if (hasProductPattern && line.trim().length >= 3) {
          potentialOrderLines.push(line);
        }
      }

      if (potentialOrderLines.length > 0) {
        data.order_content = potentialOrderLines.join('\n');
      }
    }

    for (let i = 0; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i];
      const lowerLine = line.toLowerCase();

      if ((lowerLine.startsWith('всего') || lowerLine.startsWith('всього')) && lowerLine.includes(':')) {
        const num = extractNumber(extractValueAfterColon(line) || '');
        if (num !== null) {
          data.total_sum = num;
        }
        continue;
      }

      if ((lowerLine.startsWith('доставка') || lowerLine.includes('доставка:')) && lowerLine.includes(':')) {
        const num = extractNumber(extractValueAfterColon(line) || '');
        if (num !== null) {
          data.delivery_price = num;
        }
        continue;
      }

      if ((lowerLine.startsWith('итого') || lowerLine.startsWith('разом') || lowerLine.startsWith('підсумок')) &&
          lowerLine.includes(':') && !data.items_total) {
        const num = extractNumber(extractValueAfterColon(line) || '');
        if (num !== null) {
          data.items_total = num;
        }
        continue;
      }
    }

    if (!data.total_sum && data.items_total) {
      data.total_sum = data.items_total + (data.delivery_price || 0);
    }

    buildFullAddress(data);

    return data;
  };

  const parseOrderItems = (orderLines: string[], data: ParsedOrderData) => {
    let currentItem: Partial<ParsedOrderItem> | null = null;
    const items: ParsedOrderItem[] = [];

    for (const line of orderLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('+')) {
        if (currentItem) {
          currentItem.modifiers = currentItem.modifiers || [];
          currentItem.modifiers.push(trimmedLine.replace(/^[-•+]\s*/, ''));
        }
        continue;
      }

      const qtyPriceMatch = trimmedLine.match(/(\d+)\s*[хx*×]\s*([\d,\.]+)(?:\s*[=]?\s*([\d,\.]+))?/i);
      if (qtyPriceMatch && currentItem) {
        currentItem.quantity = parseInt(qtyPriceMatch[1]);
        currentItem.price = parseFloat(qtyPriceMatch[2].replace(',', '.'));
        if (qtyPriceMatch[3]) {
          currentItem.sum = parseFloat(qtyPriceMatch[3].replace(',', '.'));
        } else {
          currentItem.sum = currentItem.quantity * currentItem.price;
        }
        continue;
      }

      const lineWithNumbers = trimmedLine.match(/^(.+?)\s+(\d+)\s+([\d,\.]+)\s+([\d,\.]+)$/);
      if (lineWithNumbers) {
        if (currentItem && currentItem.name) {
          items.push({
            name: currentItem.name,
            modifiers: currentItem.modifiers || [],
            quantity: currentItem.quantity || 1,
            price: currentItem.price || 0,
            sum: currentItem.sum || 0
          });
        }

        currentItem = {
          name: lineWithNumbers[1].trim(),
          modifiers: [],
          quantity: parseInt(lineWithNumbers[2]),
          price: parseFloat(lineWithNumbers[3].replace(',', '.')),
          sum: parseFloat(lineWithNumbers[4].replace(',', '.'))
        };
        continue;
      }

      if (currentItem && currentItem.name) {
        items.push({
          name: currentItem.name,
          modifiers: currentItem.modifiers || [],
          quantity: currentItem.quantity || 1,
          price: currentItem.price || 0,
          sum: currentItem.sum || 0
        });
      }

      currentItem = {
        name: trimmedLine,
        modifiers: [],
        quantity: 1,
        price: 0,
        sum: 0
      };
    }

    if (currentItem && currentItem.name) {
      items.push({
        name: currentItem.name,
        modifiers: currentItem.modifiers || [],
        quantity: currentItem.quantity || 1,
        price: currentItem.price || 0,
        sum: currentItem.sum || 0
      });
    }

    data.items = items;
  };

  const buildFullAddress = (data: ParsedOrderData) => {
    const parts: string[] = [];

    if (data.address_city) {
      parts.push(data.address_city);
    }

    if (data.address_street) {
      let streetWithHouse = data.address_street;
      if (data.address_house_number) {
        streetWithHouse += ' ' + data.address_house_number;
      }
      parts.push(streetWithHouse);
    } else if (data.address_house_number) {
      parts.push(data.address_house_number);
    }

    if (data.address_flat) {
      parts.push(`кв. ${data.address_flat}`);
    }

    if (data.address_office) {
      parts.push(`оф. ${data.address_office}`);
    }

    if (parts.length > 0) {
      data.address_full_for_maps = parts.join(', ');
    }
  };

  const handleParse = () => {
    if (!text.trim()) {
      setError('Введите текст заказа');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsedData = parseOrderText(text);

      const hasAnyData = parsedData.address_street ||
                         parsedData.customer_phone ||
                         parsedData.customer_name ||
                         parsedData.payment_method ||
                         parsedData.total_sum ||
                         parsedData.items.length > 0 ||
                         parsedData.order_content ||
                         recognizedItems.length > 0;

      if (!hasAnyData) {
        throw new Error('Не удалось распознать данные заказа. Проверьте формат текста.');
      }

      onParsed(parsedData, recognizedItems);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при разборе текста');
    } finally {
      setLoading(false);
    }
  };

  const recognizedTotal = recognizedItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const convertToCheckItems = (): CheckItem[] => {
    return recognizedItems.map((item, idx) => ({
      id: `parsed-${Date.now()}-${idx}`,
      product_poster_id: item.product.poster_product_id,
      product_name: item.product.name,
      base_price: item.product.price,
      modifiers: item.modifiers.map((m) => ({
        modifier_poster_id: m.modifier.poster_modifier_id,
        name: m.modifier.name,
        price: m.modifier.price_change,
        quantity: m.quantity
      })),
      quantity: item.quantity,
      total_price: item.totalPrice
    }));
  };

  const handlePOSTerminalSave = (items: CheckItem[], _total: number) => {
    const newRecognizedItems: RecognizedItem[] = items.map(item => {
      const product = products.find(p => p.poster_product_id === item.product_poster_id);
      if (!product) return null;

      const itemModifiers = item.modifiers.map(m => {
        const modifier = modifiers.find(mod => mod.poster_modifier_id === m.modifier_poster_id);
        if (!modifier) return null;
        return { modifier, quantity: m.quantity };
      }).filter((m): m is { modifier: Modifier; quantity: number } => m !== null);

      return {
        product,
        quantity: item.quantity,
        modifiers: itemModifiers,
        totalPrice: item.total_price,
        matched: true,
        originalText: item.product_name
      };
    }).filter((item): item is RecognizedItem => item !== null);

    setRecognizedItems(newRecognizedItems);
    setShowPOSTerminal(false);
  };

  const isParseDisabled = !text.trim() || loading;

  return (
    <>
    {showPOSTerminal && (
      <POSTerminal
        partnerId={partnerId}
        initialItems={convertToCheckItems()}
        onClose={() => setShowPOSTerminal(false)}
        onSave={handlePOSTerminalSave}
      />
    )}
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Парсинг заказа
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Вставьте текст заказа
                </label>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  rows={20}
                  placeholder={`Пример текста заказа:

Детали заказа #123
Способ доставки: Доставка
Способ оплаты: Наличные
Телефон: +38(050)123-45-67
Имя: Иван

Улица: Бувалкіна
№ Дома: 44б
Подъезд: 2
Квартира: 15

Товар Количество Цена Всего
Пицца Маргарита
- с сыром
- большая
2 х 150 грн = 300 грн

Итого: 300 грн
Доставка: 50 грн
Всего: 350 грн`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-5 h-5 text-green-600" />
                <label className="text-sm font-semibold text-gray-700">
                  Распознанные товары (превью чека)
                </label>
              </div>

              <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white px-4 py-2 text-center">
                  <span className="text-xs font-mono tracking-wider">ЧЕК</span>
                </div>

                <div className="p-3 max-h-[400px] overflow-y-auto">
                  {recognizedItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Товары не распознаны</p>
                      <p className="text-xs mt-1">Введите текст заказа слева</p>
                    </div>
                  ) : (
                    <div className="space-y-2 font-mono text-xs">
                      {recognizedItems.map((item, index) => (
                        <div key={index} className="bg-white rounded-lg p-2 border border-gray-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <span className="font-semibold text-gray-900">{item.product.name}</span>
                              </div>
                              {item.originalText !== item.product.name && (
                                <div className="text-[10px] text-gray-400 mt-0.5 pl-4">
                                  "{item.originalText}"
                                </div>
                              )}
                              {item.modifiers.length > 0 && (
                                <div className="mt-1 pl-4 space-y-0.5">
                                  {item.modifiers.map((mod, midx) => (
                                    <div key={midx} className="text-gray-600 flex items-center gap-1">
                                      <span className="text-green-500">+</span>
                                      <span>{mod.modifier.name}</span>
                                      {mod.quantity > 1 && <span>x{mod.quantity}</span>}
                                      <span className="text-gray-400 ml-auto">
                                        +{(mod.modifier.price_change * mod.quantity).toFixed(0)} {currencySymbol}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-gray-500">{item.quantity} x {item.product.price.toFixed(0)}</div>
                              <div className="font-bold text-gray-900">{item.totalPrice.toFixed(0)} {currencySymbol}</div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="border-t-2 border-dashed border-gray-300 pt-2 mt-3">
                        <div className="flex justify-between items-center font-bold text-sm">
                          <span>ИТОГО:</span>
                          <span className="text-green-600">{recognizedTotal.toFixed(0)} {currencySymbol}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {recognizedItems.length > 0 && (
                  <div className="bg-green-50 border-t border-green-200 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-700 text-xs">
                        <Check className="w-4 h-4" />
                        <span>Распознано {recognizedItems.length} позиций</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPOSTerminal(true)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        Редактировать
                      </button>
                    </div>
                  </div>
                )}

                {text.trim() && products.length > 0 && (
                  <div className="border-t border-gray-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setShowPOSTerminal(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-xs font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                      Открыть терминал
                    </button>
                  </div>
                )}

                {text.trim() && recognizedItems.length === 0 && products.length > 0 && (
                  <div className="bg-amber-50 border-t border-amber-200 px-3 py-2">
                    <div className="flex items-center gap-2 text-amber-700 text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Товары не найдены в каталоге</span>
                    </div>
                  </div>
                )}

                {products.length === 0 && (
                  <div className="bg-gray-100 border-t border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Каталог товаров пуст</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  <strong>Подсказка:</strong> Система автоматически находит товары из каталога по названиям в тексте заказа и показывает превью чека для проверки корректности распознавания.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t bg-white rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleParse}
            disabled={isParseDisabled}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Распознавание...' : 'Распознать'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
