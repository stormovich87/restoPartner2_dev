export interface ExecutorMessageParams {
  order: any;
  branch: { name?: string; address?: string; phone?: string } | null;
  readinessMinutes?: number | null;
  deliveryPrice?: number | null;
  deliveryPayer?: 'restaurant' | 'client';
  paymentMethod?: {
    method_type?: 'cash' | 'card' | 'other';
    name?: string;
  } | null;
  paymentStatus?: 'paid' | 'unpaid' | null;
  zonePrice?: number | null;
  distancePrice?: number | null;
  roundedDistanceKm?: number | null;
  distanceKm?: number | null;
}

export interface PaymentBreakdownItem {
  method_id: string;
  method_name: string;
  method_type: 'cash' | 'cashless';
  amount: number;
  status?: 'paid' | 'unpaid' | null;
  cash_given?: number | null;
}

export interface CourierMessageParams {
  order: any;
  branch: { name?: string; address?: string; phone?: string } | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  paymentMethod?: {
    method_type?: 'cash' | 'card' | 'other';
    name?: string;
  } | null;
  paymentStatus?: 'paid' | 'unpaid' | null;
  orderItems?: Array<{
    product_name: string;
    quantity: number;
    base_price: number;
    total_price: number;
    modifiers?: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
  }>;
  deliveryPrice?: number | null;
  paymentBreakdown?: PaymentBreakdownItem[] | null;
}

function formatOrderItems(orderItems: Array<{
  product_name: string;
  quantity: number;
  base_price: number;
  total_price: number;
  modifiers?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}>): { itemsText: string; subtotal: number } {
  let itemsText = '';
  let subtotal = 0;

  orderItems.forEach((item, index) => {
    const itemTotal = item.total_price;
    const unitPrice = item.total_price / item.quantity;
    subtotal += itemTotal;

    itemsText += `\n${index + 1}. ${item.product_name}`;

    if (item.modifiers && item.modifiers.length > 0) {
      item.modifiers.forEach(mod => {
        if (mod.quantity > 0) {
          itemsText += `\n   + ${mod.name} x${mod.quantity}`;
          if (mod.price !== 0) {
            itemsText += ` (${mod.price > 0 ? '+' : ''}${mod.price.toFixed(2)} грн)`;
          }
        }
      });
    }

    itemsText += `\n   ${unitPrice.toFixed(2)} грн x ${item.quantity} = ${itemTotal.toFixed(2)} грн`;
  });

  return { itemsText, subtotal };
}

export function buildExecutorTelegramMessage(params: ExecutorMessageParams): string {
  const branchAddress = params.branch?.address || 'Не указан';
  const branchPhone = params.branch?.phone || 'Не указан';

  const clientAddress =
    params.order.delivery_address ||
    params.order.address_line ||
    'Не указан';

  const clientPhone =
    params.order.customer_phone ||
    params.order.phone ||
    'Не указан';

  const readinessText =
    typeof params.readinessMinutes === 'number' && params.readinessMinutes > 0
      ? `${params.readinessMinutes} мин`
      : 'Не указано';

  let deliveryPriceText = 'Не указана';
  let deliveryBreakdown = '';

  if (typeof params.deliveryPrice === 'number' && params.deliveryPrice > 0) {
    if (params.distancePrice && params.distancePrice > 0) {
      const zonePriceVal = params.zonePrice || 0;
      const distanceVal = params.roundedDistanceKm || params.distanceKm || 0;
      deliveryPriceText = `${params.deliveryPrice.toFixed(2)} грн`;
      deliveryBreakdown = `\n   (Зона: ${zonePriceVal.toFixed(2)} грн + Расст.: ${distanceVal.toFixed(1)} км = ${params.distancePrice.toFixed(2)} грн)`;
    } else {
      deliveryPriceText = `${params.deliveryPrice.toFixed(2)} грн`;
    }
  }

  const deliveryPayerText =
    params.deliveryPayer === 'client'
      ? '👤 Клиент'
      : '🏢 Заведение';

  let paymentText = '';
  if (params.paymentMethod?.method_type === 'cash') {
    const orderAmount = Number(params.order.total_amount || params.order.total_price || 0);
    paymentText = `💵 Наличные (выкуп ${orderAmount.toFixed(2)} грн)`;
  } else {
    const methodName = params.paymentMethod?.name || 'Безнал';
    const statusText =
      params.paymentStatus === 'paid'
        ? '✅ Оплачено'
        : '⏳ Не оплачено';
    paymentText = `💳 ${methodName} (${statusText})`;
  }

  let message = '📦 Resto-Presto\n\n';

  message += `🏪 Забрать: ${branchAddress}\n`;
  message += `☎️ Филиал: ${branchPhone}\n\n`;

  message += `📍 Доставка: ${clientAddress}\n`;
  message += `📱 Клиент: ${clientPhone}\n\n`;

  message += `⏰ Готовность: ${readinessText}\n`;

  if (params.order.comment) {
    message += `💬 ${params.order.comment}\n`;
  }

  message += `\n🚗 Доставка: ${deliveryPriceText} (${deliveryPayerText})${deliveryBreakdown}\n`;
  message += `💰 ${paymentText}`;

  return message;
}

