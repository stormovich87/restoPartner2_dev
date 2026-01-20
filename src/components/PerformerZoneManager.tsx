import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PerformerDeliveryZone } from '../types';
import { Plus, Edit2, Trash2, Save, X, Layers, Calculator } from 'lucide-react';

interface KmSettings {
  km_calculation_enabled: boolean;
  price_per_km: number;
  km_graduation_meters: number;
}

interface PerformerZoneManagerProps {
  performerId: string;
  noZoneMessage: string;
  onNoZoneMessageChange: (message: string) => void;
}

export default function PerformerZoneManager({
  performerId,
  noZoneMessage,
  onNoZoneMessageChange
}: PerformerZoneManagerProps) {
  const [zones, setZones] = useState<PerformerDeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<PerformerDeliveryZone | null>(null);

  const [kmSettings, setKmSettings] = useState<KmSettings>({
    km_calculation_enabled: false,
    price_per_km: 0,
    km_graduation_meters: 100
  });
  const [savingKmSettings, setSavingKmSettings] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    color: '#10B981',
    price_uah: 0
  });

  useEffect(() => {
    loadZones();
    loadKmSettings();
  }, [performerId]);

  const loadKmSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('executors')
        .select('km_calculation_enabled, price_per_km, km_graduation_meters')
        .eq('id', performerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setKmSettings({
          km_calculation_enabled: data.km_calculation_enabled || false,
          price_per_km: data.price_per_km || 0,
          km_graduation_meters: data.km_graduation_meters || 100
        });
      }
    } catch (error) {
      console.error('Error loading km settings:', error);
    }
  };

  const saveKmSettings = async (newSettings: KmSettings) => {
    setSavingKmSettings(true);
    try {
      const { error } = await supabase
        .from('executors')
        .update({
          km_calculation_enabled: newSettings.km_calculation_enabled,
          price_per_km: newSettings.price_per_km,
          km_graduation_meters: newSettings.km_graduation_meters
        })
        .eq('id', performerId);

      if (error) throw error;

      setKmSettings(newSettings);
    } catch (error) {
      console.error('Error saving km settings:', error);
      alert('Ошибка при сохранении настроек');
    } finally {
      setSavingKmSettings(false);
    }
  };

  const loadZones = async () => {
    try {
      const { data, error } = await supabase
        .from('performer_delivery_zones')
        .select('*')
        .eq('performer_id', performerId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const zoneIds = data.map(z => z.id);
        const { data: polygonsData } = await supabase
          .from('performer_zone_polygons')
          .select('*')
          .in('zone_id', zoneIds)
          .order('display_order', { ascending: true });

        const zonesWithPolygons = data.map(zone => ({
          ...zone,
          polygons: polygonsData?.filter(p => p.zone_id === zone.id) || []
        }));

        setZones(zonesWithPolygons);
      } else {
        setZones([]);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#10B981',
      price_uah: 0
    });
    setShowForm(false);
    setEditingZone(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (zone: PerformerDeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      color: zone.color,
      price_uah: zone.price_uah
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert('Введите название зоны');
      return;
    }

    try {
      if (editingZone) {
        const { error } = await supabase
          .from('performer_delivery_zones')
          .update({
            name: formData.name,
            color: formData.color,
            price_uah: formData.price_uah,
            courier_payment: formData.price_uah
          })
          .eq('id', editingZone.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('performer_delivery_zones')
          .insert({
            performer_id: performerId,
            name: formData.name,
            color: formData.color,
            price_uah: formData.price_uah,
            courier_payment: formData.price_uah
          });

        if (error) throw error;
      }

      resetForm();
      loadZones();
    } catch (error) {
      console.error('Error saving zone:', error);
      alert('Ошибка при сохранении зоны');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить эту зону?')) return;

    try {
      const { error } = await supabase
        .from('performer_delivery_zones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadZones();
    } catch (error) {
      console.error('Error deleting zone:', error);
      alert('Ошибка при удалении зоны');
    }
  };

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>;
  }

  const calculateExamplePrice = (distanceKm: number) => {
    if (!kmSettings.km_calculation_enabled || kmSettings.price_per_km <= 0) return null;

    const minDistance = 1;
    const graduationKm = kmSettings.km_graduation_meters / 1000;
    let roundedDistance = Math.max(distanceKm, minDistance);

    if (graduationKm > 0) {
      roundedDistance = Math.round(roundedDistance / graduationKm) * graduationKm;
      roundedDistance = Math.max(roundedDistance, minDistance);
    }

    const distancePrice = Math.round(roundedDistance * kmSettings.price_per_km);
    return { roundedDistance, distancePrice };
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Сообщение если зона не выбрана
        </label>
        <textarea
          value={noZoneMessage}
          onChange={(e) => onNoZoneMessageChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          rows={2}
          placeholder="Выберите зону доставки"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Расчет по километрам</h4>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={kmSettings.km_calculation_enabled}
              onChange={(e) => {
                const newSettings = { ...kmSettings, km_calculation_enabled: e.target.checked };
                saveKmSettings(newSettings);
              }}
              disabled={savingKmSettings}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {kmSettings.km_calculation_enabled && (
          <div className="space-y-4 mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цена за километр (грн)
                </label>
                <input
                  type="number"
                  value={kmSettings.price_per_km}
                  onChange={(e) => {
                    const newSettings = { ...kmSettings, price_per_km: Number(e.target.value) };
                    setKmSettings(newSettings);
                  }}
                  onBlur={() => saveKmSettings(kmSettings)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                  step="0.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Градация (метры)
                </label>
                <select
                  value={kmSettings.km_graduation_meters}
                  onChange={(e) => {
                    const newSettings = { ...kmSettings, km_graduation_meters: Number(e.target.value) };
                    saveKmSettings(newSettings);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={100}>100 м</option>
                  <option value={200}>200 м</option>
                  <option value={500}>500 м</option>
                  <option value={1000}>1000 м (1 км)</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 text-sm">
              <div className="font-medium text-gray-700 mb-2">Примеры расчета:</div>
              <div className="space-y-1 text-gray-600">
                {[0.8, 1.5, 2.1, 3.7].map(dist => {
                  const result = calculateExamplePrice(dist);
                  if (!result) return null;
                  return (
                    <div key={dist} className="flex justify-between">
                      <span>{dist} км:</span>
                      <span className="font-medium">
                        {result.roundedDistance.toFixed(1)} км = {result.distancePrice} грн
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                Итоговая цена = Цена зоны + Цена за расстояние
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Зоны доставки ({zones.length})</h3>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить зону
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">
            {editingZone ? 'Редактировать зону' : 'Новая зона'}
          </h4>
          <div className="space-y-3 mb-3">
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
                Цвет зоны
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  placeholder="#10B981"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Выберите цвет с помощью палитры или введите HEX код
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: zone.color }}
                />
                <div>
                  <div className="font-medium">{zone.name}</div>
                  <div className="text-sm text-gray-600">
                    <div>Цена: {zone.price_uah} грн</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Layers className="w-3 h-3" />
                      <span>Полигонов: {zone.polygons?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(zone)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(zone.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {zones.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
            Зоны не созданы. Нажмите "Добавить зону" чтобы создать первую зону.
          </div>
        )}
      </div>
    </div>
  );
}
