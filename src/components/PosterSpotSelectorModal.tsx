import { useState, useEffect } from 'react';
import { X, MapPin, Search } from 'lucide-react';

interface PosterSpot {
  spot_id: number;
  name: string;
  address: string;
}

interface PosterSpotSelectorModalProps {
  posterAccount: string;
  posterApiToken: string;
  onClose: () => void;
  onSelect: (spot: PosterSpot) => void;
}

export default function PosterSpotSelectorModal({
  posterAccount,
  posterApiToken,
  onClose,
  onSelect,
}: PosterSpotSelectorModalProps) {
  const [spots, setSpots] = useState<PosterSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSpots();
  }, []);

  const loadSpots = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poster-get-spots`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            poster_account: posterAccount,
            poster_api_token: posterApiToken,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при загрузке заведений Poster');
      }

      const data = await response.json();

      if (data.response && Array.isArray(data.response)) {
        setSpots(data.response);
      } else {
        throw new Error('Некорректный формат ответа от Poster API');
      }
    } catch (err) {
      console.error('Error loading Poster spots:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке заведений');
    } finally {
      setLoading(false);
    }
  };

  const filteredSpots = spots.filter((spot) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      spot.name.toLowerCase().includes(searchLower) ||
      spot.address.toLowerCase().includes(searchLower) ||
      String(spot.spot_id).includes(searchLower)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Выбор заведения Poster
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600 font-medium">Загрузка заведений...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 font-semibold mb-2">Ошибка</p>
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={loadSpots}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Повторить
              </button>
            </div>
          )}

          {!loading && !error && spots.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Заведения не найдены</p>
              <p className="text-gray-500 text-sm mt-2">
                Проверьте настройки Poster в разделе Настройки → Poster
              </p>
            </div>
          )}

          {!loading && !error && spots.length > 0 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск по названию, адресу или ID..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Адрес</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredSpots.map((spot) => (
                      <tr key={spot.spot_id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">{spot.spot_id}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{spot.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{spot.address}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onSelect(spot)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-sm hover:shadow-md text-sm font-semibold"
                          >
                            Привязать
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredSpots.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Ничего не найдено по запросу "{searchTerm}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-white transition-colors font-semibold"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