export function buildCourierTelegramMessage(params: CourierMessageParams): string {
  console.log('buildCourierTelegramMessage called with:', {
    distanceKm: params.distanceKm,
    durationMinutes: params.durationMinutes,
    orderNumber: params.order.order_number
  });

  const orderNumber = params.order.shift_order_number || params.order.order_number || params.order.id;

  const address =
    params.order.delivery_address ||
    params.order.address_line ||
    `${params.order.street || ''} ${params.order.house_number || ''}`.trim() ||
    'Не указан';

  const encodedAddress = encodeURIComponent(address);

  let itemsBlock = '';
  let subtotal = 0;

  if (params.orderItems && params.orderItems.length > 0) {
    const formatted = formatOrderItems(params.orderItems);
    itemsBlock = formatted.itemsText;
    subtotal = formatted.subtotal;
  } else {
    itemsBlock = params.order.order_items_summary || 'Не указан';
  }

  const methodName = params.paymentMethod?.name || 'Не указан';

  let scheduledBlock = '';
  if (params.order.scheduled_at) {
    const scheduledDate = new Date(params.order.scheduled_at);
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const year = scheduledDate.getFullYear();
    const hours = String(scheduledDate.getHours()).padStart(2, '0');
    const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
    scheduledBlock = `\n\n🕐 <b>⚠️ ЗАКАЗ НА ВРЕМЯ: ${day}.${month}.${year} в ${hours}:${minutes}</b>\n`;
  }

  let distanceBlock = '';
  if (params.distanceKm != null && params.durationMinutes != null) {
    const distance = Number(params.distanceKm).toFixed(1);
    distanceBlock = `🛣 Расстояние / время пути: ${distance} км / ${params.durationMinutes} мин\n\n`;
  }

  let commentBlock = '';
  if (params.order.comment) {
    commentBlock = `\n💬 Комментарий: ${params.order.comment}`;
  }

  let paymentText = '';
  let changeText = '';

  const paymentBreakdown = params.paymentBreakdown || params.order.payment_breakdown;
  if (paymentBreakdown && Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
    const paymentParts: string[] = [];
    const changeParts: string[] = [];

    paymentBreakdown.forEach((split: PaymentBreakdownItem) => {
      if (split.method_type === 'cash') {
        let cashText = `наличкой ${split.amount.toFixed(2)} грн`;
        paymentParts.push(cashText);

        if (split.cash_given && split.cash_given > split.amount) {
          const change = split.cash_given - split.amount;
          changeParts.push(`${change.toFixed(2)} грн (с ${split.cash_given.toFixed(2)} грн)`);
        }
      } else {
        const statusText = split.status === 'paid' ? 'Оплачено' : 'Не оплачено';
        paymentParts.push(`${split.method_name} ${split.amount.toFixed(2)} грн ${statusText}`);
      }
    });

    paymentText = paymentParts.join(', ');

    if (changeParts.length > 0) {
      changeText = `\n💵 Подготовить сдачу: ${changeParts.join(', ')}`;
    }
  } else if (params.paymentMethod?.method_type === 'cash' &&
      params.order.cash_amount > params.order.total_amount) {
    const change = params.order.cash_amount - params.order.total_amount;
    paymentText = methodName;
    changeText = `\n💵 Подготовить сдачу: ${change.toFixed(2)} грн (с ${params.order.cash_amount.toFixed(2)} грн)`;
  } else {
    paymentText = methodName;
  }

  let deliveryBlock = '';
  if (params.deliveryPrice != null && params.deliveryPrice > 0) {
    deliveryBlock = `\n🚗 Доставка: ${params.deliveryPrice.toFixed(2)} грн`;
  }

  const totalAmount = params.order.total_amount || 0;

  let addressDetailsBlock = '';
  if (params.order.floor) {
    addressDetailsBlock += `\n🏢 Этаж: ${params.order.floor}`;
  }
  if (params.order.apartment) {
    addressDetailsBlock += `\n🚪 Квартира: ${params.order.apartment}`;
  }
  if (params.order.entrance) {
    addressDetailsBlock += `\n🚶 Парадная: ${params.order.entrance}`;
  }
  if (params.order.intercom) {
    addressDetailsBlock += `\n🔔 Домофон: ${params.order.intercom}`;
  }
  if (params.order.office) {
    addressDetailsBlock += `\n🏢 Офис: ${params.order.office}`;
  }

  return (
`🆕 <b>НОВЫЙ ЗАКАЗ #${orderNumber}</b>${scheduledBlock}

🏢 Филиал: ${params.branch?.name || 'Не указан'}
🏪 Адрес филиала: ${params.branch?.address || 'Не указан'}
☎️ Телефон филиала: ${params.branch?.phone || 'Не указан'}

──────────────────

📱 Телефон клиента: ${params.order.phone || 'Не указан'}
📍 Адрес доставки: ${address}${addressDetailsBlock}

📍 <a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}">Проложить маршрут</a>
${distanceBlock}
📦 Состав заказа:${itemsBlock}${commentBlock}${deliveryBlock}

──────────────────

💰 Сумма заказа: ${totalAmount.toFixed(2)} грн
💳 Оплата: ${paymentText}${changeText}
`
  );
}

