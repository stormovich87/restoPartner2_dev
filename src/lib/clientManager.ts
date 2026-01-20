import { supabase } from './supabase';

export interface OrderData {
  id: string;
  order_number: string;
  phone: string;
  address_line: string;
  floor: string | null;
  apartment: string | null;
  entrance: string | null;
  intercom: string | null;
  office: string | null;
  total_amount: number;
  delivery_type: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

export interface OrderItem {
  product_name: string;
  quantity: number;
  base_price: number;
  modifiers: any[];
  total_price: number;
}

export const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const saveOrUpdateClient = async (
  partnerId: string,
  orderData: OrderData,
  orderItems: OrderItem[],
  clientName?: string
): Promise<string | null> => {
  try {
    const normalizedPhone = normalizePhone(orderData.phone);
    console.log('🔍 saveOrUpdateClient called:', { partnerId, normalizedPhone, clientName, orderItemsCount: orderItems.length });

    const { data: existingClient, error: selectError } = await supabase
      .from('clients')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (selectError) {
      console.error('Error searching for existing client:', selectError);
    }

    if (existingClient) {
      console.log('✅ Found existing client, updating...', existingClient.id);
      const dishFrequency = calculateDishFrequency(existingClient.favorite_dishes || [], orderItems);

      const { error: updateError } = await supabase
        .from('clients')
        .update({
          total_orders: existingClient.total_orders + 1,
          total_spent: parseFloat(existingClient.total_spent) + orderData.total_amount,
          last_order_date: new Date().toISOString(),
          favorite_dishes: dishFrequency,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingClient.id);

      if (updateError) {
        console.error('Error updating client:', updateError);
      } else {
        console.log('✅ Client updated successfully');
      }

      return existingClient.id;
    } else {
      console.log('📝 Creating new client...');
      const names = parseClientName(clientName || '');
      const dishFrequency = calculateDishFrequency([], orderItems);

      console.log('Client data to insert:', {
        partner_id: partnerId,
        phone: normalizedPhone,
        first_name: names.firstName,
        last_name: names.lastName,
        total_orders: 1,
        total_spent: orderData.total_amount
      });

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert([{
          partner_id: partnerId,
          phone: normalizedPhone,
          first_name: names.firstName,
          last_name: names.lastName,
          total_orders: 1,
          total_spent: orderData.total_amount,
          last_order_date: new Date().toISOString(),
          favorite_dishes: dishFrequency
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating new client:', error);
        throw error;
      }

      console.log('✅ New client created successfully:', newClient?.id);
      return newClient?.id || null;
    }
  } catch (error) {
    console.error('❌ Error in saveOrUpdateClient:', error);
    return null;
  }
};

export const saveClientAddress = async (
  clientId: string,
  orderData: OrderData
): Promise<void> => {
  try {
    if (orderData.delivery_type !== 'delivery' || !orderData.address_line) {
      return;
    }

    const { data: existingAddress } = await supabase
      .from('client_addresses')
      .select('*')
      .eq('client_id', clientId)
      .eq('address_text', orderData.address_line)
      .maybeSingle();

    if (existingAddress) {
      await supabase
        .from('client_addresses')
        .update({
          deliveries_count: existingAddress.deliveries_count + 1,
          last_delivery_date: new Date().toISOString(),
          floor: orderData.floor || existingAddress.floor,
          apartment: orderData.apartment || existingAddress.apartment,
          entrance: orderData.entrance || existingAddress.entrance,
          intercom: orderData.intercom || existingAddress.intercom,
          office: orderData.office || existingAddress.office,
          lat: orderData.delivery_lat || existingAddress.lat,
          lng: orderData.delivery_lng || existingAddress.lng,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAddress.id);
    } else {
      await supabase
        .from('client_addresses')
        .insert([{
          client_id: clientId,
          address_text: orderData.address_line,
          floor: orderData.floor,
          apartment: orderData.apartment,
          entrance: orderData.entrance,
          intercom: orderData.intercom,
          office: orderData.office,
          lat: orderData.delivery_lat,
          lng: orderData.delivery_lng,
          deliveries_count: 1,
          last_delivery_date: new Date().toISOString()
        }]);
    }
  } catch (error) {
    console.error('Error saving client address:', error);
  }
};

export const saveOrderHistory = async (
  clientId: string,
  orderData: OrderData,
  orderItems: OrderItem[]
): Promise<void> => {
  try {
    await supabase
      .from('client_orders_history')
      .insert([{
        client_id: clientId,
        order_id: orderData.id,
        order_number: orderData.order_number,
        order_data: {
          items: orderItems,
          address: orderData.address_line,
          floor: orderData.floor,
          apartment: orderData.apartment,
          entrance: orderData.entrance,
          intercom: orderData.intercom,
          office: orderData.office,
          delivery_type: orderData.delivery_type
        },
        total_amount: orderData.total_amount
      }]);
  } catch (error) {
    console.error('Error saving order history:', error);
  }
};

const parseClientName = (fullName: string): { firstName: string; lastName: string } => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    return { firstName: 'Клиент', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const calculateDishFrequency = (
  existingFavorites: Array<{ name: string; count: number }>,
  newItems: OrderItem[]
): Array<{ name: string; count: number }> => {
  const dishMap = new Map<string, number>();

  existingFavorites.forEach(dish => {
    dishMap.set(dish.name, dish.count);
  });

  newItems.forEach(item => {
    const currentCount = dishMap.get(item.product_name) || 0;
    dishMap.set(item.product_name, currentCount + item.quantity);
  });

  return Array.from(dishMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};
