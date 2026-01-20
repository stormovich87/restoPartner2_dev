export function buildCourierTelegramMessage(params: {
  order: any;
  branch: any;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  paymentMethod?: any;
  paymentStatus?: string | null;
  deliveryPrice?: number | null;
}): string {
  const { order, branch, distanceKm, durationMinutes, paymentMethod, paymentStatus, deliveryPrice } = params;

  let message = `\ud83d\udce6 <b>Новый заказ #${order.shift_order_number || order.order_number}</b>\n\n`;

  if (order.scheduled_at) {
    const scheduledDate = new Date(order.scheduled_at);
    const date = scheduledDate.toLocaleDateString('ru-RU');
    const time = scheduledDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    message += `\u23f0 <b>Заказ на время:</b> ${date} ${time}\n\n`;
  }

  message += `\ud83c\udfea <b>Филиал:</b> ${branch.name}\n`;
  message += `\ud83d\udccd <b>Адрес:</b> ${order.address_line || 'не указан'}\n`;

  if (order.floor) message += `🏢 Этаж: ${order.floor}\n`;
  if (order.apartment) message += `🚪 Квартира: ${order.apartment}\n`;
  if (order.entrance) message += `🚶 Парадная: ${order.entrance}\n`;
  if (order.intercom) message += `🔔 Домофон: ${order.intercom}\n`;
  if (order.office) message += `🏢 Офис: ${order.office}\n`;

  if (order.phone) {
    message += `\ud83d\udcde <b>Телефон:</b> ${order.phone}\n`;
  }

  if (order.comment) {
    message += `\ud83d\udcdd <b>Комментарий:</b> ${order.comment}\n`;
  }

  if (order.order_items_summary) {
    message += `\n\ud83d\uded2 <b>Состав заказа:</b>\n${order.order_items_summary}\n`;
  }

  message += '\n';

  if (distanceKm !== null && distanceKm !== undefined) {
    message += `\ud83d\udccd <b>Расстояние:</b> ${distanceKm.toFixed(1)} км\n`;
  }

  if (durationMinutes !== null && durationMinutes !== undefined) {
    message += `\u23f1 <b>Время в пути:</b> ${durationMinutes} мин\n`;
  }

  if (deliveryPrice !== null && deliveryPrice !== undefined) {
    message += `\ud83d\ude9a <b>Доставка:</b> ${deliveryPrice} грн\n`;
  }

  message += `\ud83d\udcb0 <b>Сумма заказа:</b> ${order.total_amount || 0} грн\n`;

  if (order.payment_breakdown) {
    if (order.payment_breakdown.cash > 0 && order.payment_breakdown.card > 0) {
      message += `  \u2022 Наличными: ${order.payment_breakdown.cash} грн\n`;
      message += `  \u2022 Картой: ${order.payment_breakdown.card} грн\n`;
    } else if (order.payment_breakdown.cash > 0) {
      message += `  \u2022 Наличными\n`;
    } else if (order.payment_breakdown.card > 0) {
      message += `  \u2022 Картой\n`;
    }
  } else if (paymentMethod) {
    message += `\ud83d\udcb3 <b>Оплата:</b> ${paymentMethod.name}\n`;
  }

  if (order.cash_amount && order.cash_amount > 0) {
    message += `\ud83d\udcb5 <b>Сдача с:</b> ${order.cash_amount} грн\n`;
  }

  if (order.courier) {
    message += `\n\ud83d\udc68\u200d\ud83d\udcbc <b>Курьер:</b> ${order.courier.name} ${order.courier.lastname || ''}`;
  }

  return message;
}