import { Minus, Plus, Trash2, ShoppingCart, Edit2 } from 'lucide-react';

interface CheckItem {
  id: string;
  product_poster_id: number;
  product_name: string;
  base_price: number;
  modifiers: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  quantity: number;
  total_price: number;
}

interface CheckViewProps {
  items: CheckItem[];
  currencySymbol: string;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
  onSave: () => void;
  totalAmount: number;
  isMobile?: boolean;
  onShowCatalog?: () => void;
  freeDeliveryThreshold?: number | null;
  minOrderAmount?: number | null;
  deliveryType?: 'delivery' | 'pickup';
}

export default function CheckView({
  items,
  currencySymbol,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  onSave,
  totalAmount,
  isMobile = false,
  onShowCatalog,
  freeDeliveryThreshold,
  minOrderAmount,
  deliveryType
}: CheckViewProps) {
  return (
    <div className={`bg-white flex flex-col ${isMobile ? 'w-full' : 'w-full md:w-96 border-r border-gray-200'}`}>
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-1.5 border-b border-gray-200 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Чек</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm font-semibold">Чек порожній</p>
            <p className="text-xs text-center mt-1">Оберіть товари з каталогу {isMobile ? 'нижче' : 'справа'}</p>
          </div>
        ) : (
          items.map((item) => {
            const modifiersTotal = item.modifiers.reduce(
              (sum, m) => sum + m.price * m.quantity,
              0
            );
            const unitPrice = item.base_price + modifiersTotal;

            return (
              <div
                key={item.id}
                className="bg-gray-50 rounded-lg p-2 border border-gray-200 hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between mb-1">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onEditItem && onEditItem(item.id)}
                  >
                    <div className="flex items-center gap-1">
                      <h4 className="text-sm font-semibold text-gray-900 leading-tight">{item.product_name}</h4>
                      {onEditItem && (
                        <Edit2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                    {item.modifiers.length > 0 && (
                      <div className="mt-0.5 space-y-0">
                        {item.modifiers.map((mod, idx) => (
                          <p key={idx} className="text-[10px] text-gray-600 leading-tight">
                            + {mod.name} ({mod.quantity}x) +{(mod.price * mod.quantity).toFixed(2)} {currencySymbol}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    title="Видалити"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-gray-600">
                    {unitPrice.toFixed(2)} {currencySymbol} × {item.quantity}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                    >
                      <Minus className="w-3 h-3 text-gray-700" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="mt-1 pt-1 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-700">Сума:</span>
                  <span className="text-base font-bold text-blue-600">
                    {item.total_price.toFixed(2)} {currencySymbol}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-300 px-2 py-2 flex-shrink-0 space-y-2">
        <div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">До оплати:</span>
            <span className="text-xl font-bold text-green-600">
              {totalAmount.toFixed(2)} {currencySymbol}
            </span>
          </div>
          {minOrderAmount && minOrderAmount > totalAmount && deliveryType !== 'pickup' && (
            <div className="mt-1 p-2 bg-red-50 border border-red-300 rounded">
              <p className="text-xs font-bold text-red-700">
                Минимальный заказ не достигнут!
              </p>
              <p className="text-[10px] font-semibold text-red-600 mt-0.5">
                Осталось: {(minOrderAmount - totalAmount).toFixed(2)} {currencySymbol}
              </p>
            </div>
          )}
          {freeDeliveryThreshold && freeDeliveryThreshold > totalAmount && (
            <div className="mt-1 p-1.5 bg-blue-50 border border-blue-200 rounded">
              <p className="text-[10px] text-blue-700">
                Не хватает {(freeDeliveryThreshold - totalAmount).toFixed(2)} {currencySymbol} до бесплатной доставки
              </p>
            </div>
          )}
          {freeDeliveryThreshold && freeDeliveryThreshold <= totalAmount && (
            <div className="mt-1 p-1.5 bg-green-50 border border-green-200 rounded">
              <p className="text-[10px] text-green-700 font-semibold">
                🎉 Бесплатная доставка
              </p>
            </div>
          )}
        </div>

        {isMobile && onShowCatalog && (
          <button
            onClick={onShowCatalog}
            className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg font-semibold text-sm"
          >
            + Додати товар
          </button>
        )}

        <button
          onClick={onSave}
          disabled={items.length === 0}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Додати в замовлення
        </button>
      </div>
    </div>
  );
}
