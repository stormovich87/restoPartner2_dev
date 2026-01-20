import { useState, useEffect, useRef } from 'react';
import { X, Search, MapPin, Navigation, FileText, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadGoogleMapsScript } from '../lib/googleMapsLoader';
import { findNearestBranch, geocodeAddress, reverseGeocode, calculateRouteDistance } from '../lib/mapHelpers';
import type { BranchWithDistance } from '../lib/mapHelpers';
import type { CourierDeliveryZone, Executor, PerformerDeliveryZone } from '../types';
import OrderParsingModal from './OrderParsingModal';
import POSTerminal from './POSTerminal';
import { buildCourierTelegramMessage } from '../lib/orderMessageBuilder';
import ClientProfileCard from './ClientProfileCard';
import ClientDetailsModal from './ClientDetailsModal';
import { saveOrUpdateClient, saveClientAddress, saveOrderHistory } from '../lib/clientManager';

interface Branch {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  poster_spot_id?: number | null;
  poster_spot_name?: string | null;
  poster_spot_address?: string | null;
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

interface PaymentSplit {
  id: string;
  methodId: string;
  amount: string;
  isPaid: boolean;
  cashGiven: string;
  billCounts: Record<number, number>;
}

interface CreateOrderModalProps {
  partnerId: string;
  onClose: () => void;
  onSuccess?: () => void;
  onOrderCreated?: () => void;
  initialPhone?: string;
  initialBranchId?: string | null;
  initialSourceCallId?: string | null;
  initialOrderItems?: Array<{
    product_poster_id: number;
    product_name: string;
    base_price: number;
    quantity: number;
    modifiers: Array<{
      modifier_poster_id: number;
      modifier_name: string;
      price: number;
    }>;
  }>;
}

export default function CreateOrderModal({ partnerId, onClose, onSuccess, onOrderCreated, initialPhone, initialBranchId, initialSourceCallId, initialOrderItems }: CreateOrderModalProps) {
  const formatInitialPhone = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 0) return '';

