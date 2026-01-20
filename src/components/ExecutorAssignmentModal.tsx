import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Executor, Courier, CourierDeliveryZone, PerformerDeliveryZone } from '../types';
import { calculateCourierDeliveryPrice } from '../lib/deliveryZones';
import { buildCourierTelegramMessage } from '../lib/orderMessageBuilder';
import { Users, Bike, AlertCircle } from 'lucide-react';

interface ExecutorAssignmentModalProps {
  orderId: string;
  partnerId: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface PriceBreakdown {
  deliveryPrice: number;
  courierPaymentBase: number;
  distancePrice: number;
  totalCourierPayment: number;
  distanceKm: number;
}

export default function ExecutorAssignmentModal({
  orderId,
  partnerId,
  deliveryLat,
  deliveryLng,
  onClose,
  onSuccess
}: ExecutorAssignmentModalProps) {
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierZones, setCourierZones] = useState<CourierDeliveryZone[]>([]);
  const [performerZones, setPerformerZones] = useState<Map<string, PerformerDeliveryZone[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'courier' | 'performer' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [courierPrice, setCourierPrice] = useState<number | null>(null);
  const [noZoneMessage, setNoZoneMessage] = useState<string>('');
  const [deliveryPayer, setDeliveryPayer] = useState<'restaurant' | 'client'>('restaurant');
  const [badWeatherEnabled, setBadWeatherEnabled] = useState<boolean>(false);
  const [orderDistanceKm, setOrderDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    loadData();
    loadOrderDistance();
  }, [partnerId]);

  const loadOrderDistance = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('distance_km')
        .eq('id', orderId)
        .single();

