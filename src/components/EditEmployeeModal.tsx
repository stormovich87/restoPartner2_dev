import { useState, useEffect, useRef } from 'react';
import { X, User, Briefcase, Building2, Phone, Mail, AtSign, CreditCard, Calendar, Hash, Upload, Camera, Loader2, Link, Key, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import EmployeeAvatar from './EmployeeAvatar';
import { transliterate, generateCabinetSlug } from '../lib/transliteration';

interface Branch {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  partner_id: string;
  branch_id: string | null;
  position_id: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  telegram_username: string | null;
  telegram_user_id: string | null;
  bank_card_number: string | null;
  hire_date: string;
  photo_url?: string | null;
  cabinet_slug?: string | null;
  cabinet_login?: string | null;
  cabinet_password?: string | null;
}

interface EditEmployeeModalProps {
  partnerId: string;
  employee: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditEmployeeModal({ partnerId, employee, onClose, onSuccess }: EditEmployeeModalProps) {
  const [firstName, setFirstName] = useState(employee.first_name);
  const [lastName, setLastName] = useState(employee.last_name || '');
  const [positionId, setPositionId] = useState(employee.position_id || '');
  const [branchId, setBranchId] = useState(employee.branch_id || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [email, setEmail] = useState(employee.email || '');
  const [telegramUsername, setTelegramUsername] = useState(employee.telegram_username || '');
  const [bankCardNumber, setBankCardNumber] = useState(employee.bank_card_number || '');
  const [hireDate, setHireDate] = useState(employee.hire_date || new Date().toISOString().split('T')[0]);
  const [photoUrl, setPhotoUrl] = useState(employee.photo_url || '');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cabinetSlug, setCabinetSlug] = useState(employee.cabinet_slug || '');
  const [cabinetLogin, setCabinetLogin] = useState(employee.cabinet_login || '');
  const [cabinetPassword, setCabinetPassword] = useState(employee.cabinet_password || '');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [regeneratingCredentials, setRegeneratingCredentials] = useState(false);

  useEffect(() => {
    loadBranchesAndPositions();
  }, [partnerId]);

  const loadBranchesAndPositions = async () => {
    try {
      const [branchesRes, positionsRes] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('positions')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('is_visible', true)
          .order('name')
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);
      if (positionsRes.data) setPositions(positionsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5MB');
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employee.id}-${Date.now()}.${fileExt}`;
      const filePath = `${partnerId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(filePath);

      setPhotoUrl(publicUrl);

      const { error: updateError } = await supabase
        .from('employees')
        .update({ photo_url: publicUrl })
        .eq('id', employee.id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Ошибка при загрузке фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handlePhotoUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generatePassword = (): string => {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const generateUniqueSlug = async (baseSlug: string): Promise<string> => {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('cabinet_slug', slug)
        .neq('id', employee.id)
        .maybeSingle();

      if (!data) break;
      slug = `${baseSlug}-${++counter}`;
    }
    return slug;
  };

  const generateUniqueLogin = async (baseLogin: string): Promise<string> => {
    let login = baseLogin;
    let counter = 1;

    while (true) {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('partner_id', partnerId)
        .eq('cabinet_login', login)
        .neq('id', employee.id)
        .maybeSingle();

      if (!data) break;
      login = `${baseLogin}${++counter}`;
    }
    return login;
  };

  const regenerateCredentials = async () => {
    setRegeneratingCredentials(true);
    setError(null);

    try {
      if (!firstName.trim()) {
        throw new Error('Имя сотрудника не может быть пустым');
      }

      const lastNameValue = lastName.trim() || firstName.trim();
      const baseSlug = generateCabinetSlug(firstName.trim(), lastNameValue);

      if (!baseSlug) {
        throw new Error('Не удалось сгенерировать slug');
      }

      const newSlug = await generateUniqueSlug(baseSlug);

      const baseLogin = transliterate(firstName.trim()).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!baseLogin) {
        throw new Error('Не удалось сгенерировать логин');
      }

      const newLogin = await generateUniqueLogin(baseLogin);
      const newPassword = generatePassword();

      const { error: updateError } = await supabase
        .from('employees')
        .update({
          cabinet_slug: newSlug,
          cabinet_login: newLogin,
          cabinet_password: newPassword
        })
        .eq('id', employee.id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error(updateError.message || 'Ошибка при обновлении в базе данных');
      }

      setCabinetSlug(newSlug);
      setCabinetLogin(newLogin);
      setCabinetPassword(newPassword);

      setError(null);
    } catch (err: any) {
      console.error('Error regenerating credentials:', err);
      setError(err.message || 'Ошибка при обновлении данных кабинета');
    } finally {
      setRegeneratingCredentials(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError('Введите имя сотрудника');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          position_id: positionId || null,
          branch_id: branchId || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          telegram_username: telegramUsername.trim() || null,
          bank_card_number: bankCardNumber.trim() || null,
          hire_date: hireDate,
          photo_url: photoUrl || null,
        })
        .eq('id', employee.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (err) {
      console.error('Error updating employee:', err);
      setError('Ошибка при обновлении сотрудника');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <h2 className="text-xl font-bold text-gray-900">Редактировать сотрудника</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div
            className={`mb-6 flex flex-col items-center p-6 rounded-xl border-2 border-dashed transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="relative mb-4">
              <EmployeeAvatar
                photoUrl={photoUrl}
                firstName={firstName}
                lastName={lastName}
                size="xl"
              />
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                Перетащите фото сюда или
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Загрузить фото
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.capture = 'environment';
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  Камера
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Hash className="w-4 h-4" />
              <span className="font-medium">Telegram User ID:</span>
              <span className="font-mono text-gray-900">
                {employee.telegram_user_id || 'Не привязан'}
              </span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Кабинет сотрудника</span>
              </div>
              <button
                type="button"
                onClick={regenerateCredentials}
                disabled={regeneratingCredentials}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${regeneratingCredentials ? 'animate-spin' : ''}`} />
                Обновить
              </button>
            </div>

            {cabinetSlug ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ссылка на кабинет</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg font-mono text-sm text-gray-900 truncate">
                      {window.location.origin}/employee/{cabinetSlug}
                    </div>
                    <button
                      type="button"
                      onClick={() => window.open(`${window.location.origin}/employee/${cabinetSlug}`, '_blank')}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Открыть кабинет"
                    >
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${window.location.origin}/employee/${cabinetSlug}`, 'url')}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Копировать"
                    >
                      {copiedField === 'url' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-blue-600" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Логин</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg font-mono text-sm text-gray-900">
                        {cabinetLogin}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cabinetLogin, 'login')}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Копировать"
                      >
                        {copiedField === 'login' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-blue-600" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Пароль</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg font-mono text-sm text-gray-900">
                        {cabinetPassword}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cabinetPassword, 'password')}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Копировать"
                      >
                        {copiedField === 'password' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-blue-600" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-3">Данные для входа в кабинет не настроены</p>
                <button
                  type="button"
                  onClick={regenerateCredentials}
                  disabled={regeneratingCredentials}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {regeneratingCredentials ? 'Создание...' : 'Создать данные для входа'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1.5" />
                Имя *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Введите имя"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1.5" />
                Фамилия
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Введите фамилию"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Briefcase className="w-4 h-4 inline mr-1.5" />
                Должность
              </label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">Выберите должность</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-1.5" />
                Филиал
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">Выберите филиал</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1.5" />
                Номер телефона
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="+380 XX XXX XX XX"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1.5" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <AtSign className="w-4 h-4 inline mr-1.5" />
                Telegram Username
              </label>
              <input
                type="text"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="@username"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <CreditCard className="w-4 h-4 inline mr-1.5" />
                Номер банковской карты
              </label>
              <input
                type="text"
                value={bankCardNumber}
                onChange={(e) => setBankCardNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="XXXX XXXX XXXX XXXX"
                maxLength={19}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1.5" />
                Дата начала работы
              </label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl transition-all font-semibold"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-semibold disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}
