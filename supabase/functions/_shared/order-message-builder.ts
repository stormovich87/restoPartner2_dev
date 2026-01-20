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

export function buildCourierTelegramMessage({
  order,
  branch,
  distanceKm,
  durationMinutes,
  paymentMethod,
  paymentStatus,
  orderItems,
  deliveryPrice
}: {
  order: any;
  branch: any;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  paymentMethod?: any;
  paymentStatus?: string | null;
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
}): string {
  console.log('Edge buildCourierTelegramMessage called with:', {
    distanceKm,
    durationMinutes,
    orderNumber: order.order_number,
    orderId: order.id,
    hasOrderItems: !!orderItems && orderItems.length > 0
  });

  const orderNumber = order.shift_order_number || order.order_number || order.id;

  const address =
    order.delivery_address ||
    order.address_line ||
    `${order.street || ''} ${order.house_number || ''}`.trim() ||
    'Не указан';

  const encodedAddress = encodeURIComponent(address);

  let itemsBlock = '';
  let subtotal = 0;

  if (orderItems && orderItems.length > 0) {
    const formatted = formatOrderItems(orderItems);
    itemsBlock = formatted.itemsText;
    subtotal = formatted.subtotal;
  } else {
    itemsBlock = order.order_items_summary || 'Не указан';
  }

  const methodName = paymentMethod?.name || 'Не указан';

  let scheduledBlock = '';
  if (order.scheduled_at) {
    const scheduledDate = new Date(order.scheduled_at);
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const year = scheduledDate.getFullYear();
    const hours = String(scheduledDate.getHours()).padStart(2, '0');
    const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
    scheduledBlock = `\n🕐 ⚠️ ЗАКАЗ НА ВРЕМЯ: ${day}.${month}.${year} в ${hours}:${minutes}\n`;
  }

  let distanceBlock = '';
  if (distanceKm != null && durationMinutes != null) {
    const distance = Number(distanceKm).toFixed(1);
    distanceBlock = `🛣 Расстояние / время пути: ${distance} км / ${durationMinutes} мин\n\n`;
  }

  let commentBlock = '';
  if (order.comment) {
    commentBlock = `\n💬 Комментарий: ${order.comment}`;
  }

  let paymentText = '';
  let changeText = '';

  const paymentBreakdown = order.payment_breakdown;
  if (paymentBreakdown && Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
    const paymentParts: string[] = [];
    const changeParts: string[] = [];

    paymentBreakdown.forEach((split: any) => {
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
  } else if (paymentMethod?.method_type === 'cash' &&
      order.cash_amount > order.total_amount) {
    const change = order.cash_amount - order.total_amount;
    paymentText = methodName;
    changeText = `\n💵 Подготовить сдачу: ${change.toFixed(2)} грн (с ${order.cash_amount.toFixed(2)} грн)`;
  } else {
    paymentText = methodName;
  }

  let deliveryBlock = '';
  if (deliveryPrice != null && deliveryPrice > 0) {
    deliveryBlock = `\n🚗 Доставка: ${deliveryPrice.toFixed(2)} грн`;
  }

  const totalAmount = order.total_amount || 0;

  let addressDetailsBlock = '';
  if (order.floor) {
    addressDetailsBlock += `\n🏢 Этаж: ${order.floor}`;
  }
  if (order.apartment) {
    addressDetailsBlock += `\n🚪 Квартира: ${order.apartment}`;
  }
  if (order.entrance) {
    addressDetailsBlock += `\n🚶 Парадная: ${order.entrance}`;
  }
  if (order.intercom) {
    addressDetailsBlock += `\n🔔 Домофон: ${order.intercom}`;
  }
  if (order.office) {
    addressDetailsBlock += `\n🏢 Офис: ${order.office}`;
  }

  return (
`🆕 <b>НОВЫЙ ЗАКАЗ #${orderNumber}</b>${scheduledBlock}
🏢 Филиал: ${branch?.name || 'Не указан'}
🏪 Адрес филиала: ${branch?.address || 'Не указан'}
☎️ Телефон филиала: ${branch?.phone || 'Не указан'}

──────────────────

📱 Телефон клиента: ${order.phone || 'Не указан'}
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

export function buildCourierPrivateMessage({
  order,
  branch,
  distanceKm,
  durationMinutes,
  paymentMethod,
  paymentStatus,
  orderItems,
  deliveryPrice
}: {
  order: any;
  branch: any;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  paymentMethod?: any;
  paymentStatus?: string | null;
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
}): string {
  const orderNumber = order.shift_order_number || order.order_number || order.id;

  const address =
    order.delivery_address ||
    order.address_line ||
    `${order.street || ''} ${order.house_number || ''}`.trim() ||
    'Не указан';

  const encodedAddress = encodeURIComponent(address);

  let itemsBlock = '';
  let subtotal = 0;

  if (orderItems && orderItems.length > 0) {
    const formatted = formatOrderItems(orderItems);
    itemsBlock = formatted.itemsText;
    subtotal = formatted.subtotal;
  } else {
    itemsBlock = order.order_items_summary || 'Не указан';
  }

  const distance =
    distanceKm != null ? Number(distanceKm).toFixed(1) : 'Не указан';

  const duration =
    durationMinutes != null ? `${durationMinutes}` : 'Не указан';

  const methodName = paymentMethod?.name || 'Не указан';

  let commentBlock = '';
  if (order.comment) {
    commentBlock = `\n💬 Комментарий: ${order.comment}\n`;
  }

  let paymentTextPrivate = '';
  let changeTextPrivate = '';

  const paymentBreakdownPrivate = order.payment_breakdown;
  if (paymentBreakdownPrivate && Array.isArray(paymentBreakdownPrivate) && paymentBreakdownPrivate.length > 0) {
    const paymentParts: string[] = [];
    const changeParts: string[] = [];

    paymentBreakdownPrivate.forEach((split: any) => {
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
  } else if (paymentMethod?.method_type === 'cash' &&
      order.cash_amount > order.total_amount) {
    const change = order.cash_amount - order.total_amount;
    paymentTextPrivate = methodName;
    changeTextPrivate = `\n💵 Подготовить сдачу: ${change.toFixed(2)} грн (с ${order.cash_amount.toFixed(2)} грн)`;
  } else {
    paymentTextPrivate = methodName;
  }

  let deliveryBlock = '';
  if (deliveryPrice != null && deliveryPrice > 0) {
    deliveryBlock = `\n🚗 Доставка: ${deliveryPrice.toFixed(2)} грн`;
  }

  const totalAmount = order.total_amount || 0;

  let addressDetailsBlockPrivate = '';
  if (order.floor) {
    addressDetailsBlockPrivate += `\n🏢 Этаж: ${order.floor}`;
  }
  if (order.apartment) {
    addressDetailsBlockPrivate += `\n🚪 Квартира: ${order.apartment}`;
  }
  if (order.entrance) {
    addressDetailsBlockPrivate += `\n🚶 Парадная: ${order.entrance}`;
  }
  if (order.intercom) {
    addressDetailsBlockPrivate += `\n🔔 Домофон: ${order.intercom}`;
  }
  if (order.office) {
    addressDetailsBlockPrivate += `\n🏢 Офис: ${order.office}`;
  }

  return (
`<b>ЗАКАЗ #${orderNumber}</b>

🏢 Филиал: ${branch?.name || 'Не указан'}
🏪 Адрес филиала: ${branch?.address || 'Не указан'}
☎️ Телефон филиала: ${branch?.phone || 'Не указан'}

──────────────────

📱 Телефон клиента: ${order.phone || 'Не указан'}
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
