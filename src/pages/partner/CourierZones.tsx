import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CourierDeliveryZone, CourierZonePolygon, PartnerSettings } from '../../types';
import { MapPin, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Layers, Download } from 'lucide-react';
import { loadGoogleMapsScript } from '../../lib/googleMapsLoader';

const DEFAULT_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316'
];

export default function CourierZones() {
  const { partner } = useAuth();
  const [zones, setZones] = useState<CourierDeliveryZone[]>([]);
  const [settings, setSettings] = useState<PartnerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<google.maps.LatLng[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<CourierDeliveryZone | null>(null);
  const [addingPolygonToZone, setAddingPolygonToZone] = useState<CourierDeliveryZone | null>(null);
  const [editingPolygonId, setEditingPolygonId] = useState<string | null>(null);
  const [hiddenZones, setHiddenZones] = useState<Set<string>>(new Set());
  const [courierNoZoneMessage, setCourierNoZoneMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    price_uah: 0,
    courier_payment: 0,
    free_delivery_threshold: null as number | null,
    min_order_amount: null as number | null
  });

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const drawingPolygonRef = useRef<google.maps.Polygon | null>(null);
  const polygonsRef = useRef<Map<string, google.maps.Polygon[]>>(new Map());

  useEffect(() => {
    if (partner) {
      loadData();
    } else {
      setLoading(false);
      setSettings({ partner_id: '' } as PartnerSettings);
    }
  }, [partner]);

  const loadData = async () => {
    if (!partner) {
      setLoading(false);
      setInitialLoad(false);
      setSettings({ partner_id: '' } as PartnerSettings);
      return;
    }

    if (initialLoad) {
      setLoading(true);
    }

    try {
      console.log('[CourierZones] Loading data for partner:', partner.id);

      const { data: settingsData, error: settingsError } = await supabase
        .from('partner_settings')
        .select('*')
        .eq('partner_id', partner.id)
        .maybeSingle();

      console.log('[CourierZones] Settings loaded:', { settingsData, settingsError, hasApiKey: !!settingsData?.google_maps_api_key });

      if (settingsError) {
        console.error('Error loading partner settings:', settingsError);
      }

      if (settingsData) {
        setSettings(settingsData);
        setCourierNoZoneMessage(settingsData.courier_no_zone_message || 'Адрес доставки вне зоны обслуживания курьеров');
      } else {
        console.warn('[CourierZones] No settings found for partner, creating placeholder');
        setSettings({ partner_id: partner.id } as PartnerSettings);
      }

      const { data: zonesData } = await supabase
        .from('courier_delivery_zones')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: true });

      if (zonesData) {
        const zoneIds = zonesData.map(z => z.id);
        let polygonsData: any[] = [];

        if (zoneIds.length > 0) {
          const { data } = await supabase
            .from('courier_zone_polygons')
            .select('*')
            .in('zone_id', zoneIds)
            .order('display_order', { ascending: true });
          polygonsData = data || [];
        }

        const zonesWithPolygons = zonesData.map(zone => ({
          ...zone,
          polygons: polygonsData.filter(p => p.zone_id === zone.id) || []
        }));

        setZones(zonesWithPolygons);
      }

      setLoading(false);
      setInitialLoad(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setSettings({ partner_id: partner?.id || '' } as PartnerSettings);
      setLoading(false);
      setInitialLoad(false);
    }
  };

  const initializeMap = useCallback(async () => {
    if (!settings?.google_maps_api_key || !mapRef.current || mapInstanceRef.current) return;

    try {
      await loadGoogleMapsScript(settings.google_maps_api_key);

      let center = {
        lat: settings.default_map_lat || 50.4501,
        lng: settings.default_map_lng || 30.5234
      };

      // Fallback: если координаты не заданы, берем из первого филиала
      if (!settings.default_map_lat || !settings.default_map_lng) {
        if (partner) {
          const { data: branches } = await supabase
            .from('branches')
            .select('id, name, latitude, longitude')
            .eq('partner_id', partner.id)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: true })
            .limit(1);

          if (branches && branches.length > 0 && branches[0].latitude && branches[0].longitude) {
            center = {
              lat: branches[0].latitude,
              lng: branches[0].longitude
            };

            console.log(`[CourierZones] Using branch "${branches[0].name}" as map center:`, center);
          }
        }
      }

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
      });

      mapInstanceRef.current = map;
      setMapReady(true);

      // Добавим маркер для центра карты (если это филиал)
      if (!settings.default_map_lat || !settings.default_map_lng) {
        new google.maps.Marker({
          position: center,
          map: map,
          title: 'Филиал',
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%233B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32)
          }
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [settings?.google_maps_api_key, settings?.default_map_lat, settings?.default_map_lng, partner]);

  const renderZones = useCallback(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    polygonsRef.current.forEach(polygons => {
      polygons.forEach(polygon => polygon.setMap(null));
    });
    polygonsRef.current.clear();

    zones.forEach(zone => {
      if (hiddenZones.has(zone.id) || !zone.polygons) return;

      const zonePolygons: google.maps.Polygon[] = [];

      zone.polygons.forEach(poly => {
        const polygon = new google.maps.Polygon({
          paths: poly.polygon,
          strokeColor: zone.color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: zone.color,
          fillOpacity: 0.2,
          map: mapInstanceRef.current
        });

        zonePolygons.push(polygon);
      });

      polygonsRef.current.set(zone.id, zonePolygons);
    });

    if ((isDrawing || addingPolygonToZone || editingPolygonId) && currentPath.length > 0) {
      if (drawingPolygonRef.current) {
        drawingPolygonRef.current.setMap(null);
      }

      const color = addingPolygonToZone ? addingPolygonToZone.color : formData.color;

      const polygon = new google.maps.Polygon({
        paths: currentPath,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillColor: color,
        fillOpacity: 0.35,
        map: mapInstanceRef.current,
        editable: true,
        draggable: false
      });

      drawingPolygonRef.current = polygon;

      const updatePath = () => {
        const path = polygon.getPath();
        const newPath: google.maps.LatLng[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          newPath.push(path.getAt(i));
        }
        setCurrentPath(newPath);
      };

      polygon.getPath().addListener('set_at', updatePath);
      polygon.getPath().addListener('insert_at', updatePath);
      polygon.getPath().addListener('remove_at', updatePath);
    }
  }, [zones, hiddenZones, mapReady, isDrawing, addingPolygonToZone, editingPolygonId, currentPath, formData.color]);

  useEffect(() => {
    if (settings?.google_maps_api_key && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [settings?.google_maps_api_key, initializeMap]);

  useEffect(() => {
    renderZones();
  }, [renderZones]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if ((!isDrawing && !addingPolygonToZone && !editingPolygonId) || !e.latLng) {
      return;
    }

    const newPath = [...currentPath, e.latLng];
    setCurrentPath(newPath);
  }, [isDrawing, addingPolygonToZone, editingPolygonId, currentPath]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const listener = map.addListener('click', handleMapClick);
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [handleMapClick]);

  const completePolygon = () => {
    if (!drawingPolygonRef.current) return;

    const path = drawingPolygonRef.current.getPath();
    if (path.getLength() < 3) {
      alert('Нужно минимум 3 точки для создания зоны');
      return;
    }

    const finalPath: google.maps.LatLng[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      finalPath.push(path.getAt(i));
    }
    setCurrentPath(finalPath);
    setShowForm(true);
  };

  const cancelDrawing = () => {
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null);
      drawingPolygonRef.current = null;
    }
    setIsDrawing(false);
    setAddingPolygonToZone(null);
    setEditingPolygonId(null);
    setCurrentPath([]);
    setShowForm(false);
    setFormData({
      name: '',
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      price_uah: 0,
      courier_payment: 0,
      free_delivery_threshold: null,
      min_order_amount: null
    });
  };

  const startDrawing = () => {
    setIsDrawing(true);
    setShowForm(false);
    setCurrentPath([]);
    setFormData({
      name: '',
      color: '#3B82F6',
      price_uah: 0,
      courier_payment: 0,
      free_delivery_threshold: null,
      min_order_amount: null
    });
  };

  const saveZone = async () => {
    if (!partner || currentPath.length < 3) return;

    const polygon = currentPath.map(p => ({ lat: p.lat(), lng: p.lng() }));

    try {
      const { data: zoneData, error: zoneError } = await supabase
        .from('courier_delivery_zones')
        .insert({
          partner_id: partner.id,
          name: formData.name,
          color: formData.color,
          price_uah: formData.price_uah,
          courier_payment: formData.courier_payment,
          free_delivery_threshold: formData.free_delivery_threshold,
          min_order_amount: formData.min_order_amount
        })
        .select()
        .single();

      if (zoneError) throw zoneError;

      const { error: polygonError } = await supabase
        .from('courier_zone_polygons')
        .insert({
          zone_id: zoneData.id,
          polygon,
          display_order: 0
        });

      if (polygonError) throw polygonError;

      cancelDrawing();
      loadData();
    } catch (error) {
      console.error('Error saving zone:', error);
      alert('Ошибка при сохранении зоны');
    }
  };

  const deleteZone = async (id: string) => {
    if (!confirm('Удалить эту зону доставки со всеми её полигонами?')) return;

    try {
      const { error } = await supabase
        .from('courier_delivery_zones')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadData();
    } catch (error) {
      console.error('Error deleting zone:', error);
      alert('Ошибка при удалении зоны');
    }
  };

  const deletePolygon = async (zone: CourierDeliveryZone, polygonId: string) => {
    if (!zone.polygons || zone.polygons.length <= 1) {
      alert('Нельзя удалить последний полигон. Удалите всю зону.');
      return;
    }

    if (!confirm('Удалить этот полигон из зоны?')) return;

    try {
      const { error } = await supabase
        .from('courier_zone_polygons')
        .delete()
        .eq('id', polygonId);

      if (error) throw error;

      loadData();
    } catch (error) {
      console.error('Error deleting polygon:', error);
      alert('Ошибка при удалении полигона');
    }
  };

  const updateZone = async () => {
    if (!editingZone) return;

    try {
      const { error } = await supabase
        .from('courier_delivery_zones')
        .update({
          name: formData.name,
          color: formData.color,
          price_uah: formData.price_uah,
          courier_payment: formData.courier_payment,
          free_delivery_threshold: formData.free_delivery_threshold,
          min_order_amount: formData.min_order_amount
        })
        .eq('id', editingZone.id);

      if (error) throw error;

      setEditingZone(null);
      loadData();
    } catch (error) {
      console.error('Error updating zone:', error);
      alert('Ошибка при обновлении зоны');
    }
  };

  const startEditZone = (zone: CourierDeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      color: zone.color,
      price_uah: zone.price_uah,
      courier_payment: zone.courier_payment,
      free_delivery_threshold: zone.free_delivery_threshold,
      min_order_amount: zone.min_order_amount
    });
  };

  const startAddPolygonToZone = (zone: CourierDeliveryZone) => {
    setAddingPolygonToZone(zone);
    setCurrentPath([]);
  };

  const completeAddPolygonToZone = async () => {
    if (!addingPolygonToZone || currentPath.length < 3) return;

    const polygon = currentPath.map(p => ({ lat: p.lat(), lng: p.lng() }));

    try {
      const displayOrder = (addingPolygonToZone.polygons?.length || 0);

      const { error } = await supabase
        .from('courier_zone_polygons')
        .insert({
          zone_id: addingPolygonToZone.id,
          polygon,
          display_order: displayOrder
        });

      if (error) throw error;

      cancelDrawing();
      loadData();
    } catch (error) {
      console.error('Error adding polygon:', error);
      alert('Ошибка при добавлении полигона');
    }
  };

  const startEditPolygon = (zone: CourierDeliveryZone, polygon: CourierZonePolygon) => {
    setEditingPolygonId(polygon.id);
    const path = polygon.polygon.map(p => new google.maps.LatLng(p.lat, p.lng));
    setCurrentPath(path);
    setFormData({
      name: zone.name,
      color: zone.color,
      price_uah: zone.price_uah,
      courier_payment: zone.courier_payment,
      free_delivery_threshold: zone.free_delivery_threshold,
      min_order_amount: zone.min_order_amount
    });
  };

  const completeEditPolygon = async () => {
    if (!editingPolygonId || currentPath.length < 3) return;

    const polygon = currentPath.map(p => ({ lat: p.lat(), lng: p.lng() }));

    try {
      const { error } = await supabase
        .from('courier_zone_polygons')
        .update({ polygon })
        .eq('id', editingPolygonId);

      if (error) throw error;

      cancelDrawing();
      loadData();
    } catch (error) {
      console.error('Error updating polygon:', error);
      alert('Ошибка при обновлении полигона');
    }
  };

  const toggleZoneVisibility = (zoneId: string) => {
    const newHidden = new Set(hiddenZones);
    if (newHidden.has(zoneId)) {
      newHidden.delete(zoneId);
    } else {
      newHidden.add(zoneId);
    }
    setHiddenZones(newHidden);
  };

  const saveSettings = async () => {
    if (!partner) return;

    try {
      const { error } = await supabase
        .from('partner_settings')
        .update({ courier_no_zone_message: courierNoZoneMessage })
        .eq('partner_id', partner.id);

      if (error) throw error;

      alert('Настройки сохранены');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Ошибка при сохранении настроек');
    }
  };

  const hexToKmlColor = (hex: string, alpha: string = 'FF'): string => {
    const cleanHex = hex.replace('#', '');
    const r = cleanHex.substring(0, 2);
    const g = cleanHex.substring(2, 4);
    const b = cleanHex.substring(4, 6);
    return `${alpha}${b}${g}${r}`;
  };

  const exportToKml = () => {
    if (!partner) return;

    const styles: string[] = [];
    const placemarks: string[] = [];

    zones.forEach((zone, index) => {
      const styleId = `style_${index}`;
      const lineColor = hexToKmlColor(zone.color, 'FF');
      const polyColor = hexToKmlColor(zone.color, '4D');

      styles.push(`
    <Style id="${styleId}">
      <LineStyle>
        <color>${lineColor}</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>${polyColor}</color>
      </PolyStyle>
    </Style>`);

      const descriptionLines = [
        `Цена доставки: ${zone.price_uah} грн`,
        `Оплата курьеру: ${zone.courier_payment} грн`
      ];
      if (zone.free_delivery_threshold !== null) {
        descriptionLines.push(`Бесплатно от: ${zone.free_delivery_threshold} грн`);
      }
      if (zone.min_order_amount !== null) {
        descriptionLines.push(`Мин. заказ: ${zone.min_order_amount} грн`);
      }

      const polygonElements: string[] = [];

      if (zone.polygons && zone.polygons.length > 0) {
        zone.polygons.forEach(poly => {
          if (poly.polygon.length < 3) {
            console.warn(`Skipping polygon with less than 3 points in zone "${zone.name}"`);
            return;
          }

          const coords = poly.polygon.map(p => `${p.lng},${p.lat},0`);
          const firstPoint = poly.polygon[0];
          coords.push(`${firstPoint.lng},${firstPoint.lat},0`);

          polygonElements.push(`
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>${coords.join(' ')}</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>`);
        });
      }

      if (polygonElements.length > 0) {
        placemarks.push(`
    <Placemark>
      <name>${zone.name}</name>
      <description><![CDATA[${descriptionLines.join('\n')}]]></description>
      <styleUrl>#${styleId}</styleUrl>
      <MultiGeometry>${polygonElements.join('')}
      </MultiGeometry>
    </Placemark>`);
      }
    });

    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Зоны доставки курьеров</name>
    <description>Экспорт зон доставки партнёра</description>${styles.join('')}${placemarks.join('')}
  </Document>
</kml>`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `courier_zones_${partner.url_suffix || partner.id}.kml`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(zones.length > 0 ? 'Файл KML скачан' : 'Файл KML скачан (зоны не созданы)');
  };

  if (loading || !settings) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!settings.google_maps_api_key) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Для работы с зонами доставки необходимо настроить Google Maps API ключ в общих настройках.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Зоны доставки курьеров</h1>
        <p className="text-gray-600">Настройте зоны доставки на карте. Каждая зона может содержать несколько независимых полигонов.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Карта зон</h2>
                  {isDrawing && (
                    <p className="text-sm text-gray-600 mt-1">
                      Кликайте по карте для создания новой зоны. Минимум 3 точки.
                    </p>
                  )}
                  {addingPolygonToZone && (
                    <p className="text-sm text-gray-600 mt-1">
                      Добавление полигона в зону: {addingPolygonToZone.name}. Кликайте по карте.
                    </p>
                  )}
                  {editingPolygonId && (
                    <p className="text-sm text-gray-600 mt-1">
                      Редактирование полигона. Перетаскивайте точки для изменения.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {isDrawing ? (
                    <>
                      <button
                        onClick={completePolygon}
                        disabled={currentPath.length < 3}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Завершить
                      </button>
                      <button
                        onClick={cancelDrawing}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : addingPolygonToZone ? (
                    <>
                      <button
                        onClick={completeAddPolygonToZone}
                        disabled={currentPath.length < 3}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Добавить
                      </button>
                      <button
                        onClick={cancelDrawing}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : editingPolygonId ? (
                    <>
                      <button
                        onClick={completeEditPolygon}
                        disabled={currentPath.length < 3}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Сохранить
                      </button>
                      <button
                        onClick={cancelDrawing}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={exportToKml}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Экспорт KML
                      </button>
                      <button
                        onClick={startDrawing}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        Создать зону
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div ref={mapRef} className="h-[600px]" />
          </div>

          {showForm && (
            <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-lg font-semibold mb-4">Параметры зоны</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название зоны
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Например: Центр"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Цена доставки (грн)
                  </label>
                  <input
                    type="number"
                    value={formData.price_uah}
                    onChange={(e) => setFormData({ ...formData, price_uah: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Оплата курьеру (грн)
                  </label>
                  <input
                    type="number"
                    value={formData.courier_payment}
                    onChange={(e) => setFormData({ ...formData, courier_payment: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сумма для бесплатной доставки (грн)
                  </label>
                  <input
                    type="number"
                    value={formData.free_delivery_threshold || ''}
                    onChange={(e) => setFormData({ ...formData, free_delivery_threshold: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                    placeholder="Оставьте пустым чтобы отключить"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Минимальный заказ (грн)
                  </label>
                  <input
                    type="number"
                    value={formData.min_order_amount || ''}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                    placeholder="Оставьте пустым чтобы отключить"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цвет зоны
                  </label>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => {
                        const newColor = e.target.value;
                        setFormData({ ...formData, color: newColor });
                        if (drawingPolygonRef.current) {
                          drawingPolygonRef.current.setOptions({
                            strokeColor: newColor,
                            fillColor: newColor
                          });
                        }
                      }}
                      className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => {
                        const newColor = e.target.value;
                        setFormData({ ...formData, color: newColor });
                        if (drawingPolygonRef.current && /^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                          drawingPolygonRef.current.setOptions({
                            strokeColor: newColor,
                            fillColor: newColor
                          });
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      placeholder="#3B82F6"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {DEFAULT_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, color });
                          if (drawingPolygonRef.current) {
                            drawingPolygonRef.current.setOptions({
                              strokeColor: color,
                              fillColor: color
                            });
                          }
                        }}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveZone}
                  disabled={!formData.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Сохранить зону
                </button>
                <button
                  onClick={cancelDrawing}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <h3 className="text-lg font-semibold mb-4">Настройки</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сообщение если адрес вне зоны
              </label>
              <textarea
                value={courierNoZoneMessage}
                onChange={(e) => setCourierNoZoneMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>
            <button
              onClick={saveSettings}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Сохранить настройки
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-4">Список зон ({zones.length})</h3>
            <div className="space-y-3">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  {editingZone?.id === zone.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Название"
                      />
                      <input
                        type="number"
                        value={formData.price_uah}
                        onChange={(e) => setFormData({ ...formData, price_uah: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Цена доставки (грн)"
                      />
                      <input
                        type="number"
                        value={formData.courier_payment}
                        onChange={(e) => setFormData({ ...formData, courier_payment: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Оплата курьеру (грн)"
                      />
                      <input
                        type="number"
                        value={formData.free_delivery_threshold || ''}
                        onChange={(e) => setFormData({ ...formData, free_delivery_threshold: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Сумма для бесплатной доставки (грн)"
                      />
                      <input
                        type="number"
                        value={formData.min_order_amount || ''}
                        onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Минимальный заказ (грн)"
                      />
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Цвет зоны
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.color}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            className="h-8 w-16 rounded border border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formData.color}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded font-mono text-xs"
                            placeholder="#3B82F6"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={updateZone}
                          className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => setEditingZone(null)}
                          className="flex-1 px-2 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: zone.color }}
                          />
                          <span className="font-medium">{zone.name}</span>
                        </div>
                        <button
                          onClick={() => toggleZoneVisibility(zone.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {hiddenZones.has(zone.id) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <div>Цена доставки: {zone.price_uah} грн</div>
                        <div>Оплата курьеру: {zone.courier_payment} грн</div>
                        {zone.free_delivery_threshold && (
                          <div>Бесплатно от: {zone.free_delivery_threshold} грн</div>
                        )}
                        {zone.min_order_amount && (
                          <div>Мин. заказ: {zone.min_order_amount} грн</div>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Layers className="w-3 h-3" />
                          <span>Полигонов: {zone.polygons?.length || 0}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-col">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditZone(zone)}
                            className="flex-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm flex items-center justify-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            Параметры
                          </button>
                          <button
                            onClick={() => deleteZone(zone.id)}
                            className="flex-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Удалить
                          </button>
                        </div>
                        <button
                          onClick={() => startAddPolygonToZone(zone)}
                          className="w-full px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Добавить полигон
                        </button>
                        {zone.polygons && zone.polygons.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="text-xs font-medium text-gray-700 mb-1">Полигоны:</div>
                            <div className="space-y-1">
                              {zone.polygons.map((poly, index) => (
                                <div key={poly.id} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-gray-600">Полигон {index + 1} ({poly.polygon.length} точек)</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => startEditPolygon(zone, poly)}
                                      className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                      title="Редактировать"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    {zone.polygons && zone.polygons.length > 1 && (
                                      <button
                                        onClick={() => deletePolygon(zone, poly.id)}
                                        className="px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100"
                                        title="Удалить"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {zones.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  Зоны не созданы
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