export function buildCourierPrivateMessage(params: CourierMessageParams): string {
  const orderNumber = params.order.shift_order_number || params.order.order_number || params.order.id;

  const address =
    params.order.delivery_address ||
    params.order.address_line ||
    `${params.order.street || ''} ${params.order.house_number || ''}`.trim() ||
    'Не указан';

  const encodedAddress = encodeURIComponent(address);

  let itemsBlock = '';
  let subtotal = 0;

  if (params.orderItems && params.orderItems.length > 0) {
    const formatted = formatOrderItems(params.orderItems);
    itemsBlock = formatted.itemsText;
    subtotal = formatted.subtotal;
  } else {
    itemsBlock = params.order.order_items_summary || 'Не указан';
  }

  const distance =
    params.distanceKm != null ? Number(params.distanceKm).toFixed(1) : 'Не указан';

  const duration =
    params.durationMinutes != null ? `${params.durationMinutes}` : 'Не указан';

  const methodName = params.paymentMethod?.name || 'Не указан';

  let scheduledBlock = '';
  if (params.order.scheduled_at) {
    const scheduledDate = new Date(params.order.scheduled_at);
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const year = scheduledDate.getFullYear();
    const hours = String(scheduledDate.getHours()).padStart(2, '0');
    const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
    scheduledBlock = `\n\n🕐 <b>⚠️ ЗАКАЗ НА ВРЕМЯ:</b>\n<b>${day}.${month}.${year} в ${hours}:${minutes}</b>\n`;
  }

  let commentBlock = '';
  if (params.order.comment) {
    commentBlock = `\n💬 Комментарий: ${params.order.comment}\n`;
  }

  let paymentTextPrivate = '';
  let changeTextPrivate = '';

  const paymentBreakdownPrivate = params.paymentBreakdown || params.order.payment_breakdown;
  if (paymentBreakdownPrivate && Array.isArray(paymentBreakdownPrivate) && paymentBreakdownPrivate.length > 0) {
    const paymentParts: string[] = [];
    const changeParts: string[] = [];

    paymentBreakdownPrivate.forEach((split: PaymentBreakdownItem) => {
      if (split.method_type === 'cash') {
        let cashText = `наличкой ${split.amount.toFixed(2)} грн`;
        paymentParts.push(cashText);

        if (split.cash_given && split.cash_given > split.amount) {
          const change = split.cash_given - split.amount;
          changeParts.push(`${change.toFixed(2)} грн (с ${split.cash_given.toFixed(2)} грн)`);
        }
      } else {
        const statusText = split.status === 'paid' ? 'Оплачено' : 'Не оплачено';
        paymentParts.push(`${split.method_name} ${split.amount.toFixed(2)} грн ${statusText}`);
      }
    });

    paymentTextPrivate = paymentParts.join(', ');

    if (changeParts.length > 0) {
      changeTextPrivate = `\n💵 Подготовить сдачу: ${changeParts.join(', ')}`;
    }
  } else if (params.paymentMethod?.method_type === 'cash' &&
      params.order.cash_amount > params.order.total_amount) {
    const change = params.order.cash_amount - params.order.total_amount;
    paymentTextPrivate = methodName;
    changeTextPrivate = `\n💵 Подготовить сдачу: ${change.toFixed(2)} грн (с ${params.order.cash_amount.toFixed(2)} грн)`;
  } else {
    paymentTextPrivate = methodName;
  }

  let deliveryBlock = '';
  if (params.deliveryPrice != null && params.deliveryPrice > 0) {
    deliveryBlock = `\n🚗 Доставка: ${params.deliveryPrice.toFixed(2)} грн`;
  }

  const totalAmount = params.order.total_amount || 0;

  let addressDetailsBlockPrivate = '';
  if (params.order.floor) {
    addressDetailsBlockPrivate += `\n🏢 Этаж: ${params.order.floor}`;
  }
  if (params.order.apartment) {
    addressDetailsBlockPrivate += `\n🚪 Квартира: ${params.order.apartment}`;
  }
  if (params.order.entrance) {
    addressDetailsBlockPrivate += `\n🚶 Парадная: ${params.order.entrance}`;
  }
  if (params.order.intercom) {
    addressDetailsBlockPrivate += `\n🔔 Домофон: ${params.order.intercom}`;
  }
  if (params.order.office) {
    addressDetailsBlockPrivate += `\n🏢 Офис: ${params.order.office}`;
  }

  return (
`<b>ЗАКАЗ #${orderNumber}</b>${scheduledBlock}

🏢 Филиал: ${params.branch?.name || 'Не указан'}
🏪 Адрес филиала: ${params.branch?.address || 'Не указан'}
☎️ Телефон филиала: ${params.branch?.phone || 'Не указан'}

──────────────────

📱 Телефон клиента: ${params.order.phone || 'Не указан'}
📍 Адрес доставки: ${address}${addressDetailsBlockPrivate}

📍 <a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}">Проложить маршрут</a>

🛣 Расстояние: ${distance} км
⏱ Время в пути: ${duration} мин

──────────────────

📦 Состав заказа:${itemsBlock}
${commentBlock}${deliveryBlock}
──────────────────

💰 Сумма заказа: ${totalAmount.toFixed(2)} грн
💳 Способ оплаты: ${paymentTextPrivate}${changeTextPrivate}
`
  );
}
