import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CheckView from './CheckView';
import ProductSelector from './ProductSelector';
import ModifierSelector from './ModifierSelector';

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

interface Product {
  id: string;
  poster_product_id: number;
  name: string;
  price: number;
  photo_url: string | null;
  category_poster_id: number;
}

interface Modifier {
  id: string;
  poster_modifier_id: number;
  name: string;
  price_change: number;
  photo_url: string | null;
}

interface ProductModifier {
  modifier_poster_id: number;
  is_required: boolean;
  min_amount: number;
  max_amount: number;
}

interface POSTerminalProps {
  partnerId: string;
  orderId?: string;
  initialItems?: CheckItem[];
  onClose: () => void;
  onSave: (items: CheckItem[], totalAmount: number) => void;
  freeDeliveryThreshold?: number | null;
  minOrderAmount?: number | null;
  deliveryType?: 'delivery' | 'pickup';
}

export default function POSTerminal({ partnerId, orderId, initialItems, onClose, onSave, freeDeliveryThreshold, minOrderAmount, deliveryType }: POSTerminalProps) {
  const [checkItems, setCheckItems] = useState<CheckItem[]>(initialItems || []);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemModifiers, setEditingItemModifiers] = useState<Array<{ modifier_poster_id: number; quantity: number }>>([]);
  const [currencySymbol, setCurrencySymbol] = useState('₴');
  const [isMobile, setIsMobile] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadSettings();
    if (orderId) {
      loadOrderItems();
    }
  }, [partnerId, orderId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('partner_settings')
      .select('currency_symbol')
      .eq('partner_id', partnerId)
      .maybeSingle();

    if (data?.currency_symbol) {
      setCurrencySymbol(data.currency_symbol);
    }
  };

  const loadOrderItems = async () => {
    if (!orderId) return;

    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (data) {
      setCheckItems(data.map(item => ({
        id: item.id,
        product_poster_id: item.product_poster_id,
        product_name: item.product_name,
        base_price: parseFloat(item.base_price),
        modifiers: item.modifiers || [],
        quantity: item.quantity,
        total_price: parseFloat(item.total_price)
      })));
    }
  };

  const handleProductSelect = async (product: Product) => {
    const { data: productModifiers } = await supabase
      .from('product_modifiers')
      .select('modifier_poster_id')
      .eq('partner_id', partnerId)
      .eq('product_poster_id', product.poster_product_id)
      .limit(1);

    if (!productModifiers || productModifiers.length === 0) {
      handleAddToCheck(product, []);
      if (isMobile) setShowCatalog(false);
    } else {
      setSelectedProduct(product);
    }
  };

  const handleAddToCheck = (
    product: Product,
    selectedModifiers: Array<{ modifier: Modifier; quantity: number }>
  ) => {
    const modifiersArray = selectedModifiers.map(sm => ({
      modifier_poster_id: sm.modifier.poster_modifier_id,
      name: sm.modifier.name,
      price: parseFloat(String(sm.modifier.price_change)),
      quantity: sm.quantity
    }));

    const modifiersTotal = modifiersArray.reduce(
      (sum, m) => sum + m.price * m.quantity,
      0
    );

    const totalPrice = product.price + modifiersTotal;

    if (editingItemId) {
      setCheckItems(prev => prev.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            modifiers: modifiersArray,
            total_price: totalPrice * item.quantity
          };
        }
        return item;
      }));
      setEditingItemId(null);
      setEditingItemModifiers([]);
    } else {
      const newItem: CheckItem = {
        id: `temp-${Date.now()}`,
        product_poster_id: product.poster_product_id,
        product_name: product.name,
        base_price: product.price,
        modifiers: modifiersArray,
        quantity: 1,
        total_price: totalPrice
      };
      setCheckItems(prev => [...prev, newItem]);
    }

    setSelectedProduct(null);
    if (isMobile) setShowCatalog(false);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCheckItems(prev =>
      prev
        .map(item => {
          if (item.id === itemId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;

            const modifiersTotal = item.modifiers.reduce(
              (sum, m) => sum + m.price * m.quantity,
              0
            );
            const unitPrice = item.base_price + modifiersTotal;

            return {
              ...item,
              quantity: newQuantity,
              total_price: unitPrice * newQuantity
            };
          }
          return item;
        })
        .filter((item): item is CheckItem => item !== null)
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCheckItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleRemoveByProductId = (productPosterId: number) => {
    setCheckItems(prev => prev.filter(item => item.product_poster_id !== productPosterId));
  };

  const handleEditItem = async (itemId: string) => {
    const item = checkItems.find(i => i.id === itemId);
    if (!item) return;

    const { data: productData } = await supabase
      .from('products')
      .select('id, poster_product_id, name, price, photo_url, category_poster_id')
      .eq('partner_id', partnerId)
      .eq('poster_product_id', item.product_poster_id)
      .maybeSingle();

    if (productData) {
      setEditingItemId(itemId);
      setEditingItemModifiers(item.modifiers.map(m => ({
        modifier_poster_id: m.modifier_poster_id,
        quantity: m.quantity
      })));
      setSelectedProduct(productData);
    }
  };

  const calculateTotal = () => {
    return checkItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSaveToOrder = () => {
    onSave(checkItems, calculateTotal());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className={`bg-white shadow-2xl w-full h-full flex flex-col ${
        isMobile ? '' : 'rounded-2xl max-w-[98vw] max-h-[98vh]'
      }`}>
        {isMobile ? (
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-3 py-1.5 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold">Термінал</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-t-2xl flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-semibold">Термінал</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-hidden ${isMobile ? 'flex flex-col' : 'flex'}`}>
          <CheckView
            items={checkItems}
            currencySymbol={currencySymbol}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onEditItem={handleEditItem}
            onSave={handleSaveToOrder}
            totalAmount={calculateTotal()}
            isMobile={isMobile}
            onShowCatalog={isMobile ? () => setShowCatalog(true) : undefined}
            freeDeliveryThreshold={freeDeliveryThreshold}
            minOrderAmount={minOrderAmount}
            deliveryType={deliveryType}
          />

          {!isMobile && (
            <ProductSelector
              partnerId={partnerId}
              currencySymbol={currencySymbol}
              onProductSelect={handleProductSelect}
              checkItems={checkItems}
              onRemoveFromCheck={handleRemoveByProductId}
            />
          )}
        </div>
      </div>

      {isMobile && showCatalog && (
        <ProductSelector
          partnerId={partnerId}
          currencySymbol={currencySymbol}
          onProductSelect={handleProductSelect}
          checkItems={checkItems}
          onRemoveFromCheck={handleRemoveByProductId}
          isMobile={true}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {selectedProduct && (
        <ModifierSelector
          partnerId={partnerId}
          product={selectedProduct}
          currencySymbol={currencySymbol}
          onClose={() => {
            setSelectedProduct(null);
            setEditingItemId(null);
            setEditingItemModifiers([]);
          }}
          onAdd={handleAddToCheck}
          isMobile={isMobile}
          initialModifiers={editingItemId ? editingItemModifiers : undefined}
        />
      )}
    </div>
  );
}