      if (data?.distance_km) {
        setOrderDistanceKm(data.distance_km);
      }
    } catch (error) {
      console.error('Error loading order distance:', error);
    }
  };

  useEffect(() => {
    if (deliveryLat && deliveryLng && courierZones.length > 0) {
      const price = calculateCourierDeliveryPrice(
        { lat: deliveryLat, lng: deliveryLng },
        courierZones
      );
      setCourierPrice(price);
    }
  }, [deliveryLat, deliveryLng, courierZones]);

  const loadData = async () => {
    try {
      const [executorsRes, couriersRes, courierZonesRes] = await Promise.all([
        supabase
          .from('executors')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('status', 'active'),
        supabase
          .from('couriers')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('is_active', true),
        supabase
          .from('courier_delivery_zones')
          .select('*')
          .eq('partner_id', partnerId)
          .order('created_at')
      ]);

      if (executorsRes.data) {
        setExecutors(executorsRes.data);

        const zonesMap = new Map<string, PerformerDeliveryZone[]>();
        for (const executor of executorsRes.data) {
          const { data } = await supabase
            .from('performer_delivery_zones')
            .select('*')
            .eq('performer_id', executor.id)
            .order('created_at');

          if (data) {
            zonesMap.set(executor.id, data);
          }
        }
        setPerformerZones(zonesMap);
      }

      if (couriersRes.data) setCouriers(couriersRes.data);
      if (courierZonesRes.data) setCourierZones(courierZonesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCourier = (courierId: string) => {
    setSelectedType('courier');
    setSelectedId(courierId);
    setSelectedZoneId(null);
    setDeliveryPayer('restaurant');
  };

  const handleSelectPerformer = (performerId: string) => {
    setSelectedType('performer');
    setSelectedId(performerId);
    setSelectedZoneId(null);

    const executor = executors.find(e => e.id === performerId);
    if (executor) {
      setNoZoneMessage(executor.no_zone_message || 'Выберите зону доставки');
      setDeliveryPayer(executor.delivery_payer_default || 'restaurant');
    }
  };

  const calculatePerformerPrice = (executor: Executor, zone: PerformerDeliveryZone): PriceBreakdown => {
    let deliveryPrice = zone.price_uah;
    let courierPaymentBase = zone.courier_payment ?? zone.price_uah;

    if (badWeatherEnabled && executor.bad_weather_surcharge_percent > 0) {
      deliveryPrice = Math.round(zone.price_uah * (1 + executor.bad_weather_surcharge_percent / 100));
      courierPaymentBase = Math.round((zone.courier_payment ?? zone.price_uah) * (1 + executor.bad_weather_surcharge_percent / 100));
    }

    if (executor.km_calculation_enabled && orderDistanceKm && executor.price_per_km > 0) {
      const graduationKm = (executor.km_graduation_meters || 500) / 1000;
      const roundedDistanceKm = Math.round(orderDistanceKm / graduationKm) * graduationKm;
      const distancePrice = roundedDistanceKm * executor.price_per_km;
      const totalCourierPayment = courierPaymentBase + distancePrice;

      return {
        deliveryPrice,
        courierPaymentBase,
        distancePrice,
        totalCourierPayment,
        distanceKm: roundedDistanceKm
      };
    }

    return {
      deliveryPrice,
      courierPaymentBase,
      distancePrice: 0,
      totalCourierPayment: courierPaymentBase,
      distanceKm: 0
    };
  };

  const handleAssign = async () => {
    if (!selectedType || !selectedId) return;

    if (selectedType === 'performer' && !selectedZoneId) {
      alert(noZoneMessage);
      return;
    }

    if (selectedType === 'courier' && courierPrice === null) {
      const settingsRes = await supabase
        .from('partner_settings')
        .select('courier_no_zone_message')
        .eq('partner_id', partnerId)
        .single();

      const message = settingsRes.data?.courier_no_zone_message || 'Адрес доставки вне зоны обслуживания курьеров';
      alert(message);
      return;
    }

    setSaving(true);

    try {
      const { data: currentOrder } = await supabase
        .from('orders')
        .select(`
          courier_id,
          courier_message_id,
          courier:couriers!orders_courier_id_fkey (
            telegram_user_id,
            name
          )
        `)
        .eq('id', orderId)
        .single();

      const { data: settings } = await supabase
        .from('partner_settings')
        .select('courier_bot_token')
        .eq('partner_id', partnerId)
        .single();

      if (currentOrder?.courier_message_id && currentOrder?.courier?.telegram_user_id && settings?.courier_bot_token) {
        try {
          await fetch(`https://api.telegram.org/bot${settings.courier_bot_token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: currentOrder.courier.telegram_user_id,
              message_id: currentOrder.courier_message_id
            })
          });
        } catch (err) {
          console.error('Error deleting courier message:', err);
        }
      }

      const updateData: any = {
        executor_type: selectedType,
        executor_id: selectedId,
        executor_zone_id: selectedZoneId,
        delivery_payer: deliveryPayer,
        assignment_status: 'assigned',
        courier_message_id: null
      };

      if (selectedType === 'courier') {
        updateData.delivery_price_uah = courierPrice;
        updateData.delivery_price_manual = false;

        // Save courier payment amount
        const courierZone = courierZones.find(z => z.id === selectedZoneId);
        if (courierZone) {
          updateData.courier_payment_amount = courierZone.courier_payment;
        }
      } else if (selectedType === 'performer' && selectedZoneId) {
        const zones = performerZones.get(selectedId) || [];
        const selectedZone = zones.find(z => z.id === selectedZoneId);
        const executor = executors.find(e => e.id === selectedId);

        if (selectedZone && executor) {
          const priceBreakdown = calculatePerformerPrice(executor, selectedZone);
          updateData.delivery_price_uah = priceBreakdown.deliveryPrice;
          updateData.delivery_price_manual = false;
          updateData.courier_payment_amount = priceBreakdown.totalCourierPayment;
        }
      }

      if (selectedType === 'courier') {
        updateData.courier_id = selectedId;
      } else {
        updateData.courier_id = null;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      if (selectedType === 'courier' && settings?.courier_bot_token) {
        try {
          const { data: updatedOrder } = await supabase
            .from('orders')
            .select(`
              *,
              branch:branches!orders_branch_id_fkey (
                name,
                address,
                phone
              ),
              courier:couriers!orders_courier_id_fkey (
                telegram_user_id
              ),
              payment_method:payment_methods!orders_payment_method_id_fkey (
                method_type,
                name
              )
            `)
            .eq('id', orderId)
            .single();

          if (updatedOrder?.courier?.telegram_user_id) {
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', orderId);

            const message = buildCourierTelegramMessage({
              order: updatedOrder,
              branch: updatedOrder.branch,
              distanceKm: updatedOrder.distance_km,
              durationMinutes: updatedOrder.duration_minutes,
              paymentMethod: updatedOrder.payment_method,
              paymentStatus: updatedOrder.payment_status,
              orderItems: orderItems || undefined,
              deliveryPrice: updatedOrder.delivery_price_uah,
              paymentBreakdown: updatedOrder.payment_breakdown
            });

            const response = await fetch(`https://api.telegram.org/bot${settings.courier_bot_token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: updatedOrder.courier.telegram_user_id,
                text: message,
                parse_mode: 'HTML'
              })
            });

            const result = await response.json();
            if (result.ok && result.result?.message_id) {
              await supabase
                .from('orders')
                .update({ courier_message_id: String(result.result.message_id) })
                .eq('id', orderId);
            }
          }
        } catch (err) {
          console.error('Error sending courier message:', err);
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error assigning executor:', error);
      alert('Ошибка при назначении исполнителя');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900">Назначить исполнителя</h3>
        </div>

        <div className="p-6 space-y-6">
          {deliveryLat && deliveryLng && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-800">
                <strong>Координаты доставки:</strong> {deliveryLat.toFixed(6)}, {deliveryLng.toFixed(6)}
              </div>
              {courierPrice !== null && (
                <div className="text-sm text-blue-800 mt-1">
                  <strong>Цена доставки курьером:</strong> {courierPrice} грн
                </div>
              )}
            </div>
          )}

          {couriers.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Bike className="w-5 h-5" />
                Курьеры
              </h4>
              <div className="grid gap-2">
                {couriers.map(courier => (
                  <button
                    key={courier.id}
                    onClick={() => handleSelectCourier(courier.id)}
                    disabled={courierPrice === null}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedType === 'courier' && selectedId === courier.id
                        ? 'border-blue-500 bg-blue-50'
                        : courierPrice === null
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-medium">{courier.name} {courier.lastname}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {courier.phone}
                      {courier.vehicle_type && ` • ${courier.vehicle_type}`}
                    </div>
                    {courierPrice !== null && (
                      <div className="text-sm text-green-600 font-medium mt-1">
                        Стоимость доставки: {courierPrice} грн
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {courierPrice === null && deliveryLat && deliveryLng && (
                <div className="mt-2 text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Адрес доставки вне зон обслуживания курьеров
                </div>
              )}
            </div>
          )}

          {executors.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Исполнители
              </h4>
              <div className="grid gap-2">
                {executors.map(executor => {
                  const zones = performerZones.get(executor.id) || [];
                  const isSelected = selectedType === 'performer' && selectedId === executor.id;

                  return (
                    <div key={executor.id} className="space-y-2">
                      <button
                        onClick={() => handleSelectPerformer(executor.id)}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <div className="font-medium">{executor.name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Комиссия: {executor.commission_percent}%
                        </div>
                      </button>

                      {isSelected && zones.length > 0 && (
                        <div className="ml-4 space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Выберите зону доставки:
                          </label>
                          <select
                            value={selectedZoneId || ''}
                            onChange={(e) => setSelectedZoneId(e.target.value || null)}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                          >
                            <option value="">-- Выберите зону --</option>
                            {zones.map(zone => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name} - {zone.price_uah} грн
                              </option>
                            ))}
                          </select>
                          {selectedZoneId && (() => {
                            const selectedZone = zones.find(z => z.id === selectedZoneId);
                            if (!selectedZone) return null;

                            const priceBreakdown = calculatePerformerPrice(executor, selectedZone);
                            const hasKmCalculation = executor.km_calculation_enabled && priceBreakdown.distancePrice > 0;

                            return (
                              <>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <div
                                      className="w-4 h-4 rounded border border-gray-300"
                                      style={{ backgroundColor: selectedZone.color }}
                                    />
                                    <span>Зона: {selectedZone.name}</span>
                                  </div>

                                  <div className="mt-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                      <span className="font-semibold text-green-800">Ставка</span>
                                    </div>
                                    <div className="text-sm space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-gray-700">Цена доставки:</span>
                                        <span className="font-medium text-gray-900">{priceBreakdown.deliveryPrice} грн</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-700">Оплата курьеру:</span>
                                        <span className="font-bold text-green-600">{priceBreakdown.totalCourierPayment} грн</span>
                                      </div>
                                      {hasKmCalculation && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          <span>{priceBreakdown.courierPaymentBase} грн + ({priceBreakdown.distanceKm.toFixed(1)} км × {executor.price_per_km} грн) = {priceBreakdown.totalCourierPayment} грн</span>
                                        </div>
                                      )}
                                      {executor.km_calculation_enabled && !hasKmCalculation && (
                                        <div className="text-xs text-amber-600 mt-1">
                                          Расчет по км включен, но расстояние не определено
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {executor.bad_weather_surcharge_percent > 0 && (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={badWeatherEnabled}
                                      onChange={(e) => setBadWeatherEnabled(e.target.checked)}
                                      className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      Плохая погода ({executor.bad_weather_surcharge_percent}% надбавка)
                                    </span>
                                  </label>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {isSelected && zones.length === 0 && (
                        <div className="ml-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                          У этого исполнителя нет настроенных зон доставки
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(selectedType === 'courier' || selectedType === 'performer') && (
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Кто оплачивает доставку
              </label>
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery_payer_modal"
                    value="restaurant"
                    checked={deliveryPayer === 'restaurant'}
                    onChange={() => setDeliveryPayer('restaurant')}
                    className="sr-only peer"
                  />
                  <div className="px-4 py-3 border-2 rounded-lg text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 transition-colors">
                    <div className="font-medium">🏢 Заведение</div>
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery_payer_modal"
                    value="client"
                    checked={deliveryPayer === 'client'}
                    onChange={() => setDeliveryPayer('client')}
                    className="sr-only peer"
                  />
                  <div className="px-4 py-3 border-2 rounded-lg text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 transition-colors">
                    <div className="font-medium">👤 Клиент</div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleAssign}
            disabled={
              saving ||
              !selectedType ||
              !selectedId ||
              (selectedType === 'performer' && !selectedZoneId) ||
              (selectedType === 'courier' && courierPrice === null)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Назначение...' : 'Назначить'}
          </button>
        </div>
      </div>
    </div>
  );
}
