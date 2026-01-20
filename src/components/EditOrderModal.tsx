import { useState, useEffect, useRef } from 'react';
import { X, Search, MapPin, Navigation, ShoppingCart, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadGoogleMapsScript } from '../lib/googleMapsLoader';
import { findNearestBranch, geocodeAddress, reverseGeocode, calculateRouteDistance } from '../lib/mapHelpers';
import type { BranchWithDistance } from '../lib/mapHelpers';
import type { CourierDeliveryZone } from '../types';
import POSTerminal from './POSTerminal';
import OrderParsingModal from './OrderParsingModal';
import { buildCourierTelegramMessage } from '../lib/orderMessageBuilder';

interface Branch {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
}

interface Courier {
  id: string;
  name: string;
  branch_id: string;
  branches?: {
    name: string;
  };
}

interface PaymentMethod {
  id: string;
  name: string;
  method_type: 'cash' | 'cashless';
}

interface Order {
  id: string;
  order_number: string;
  branch_id: string;
  address_line?: string;
  floor?: string;
  apartment?: string;
  entrance?: string;
  intercom?: string;
  office?: string;
  phone: string;
  comment?: string;
  order_items_summary: string;
  delivery_type: 'delivery' | 'pickup';
  courier_id?: string;
  courier_zone_id?: string;
  delivery_price_manual?: boolean;
  delivery_price_uah?: number;
  scheduled_at: string | null;
  total_time_minutes: number;
  total_amount: number;
  payment_method_id?: string;
  payment_status?: 'paid' | 'unpaid' | null;
  cash_amount?: number | null;
}

interface EditOrderModalProps {
  partnerId: string;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditOrderModal({ partnerId, orderId, onClose, onSuccess }: EditOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierZones, setCourierZones] = useState<CourierDeliveryZone[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(true);

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | null>(null);
  const [defaultMapLat, setDefaultMapLat] = useState<number | null>(null);
  const [defaultMapLng, setDefaultMapLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [branchLat, setBranchLat] = useState<number | null>(null);
  const [branchLng, setBranchLng] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [nearestBranch, setNearestBranch] = useState<BranchWithDistance | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const getLocalDateTimeComponents = (isoString: string | null) => {
    if (!isoString) return { date: '', time: '' };
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    };
  };

  const [branchId, setBranchId] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [intercom, setIntercom] = useState('');
  const [office, setOffice] = useState('');
  const [phone, setPhone] = useState('');
  const [commentEnabled, setCommentEnabled] = useState(false);
  const [comment, setComment] = useState('');
  const [orderItemsSummary, setOrderItemsSummary] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [courierId, setCourierId] = useState('search_courier');
  const [courierZoneId, setCourierZoneId] = useState('');
  const [autoDetectedCourierZone, setAutoDetectedCourierZone] = useState<CourierDeliveryZone | null>(null);
  const [manualCourierZoneSelection, setManualCourierZoneSelection] = useState(false);
  const [courierDeliveryPrice, setCourierDeliveryPrice] = useState<number | null>(null);
  const [scheduledType, setScheduledType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [totalAmount, setTotalAmount] = useState('0');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [showPOSTerminal, setShowPOSTerminal] = useState(false);
  const [showParsingModal, setShowParsingModal] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [parsedOrderContent, setParsedOrderContent] = useState('');
  const [productModifierRules, setProductModifierRules] = useState<Map<number, any[]>>(new Map());
  const [minPickupOrderAmount, setMinPickupOrderAmount] = useState<number | null>(null);

  const bills = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

  const formatPhoneNumber = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '');

    if (digitsOnly.length === 0) {
      return '';
    }

    let formattedDigits = digitsOnly;

    if (digitsOnly.startsWith('380') && digitsOnly.length >= 12) {
      formattedDigits = digitsOnly.slice(2);
    } else if (digitsOnly.startsWith('0') && digitsOnly.length >= 10) {
      formattedDigits = digitsOnly;
    } else if (!digitsOnly.startsWith('0') && !digitsOnly.startsWith('380')) {
      return value;
    }

    if (formattedDigits.length >= 10 && formattedDigits.startsWith('0')) {
      const code = formattedDigits.slice(0, 3);
      const part1 = formattedDigits.slice(3, 6);
      const part2 = formattedDigits.slice(6, 8);
      const part3 = formattedDigits.slice(8, 10);
      return `+38 (${code}) ${part1} ${part2} ${part3}`;
    }

    return value;
  };

  const isPhoneValid = (phoneValue: string): boolean => {
    const digitsOnly = phoneValue.replace(/\D/g, '');
    return digitsOnly.length === 10 || digitsOnly.length === 12;
  };

