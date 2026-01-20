import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Package, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

interface Product {
  id: string;
  poster_product_id: number;
  name: string;
  category_poster_id: number | null;
  price: number;
  is_active: boolean;
  sku: string | null;
  code: string | null;
  photo_url: string | null;
  updated_at: string;
}

interface Category {
  poster_category_id: number;
  name: string;
}

interface Modifier {
  id: string;
  poster_modifier_id: number;
  name: string;
  price_change: number;
  photo_url: string | null;
}

interface ProductModifier {
  modifier_poster_id: number;
  is_required: boolean;
  min_amount: number;
  max_amount: number;
}

interface MenuProductsProps {
  partnerId: string;
  onBack: () => void;
}

export default function MenuProducts({ partnerId, onBack }: MenuProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModifiers, setProductModifiers] = useState<{ modifier: Modifier; config: ProductModifier }[]>([]);
  const [loadingModifiers, setLoadingModifiers] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('₴');

  useEffect(() => {
    loadData();
  }, [partnerId, showInactive, selectedCategoryId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [productsResult, categoriesResult, settingsResult] = await Promise.all([
        loadProducts(),
        loadCategories(),
        loadSettings()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      await logger.error(partnerId, 'menu', 'Ошибка загрузки данных меню', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('partner_settings')
      .select('currency_symbol')
      .eq('partner_id', partnerId)
      .maybeSingle();

    if (data && data.currency_symbol) {
      setCurrencySymbol(data.currency_symbol);
    }
  };

  const loadProducts = async () => {
    let query = supabase
      .from('products')
      .select('*')
      .eq('partner_id', partnerId)
      .order('name', { ascending: true });

    if (!showInactive) {
      query = query.eq('is_active', true);
    }

    if (selectedCategoryId !== null) {
      query = query.eq('category_poster_id', selectedCategoryId);
    }

    const { data, error } = await query;

    if (error) throw error;

    setProducts(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('poster_category_id, name')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    setCategories(data || []);
  };

  const loadProductModifiers = async (product: Product) => {
    try {
      setLoadingModifiers(true);
      setSelectedProduct(product);

      const { data: pmData, error: pmError } = await supabase
        .from('product_modifiers')
        .select('modifier_poster_id, is_required, min_amount, max_amount')
        .eq('partner_id', partnerId)
        .eq('product_poster_id', product.poster_product_id);

      if (pmError) throw pmError;

      if (!pmData || pmData.length === 0) {
        setProductModifiers([]);
        return;
      }

      const modifierIds = pmData.map(pm => pm.modifier_poster_id);

      const { data: modifiersData, error: modifiersError } = await supabase
        .from('modifiers')
        .select('id, poster_modifier_id, name, price_change')
        .eq('partner_id', partnerId)
        .in('poster_modifier_id', modifierIds);

      if (modifiersError) throw modifiersError;

      const modifiersMap = new Map(
        (modifiersData || []).map(m => [m.poster_modifier_id, m])
      );

      const result = pmData
        .filter(pm => modifiersMap.has(pm.modifier_poster_id))
        .map(pm => ({
          modifier: modifiersMap.get(pm.modifier_poster_id)!,
          config: pm
        }));

      setProductModifiers(result);
    } catch (error) {
      console.error('Error loading product modifiers:', error);
      await logger.error(partnerId, 'menu', 'Ошибка загрузки модификаторов товара', {
        productId: product.poster_product_id,
        error: String(error)
      });
    } finally {
      setLoadingModifiers(false);
    }
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return '—';
    const category = categories.find(c => c.poster_category_id === categoryId);
    return category?.name || `ID: ${categoryId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Товары меню</h1>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Все категории</option>
            {categories.map((category) => (
              <option key={category.poster_category_id} value={category.poster_category_id}>
                {category.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showInactive ? 'Показать активные' : 'Показать все'}
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет товаров</h3>
          <p className="text-gray-600">
            {selectedCategoryId
              ? 'В выбранной категории нет товаров'
              : 'Синхронизируйте меню из Poster в разделе "Настройки → Интеграция с Poster"'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Фото
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID Poster
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Категория
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Цена
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {product.poster_product_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getCategoryName(product.category_poster_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {product.price.toFixed(2)} {currencySymbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {product.sku || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => loadProductModifiers(product)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Модификаторы
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500 text-center">
        Всего товаров: {products.length}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Модификаторы товара</h2>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setProductModifiers([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-4">
                  {selectedProduct.photo_url && (
                    <img
                      src={selectedProduct.photo_url}
                      alt={selectedProduct.name}
                      className="w-20 h-20 object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{selectedProduct.name}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">ID Poster:</span>
                        <span className="ml-2 font-mono">{selectedProduct.poster_product_id}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Цена:</span>
                        <span className="ml-2 font-semibold">{selectedProduct.price.toFixed(2)} {currencySymbol}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {loadingModifiers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : productModifiers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  У этого товара нет модификаторов
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Список модификаторов:</h4>
                  {productModifiers.map(({ modifier, config }) => (
                    <div
                      key={modifier.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        {modifier.photo_url ? (
                          <img
                            src={modifier.photo_url}
                            alt={modifier.name}
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 flex items-start justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">{modifier.name}</h5>
                            <p className="text-sm text-gray-500 font-mono">ID: {modifier.poster_modifier_id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {modifier.price_change > 0 ? '+' : ''}
                              {modifier.price_change.toFixed(2)} {currencySymbol}
                            </p>
                            {config.is_required && (
                              <span className="inline-flex mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                Обязательный
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {(config.min_amount > 0 || config.max_amount > 0) && (
                        <div className="text-xs text-gray-600 mt-2">
                          Количество: {config.min_amount} - {config.max_amount}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
