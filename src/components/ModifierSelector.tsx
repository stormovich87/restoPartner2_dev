import { useState, useEffect } from 'react';
import { X, Package, AlertCircle, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  poster_product_id: number;
  name: string;
  price: number;
  photo_url: string | null;
}

interface Modifier {
  id: string;
  poster_modifier_id: number;
  name: string;
  price_change: number;
  photo_url: string | null;
}

interface ProductModifierRule {
  modifier_poster_id: number;
  is_required: boolean;
  min_amount: number;
  max_amount: number;
  group_id: number | null;
  group_name: string;
  sort_order: number;
}

interface ModifierWithRule extends Modifier {
  rule: ProductModifierRule;
}

interface ModifierGroup {
  group_id: number | null;
  group_name: string;
  min_amount: number;
  max_amount: number;
  modifiers: ModifierWithRule[];
}

interface ModifierSelectorProps {
  partnerId: string;
  product: Product;
  currencySymbol: string;
  onClose: () => void;
  onAdd: (product: Product, modifiers: Array<{ modifier: Modifier; quantity: number }>) => void;
  isMobile?: boolean;
  initialModifiers?: Array<{ modifier_poster_id: number; quantity: number }>;
}

export default function ModifierSelector({
  partnerId,
  product,
  currencySymbol,
  onClose,
  onAdd,
  isMobile = false,
  initialModifiers
}: ModifierSelectorProps) {
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Map<number, number>>(() => {
    const initial = new Map<number, number>();
    if (initialModifiers) {
      initialModifiers.forEach(m => {
        initial.set(m.modifier_poster_id, m.quantity);
      });
    }
    return initial;
  });
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadModifiers();
  }, [partnerId, product]);

  const loadModifiers = async () => {
    setLoading(true);
    try {
      const { data: productModifiers } = await supabase
        .from('product_modifiers')
        .select('modifier_poster_id, is_required, min_amount, max_amount, group_id, group_name, sort_order')
        .eq('partner_id', partnerId)
        .eq('product_poster_id', product.poster_product_id)
        .order('sort_order', { ascending: true });

      if (!productModifiers || productModifiers.length === 0) {
        setModifierGroups([]);
        setLoading(false);
        return;
      }

      const modifierIds = productModifiers.map(pm => pm.modifier_poster_id);

      const { data: modifiersData } = await supabase
        .from('modifiers')
        .select('id, poster_modifier_id, name, price_change, photo_url')
        .eq('partner_id', partnerId)
        .in('poster_modifier_id', modifierIds)
        .eq('is_active', true);

      if (modifiersData) {
        const modifiersWithRules: ModifierWithRule[] = modifiersData.map(mod => {
          const rule = productModifiers.find(
            pm => pm.modifier_poster_id === mod.poster_modifier_id
          )!;
          return { ...mod, rule };
        });

        const groupsMap = new Map<string, ModifierGroup>();

        modifiersWithRules.forEach(mod => {
          const groupKey = mod.rule.group_id !== null ? String(mod.rule.group_id) : 'default';

          if (!groupsMap.has(groupKey)) {
            groupsMap.set(groupKey, {
              group_id: mod.rule.group_id,
              group_name: mod.rule.group_name || 'Набір 1',
              min_amount: mod.rule.min_amount || 0,
              max_amount: mod.rule.max_amount || 0,
              modifiers: []
            });
          }

          groupsMap.get(groupKey)!.modifiers.push(mod);
        });

        const groups = Array.from(groupsMap.values());

        groups.sort((a, b) => {
          const aRequired = a.min_amount > 0;
          const bRequired = b.min_amount > 0;
          if (aRequired && !bRequired) return -1;
          if (!aRequired && bRequired) return 1;
          return 0;
        });

        const requiredGroupIds = new Set<number>();
        groups.forEach((group, index) => {
          if (group.min_amount > 0 && group.group_id !== null) {
            requiredGroupIds.add(index);
          }
        });
        setExpandedGroups(requiredGroupIds);

        setModifierGroups(groups);
      }
    } catch (error) {
      console.error('Error loading modifiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupIndex: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupIndex)) {
        newSet.delete(groupIndex);
      } else {
        newSet.add(groupIndex);
      }
      return newSet;
    });
  };

  const handleModifierClick = (modifierId: number) => {
    setSelectedModifiers(prev => {
      const newMap = new Map(prev);
      const currentQty = newMap.get(modifierId) || 0;
      newMap.set(modifierId, currentQty + 1);
      return newMap;
    });
  };

  const handleRemoveModifier = (modifierId: number) => {
    setSelectedModifiers(prev => {
      const newMap = new Map(prev);
      const currentQty = newMap.get(modifierId) || 0;
      if (currentQty <= 1) {
        newMap.delete(modifierId);
      } else {
        newMap.set(modifierId, currentQty - 1);
      }
      return newMap;
    });
  };

  const calculateModifiersTotal = () => {
    return Array.from(selectedModifiers.entries()).reduce((sum, [modId, qty]) => {
      let modifier: ModifierWithRule | undefined;
      for (const group of modifierGroups) {
        modifier = group.modifiers.find(m => m.poster_modifier_id === modId);
        if (modifier) break;
      }
      if (modifier) {
        return sum + parseFloat(String(modifier.price_change)) * qty;
      }
      return sum;
    }, 0);
  };

  const canAdd = () => {
    return modifierGroups.every(group => {
      const groupTotal = group.modifiers.reduce((sum, mod) => {
        return sum + (selectedModifiers.get(mod.poster_modifier_id) || 0);
      }, 0);

      if (group.min_amount > 0 && groupTotal < group.min_amount) {
        return false;
      }

      if (group.max_amount > 0 && groupTotal > group.max_amount) {
        return false;
      }

      return true;
    });
  };

  const handleAdd = () => {
    if (!canAdd()) return;

    const selectedModifiersArray = Array.from(selectedModifiers.entries())
      .map(([modId, qty]) => {
        let modifier: ModifierWithRule | undefined;
        for (const group of modifierGroups) {
          modifier = group.modifiers.find(m => m.poster_modifier_id === modId);
          if (modifier) break;
        }
        if (modifier) {
          const { rule, ...modifierData } = modifier;
          return { modifier: modifierData, quantity: qty };
        }
        return null;
      })
      .filter((item): item is { modifier: Modifier; quantity: number } => item !== null);

    onAdd(product, selectedModifiersArray);
  };

  const modifiersTotal = calculateModifiersTotal();
  const totalPrice = product.price + modifiersTotal;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col ${
        isMobile ? 'max-w-full h-full' : 'max-w-2xl max-h-[90vh]'
      }`}>
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          {isMobile && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <h3 className="text-xl font-bold">Оберіть модифікатори</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {product.photo_url ? (
                <img src={product.photo_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-gray-900 mb-1">{product.name}</h4>
              <p className="text-2xl font-bold text-blue-600">
                {product.price.toFixed(2)} {currencySymbol}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : modifierGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Немає модифікаторів для цього товару</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modifierGroups.map((group, groupIndex) => {
                const groupTotal = group.modifiers.reduce((sum, mod) => {
                  return sum + (selectedModifiers.get(mod.poster_modifier_id) || 0);
                }, 0);
                const isGroupValid = (
                  (group.min_amount === 0 || groupTotal >= group.min_amount) &&
                  (group.max_amount === 0 || groupTotal <= group.max_amount)
                );
                const isExpanded = expandedGroups.has(groupIndex);
                const isRequired = group.min_amount > 0;

                return (
                  <div
                    key={groupIndex}
                    className={`border-2 rounded-xl overflow-hidden transition-all ${
                      !isGroupValid
                        ? 'border-red-300 bg-red-50'
                        : isExpanded
                          ? 'border-blue-300 bg-white'
                          : 'border-gray-200 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => toggleGroup(groupIndex)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        )}
                        <div className="text-left">
                          <h5 className="font-bold text-gray-900">
                            {group.group_name}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                          </h5>
                          <p className="text-xs text-gray-600">
                            {group.min_amount > 0 && group.max_amount > 0
                              ? `Оберіть від ${group.min_amount} до ${group.max_amount}`
                              : group.min_amount > 0
                                ? `Оберіть мінімум ${group.min_amount}`
                                : group.max_amount > 0
                                  ? `Оберіть максимум ${group.max_amount}`
                                  : 'Необов\'язково'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.min_amount > 0 && (
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            groupTotal >= group.min_amount
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {groupTotal}/{group.min_amount}
                          </span>
                        )}
                        {group.max_amount > 0 && group.min_amount === 0 && (
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            groupTotal <= group.max_amount
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {groupTotal}/{group.max_amount}
                          </span>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className={`px-4 pb-4 pt-2 ${
                        isMobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 sm:grid-cols-3 gap-3'
                      }`}>
                        {group.modifiers.map(modifier => {
                          const quantity = selectedModifiers.get(modifier.poster_modifier_id) || 0;
                          const isSelected = quantity > 0;
                          const canSelect = group.max_amount === 0 || groupTotal < group.max_amount || isSelected;

                          return (
                            <div key={modifier.id} className="relative">
                              <button
                                onClick={() => canSelect && handleModifierClick(modifier.poster_modifier_id)}
                                disabled={!canSelect}
                                className={`w-full bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col border-2 ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : canSelect
                                      ? 'border-gray-200 hover:border-blue-300'
                                      : 'border-gray-200 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
                                  {modifier.photo_url ? (
                                    <img
                                      src={modifier.photo_url}
                                      alt={modifier.name}
                                      className={`w-full h-full object-cover transition-all ${
                                        isSelected ? 'opacity-75' : ''
                                      }`}
                                    />
                                  ) : (
                                    <Package className={`w-12 h-12 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                                  )}
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                                      {quantity}
                                    </div>
                                  )}
                                </div>
                                <div className="p-2">
                                  <p className="font-semibold text-gray-900 text-sm line-clamp-2 min-h-[2.5rem]">
                                    {modifier.name}
                                  </p>
                                  <p className="text-base font-bold text-blue-600">
                                    +{parseFloat(String(modifier.price_change)).toFixed(2)} {currencySymbol}
                                  </p>
                                </div>
                              </button>
                              {isSelected && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveModifier(modifier.poster_modifier_id);
                                  }}
                                  className="absolute -top-2 -left-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg transition-colors z-10"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {!canAdd() && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Будь ласка, виберіть необхідну кількість модифікаторів у кожній групі
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex-shrink-0">
          {modifiersTotal > 0 && (
            <div className="mb-3 space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Модифікатори:</span>
                <span className="font-semibold">+{modifiersTotal.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Разом:</span>
                <span className="text-blue-600">{totalPrice.toFixed(2)} {currencySymbol}</span>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
            >
              Скасувати
            </button>
            <button
              onClick={handleAdd}
              disabled={!canAdd() || modifierGroups.length === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {modifierGroups.length === 0 ? 'Додати без модифікаторів' : 'Додати'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