  const getNormalizedPhone = (phoneValue: string): string => {
    const digitsOnly = phoneValue.replace(/\D/g, '');
    if (digitsOnly.startsWith('380') && digitsOnly.length === 12) {
      return digitsOnly.slice(2);
    } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
      return digitsOnly;
    }
    return digitsOnly;
  };

  const addBill = (bill: number) => {
    setBillCounts(prev => ({
      ...prev,
      [bill]: (prev[bill] || 0) + 1
    }));
  };

  const removeBill = (bill: number) => {
    setBillCounts(prev => {
      const newCount = (prev[bill] || 0) - 1;
      if (newCount <= 0) {
        const { [bill]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [bill]: newCount };
    });
  };

  const calculateTotalFromBills = () => {
    return Object.entries(billCounts).reduce((sum, [bill, count]) => {
      return sum + (Number(bill) * count);
    }, 0);
  };

  const calculateChange = () => {
    const total = parseFloat(totalAmount) || 0;
    const cash = calculateTotalFromBills();
    return cash - total;
  };

  useEffect(() => {
    const total = calculateTotalFromBills();
    setCashAmount(total > 0 ? String(total) : '');
  }, [billCounts]);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    if (order) {
      const localDateTime = getLocalDateTimeComponents(order.scheduled_at);
      setBranchId(order.branch_id);
      setAddressLine(order.address_line || '');
      setFloor(order.floor || '');
      setApartment(order.apartment || '');
      setEntrance(order.entrance || '');
      setIntercom(order.intercom || '');
      setOffice(order.office || '');
      setPhone(order.phone);
      setCommentEnabled(!!order.comment);
      setComment(order.comment || '');
      setOrderItemsSummary(order.order_items_summary);
      setDeliveryType(order.delivery_type);
      setCourierId(order.courier_id || 'search_courier');
      setCourierZoneId(order.courier_zone_id || '');
      setManualCourierZoneSelection(order.delivery_price_manual || false);
      setCourierDeliveryPrice(order.delivery_price_uah || null);
      setScheduledType(order.scheduled_at ? 'scheduled' : 'now');
      setScheduledDate(localDateTime.date);
      setScheduledTime(localDateTime.time);
      setTotalAmount(order.total_amount.toString());
      setPaymentMethodId(order.payment_method_id || '');
      setIsPaid(order.payment_status === 'paid');
      setCashAmount(order.cash_amount?.toString() || '');

      loadData();
      loadOrderItems();
    }
  }, [order]);

  const loadOrder = async () => {
    try {
      setLoadingOrder(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOrder(data as Order);
      } else {
        alert('Заказ не найден');
        onClose();
      }
    } catch (error) {
      console.error('Error loading order:', error);
      alert('Ошибка загрузки заказа');
      onClose();
    } finally {
      setLoadingOrder(false);
    }
  };

  const loadOrderItems = async () => {
    if (!order) return;

    try {
      const { data } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (data && data.length > 0) {
        setOrderItems(data.map(item => ({
          id: item.id,
          product_poster_id: item.product_poster_id,
          product_name: item.product_name,
          base_price: parseFloat(item.base_price),
          modifiers: item.modifiers || [],
          quantity: item.quantity,
          total_price: parseFloat(item.total_price)
        })));
      }
    } catch (error) {
      console.error('Error loading order items:', error);
    }
  };

  const loadData = async () => {
    try {
      const [shiftsRes, branchesRes, couriersRes, methodsRes, settingsRes, courierZonesRes, zonePolygonsRes] = await Promise.all([
        supabase
          .from('shifts')
          .select('branch_id')
          .eq('partner_id', partnerId)
          .eq('status', 'open'),
        supabase
          .from('branches')
          .select('id, name, address, latitude, longitude, telegram_bot_token, telegram_chat_id')
          .eq('partner_id', partnerId)
          .eq('status', 'active'),
        supabase
          .from('couriers')
          .select('id, name, branch_id, branches(name)')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .eq('is_external', false)
          .order('branch_id'),
        supabase
          .from('payment_methods')
          .select('id, name, method_type')
          .eq('partner_id', partnerId)
          .eq('is_active', true),
        supabase
          .from('partner_settings')
          .select('google_maps_api_key, default_map_lat, default_map_lng, min_pickup_order_amount')
          .eq('partner_id', partnerId)
          .maybeSingle(),
        supabase
          .from('courier_delivery_zones')
          .select('*')
          .eq('partner_id', partnerId)
          .order('created_at'),
        supabase
          .from('courier_zone_polygons')
          .select('*')
          .order('zone_id, display_order')
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (couriersRes.error) throw couriersRes.error;
      if (methodsRes.error) throw methodsRes.error;

      const openShiftBranchIds = shiftsRes.data?.map(s => s.branch_id) || [];
      const allBranches = branchesRes.data || [];
      const currentBranch = order ? allBranches.find(b => b.id === order.branch_id) : null;
      const branchesWithOpenShifts = allBranches.filter(b => openShiftBranchIds.includes(b.id));

      if (currentBranch && !openShiftBranchIds.includes(currentBranch.id)) {
        branchesWithOpenShifts.unshift(currentBranch);
      }

      setBranches(branchesWithOpenShifts);

      if (settingsRes.data?.google_maps_api_key) setGoogleMapsApiKey(settingsRes.data.google_maps_api_key);
      if (settingsRes.data?.default_map_lat && settingsRes.data?.default_map_lng) {
        setDefaultMapLat(settingsRes.data.default_map_lat);
        setDefaultMapLng(settingsRes.data.default_map_lng);
      }
      if (settingsRes.data?.min_pickup_order_amount) setMinPickupOrderAmount(settingsRes.data.min_pickup_order_amount);

      if (currentBranch) {
        setBranchLat(currentBranch.latitude || null);
        setBranchLng(currentBranch.longitude || null);
      }
      setCouriers(couriersRes.data || []);

      if (courierZonesRes.data && zonePolygonsRes.data) {
        const zonesWithPolygons = courierZonesRes.data.map(zone => ({
          ...zone,
          polygons: zonePolygonsRes.data
            .filter(p => p.zone_id === zone.id)
            .map(p => p.polygon)
        }));
        setCourierZones(zonesWithPolygons);
      }

      setPaymentMethods(methodsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Ошибка загрузки данных');
    }
  };

  useEffect(() => {
    if (googleMapsApiKey && defaultMapLat !== null && defaultMapLng !== null) {
      initializeMap();
    }
  }, [googleMapsApiKey, defaultMapLat, defaultMapLng]);

  const zonePolygonsRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (mapInstanceRef.current && courierZones.length > 0) {
      zonePolygonsRef.current.forEach(polygon => polygon.setMap(null));
      zonePolygonsRef.current = [];

      courierZones.forEach(zone => {
        if (zone.polygons && zone.polygons.length > 0) {
          zone.polygons.forEach((polygonPath: any) => {
            const polygon = new google.maps.Polygon({
              paths: polygonPath,
              strokeColor: zone.color,
              strokeOpacity: 0.6,
              strokeWeight: 2,
              fillColor: zone.color,
              fillOpacity: 0.15,
              map: mapInstanceRef.current,
              clickable: false
            });

            zonePolygonsRef.current.push(polygon);
          });
        }
      });
    }
  }, [courierZones, mapInstanceRef.current]);

  useEffect(() => {
    if (courierId && courierId !== 'no_courier' && deliveryLat && deliveryLng && courierZones.length > 0 && !manualCourierZoneSelection) {
      detectCourierZone(deliveryLat, deliveryLng);
    } else if (courierId === 'no_courier') {
      setAutoDetectedCourierZone(null);
      setCourierDeliveryPrice(null);
    }
  }, [courierId, courierZones, deliveryLat, deliveryLng]);

  const detectCourierZone = (lat: number, lng: number) => {
    if (courierZones.length === 0) {
      setAutoDetectedCourierZone(null);
      setCourierDeliveryPrice(null);
      return;
    }

    const point = new google.maps.LatLng(lat, lng);

    for (const zone of courierZones) {
      if (!zone.polygons || zone.polygons.length === 0) continue;

      for (const polygonPath of zone.polygons) {
        if (!polygonPath || polygonPath.length === 0) continue;

        const polygon = new google.maps.Polygon({
          paths: polygonPath
        });

        if (google.maps.geometry.poly.containsLocation(point, polygon)) {
          setAutoDetectedCourierZone(zone);
          setCourierDeliveryPrice(zone.price_uah);
          return;
        }
      }
    }

    setAutoDetectedCourierZone(null);
    setCourierDeliveryPrice(null);
  };

  const initializeMap = async () => {
    if (!googleMapsApiKey || !mapRef.current || defaultMapLat === null || defaultMapLng === null) {
      return;
    }

    try {
      await loadGoogleMapsScript(googleMapsApiKey);

      const position = { lat: defaultMapLat, lng: defaultMapLng };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: position,
          zoom: 14,
        });

        mapInstanceRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setDeliveryLat(newLat);
            setDeliveryLng(newLng);
            updateMarker(newLat, newLng);
            reverseGeocodePosition(newLat, newLng);
            setManualCourierZoneSelection(false);
            detectCourierZone(newLat, newLng);
          }
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const updateMarker = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    const position = { lat, lng };

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        draggable: true,
      });

      markerRef.current.addListener('dragend', () => {
        if (markerRef.current) {
          const newPosition = markerRef.current.getPosition();
          if (newPosition) {
            const newLat = newPosition.lat();
            const newLng = newPosition.lng();
            setDeliveryLat(newLat);
            setDeliveryLng(newLng);
            reverseGeocodePosition(newLat, newLng);
          }
        }
      });
    }
  };

  const reverseGeocodePosition = async (lat: number, lng: number) => {
    if (!googleMapsApiKey) return;
    const address = await reverseGeocode(lat, lng, googleMapsApiKey);
    if (address) {
      setAddressLine(address);
    }
  };

  const handleFindAddress = async () => {
    if (!addressLine.trim()) {
      alert('Введите адрес для поиска');
      return;
    }

    if (!googleMapsApiKey) {
      alert('Google Maps API ключ не настроен');
      return;
    }

    setGeocoding(true);
    setRouteInfo(null);
    setNearestBranch(null);

    const result = await geocodeAddress(addressLine, googleMapsApiKey);

    if (result) {
      setDeliveryLat(result.lat);
      setDeliveryLng(result.lng);
      setAddressLine(result.formattedAddress);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: result.lat, lng: result.lng });
        updateMarker(result.lat, result.lng);
      }

      setManualCourierZoneSelection(false);
      detectCourierZone(result.lat, result.lng);

      await calculateDistanceToAllBranches(result.lat, result.lng);
    } else {
      alert('Не удалось найти адрес. Проверьте правильность ввода.');
    }

    setGeocoding(false);
  };

  const calculateDistanceToAllBranches = async (lat: number, lng: number) => {
    if (!googleMapsApiKey || branches.length === 0) {
      return;
    }

    setCalculatingDistance(true);
    setRouteInfo(null);
    setNearestBranch(null);

    const { nearestBranch: nearest } = await findNearestBranch(branches, lat, lng, googleMapsApiKey);

    if (nearest) {
      setNearestBranch(nearest);
      setBranchId(nearest.id);
      setRouteInfo(nearest.routeInfo || null);
      setBranchLat(nearest.latitude || null);
      setBranchLng(nearest.longitude || null);
    }

    setCalculatingDistance(false);
  };

  useEffect(() => {
    if (googleMapsApiKey && deliveryLat !== null && deliveryLng !== null && branches.length > 0) {
      calculateDistanceToAllBranches(deliveryLat, deliveryLng);
    }
  }, [googleMapsApiKey, deliveryLat, deliveryLng, branches]);

  const couriersByBranch = couriers.reduce((acc, courier) => {
    const branchId = courier.branch_id;
    if (!acc[branchId]) {
      acc[branchId] = {
        branchName: courier.branches?.name || 'Неизвестный филиал',
        couriers: []
      };
    }
    acc[branchId].couriers.push(courier);
    return acc;
  }, {} as Record<string, { branchName: string; couriers: Courier[] }>);

  const sendTelegramNotification = async (orderId: string) => {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          shift_order_number,
          address_line,
          floor,
          apartment,
          entrance,
          intercom,
          office,
          phone,
          total_amount,
          order_items_summary,
          comment,
          scheduled_at,
          cash_amount,
          delivery_price_uah,
          distance_km,
          duration_minutes,
          payment_status,
          branch_id,
          branches!inner(name, telegram_bot_token, telegram_chat_id),
          payment_methods(name, method_type)
        `)
        .eq('id', orderId)
        .single();

      if (!orderData) return;

      const branch = branches.find(b => b.id === orderData.branch_id);
      if (!branch?.telegram_chat_id || !branch?.telegram_bot_token) {
        return;
      }

      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      const message = buildCourierTelegramMessage({
        order: orderData,
        branch,
        distanceKm: orderData.distance_km,
        durationMinutes: orderData.duration_minutes,
        paymentMethod: orderData.payment_methods,
        paymentStatus: orderData.payment_status,
        orderItems: orderItemsData || undefined,
        deliveryPrice: orderData.delivery_price_uah,
        paymentBreakdown: orderData.payment_breakdown
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_token: branch.telegram_bot_token,
          chat_id: branch.telegram_chat_id,
          message,
          inline_keyboard: [
            [{ text: '✅ Принять заказ', callback_data: `accept_order_${orderId}` }]
          ]
        })
      });

      const responseData = await response.json();

      if (response.ok && responseData?.telegram_response?.result?.message_id) {
        const messageId = String(responseData.telegram_response.result.message_id);
        const searchStartTime = new Date().toISOString();

        await supabase
          .from('orders')
          .update({
            telegram_message_id: messageId,
            courier_search_started_at: searchStartTime,
            courier_id: null,
            courier_message_id: null
          })
          .eq('id', orderId);
      }
    } catch (error) {
      console.error('Error sending telegram notification:', error);
    }
  };

  const handlePOSTerminalSave = async (items: any[], total: number) => {
    setOrderItems(items);
    setTotalAmount(total.toFixed(2));

    const summary = items.map(item => {
      const modifiersText = item.modifiers.length > 0
        ? ` (${item.modifiers.map((m: any) => `${m.name} x${m.quantity}`).join(', ')})`
        : '';
      return `${item.product_name}${modifiersText} x${item.quantity}`;
    }).join(', ');

    setOrderItemsSummary(summary);

    try {
      await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);

      if (items.length > 0) {
        const orderItemsData = items.map(item => ({
          order_id: order.id,
          product_poster_id: item.product_poster_id,
          product_name: item.product_name,
          base_price: item.base_price,
          modifiers: item.modifiers,
          quantity: item.quantity,
          total_price: item.total_price
        }));

        await supabase.from('order_items').insert(orderItemsData);
      }
    } catch (error) {
      console.error('Error updating order items:', error);
    }
  };

  const sendCourierDirectMessage = async (order: any) => {
    try {
      const { data: settings } = await supabase
        .from('partner_settings')
        .select('courier_bot_token')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (!settings?.courier_bot_token || !order.couriers?.telegram_user_id) {
        return;
      }

      const branch = branches.find(b => b.id === order.branch_id);
      if (!branch) {
        return;
      }

      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      const message = buildCourierTelegramMessage({
        order,
        branch,
        distanceKm: order.distance_km,
        durationMinutes: order.duration_minutes,
        paymentMethod: order.payment_methods,
        paymentStatus: order.payment_status,
        orderItems: orderItemsData || undefined,
        deliveryPrice: order.delivery_price_uah,
        paymentBreakdown: order.payment_breakdown
      });

      const response = await fetch(`https://api.telegram.org/bot${settings.courier_bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: order.couriers.telegram_user_id,
          text: message,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();
      if (result.ok && result.result?.message_id) {
        const messageId = String(result.result.message_id);

        await supabase
          .from('orders')
          .update({ courier_message_id: messageId })
          .eq('id', order.id);
      }
    } catch (error) {
      console.error('Error sending courier direct message:', error);
    }
  };

  const handleParsedData = (parsedData: any, recognizedItems?: any[]) => {
    if (parsedData.address_full_for_maps) {
      setAddressLine(parsedData.address_full_for_maps);
    }
    if (parsedData.address_floor) {
      setFloor(parsedData.address_floor);
    }
    if (parsedData.address_flat) {
      setApartment(parsedData.address_flat);
    }
    if (parsedData.address_entrance) {
      setEntrance(parsedData.address_entrance);
    }
    if (parsedData.address_domofon) {
      setIntercom(parsedData.address_domofon);
    }
    if (parsedData.address_office) {
      setOffice(parsedData.address_office);
    }
    if (parsedData.customer_phone) {
      setPhone(parsedData.customer_phone);
    }
    if (parsedData.fulfillment_method) {
      setDeliveryType(parsedData.fulfillment_method);
    }
    if (parsedData.delivery_price !== null && parsedData.delivery_price !== undefined) {
      setCourierDeliveryPrice(parsedData.delivery_price);
    }
    if (parsedData.comment) {
      setComment(parsedData.comment);
      setCommentEnabled(true);
    }
    if (parsedData.order_content) {
      setParsedOrderContent(parsedData.order_content);
    }

    if (recognizedItems && recognizedItems.length > 0) {
      const convertedItems = recognizedItems.map((item, idx) => ({
        id: `parsed-${Date.now()}-${idx}`,
        product_poster_id: item.product.poster_product_id,
        product_name: item.product.name,
        base_price: item.product.price,
        modifiers: item.modifiers.map((m: any) => ({
          modifier_poster_id: m.modifier.poster_modifier_id,
          name: m.modifier.name,
          price: m.modifier.price_change,
          quantity: m.quantity
        })),
        quantity: item.quantity,
        total_price: item.totalPrice
      }));

      setOrderItems(convertedItems);

      const summary = convertedItems.map(item => {
        const modifiersText = item.modifiers.length > 0
          ? ` (${item.modifiers.map((m: any) => `${m.name} x${m.quantity}`).join(', ')})`
          : '';
        return `${item.product_name}${modifiersText} x${item.quantity}`;
      }).join(', ');

      setOrderItemsSummary(summary);
      const total = convertedItems.reduce((sum, item) => sum + item.total_price, 0);
      setTotalAmount(total.toString());
    } else if (parsedData.order_content) {
      setOrderItemsSummary(parsedData.order_content);
    }

    if (parsedData.payment_type_name || parsedData.payment_method) {
      const paymentName = parsedData.payment_type_name || parsedData.payment_method;
      const lowerPaymentName = paymentName.toLowerCase();

      const matchedPaymentMethod = paymentMethods.find(pm => {
        const pmLower = pm.name.toLowerCase();
        return pmLower.includes(lowerPaymentName) || lowerPaymentName.includes(pmLower);
      });

      if (matchedPaymentMethod) {
        setPaymentMethodId(matchedPaymentMethod.id);
      }
    }

    setShowParsingModal(false);
  };

  useEffect(() => {
    if (orderItems.length > 0) {
      loadProductModifierRules();
    }
  }, [orderItems]);

  const loadProductModifierRules = async () => {
    const productIds = [...new Set(orderItems.map(item => item.product_poster_id))];
    if (productIds.length === 0) return;

    const { data } = await supabase
      .from('product_modifiers')
      .select('product_poster_id, modifier_poster_id, is_required, min_amount, max_amount, group_id, group_name')
      .eq('partner_id', partnerId)
      .in('product_poster_id', productIds);

    if (data) {
      const rulesMap = new Map<number, any[]>();
      data.forEach(rule => {
        if (!rulesMap.has(rule.product_poster_id)) {
          rulesMap.set(rule.product_poster_id, []);
        }
        rulesMap.get(rule.product_poster_id)!.push(rule);
      });
      setProductModifierRules(rulesMap);
    }
  };

  const checkMissingModifiers = (item: any): { isValid: boolean; message: string } => {
    const rules = productModifierRules.get(item.product_poster_id);
    if (!rules || rules.length === 0) {
      return { isValid: true, message: '' };
    }

    const groupsMap = new Map<string, {
      groupName: string;
      minAmount: number;
      maxAmount: number;
      selectedCount: number;
    }>();

    rules.forEach(rule => {
      const groupKey = rule.group_id !== null ? String(rule.group_id) : `ungrouped_${rule.modifier_poster_id}`;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          groupName: rule.group_name || 'Модифікатори',
          minAmount: rule.min_amount || 0,
          maxAmount: rule.max_amount || 0,
          selectedCount: 0
        });
      }

      const selected = item.modifiers?.find((m: any) => m.modifier_poster_id === rule.modifier_poster_id);
      if (selected) {
        const group = groupsMap.get(groupKey)!;
        group.selectedCount += selected.quantity || 1;
      }
    });

    const missingGroups: string[] = [];
    for (const [, group] of groupsMap) {
      if (group.minAmount > 0 && group.selectedCount < group.minAmount) {
        missingGroups.push(`${group.groupName} (потрібно мінімум ${group.minAmount})`);
      }
    }

    if (missingGroups.length > 0) {
      return {
        isValid: false,
        message: `Не вибрано обов'язкові модифікатори: ${missingGroups.join(', ')}`
      };
    }

    return { isValid: true, message: '' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      alert('Выберите филиал');
      return;
    }

    if (!phone || !isPhoneValid(phone)) {
      alert('Введите корректный номер телефона в формате +380XXXXXXXXX');
      return;
    }

    const itemsTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
    const manualTotal = parseFloat(totalAmount) || 0;
    const checkAmount = orderItems.length > 0 ? itemsTotal : manualTotal;
    const minOrderAmount = autoDetectedCourierZone?.min_order_amount;

    if (minOrderAmount && checkAmount < minOrderAmount && deliveryType !== 'pickup') {
      const remainingAmount = minOrderAmount - checkAmount;
      alert(`Мінімальна сума замовлення ${minOrderAmount} грн не досягнута.\nНеобхідно додати ще ${remainingAmount.toFixed(2)} грн`);
      return;
    }

    setLoading(true);

    try {
      const selectedPaymentMethod = paymentMethods.find(m => m.id === paymentMethodId);

      let distanceKm: number | null = null;
      let durationMinutes: number | null = null;

      if (routeInfo) {
        const distanceMatch = routeInfo.distance.match(/[\d,.]+/);
        const durationMatch = routeInfo.duration.match(/\d+/);

        if (distanceMatch) {
          distanceKm = parseFloat(distanceMatch[0].replace(',', '.'));
        }
        if (durationMatch) {
          durationMinutes = parseInt(durationMatch[0], 10);
        }
      } else if (deliveryType === 'delivery' && deliveryLat !== null && deliveryLng !== null) {
        const selectedBranch = branches.find(b => b.id === branchId);
        if (selectedBranch?.latitude && selectedBranch?.longitude) {
          try {
            const routeData = await calculateRouteDistance(
              { lat: selectedBranch.latitude, lng: selectedBranch.longitude },
              { lat: deliveryLat, lng: deliveryLng }
            );

            if (routeData) {
              const distanceMatch = routeData.distance.match(/[\d,.]+/);
              const durationMatch = routeData.duration.match(/\d+/);

              if (distanceMatch) {
                distanceKm = parseFloat(distanceMatch[0].replace(',', '.'));
              }
              if (durationMatch) {
                durationMinutes = parseInt(durationMatch[0], 10);
              }
            }
          } catch (error) {
            console.error('Ошибка при вычислении расстояния:', error);
          }
        }
      }

      const finalCourierId = deliveryType === 'delivery' && courierId !== 'search_courier' && courierId !== 'no_courier' ? courierId : null;
      const shouldSearchCourier = deliveryType === 'delivery' && courierId === 'search_courier';

      let deliveryPriceUah: number | null = courierDeliveryPrice;
      let deliveryPriceManual = manualCourierZoneSelection;
      let selectedCourierZoneId: string | null = null;
      if (manualCourierZoneSelection && courierZoneId) {
        selectedCourierZoneId = courierZoneId;
      } else if (autoDetectedCourierZone?.id) {
        selectedCourierZoneId = autoDetectedCourierZone.id;
      }

      const orderData: any = {
        branch_id: branchId,
        address_line: addressLine,
        floor: floor || null,
        apartment: apartment || null,
        entrance: entrance || null,
        intercom: intercom || null,
        office: office || null,
        phone: getNormalizedPhone(phone),
        comment: commentEnabled ? comment : null,
        order_items_summary: orderItemsSummary,
        delivery_type: deliveryType,
        courier_id: finalCourierId,
        delivery_price_uah: deliveryPriceUah,
        delivery_price_manual: deliveryPriceManual,
        courier_zone_id: selectedCourierZoneId,
        total_amount: parseFloat(totalAmount) || 0,
        payment_method_id: paymentMethodId || null,
        payment_status: selectedPaymentMethod?.method_type === 'cashless' ? (isPaid ? 'paid' : 'unpaid') : null,
        cash_amount: selectedPaymentMethod?.method_type === 'cash' && cashAmount ? parseFloat(cashAmount) : null,
        distance_km: distanceKm,
        duration_minutes: durationMinutes,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng
      };

      if (scheduledType === 'scheduled' && scheduledDate && scheduledTime) {
        const localDateTimeString = `${scheduledDate}T${scheduledTime}:00`;
        const localDate = new Date(localDateTimeString);
        orderData.scheduled_at = localDate.toISOString();
      } else if (scheduledType === 'now') {
        orderData.scheduled_at = null;
      }

      const fullAddress = [
        addressLine,
        floor && `эт. ${floor}`,
        apartment && `кв. ${apartment}`,
        entrance && `под. ${entrance}`,
        intercom && `дом. ${intercom}`,
        office && `оф. ${office}`
      ].filter(Boolean).join(', ');
      orderData.address = fullAddress;

      const { error } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', order.id);

      if (error) throw error;

      if (orderItems.length > 0) {
        await supabase.from('order_items').delete().eq('order_id', order.id);

        const orderItemsData = orderItems.map(item => ({
          order_id: order.id,
          product_poster_id: item.product_poster_id,
          product_name: item.product_name,
          base_price: item.base_price,
          modifiers: item.modifiers,
          quantity: item.quantity,
          total_price: item.total_price
        }));

        await supabase.from('order_items').insert(orderItemsData);
      }

      const { data: settings } = await supabase
        .from('partner_settings')
        .select('courier_bot_token')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (shouldSearchCourier) {
        if (order.courier_message_id && order.courier_id && settings?.courier_bot_token) {
          const { data: oldCourierData } = await supabase
            .from('couriers')
            .select('telegram_user_id')
            .eq('id', order.courier_id)
            .maybeSingle();

          if (oldCourierData?.telegram_user_id) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bot_token: settings.courier_bot_token,
                chat_id: oldCourierData.telegram_user_id,
                message_id: order.courier_message_id
              })
            }).catch(err => console.error('Error deleting old courier message:', err));
          }
        }

        await sendTelegramNotification(order.id);
      } else if (finalCourierId) {
        const branch = branches.find(b => b.id === branchId);

        if (order.telegram_message_id && branch?.telegram_bot_token && branch?.telegram_chat_id) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bot_token: branch.telegram_bot_token,
              chat_id: branch.telegram_chat_id,
              message_id: order.telegram_message_id
            })
          }).catch(err => console.error('Error deleting branch group message:', err));
        }

        if (order.courier_message_id && order.courier_id && settings?.courier_bot_token && finalCourierId !== order.courier_id) {
          const { data: oldCourierData } = await supabase
            .from('couriers')
            .select('telegram_user_id')
            .eq('id', order.courier_id)
            .maybeSingle();

          if (oldCourierData?.telegram_user_id) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bot_token: settings.courier_bot_token,
                chat_id: oldCourierData.telegram_user_id,
                message_id: order.courier_message_id
              })
            }).catch(err => console.error('Error deleting old courier message:', err));
          }
        }

        const { data: updatedOrder } = await supabase
          .from('orders')
          .select(`
            *,
            branches(name),
            payment_methods(name, method_type),
            couriers(id, name, lastname, telegram_user_id, vehicle_type)
          `)
          .eq('id', order.id)
          .single();

        if (updatedOrder) {
          await sendCourierDirectMessage(updatedOrder);
        }
      } else if (!finalCourierId) {
        const branch = branches.find(b => b.id === branchId);

        if (order.telegram_message_id && branch?.telegram_bot_token && branch?.telegram_chat_id) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bot_token: branch.telegram_bot_token,
              chat_id: branch.telegram_chat_id,
              message_id: order.telegram_message_id
            })
          }).catch(err => console.error('Error deleting branch group message:', err));
        }

        if (order.courier_message_id && order.courier_id && settings?.courier_bot_token) {
          const { data: oldCourierData } = await supabase
            .from('couriers')
            .select('telegram_user_id')
            .eq('id', order.courier_id)
            .maybeSingle();

          if (oldCourierData?.telegram_user_id) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bot_token: settings.courier_bot_token,
                chat_id: oldCourierData.telegram_user_id,
                message_id: order.courier_message_id
              })
            }).catch(err => console.error('Error deleting old courier message:', err));
          }
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Ошибка при обновлении заказа');
    } finally {
      setLoading(false);
    }
  };

  if (loadingOrder || !order) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600">Загрузка заказа...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showParsingModal && (
        <OrderParsingModal
          partnerId={partnerId}
          onClose={() => setShowParsingModal(false)}
          onParsed={handleParsedData}
        />
      )}

      {showPOSTerminal && (
        <POSTerminal
          partnerId={partnerId}
          orderId={order.id}
          initialItems={orderItems}
          onClose={() => setShowPOSTerminal(false)}
          onSave={handlePOSTerminalSave}
          freeDeliveryThreshold={autoDetectedCourierZone?.free_delivery_threshold || null}
          minOrderAmount={autoDetectedCourierZone?.min_order_amount || null}
          deliveryType={deliveryType}
        />
      )}

      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-900">Редактировать заказ {order.order_number}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowPOSTerminal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg font-semibold flex items-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              Відкрити термінал
            </button>
            <button
              type="button"
              onClick={() => setShowParsingModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-semibold flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Парсинг
            </button>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                deliveryType === 'delivery'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              🚗 Доставка
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                deliveryType === 'pickup'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              🏪 Самовывос
            </button>
          </div>


          {deliveryType === 'delivery' && (
            <>
              {branchId && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Navigation className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {nearestBranch ? `Ближайший филиал: ${nearestBranch.name}` : `Филиал: ${branches.find(b => b.id === branchId)?.name || 'Выбран'}`}
                      </p>
                      {calculatingDistance && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          <p className="text-sm text-blue-700 font-medium">
                            Расчёт расстояния...
                          </p>
                        </div>
                      )}
                      {!calculatingDistance && routeInfo && (
                        <p className="text-lg font-bold text-green-700 mt-1">
                          Расстояние: {routeInfo.distance} • Время: {routeInfo.duration}
                        </p>
                      )}
                      {!calculatingDistance && !routeInfo && deliveryLat !== null && deliveryLng !== null && (
                        <p className="text-sm text-gray-600 mt-1">
                          Введите адрес доставки для расчёта расстояния
                        </p>
                      )}
                      {!calculatingDistance && !routeInfo && (deliveryLat === null || deliveryLng === null) && (
                        <p className="text-sm text-gray-600 mt-1">
                          Введите адрес доставки для расчёта расстояния
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {deliveryType === 'delivery' && courierId && courierId !== 'no_courier' && courierZones.length > 0 && (
                <div>
                  {!manualCourierZoneSelection ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      {!deliveryLat || !deliveryLng ? (
                        <>
                          <p className="text-sm font-medium text-gray-600 mb-2">
                            📍 Укажите адрес доставки для расчёта цены
                          </p>
                          <button
                            type="button"
                            onClick={() => setManualCourierZoneSelection(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Выбрать зону вручную
                          </button>
                        </>
                      ) : autoDetectedCourierZone ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-blue-900">
                              📍 Зона доставки: <span className="font-bold">{autoDetectedCourierZone.name}</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => setManualCourierZoneSelection(true)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Выбрать вручную
                            </button>
                          </div>
                          {(() => {
                            const itemsTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
                            const manualTotal = parseFloat(totalAmount) || 0;
                            const checkAmount = orderItems.length > 0 ? itemsTotal : manualTotal;
                            const isFreeDelivery = autoDetectedCourierZone.free_delivery_threshold && checkAmount >= autoDetectedCourierZone.free_delivery_threshold;
                            const remainingAmount = autoDetectedCourierZone.free_delivery_threshold ? autoDetectedCourierZone.free_delivery_threshold - checkAmount : 0;
                            const minOrderAmount = autoDetectedCourierZone.min_order_amount;
                            const isBelowMinOrder = minOrderAmount && checkAmount < minOrderAmount && deliveryType !== 'pickup';
                            const remainingToMinOrder = minOrderAmount ? minOrderAmount - checkAmount : 0;

                            return (
                              <>
                                {isBelowMinOrder && (
                                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 mb-2">
                                    <p className="text-lg font-bold text-red-700">
                                      Минимальный заказ не достигнут!
                                    </p>
                                    <p className="text-base font-semibold text-red-600 mt-1">
                                      Осталось заказать: {remainingToMinOrder.toFixed(2)} грн
                                    </p>
                                    <p className="text-xs text-red-500 mt-1">
                                      Минимальная сумма заказа для этой зоны: {minOrderAmount} грн
                                    </p>
                                  </div>
                                )}
                                {isFreeDelivery ? (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2">
                                    <p className="text-sm font-bold text-green-800">
                                      🎉 Бесплатная доставка
                                    </p>
                                    <p className="text-xs text-green-700 mt-1">
                                      Сумма чека {checkAmount.toFixed(2)} грн достигла порога {autoDetectedCourierZone.free_delivery_threshold} грн
                                    </p>
                                  </div>
                                ) : autoDetectedCourierZone.free_delivery_threshold ? (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                                    <p className="text-sm font-medium text-blue-900">
                                      💰 Цена доставки: <span className="text-lg font-bold">{courierDeliveryPrice} грн</span>
                                    </p>
                                    {remainingAmount > 0 && (
                                      <p className="text-xs text-blue-700 mt-1">
                                        Осталось {remainingAmount.toFixed(2)} грн до бесплатной доставки
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm font-medium text-blue-900">
                                    💰 Цена доставки: <span className="text-lg font-bold">{courierDeliveryPrice} грн</span>
                                  </p>
                                )}
                              </>
                            );
                          })()}
                          <p className="text-xs text-blue-700 mt-1">Автоматический расчёт по адресу</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-orange-600 mb-2">
                            ⚠️ Адрес вне зоны доставки курьеров
                          </p>
                          <button
                            type="button"
                            onClick={() => setManualCourierZoneSelection(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Выбрать зону вручную
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Зона доставки курьеров (ручной выбор)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setManualCourierZoneSelection(false);
                            setCourierZoneId('');
                            if (deliveryLat && deliveryLng) {
                              detectCourierZone(deliveryLat, deliveryLng);
                            }
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Автоматически
                        </button>
                      </div>
                      <select
                        value={courierZoneId}
                        onChange={(e) => {
                          setCourierZoneId(e.target.value);
                          const selectedZone = courierZones.find(z => z.id === e.target.value);
                          if (selectedZone) {
                            setCourierDeliveryPrice(selectedZone.price_uah);
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Выберите зону</option>
                        {courierZones.map(zone => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name} - {zone.price_uah} грн
                          </option>
                        ))}
                      </select>
                      {courierZoneId && courierDeliveryPrice !== null && (
                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm font-medium text-amber-900">
                            💰 Цена доставки курьеров: <span className="text-lg font-bold">{courierDeliveryPrice} грн</span>
                          </p>
                          <p className="text-xs text-amber-700 mt-1">Выбрано вручную</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-gray-900">Адрес доставки</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Филиал *</label>
                  <select
                    value={branchId}
                    onChange={(e) => {
                      const selectedBranchId = e.target.value;
                      setBranchId(selectedBranchId);
                      const selectedBranch = branches.find(b => b.id === selectedBranchId);
                      if (selectedBranch) {
                        setBranchLat(selectedBranch.latitude || null);
                        setBranchLng(selectedBranch.longitude || null);
                      } else {
                        setBranchLat(null);
                        setBranchLng(null);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Выберите филиал</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Адрес <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Улица, дом"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleFindAddress}
                      disabled={geocoding || !googleMapsApiKey}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                      title={!googleMapsApiKey ? 'Google Maps API не настроен' : 'Найти адрес на карте'}
                    >
                      {geocoding ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                      <span className="hidden sm:inline">Найти</span>
                    </button>
                  </div>
                </div>

                {googleMapsApiKey && (
                  <>
                    <div
                      ref={mapRef}
                      className="w-full h-80 bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                    />

                    <p className="text-xs text-gray-500 mt-2">
                      Кликните на карту или перетащите маркер для точного указания адреса доставки
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Этаж</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Квартира</label>
                  <input
                    type="text"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Подъезд</label>
                  <input
                    type="text"
                    value={entrance}
                    onChange={(e) => setEntrance(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Домофон</label>
                  <input
                    type="text"
                    value={intercom}
                    onChange={(e) => setIntercom(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Офис</label>
                  <input
                    type="text"
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Курьер</label>
                <select
                  value={courierId}
                  onChange={(e) => {
                    setCourierId(e.target.value);
                    setCourierZoneId('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="no_courier">🚫 Без курьера</option>
                  <option value="search_courier">🔍 Найти курьера</option>
                  {Object.entries(couriersByBranch).map(([branchId, { branchName, couriers }]) => (
                    <optgroup key={branchId} label={branchName}>
                      {couriers.map(courier => (
                        <option key={courier.id} value={courier.id}>{courier.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Телефон *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value);
                setPhone(formatted);
              }}
              onBlur={(e) => {
                if (e.target.value && !isPhoneValid(e.target.value)) {
                  e.target.setCustomValidity('Телефон должен содержать 10 или 12 цифр');
                } else {
                  e.target.setCustomValidity('');
                }
              }}
              placeholder="0671234567 (формат: +38 (067) 123 45 67)"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                phone && !isPhoneValid(phone)
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              required
            />
            {phone && !isPhoneValid(phone) && (
              <p className="mt-1 text-sm text-red-600">
                Телефон должен содержать 10 или 12 цифр
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={commentEnabled}
                onChange={(e) => setCommentEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Добавить комментарий</span>
            </label>
            {commentEnabled && (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Комментарий к заказу"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Содержание заказа *</label>

            {orderItems.length > 0 && (
              <div className="mb-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Чек</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPOSTerminal(true)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await supabase
                            .from('order_items')
                            .delete()
                            .eq('order_id', order.id);

                          setOrderItems([]);
                          setOrderItemsSummary('');
                          setTotalAmount('');
                        } catch (error) {
                          console.error('Error deleting order items:', error);
                        }
                      }}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {orderItems.map((item, index) => {
                    const validation = checkMissingModifiers(item);
                    return (
                      <div
                        key={index}
                        className={`rounded-lg p-3 border-2 ${
                          validation.isValid
                            ? 'bg-white border-blue-200'
                            : 'bg-red-50 border-red-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.product_name}</div>
                            {!validation.isValid && (
                              <div className="text-sm text-red-600 font-medium mt-1 flex items-start gap-1">
                                <span className="text-red-500">⚠</span>
                                <span>{validation.message}</span>
                              </div>
                            )}
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="text-sm text-gray-600 mt-1">
                                {item.modifiers.map((m: any, i: number) => (
                                  <div key={i} className="ml-2">
                                    + {m.name} x{m.quantity} ({m.price > 0 ? '+' : ''}{m.price} грн)
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="ml-4 text-right">
                            <div className="text-sm text-gray-600">x{item.quantity}</div>
                            <div className="font-semibold text-gray-900">{item.total_price.toFixed(2)} грн</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Сумма товаров:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {orderItems.reduce((sum, item) => sum + item.total_price * item.quantity, 0).toFixed(2)} грн
                    </span>
                  </div>
                  {(() => {
                    let deliveryPrice = 0;
                    const itemsTotal = orderItems.reduce((sum, item) => sum + item.total_price * item.quantity, 0);

                    if (deliveryType === 'delivery' && courierDeliveryPrice !== null) {
                      if (autoDetectedCourierZone?.free_delivery_threshold && itemsTotal >= autoDetectedCourierZone.free_delivery_threshold) {
                        deliveryPrice = 0;
                      } else {
                        deliveryPrice = courierDeliveryPrice;
                      }
                    }

                    if (deliveryPrice > 0) {
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">Доставка:</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {deliveryPrice.toFixed(2)} грн
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                            <span className="font-semibold text-gray-900">Итого:</span>
                            <span className="text-xl font-bold text-blue-900">
                              {(itemsTotal + deliveryPrice).toFixed(2)} грн
                            </span>
                          </div>
                        </>
                      );
                    } else {
                      return (
                        <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                          <span className="font-semibold text-gray-900">Итого:</span>
                          <span className="text-xl font-bold text-blue-900">
                            {itemsTotal.toFixed(2)} грн
                          </span>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            )}

            {parsedOrderContent && (
              <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">Распознанный текст заказа</span>
                </div>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-gray-200 max-h-32 overflow-y-auto">
                  {parsedOrderContent}
                </pre>
              </div>
            )}

            <textarea
              value={orderItemsSummary}
              onChange={(e) => setOrderItemsSummary(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">На когда</label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="now"
                  checked={scheduledType === 'now'}
                  onChange={(e) => setScheduledType(e.target.value as 'now')}
                  className="w-4 h-4 text-blue-600"
                />
                <span>Сейчас</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="scheduled"
                  checked={scheduledType === 'scheduled'}
                  onChange={(e) => setScheduledType(e.target.value as 'scheduled')}
                  className="w-4 h-4 text-blue-600"
                />
                <span>На определенное время</span>
              </label>
            </div>

            {scheduledType === 'scheduled' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Сумма заказа *</label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Способ оплаты</label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Выберите способ оплаты</option>
              {paymentMethods.map(method => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </select>

            {paymentMethods.find(m => m.id === paymentMethodId)?.method_type === 'cashless' && (
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Уже оплачено</span>
              </label>
            )}

            {paymentMethods.find(m => m.id === paymentMethodId)?.method_type === 'cash' && (
              <div className="space-y-3 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">С какой суммы сдача</label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => {
                      setCashAmount(e.target.value);
                      setBillCounts({});
                    }}
                    placeholder="Введите сумму вручную"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {bills.map(bill => (
                    <div key={bill} className="relative">
                      <button
                        type="button"
                        onClick={() => addBill(bill)}
                        className="w-full aspect-[3/2] bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border border-green-300 rounded transition-all flex items-center justify-center font-semibold text-green-800 text-sm shadow-sm hover:shadow relative"
                      >
                        {bill}
                        {billCounts[bill] > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                            {billCounts[bill]}
                          </span>
                        )}
                      </button>
                      {billCounts[bill] > 0 && (
                        <button
                          type="button"
                          onClick={() => removeBill(bill)}
                          className="absolute -bottom-1.5 -left-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow transition-colors"
                        >
                          -
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {cashAmount && parseFloat(cashAmount) > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-200">
                      <span className="text-sm text-gray-700">Сумма от клиента:</span>
                      <span className="text-sm font-semibold text-blue-700">{cashAmount} грн</span>
                    </div>
                    {calculateChange() >= 0 && (
                      <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                        <span className="text-sm text-gray-700">Сдача:</span>
                        <span className="text-sm font-semibold text-green-700">{calculateChange().toFixed(2)} грн</span>
                      </div>
                    )}
                    {calculateChange() < 0 && (
                      <div className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-200">
                        <span className="text-sm text-gray-700">Недостаточно:</span>
                        <span className="text-sm font-semibold text-red-700">{Math.abs(calculateChange()).toFixed(2)} грн</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