    let formattedDigits = digitsOnly;
    if (digitsOnly.startsWith('380') && digitsOnly.length === 12) {
      formattedDigits = digitsOnly.slice(2);
    } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
      formattedDigits = digitsOnly;
    }

    if (formattedDigits.length === 10 && formattedDigits.startsWith('0')) {
      const code = formattedDigits.slice(0, 3);
      const part1 = formattedDigits.slice(3, 6);
      const part2 = formattedDigits.slice(6, 8);
      const part3 = formattedDigits.slice(8, 10);
      return `+38 (${code}) ${part1} ${part2} ${part3}`;
    }
    return value;
  };

  const [branches, setBranches] = useState<Branch[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [performerZones, setPerformerZones] = useState<Map<string, PerformerDeliveryZone[]>>(new Map());
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [timezone, setTimezone] = useState<string>('UTC');
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
  const [manualBranchRouteInfo, setManualBranchRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [calculatingManualDistance, setCalculatingManualDistance] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const zonePolygonsRef = useRef<google.maps.Polygon[]>([]);

  const [courierZones, setCourierZones] = useState<CourierDeliveryZone[]>([]);
  const [minPickupOrderAmount, setMinPickupOrderAmount] = useState<number | null>(null);

  const [branchId, setBranchId] = useState(initialBranchId || '');
  const [addressLine, setAddressLine] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [intercom, setIntercom] = useState('');
  const [office, setOffice] = useState('');
  const [phone, setPhone] = useState(() => {
    if (initialPhone) {
      return formatInitialPhone(initialPhone);
    }
    return '';
  });
  const [commentEnabled, setCommentEnabled] = useState(false);
  const [comment, setComment] = useState('');
  const [orderItemsSummary, setOrderItemsSummary] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [courierId, setCourierId] = useState('search_courier');
  const [executorId, setExecutorId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [courierZoneId, setCourierZoneId] = useState('');
  const [autoDetectedCourierZone, setAutoDetectedCourierZone] = useState<CourierDeliveryZone | null>(null);
  const [manualCourierZoneSelection, setManualCourierZoneSelection] = useState(false);
  const [courierDeliveryPrice, setCourierDeliveryPrice] = useState<number | null>(null);
  const [scheduledType, setScheduledType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([
    { id: crypto.randomUUID(), methodId: '', amount: '', isPaid: false, cashGiven: '', billCounts: {} }
  ]);
  const [showParsingModal, setShowParsingModal] = useState(false);
  const [showPOSTerminal, setShowPOSTerminal] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [parsedOrderContent, setParsedOrderContent] = useState('');
  const [productModifierRules, setProductModifierRules] = useState<Map<number, any[]>>(new Map());
  const [clientName, setClientName] = useState('');
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [selectedClientData, setSelectedClientData] = useState<{
    client: any;
    addresses: any[];
    orderHistory: any[];
  } | null>(null);

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

  const addPaymentSplit = () => {
    setPaymentSplits(prev => [...prev, { id: crypto.randomUUID(), methodId: '', amount: '', isPaid: false, cashGiven: '', billCounts: {} }]);
  };

  const removePaymentSplit = (id: string) => {
    if (paymentSplits.length > 1) {
      setPaymentSplits(prev => prev.filter(s => s.id !== id));
    }
  };

  const updatePaymentSplit = (id: string, updates: Partial<PaymentSplit>) => {
    setPaymentSplits(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addBillToSplit = (splitId: string, bill: number) => {
    setPaymentSplits(prev => prev.map(s => {
      if (s.id !== splitId) return s;
      const newBillCounts = { ...s.billCounts, [bill]: (s.billCounts[bill] || 0) + 1 };
      const newCashGiven = Object.entries(newBillCounts).reduce((sum, [b, count]) => sum + (Number(b) * count), 0);
      return { ...s, billCounts: newBillCounts, cashGiven: newCashGiven > 0 ? String(newCashGiven) : '' };
    }));
  };

  const removeBillFromSplit = (splitId: string, bill: number) => {
    setPaymentSplits(prev => prev.map(s => {
      if (s.id !== splitId) return s;
      const newCount = (s.billCounts[bill] || 0) - 1;
      let newBillCounts: Record<number, number>;
      if (newCount <= 0) {
        const { [bill]: _, ...rest } = s.billCounts;
        newBillCounts = rest;
      } else {
        newBillCounts = { ...s.billCounts, [bill]: newCount };
      }
      const newCashGiven = Object.entries(newBillCounts).reduce((sum, [b, count]) => sum + (Number(b) * count), 0);
      return { ...s, billCounts: newBillCounts, cashGiven: newCashGiven > 0 ? String(newCashGiven) : '' };
    }));
  };

  const calculateSplitChange = (split: PaymentSplit, index: number) => {
    const amount = index === 0 ? getFirstSplitCalculatedAmount() : (parseFloat(split.amount) || 0);
    const cashGiven = parseFloat(split.cashGiven) || 0;
    return cashGiven - amount;
  };

  const getFirstSplitCalculatedAmount = () => {
    const total = parseFloat(totalAmount) || 0;
    const otherSplitsTotal = paymentSplits.slice(1).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    return Math.max(0, total - otherSplitsTotal);
  };

  const getTotalSplitsAmount = () => {
    if (paymentSplits.length === 1) {
      return parseFloat(totalAmount) || 0;
    }
    const firstAmount = getFirstSplitCalculatedAmount();
    const otherAmount = paymentSplits.slice(1).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    return firstAmount + otherAmount;
  };

  useEffect(() => {
    loadData();
  }, [partnerId]);

  useEffect(() => {
    if (initialBranchId && branches.length > 0) {
      setBranchId(initialBranchId);
    }
  }, [initialBranchId, branches]);

  useEffect(() => {
    if (initialOrderItems && initialOrderItems.length > 0) {
      const itemsWithTotalPrice = initialOrderItems.map(item => {
        const modifiersTotal = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
        const unitPrice = item.base_price + modifiersTotal;
        const total_price = unitPrice * item.quantity;

        return {
          id: crypto.randomUUID(),
          product_poster_id: item.product_poster_id,
          product_name: item.product_name,
          base_price: item.base_price,
          quantity: item.quantity,
          total_price,
          modifiers: item.modifiers.map(mod => ({
            modifier_poster_id: mod.modifier_poster_id,
            name: mod.modifier_name,
            price: mod.price,
            quantity: 1
          }))
        };
      });
      setOrderItems(itemsWithTotalPrice);
    }
  }, [initialOrderItems]);

  const loadData = async () => {
    try {
      const [shiftsRes, branchesRes, couriersRes, executorsRes, methodsRes, settingsRes, zonesRes, performerZonesRes, zonePolygonsRes] = await Promise.all([
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
          .from('executors')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('status', 'active'),
        supabase
          .from('payment_methods')
          .select('id, name, method_type')
          .eq('partner_id', partnerId)
          .eq('is_active', true),
        supabase
          .from('partner_settings')
          .select('timezone, google_maps_api_key, default_map_lat, default_map_lng, min_pickup_order_amount')
          .eq('partner_id', partnerId)
          .maybeSingle(),
        supabase
          .from('courier_delivery_zones')
          .select('*')
          .eq('partner_id', partnerId)
          .order('created_at'),
        supabase
          .from('performer_delivery_zones')
          .select('*')
          .eq('partner_id', partnerId)
          .order('created_at'),
        supabase
          .from('courier_zone_polygons')
          .select('*')
          .order('zone_id, display_order')
      ]);

      const openShiftBranchIds = shiftsRes.data?.map(s => s.branch_id) || [];
      const branchesWithOpenShifts = branchesRes.data?.filter(b => openShiftBranchIds.includes(b.id)) || [];

      setBranches(branchesWithOpenShifts);
      if (couriersRes.data) setCouriers(couriersRes.data);
      if (executorsRes.data) {
        setExecutors(executorsRes.data);
      }
      if (performerZonesRes.data) {
        const zonesMap = new Map<string, PerformerDeliveryZone[]>();
        for (const zone of performerZonesRes.data) {
          const existing = zonesMap.get(zone.performer_id) || [];
          existing.push(zone);
          zonesMap.set(zone.performer_id, existing);
        }
        setPerformerZones(zonesMap);
      }
      if (methodsRes.data) setPaymentMethods(methodsRes.data);
      if (settingsRes.data?.timezone) setTimezone(settingsRes.data.timezone);
      if (settingsRes.data?.google_maps_api_key) setGoogleMapsApiKey(settingsRes.data.google_maps_api_key);
      if (settingsRes.data?.default_map_lat && settingsRes.data?.default_map_lng) {
        setDefaultMapLat(settingsRes.data.default_map_lat);
        setDefaultMapLng(settingsRes.data.default_map_lng);
      }
      if (settingsRes.data?.min_pickup_order_amount) setMinPickupOrderAmount(settingsRes.data.min_pickup_order_amount);

      if (zonesRes.data && zonePolygonsRes.data) {
        const zonesWithPolygons = zonesRes.data.map(zone => ({
          ...zone,
          polygons: zonePolygonsRes.data
            .filter(p => p.zone_id === zone.id)
            .map(p => p.polygon)
        }));
        setCourierZones(zonesWithPolygons);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    if (googleMapsApiKey && defaultMapLat !== null && defaultMapLng !== null) {
      initializeMap();
    }
  }, [googleMapsApiKey, defaultMapLat, defaultMapLng]);

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

  const groupedCouriers = couriers.reduce((acc, courier) => {
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
      const { data: order } = await supabase
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
          executor_id,
          executor_zone_id,
          branch_id,
          distance_km,
          duration_minutes,
          payment_status,
          payment_breakdown,
          branches!inner(name, telegram_bot_token, telegram_chat_id, address, latitude, longitude),
          payment_methods(name, method_type)
        `)
        .eq('id', orderId)
        .single();

      if (!order) return;

      const branch = branches.find(b => b.id === order.branch_id);
      if (!branch?.telegram_chat_id || !branch?.telegram_bot_token) {
        return;
      }

      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

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

  const getNextOrderNumber = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-next-order-number`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ partnerId })
      });

      if (!response.ok) {
        throw new Error('Failed to get order number');
      }

      const data = await response.json();
      return data.orderNumber.toString();
    } catch (error) {
      console.error('Error getting order number:', error);
      throw error;
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

    if (parsedData.customer_name) {
      setClientName(parsedData.customer_name);
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
    } else if (parsedData.order_content) {
      setOrderItemsSummary(parsedData.order_content);
    }

    if (parsedData.payment_type_name || parsedData.payment_method) {
      const paymentName = parsedData.payment_type_name || parsedData.payment_method;
      const lowerPaymentName = paymentName.toLowerCase();

      let matchingPaymentMethod = paymentMethods.find(
        m => m.name.toLowerCase() === lowerPaymentName
      );

      if (!matchingPaymentMethod) {
        matchingPaymentMethod = paymentMethods.find(
          m => m.name.toLowerCase().includes(lowerPaymentName) ||
               lowerPaymentName.includes(m.name.toLowerCase())
        );
      }

      if (!matchingPaymentMethod) {
        if (lowerPaymentName.includes('налич') || lowerPaymentName.includes('готівк') || lowerPaymentName.includes('cash')) {
          matchingPaymentMethod = paymentMethods.find(m => m.method_type === 'cash');
        } else if (lowerPaymentName.includes('карт') || lowerPaymentName.includes('терминал') || lowerPaymentName.includes('card')) {
          matchingPaymentMethod = paymentMethods.find(m => m.method_type === 'cashless');
        }
      }

      if (matchingPaymentMethod) {
        setPaymentSplits([{ id: crypto.randomUUID(), methodId: matchingPaymentMethod.id, amount: '', isPaid: false, cashGiven: '', billCounts: {} }]);
      }
    }
  };

  const handlePOSTerminalSave = (items: any[], total: number) => {
    setOrderItems(items);

    const summary = items.map(item => {
      const modifiersText = item.modifiers.length > 0
        ? ` (${item.modifiers.map((m: any) => `${m.name} x${m.quantity}`).join(', ')})`
        : '';
      return `${item.product_name}${modifiersText} x${item.quantity}`;
    }).join(', ');

    setOrderItemsSummary(summary);
  };

  useEffect(() => {
    if (orderItems.length > 0) {
      const itemsTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

      let deliveryPrice = 0;
      if (deliveryType === 'delivery') {
        if (executorId && selectedZoneId) {
          const selectedZone = performerZones.get(executorId)?.find(z => z.id === selectedZoneId);
          if (selectedZone) {
            deliveryPrice = selectedZone.price_uah;
          }
        } else if (courierDeliveryPrice !== null) {
          if (autoDetectedCourierZone?.free_delivery_threshold && itemsTotal >= autoDetectedCourierZone.free_delivery_threshold) {
            deliveryPrice = 0;
          } else {
            deliveryPrice = courierDeliveryPrice;
          }
        }
      }

      const finalTotal = itemsTotal + deliveryPrice;
      setTotalAmount(finalTotal.toFixed(2));
    }
  }, [orderItems, executorId, selectedZoneId, courierDeliveryPrice, performerZones, deliveryType, autoDetectedCourierZone]);

  useEffect(() => {
    if (deliveryType === 'pickup' && branchId) {
      const selectedBranch = branches.find(b => b.id === branchId);
      if (selectedBranch && selectedBranch.address) {
        setAddressLine(selectedBranch.address);
      }
    }
  }, [deliveryType, branchId, branches]);

  const sendOrderToPoster = async (orderId: string, orderData: any) => {
    try {
      const { data: settings } = await supabase
        .from('partner_settings')
        .select('poster_account, poster_api_token')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (!settings?.poster_account || !settings?.poster_api_token) {
        await supabase
          .from('orders')
          .update({
            sent_to_poster: false,
            poster_error: 'Настройки Poster не указаны'
          })
          .eq('id', orderId);
        return;
      }

      const { data: branchRow, error: branchError } = await supabase
        .from('branches')
        .select('id, name, poster_spot_id, poster_spot_name, poster_spot_address')
        .eq('id', branchId)
        .maybeSingle();

      console.log('Загружен филиал для Poster:', {
        orderId,
        branchId,
        branchRow,
        poster_spot_id: branchRow?.poster_spot_id,
        poster_spot_name: branchRow?.poster_spot_name
      });

      if (!branchRow) {
        await supabase
          .from('orders')
          .update({
            sent_to_poster: false,
            poster_error: `Филиал не найден по branch_id ${branchId}`
          })
          .eq('id', orderId);
        alert('Заказ создан в CRM, но не отправлен в Poster — филиал не найден.');
        return;
      }

      if (!branchRow.poster_spot_id) {
        await supabase
          .from('orders')
          .update({
            sent_to_poster: false,
            poster_error: `У филиала "${branchRow.name}" не заполнен poster_spot_id`
          })
          .eq('id', orderId);
        alert(`Заказ создан в CRM, но не отправлен в Poster — у филиала "${branchRow.name}" не заполнен Poster spot_id.`);
        return;
      }

      const posterSpotId = branchRow.poster_spot_id;

      // Для доставки телефон обязателен, для самовыноса и в заведении — опционален
      if (!orderData.phone && orderData.delivery_type === 'delivery') {
        await supabase
          .from('orders')
          .update({
            sent_to_poster: false,
            poster_error: 'Не указан телефон клиента для Poster'
          })
          .eq('id', orderId);
        alert('Заказ создан в CRM, но не отправлен в Poster — не указан телефон клиента.');
        return;
      }

      let serviceMode = 1;
      if (deliveryType === 'delivery') {
        serviceMode = 3;
      } else if (deliveryType === 'pickup') {
        serviceMode = 2;
      }

      const products = orderItems
        .filter(item => item.product_poster_id)
        .map(item => {
          const productData: any = {
            product_id: item.product_poster_id,
            count: item.quantity,
          };
          if (item.modifiers && item.modifiers.length > 0) {
            productData.modification = item.modifiers.map((mod: any) => ({
              m: mod.modifier_poster_id,
              a: 1
            }));
          }
          return productData;
        });

      if (products.length === 0) {
        await supabase
          .from('orders')
          .update({
            sent_to_poster: false,
            poster_error: 'Список товаров для Poster пуст'
          })
          .eq('id', orderId);
        alert('Заказ создан в CRM, но не отправлен в Poster — список товаров пуст.');
        return;
      }

      const address2Parts = [
        entrance && `подъезд ${entrance}`,
        floor && `этаж ${floor}`,
        apartment && `кв. ${apartment}`,
        intercom && `домофон ${intercom}`,
        office && `офис ${office}`
      ].filter(Boolean).join(', ');

      const clientAddress = deliveryType === 'delivery' ? {
        address1: addressLine,
        address2: address2Parts || null,
        comment: comment || null,
        lat: deliveryLat,
        lng: deliveryLng
      } : null;

      let orderComment = '';
      if (deliveryType === 'delivery') {
        orderComment = `Доставка. Адрес: ${addressLine}.`;
        if (address2Parts) orderComment += ` Дополнительно: ${address2Parts}.`;
        if (comment) orderComment += ` Комментарий клиента: ${comment}.`;
        orderComment += ` ID заказа CRM: ${orderData.order_number}.`;
      } else if (deliveryType === 'pickup') {
        orderComment = `Самовывоз.`;
        if (comment) orderComment += ` Комментарий клиента: ${comment}.`;
        orderComment += ` ID заказа CRM: ${orderData.order_number}.`;
      } else {
        orderComment = `В заведении.`;
        if (comment) orderComment += ` Комментарий клиента: ${comment}.`;
        orderComment += ` ID заказа CRM: ${orderData.order_number}.`;
      }

      const posterOrderData: any = {
        spot_id: posterSpotId,
        service_mode: serviceMode,
        comment: orderComment,
        products: products,
        branch_id: branchId
      };

      if (orderData.phone) {
        posterOrderData.phone = orderData.phone;
      }

      if (clientAddress) {
        posterOrderData.client_address = clientAddress;
      }

      if (serviceMode === 3 && orderData.delivery_price_uah !== null && orderData.delivery_price_uah !== undefined) {
        const deliveryPriceInCents = Math.max(0, Math.round((orderData.delivery_price_uah || 0) * 100));
        posterOrderData.delivery_price = deliveryPriceInCents;
        console.log('🚚 Добавление стоимости доставки в Poster заказ:', {
          original_price_uah: orderData.delivery_price_uah,
          converted_price_cents: deliveryPriceInCents,
          service_mode: serviceMode
        });
      }

      const payloadForFunction = {
        poster_account: settings.poster_account,
        poster_api_token: settings.poster_api_token,
        order_data: posterOrderData
      };

      console.log('Отправка заказа в Poster через функцию:', {
        orderId,
        branchId,
        branchName: branchRow.name,
        posterSpotId,
        posterSpotName: branchRow.poster_spot_name,
        serviceMode,
        productsCount: products.length,
        payloadForFunction
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poster-create-order`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payloadForFunction)
        }
      );

      console.log('Ответ от Edge Function:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка Supabase функции poster-create-order:', response.status, errorText);

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            sent_to_poster: false,
            poster_error: `Edge Function error (${response.status}): ${errorText}`
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Ошибка при обновлении orders:', updateError);
        }

        alert(`Заказ создан в CRM, но не отправлен в Poster: Edge Function вернула ошибку ${response.status}`);
        return;
      }

      const responseData = await response.json();
      console.log('Данные ответа от Edge Function:', responseData);

      if (responseData?.response?.incoming_order_id) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            sent_to_poster: true,
            poster_order_id: String(responseData.response.incoming_order_id),
            poster_status: responseData.response.status !== undefined ? String(responseData.response.status) : 'created',
            poster_error: null
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Ошибка при обновлении orders после успеха:', updateError);
          alert('Заказ отправлен в Poster, но не удалось обновить статус в CRM.');
        } else {
          alert('Заказ успешно отправлен в Poster.');
        }
      } else {
        const errorMessage = responseData.error || JSON.stringify(responseData);
        console.error('Edge Function вернула ответ без incoming_order_id:', responseData);

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            sent_to_poster: false,
            poster_error: errorMessage
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Ошибка при обновлении orders после ошибки:', updateError);
        }

        alert(`Заказ создан в CRM, но не отправлен в Poster: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Ошибка при отправке заказа в Poster:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          sent_to_poster: false,
          poster_error: errorMessage
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Ошибка при обновлении orders в catch:', updateError);
      }

      alert(`Заказ создан в CRM, но не отправлен в Poster: ${errorMessage}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      alert('Выберите филиал');
      return;
    }

    if (deliveryType === 'delivery' && (!phone || !isPhoneValid(phone))) {
      alert('Введите корректный номер телефона в формате +380XXXXXXXXX');
      return;
    }

    if (phone && !isPhoneValid(phone)) {
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

    if (executorId && performerZones.get(executorId)?.length) {
      if (!selectedZoneId) {
        const executor = executors.find(e => e.id === executorId);
        alert(executor?.no_zone_message || 'Выберите зону доставки для исполнителя');
        return;
      }
    }

    setLoading(true);

    try {
      const { data: activeShift } = await supabase
        .from('shifts')
        .select('id, total_orders_count')
        .eq('partner_id', partnerId)
        .eq('branch_id', branchId)
        .eq('status', 'open')
        .maybeSingle();

      if (!activeShift) {
        alert('Нет открытой смены для выбранного филиала. Откройте смену перед созданием заказа.');
        setLoading(false);
        return;
      }

      const orderNumber = await getNextOrderNumber();
      const shiftOrderNumber = activeShift.total_orders_count + 1;
      const firstSplit = paymentSplits[0];
      const selectedPaymentMethod = paymentMethods.find(m => m.id === firstSplit?.methodId);

      let distanceKm: number | null = null;
      let durationMinutes: number | null = null;

      const isNearestBranchSelected = nearestBranch && branchId === nearestBranch.id;
      const activeRouteInfo = isNearestBranchSelected ? routeInfo : manualBranchRouteInfo;

      if (activeRouteInfo) {
        const distanceMatch = activeRouteInfo.distance.match(/[\d,.]+/);
        const durationMatch = activeRouteInfo.duration.match(/\d+/);

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

      let deliveryPriceUah: number | null = null;
      let deliveryPriceManual = false;
      let selectedCourierZoneId: string | null = null;

      if (executorId && selectedZoneId) {
        const selectedZone = performerZones.get(executorId)?.find(z => z.id === selectedZoneId);
        if (selectedZone) {
          deliveryPriceUah = selectedZone.price_uah;
        }
      } else if (courierDeliveryPrice !== null) {
        const itemsTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
        if (autoDetectedCourierZone?.free_delivery_threshold && itemsTotal >= autoDetectedCourierZone.free_delivery_threshold) {
          deliveryPriceUah = 0;
        } else {
          deliveryPriceUah = courierDeliveryPrice;
        }
        deliveryPriceManual = manualCourierZoneSelection;
        if (manualCourierZoneSelection && courierZoneId) {
          selectedCourierZoneId = courierZoneId;
        } else if (autoDetectedCourierZone?.id) {
          selectedCourierZoneId = autoDetectedCourierZone.id;
        }
      }

      const orderData: any = {
        partner_id: partnerId,
        branch_id: branchId,
        shift_id: activeShift.id,
        shift_order_number: shiftOrderNumber,
        order_number: orderNumber,
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
        executor_type: executorId ? 'performer' : null,
        executor_id: executorId || null,
        executor_zone_id: selectedZoneId || null,
        delivery_price_uah: deliveryPriceUah,
        delivery_price_manual: deliveryPriceManual,
        courier_zone_id: selectedCourierZoneId,
        total_amount: parseFloat(totalAmount) || 0,
        payment_method_id: firstSplit?.methodId || null,
        payment_status: selectedPaymentMethod?.method_type === 'cashless' ? (firstSplit?.isPaid ? 'paid' : 'unpaid') : null,
        cash_amount: selectedPaymentMethod?.method_type === 'cash' && firstSplit?.cashGiven ? parseFloat(firstSplit.cashGiven) : null,
        payment_breakdown: paymentSplits.filter(s => s.methodId).map((s) => {
          const method = paymentMethods.find(m => m.id === s.methodId);
          const originalIndex = paymentSplits.indexOf(s);
          const amount = originalIndex === 0 ? getFirstSplitCalculatedAmount() : (parseFloat(s.amount) || 0);
          return {
            method_id: s.methodId,
            method_name: method?.name || '',
            method_type: method?.method_type || 'cash',
            amount: amount,
            status: method?.method_type === 'cashless' ? (s.isPaid ? 'paid' : 'unpaid') : null,
            cash_given: method?.method_type === 'cash' && s.cashGiven ? parseFloat(s.cashGiven) : null
          };
        }),
        source: initialSourceCallId ? 'binotel' : 'manual',
        source_call_id: initialSourceCallId || null,
        status: 'in_progress',
        accepted_at: new Date().toISOString(),
        extra_time_minutes: 0,
        total_time_minutes: 0,
        distance_km: distanceKm,
        duration_minutes: durationMinutes,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng
      };

      if (scheduledType === 'scheduled' && scheduledDate && scheduledTime) {
        const localDateTimeString = `${scheduledDate}T${scheduledTime}:00`;
        const localDate = new Date(localDateTimeString);
        orderData.scheduled_at = localDate.toISOString();
      }

      const { data: insertedOrder, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select(`
          *,
          branches(name),
          payment_methods(name, method_type),
          couriers(id, name, lastname, telegram_user_id, vehicle_type)
        `)
        .single();

      if (error) throw error;

      if (orderItems.length > 0 && insertedOrder) {
        const orderItemsData = orderItems.map(item => ({
          order_id: insertedOrder.id,
          product_poster_id: item.product_poster_id,
          product_name: item.product_name,
          base_price: item.base_price,
          modifiers: item.modifiers,
          quantity: item.quantity,
          total_price: item.total_price
        }));

        await supabase.from('order_items').insert(orderItemsData);
      }

      if (insertedOrder) {
        console.log('📞 Creating/updating client for order:', {
          orderId: insertedOrder.id,
          phone: phone,
          clientName: clientName,
          orderItemsCount: orderItems.length
        });

        const clientId = await saveOrUpdateClient(partnerId, {
          id: insertedOrder.id,
          order_number: orderNumber,
          phone: getNormalizedPhone(phone),
          address_line: addressLine,
          floor: floor || null,
          apartment: apartment || null,
          entrance: entrance || null,
          intercom: intercom || null,
          office: office || null,
          total_amount: parseFloat(totalAmount) || 0,
          delivery_type: deliveryType,
          delivery_lat: deliveryLat,
          delivery_lng: deliveryLng
        }, orderItems, clientName);

        if (clientId) {
          console.log('✅ Client ID received, saving address and history:', clientId);
          await saveClientAddress(clientId, {
            id: insertedOrder.id,
            order_number: orderNumber,
            phone: getNormalizedPhone(phone),
            address_line: addressLine,
            floor: floor || null,
            apartment: apartment || null,
            entrance: entrance || null,
            intercom: intercom || null,
            office: office || null,
            total_amount: parseFloat(totalAmount) || 0,
            delivery_type: deliveryType,
            delivery_lat: deliveryLat,
            delivery_lng: deliveryLng
          });

          await saveOrderHistory(clientId, {
            id: insertedOrder.id,
            order_number: orderNumber,
            phone: phone,
            address_line: addressLine,
            floor: floor || null,
            apartment: apartment || null,
            entrance: entrance || null,
            intercom: intercom || null,
            office: office || null,
            total_amount: parseFloat(totalAmount) || 0,
            delivery_type: deliveryType,
            delivery_lat: deliveryLat,
            delivery_lng: deliveryLng
          }, orderItems);
          console.log('✅ Client data saved successfully');
        } else {
          console.warn('⚠️ Client ID is null, skipping address and history save');
        }
      }

      if (deliveryType === 'delivery' && insertedOrder) {
        if (courierId === 'search_courier') {
          await sendTelegramNotification(insertedOrder.id);
        } else if (finalCourierId) {
          await sendCourierDirectMessage(insertedOrder);
        }
      }

      if (insertedOrder) {
        await sendOrderToPoster(insertedOrder.id, orderData);
      }

      onSuccess?.();
      onOrderCreated?.();
      onClose();
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Ошибка при создании заказа');
    } finally {
      setLoading(false);
    }
  };

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
          initialItems={orderItems}
          onClose={() => setShowPOSTerminal(false)}
          onSave={handlePOSTerminalSave}
          freeDeliveryThreshold={autoDetectedCourierZone?.free_delivery_threshold || null}
          minOrderAmount={autoDetectedCourierZone?.min_order_amount || null}
          deliveryType={deliveryType}
        />
      )}

      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Создать заказ
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form id="create-order-form" onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
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


          {branchId && nearestBranch && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Navigation className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Ближайший филиал: {nearestBranch.name}
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

          {branchId && nearestBranch && branchId !== nearestBranch.id && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Выбранный филиал: {branches.find(b => b.id === branchId)?.name}
                  </p>
                  {calculatingManualDistance && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <p className="text-sm text-amber-700 font-medium">
                        Расчёт расстояния...
                      </p>
                    </div>
                  )}
                  {!calculatingManualDistance && manualBranchRouteInfo && (
                    <p className="text-lg font-bold text-amber-700 mt-1">
                      Расстояние: {manualBranchRouteInfo.distance} • Время: {manualBranchRouteInfo.duration}
                    </p>
                  )}
                  {!calculatingManualDistance && !manualBranchRouteInfo && (
                    <p className="text-sm text-gray-600 mt-1">
                      Не удалось рассчитать расстояние
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {deliveryType === 'delivery' && courierId && courierId !== 'no_courier' && courierZones.length > 0 && (
            <div>
              {!manualCourierZoneSelection ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
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
                    <label className="block text-sm font-semibold text-gray-700">
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <h3 className="font-semibold text-gray-900">Данные клиента и адрес</h3>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Филиал <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={async (e) => {
                  const selectedBranchId = e.target.value;
                  setBranchId(selectedBranchId);
                  const selectedBranch = branches.find(b => b.id === selectedBranchId);
                  if (selectedBranch) {
                    setBranchLat(selectedBranch.latitude || null);
                    setBranchLng(selectedBranch.longitude || null);

                    if (
                      nearestBranch &&
                      selectedBranchId !== nearestBranch.id &&
                      deliveryLat !== null &&
                      deliveryLng !== null &&
                      selectedBranch.latitude &&
                      selectedBranch.longitude &&
                      googleMapsApiKey
                    ) {
                      setCalculatingManualDistance(true);
                      const manualRouteInfo = await calculateRouteDistance(
                        selectedBranch.latitude,
                        selectedBranch.longitude,
                        deliveryLat,
                        deliveryLng,
                        googleMapsApiKey
                      );
                      setManualBranchRouteInfo(manualRouteInfo);
                      setCalculatingManualDistance(false);
                    } else {
                      setManualBranchRouteInfo(null);
                    }
                  } else {
                    setBranchLat(null);
                    setBranchLng(null);
                    setManualBranchRouteInfo(null);
                  }
                }}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  placeholder="Город, Улица, № дома"
                  required
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleFindAddress}
                  disabled={geocoding || !googleMapsApiKey}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                  title={!googleMapsApiKey ? 'Google Maps API не настроен' : 'Найти адрес на карте'}
                >
                  <Search className="w-5 h-5" />
                  {geocoding ? 'Поиск...' : 'Найти'}
                </button>
              </div>
            </div>

            {googleMapsApiKey && defaultMapLat !== null && defaultMapLng !== null && (
              <div className="mt-3">
                <div
                  ref={mapRef}
                  className="w-full h-80 bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                />

                <p className="text-xs text-gray-500 mt-2">
                  Кликните на карту или перетащите маркер для точного указания адреса доставки
                </p>
              </div>
            )}

            {!googleMapsApiKey && (
              <p className="mt-2 text-sm text-amber-600">
                Google Maps API не настроен. Перейдите в Настройки → Общие
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Этаж</label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Квартира</label>
                <input
                  type="text"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Парадная</label>
                <input
                  type="text"
                  value={entrance}
                  onChange={(e) => setEntrance(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Домофон</label>
                <input
                  type="text"
                  value={intercom}
                  onChange={(e) => setIntercom(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Офис</label>
                <input
                  type="text"
                  value={office}
                  onChange={(e) => setOffice(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Номер телефона {deliveryType === 'delivery' && <span className="text-red-500">*</span>}
                {deliveryType === 'pickup' && <span className="text-gray-500">(опционально)</span>}
              </label>
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
                required={deliveryType === 'delivery'}
                placeholder="0671234567 (формат: +38 (067) 123 45 67)"
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent transition-colors ${
                  phone && !isPhoneValid(phone)
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {phone && !isPhoneValid(phone) && (
                <p className="mt-1 text-sm text-red-600">
                  Телефон должен содержать 10 или 12 цифр
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Имя клиента (опционально)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Имя Фамилия"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              <p className="mt-1 text-xs text-gray-500">
                Используется для нового клиента
              </p>
            </div>
          </div>

          {phone && isPhoneValid(phone) && (
            <div className="mt-4">
              <ClientProfileCard
                phone={phone}
                partnerId={partnerId}
                onSelectAddress={(address) => {
                  setAddressLine(address.address_text);
                  if (address.floor) setFloor(address.floor);
                  if (address.apartment) setApartment(address.apartment);
                  if (address.entrance) setEntrance(address.entrance);
                  if (address.intercom) setIntercom(address.intercom);
                  if (address.office) setOffice(address.office);
                  if (address.lat && address.lng) {
                    setDeliveryLat(address.lat);
                    setDeliveryLng(address.lng);
                    handleFindOnMap();
                  }
                }}
                onSelectOrder={(orderData) => {
                  if (orderData.items && Array.isArray(orderData.items)) {
                    setOrderItems(orderData.items);
                  }
                  if (orderData.address) setAddressLine(orderData.address);
                  if (orderData.floor) setFloor(orderData.floor);
                  if (orderData.apartment) setApartment(orderData.apartment);
                  if (orderData.entrance) setEntrance(orderData.entrance);
                  if (orderData.intercom) setIntercom(orderData.intercom);
                  if (orderData.office) setOffice(orderData.office);
                }}
                onViewClientDetails={(client, addresses, orderHistory) => {
                  setSelectedClientData({ client, addresses, orderHistory });
                  setShowClientDetails(true);
                }}
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={commentEnabled}
                onChange={(e) => setCommentEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-gray-700">Комментарий к заказу</span>
            </label>
            {commentEnabled && (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите комментарий..."
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Содержание заказа <span className="text-red-500">*</span>
            </label>

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
                      onClick={() => {
                        setOrderItems([]);
                        setOrderItemsSummary('');
                        setTotalAmount('');
                      }}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {orderItems.map((item, index) => {
                    const unitPrice = item.total_price / item.quantity;
                    const lineTotal = item.total_price;
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
                            <div className="text-sm text-gray-600 mt-1">
                              {unitPrice.toFixed(2)} грн x {item.quantity} = {lineTotal.toFixed(2)} грн
                            </div>
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
                      {orderItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)} грн
                    </span>
                  </div>
                  {(() => {
                    let deliveryPrice = 0;
                    const itemsTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

                    if (deliveryType === 'delivery') {
                      if (executorId && selectedZoneId) {
                        const selectedZone = performerZones.get(executorId)?.find(z => z.id === selectedZoneId);
                        if (selectedZone) {
                          deliveryPrice = selectedZone.price_uah;
                        }
                      } else if (courierDeliveryPrice !== null) {
                        if (autoDetectedCourierZone?.free_delivery_threshold && itemsTotal >= autoDetectedCourierZone.free_delivery_threshold) {
                          deliveryPrice = 0;
                        } else {
                          deliveryPrice = courierDeliveryPrice;
                        }
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
                            {orderItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)} грн
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
              rows={4}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Опишите содержание заказа..."
            />
          </div>


          {deliveryType === 'delivery' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Курьер
                </label>
                <select
                  value={courierId}
                  onChange={(e) => {
                    setCourierId(e.target.value);
                    setCourierZoneId('');
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="no_courier">🚫 Без курьера</option>
                  <option value="search_courier">🔍 Найти курьера</option>
                  {Object.entries(groupedCouriers).map(([branchId, group]) => (
                    <optgroup key={branchId} label={group.branchName}>
                      {group.couriers.map(courier => (
                        <option key={courier.id} value={courier.id}>
                          {courier.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {couriers.length === 0 && (
                  <p className="text-sm text-orange-600 mt-1">Нет доступных курьеров</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Исполнитель
                </label>
                <select
                  value={executorId}
                  onChange={(e) => {
                    const selectedExecutorId = e.target.value;
                    setExecutorId(selectedExecutorId);
                    setSelectedZoneId('');

                    if (selectedExecutorId) {
                      const selectedExecutor = executors.find(ex => ex.id === selectedExecutorId);
                      if (selectedExecutor?.default_payment_method_id) {
                        setPaymentSplits(prev => {
                          const [firstSplit, ...rest] = prev;
                          return [{ ...firstSplit, methodId: selectedExecutor.default_payment_method_id }, ...rest];
                        });
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Не выбран</option>
                  {executors.map(executor => (
                    <option key={executor.id} value={executor.id}>
                      {executor.name}
                    </option>
                  ))}
                </select>
              </div>

              {executorId && performerZones.get(executorId) && performerZones.get(executorId)!.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Зона доставки
                  </label>
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Выберите зону</option>
                    {performerZones.get(executorId)!.map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} - {zone.price_uah} грн
                      </option>
                    ))}
                  </select>
                  {selectedZoneId && performerZones.get(executorId)?.find(z => z.id === selectedZoneId) && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-900">
                        💰 Цена доставки исполнителя: <span className="text-lg font-bold">{performerZones.get(executorId)?.find(z => z.id === selectedZoneId)?.price_uah} грн</span>
                      </p>
                    </div>
                  )}
                  {!selectedZoneId && (
                    <p className="text-sm text-orange-600 mt-1">
                      {executors.find(e => e.id === executorId)?.no_zone_message || 'Выберите зону доставки'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Время выполнения</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="now"
                  checked={scheduledType === 'now'}
                  onChange={(e) => setScheduledType(e.target.value as 'now')}
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-700">Сейчас</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="scheduled"
                  checked={scheduledType === 'scheduled'}
                  onChange={(e) => setScheduledType(e.target.value as 'scheduled')}
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-700">На время</span>
              </label>
            </div>

            {scheduledType === 'scheduled' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Дата</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required={scheduledType === 'scheduled'}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Время</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    required={scheduledType === 'scheduled'}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Общая сумма <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {orderItems.length > 0 && (() => {
                const itemsTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
                let deliveryPrice = 0;
                if (deliveryType === 'delivery') {
                  if (executorId && selectedZoneId) {
                    const selectedZone = performerZones.get(executorId)?.find(z => z.id === selectedZoneId);
                    if (selectedZone) {
                      deliveryPrice = selectedZone.price_uah;
                    }
                  } else if (courierDeliveryPrice !== null) {
                    deliveryPrice = courierDeliveryPrice;
                  }
                }

                if (deliveryPrice > 0) {
                  return (
                    <p className="mt-1 text-xs text-blue-600">
                      Товары: {itemsTotal.toFixed(2)} грн + Доставка: {deliveryPrice.toFixed(2)} грн
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">Оплата</label>
              <button
                type="button"
                onClick={addPaymentSplit}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                + Добавить счет
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {paymentSplits.map((split, index) => {
              const method = paymentMethods.find(m => m.id === split.methodId);
              return (
                <div key={split.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Счет {index + 1}</span>
                    {paymentSplits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePaymentSplit(split.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold"
                      >
                        Удалить
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Тип оплаты</label>
                      <select
                        value={split.methodId}
                        onChange={(e) => updatePaymentSplit(split.id, { methodId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Выберите</option>
                        {paymentMethods.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Сумма</label>
                      {index === 0 ? (
                        <div className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700">
                          {getFirstSplitCalculatedAmount().toFixed(2)} грн
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={split.amount}
                          onChange={(e) => updatePaymentSplit(split.id, { amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      )}
                    </div>
                  </div>

                  {method?.method_type === 'cashless' && (
                    <div>
                      <button
                        type="button"
                        onClick={() => updatePaymentSplit(split.id, { isPaid: !split.isPaid })}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          split.isPaid
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                        }`}
                      >
                        {split.isPaid ? 'Оплачено' : 'Не оплачено'}
                      </button>
                    </div>
                  )}

                  {method?.method_type === 'cash' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">С какой суммы сдача</label>
                        <input
                          type="number"
                          value={split.cashGiven}
                          onChange={(e) => updatePaymentSplit(split.id, { cashGiven: e.target.value, billCounts: {} })}
                          placeholder="Введите сумму"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-5 gap-1">
                        {bills.map(bill => (
                          <div key={bill} className="relative">
                            <button
                              type="button"
                              onClick={() => addBillToSplit(split.id, bill)}
                              className="w-full aspect-[3/2] bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border border-green-300 rounded transition-all flex items-center justify-center font-semibold text-green-800 text-xs shadow-sm hover:shadow relative"
                            >
                              {bill}
                              {split.billCounts[bill] > 0 && (
                                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
                                  {split.billCounts[bill]}
                                </span>
                              )}
                            </button>
                            {split.billCounts[bill] > 0 && (
                              <button
                                type="button"
                                onClick={() => removeBillFromSplit(split.id, bill)}
                                className="absolute -bottom-1 -left-1 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow transition-colors"
                              >
                                -
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {split.cashGiven && parseFloat(split.cashGiven) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-200">
                            <span className="text-xs text-gray-700">От клиента:</span>
                            <span className="text-xs font-semibold text-blue-700">{split.cashGiven} грн</span>
                          </div>
                          {calculateSplitChange(split, index) >= 0 ? (
                            <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                              <span className="text-xs text-gray-700">Сдача:</span>
                              <span className="text-xs font-semibold text-green-700">{calculateSplitChange(split, index).toFixed(2)} грн</span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-200">
                              <span className="text-xs text-gray-700">Недостаточно:</span>
                              <span className="text-xs font-semibold text-red-700">{Math.abs(calculateSplitChange(split, index)).toFixed(2)} грн</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {paymentSplits.length > 1 && (
              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Общая сумма счетов:</span>
                  <span className="font-semibold text-gray-900">{getTotalSplitsAmount().toFixed(2)} грн</span>
                </div>
              </div>
            )}
          </div>

        </form>

        <div className="flex gap-3 px-6 py-4 border-t bg-white rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            Отмена
          </button>
          <button
            type="submit"
            form="create-order-form"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Создание...' : 'Создать заказ'}
          </button>
          </div>
        </div>
      </div>

      {showClientDetails && selectedClientData && (
        <ClientDetailsModal
          client={selectedClientData.client}
          addresses={selectedClientData.addresses}
          orderHistory={selectedClientData.orderHistory}
          onClose={() => {
            setShowClientDetails(false);
            setSelectedClientData(null);
          }}
        />
      )}
    </>
  );
}
