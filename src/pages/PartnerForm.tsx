import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Partner } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function PartnerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isEdit = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    url_suffix: '',
    logo_url: '',
    status: 'active' as Partner['status'],
    pause_message: '',
  });
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role?.name !== 'founder') {
      navigate('/');
      return;
    }

    if (isEdit) {
      loadPartner();
    }
  }, [id, isEdit, role, navigate]);

  const loadPartner = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          name: data.name,
          url_suffix: data.url_suffix,
          logo_url: data.logo_url || '',
          status: data.status,
          pause_message: data.pause_message || '',
        });
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (err) {
      console.error('Error loading partner:', err);
      setError('Ошибка загрузки данных');
    }
  };

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const isPNG = file.type === 'image/png';
          resolve(canvas.toDataURL(isPNG ? 'image/png' : 'image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5 МБ');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const resizedImage = await resizeImage(file, 400, 400);
      setLogoPreview(resizedImage);
      setFormData({ ...formData, logo_url: resizedImage });
    } catch (err) {
      console.error('Error resizing image:', err);
      setError('Ошибка обработки изображения');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview('');
    setFormData({ ...formData, logo_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateUrlSuffix = (value: string) => {
    const regex = /^[a-z0-9-]+$/;
    return regex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validateUrlSuffix(formData.url_suffix)) {
      setError('URL суффикс может содержать только латинские буквы в нижнем регистре, цифры и дефисы');
      setLoading(false);
      return;
    }

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('partners')
          .update({
            name: formData.name,
            url_suffix: formData.url_suffix,
            logo_url: formData.logo_url || null,
            status: formData.status,
            pause_message: formData.pause_message || null,
          })
          .eq('id', id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('partners')
          .insert({
            name: formData.name,
            url_suffix: formData.url_suffix,
            logo_url: formData.logo_url || null,
            status: formData.status,
            pause_message: formData.pause_message || null,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            setError('Партнёр с таким URL суффиксом уже существует');
            setLoading(false);
            return;
          }
          throw insertError;
        }
      }

      navigate('/super-admin/partners');
    } catch (err) {
      console.error('Error saving partner:', err);
      setError('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <button
            onClick={() => navigate('/super-admin/partners')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Назад к списку</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-8">
            {isEdit ? 'Редактирование партнёра' : 'Создание партнёра'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Название партнёра
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Например: Pizza City"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                URL суффикс
              </label>
              <input
                type="text"
                value={formData.url_suffix}
                onChange={(e) => setFormData({ ...formData, url_suffix: e.target.value.toLowerCase() })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono"
                placeholder="pizza-city"
                required
              />
              <p className="mt-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                Будущий URL: <span className="font-semibold text-blue-600">https://restopresto.org/{formData.url_suffix || '...'}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Логотип
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={loading}
              />

              {logoPreview ? (
                <div className="relative inline-block">
                  <img
                    src={logoPreview}
                    alt="Предпросмотр"
                    className="w-40 h-40 object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={loading}
                    className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 hover:border-blue-500 hover:bg-blue-50/50 transition-all group disabled:opacity-50"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl group-hover:from-blue-200 group-hover:to-cyan-200 transition-all">
                      <ImageIcon className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">
                        {loading ? 'Обработка изображения...' : 'Нажмите для выбора изображения'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG до 5 МБ • Автоматическое изменение размера</p>
                    </div>
                  </div>
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Статус
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Partner['status'] })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              >
                <option value="active">Активен</option>
                <option value="paused">На паузе</option>
              </select>
            </div>

            {formData.status === 'paused' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Сообщение о паузе
                </label>
                <textarea
                  value={formData.pause_message}
                  onChange={(e) => setFormData({ ...formData, pause_message: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  rows={3}
                  placeholder="Временно не работаем. Приносим извинения."
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3.5 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Создать партнёра'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/partners')}
                className="px-8 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
