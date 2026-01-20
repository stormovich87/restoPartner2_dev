import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Search, X, ArrowLeft } from 'lucide-react';

interface Category {
  poster_category_id: number;
  name: string;
}

interface Product {
  id: string;
  poster_product_id: number;
  name: string;
  price: number;
  photo_url: string | null;
  category_poster_id: number;
}

interface CheckItem {
  id: string;
  product_poster_id: number;
  quantity: number;
}

interface ProductSelectorProps {
  partnerId: string;
  currencySymbol: string;
  onProductSelect: (product: Product) => void;
  checkItems?: CheckItem[];
  onRemoveFromCheck?: (productPosterId: number) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

export default function ProductSelector({
  partnerId,
  currencySymbol,
  onProductSelect,
  checkItems = [],
  onRemoveFromCheck,
  isMobile = false,
  onClose
}: ProductSelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [partnerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        supabase
          .from('categories')
          .select('poster_category_id, name')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('products')
          .select('id, poster_product_id, name, price, photo_url, category_poster_id')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategoryId ? p.category_poster_id === selectedCategoryId : true;
    const matchesSearch = searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getProductQuantity = (productPosterId: number) => {
    const item = checkItems.find(ci => ci.product_poster_id === productPosterId);
    return item ? item.quantity : 0;
  };

  return (
    <div className={`flex-1 flex flex-col bg-gray-50 overflow-hidden ${isMobile ? 'fixed inset-0 z-50' : ''}`}>
      {isMobile && (
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h3 className="text-xl font-bold">Каталог товарів</h3>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук товару"
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              selectedCategoryId === null
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Усі товари
          </button>
          {categories.map(category => (
            <button
              key={category.poster_category_id}
              onClick={() => setSelectedCategoryId(category.poster_category_id)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                selectedCategoryId === category.poster_category_id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Package className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-semibold">Немає товарів</p>
            <p className="text-sm">
              {searchQuery ? 'Нічого не знайдено за запитом' : "Товари з'являться після синхронізації з Poster"}
            </p>
          </div>
        ) : (
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
            {filteredProducts.map(product => {
              const quantity = getProductQuantity(product.poster_product_id);
              const isInCheck = quantity > 0;

              return (
                <button
                  key={product.id}
                  onClick={() => onProductSelect(product)}
                  className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col group border-2 ${
                    isInCheck
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-transparent hover:border-blue-500'
                  } relative`}
                >
                  <div className={`aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative ${
                    isInCheck ? 'opacity-75' : ''
                  }`}>
                    {product.photo_url ? (
                      <img
                        src={product.photo_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-gray-400" />
                    )}
                    {isInCheck && (
                      <>
                        <div className="absolute top-2 right-2 bg-blue-600 text-white text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg z-10">
                          {quantity}
                        </div>
                        {onRemoveFromCheck && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveFromCheck(product.poster_product_id);
                            }}
                            className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg transition-colors z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </p>
                    <p className="text-lg font-bold text-blue-600">
                      {product.price.toFixed(2)} {currencySymbol}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
