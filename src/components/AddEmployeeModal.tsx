import { useState, useEffect } from 'react';
import { X, User, Briefcase, Building2, Phone, Mail, AtSign, CreditCard, Calendar, Link, Key, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { transliterate, generateCabinetSlug } from '../lib/transliteration';

interface Branch {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

interface AddEmployeeModalProps {
  partnerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEmployeeModal({ partnerId, onClose, onSuccess }: AddEmployeeModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [positionId, setPositionId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [bankCardNumber, setBankCardNumber] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          .order('name')
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);
      if (positionsRes.data) setPositions(positionsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateUniqueSlug = async (baseSlug: string): Promise<string> => {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('cabinet_slug', slug)
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
        .maybeSingle();

      if (!data) break;
      login = `${baseLogin}${++counter}`;
    }
    return login;
  };

  const generatePassword = (): string => {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
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
      const lastNameValue = lastName.trim() || firstName.trim();
      const baseSlug = generateCabinetSlug(firstName.trim(), lastNameValue);

      if (!baseSlug) {
        throw new Error('Не удалось сгенерировать slug');
      }

      const cabinetSlug = await generateUniqueSlug(baseSlug);

      const baseLogin = transliterate(firstName.trim()).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!baseLogin) {
        throw new Error('Не удалось сгенерировать логин');
      }

      const cabinetLogin = await generateUniqueLogin(baseLogin);
      const cabinetPassword = generatePassword();

      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .insert({
          partner_id: partnerId,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          position_id: positionId || null,
          branch_id: branchId || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          telegram_username: telegramUsername.trim() || null,
          bank_card_number: bankCardNumber.trim() || null,
          hire_date: hireDate,
          current_status: 'working',
          is_active: true,
          cabinet_slug: cabinetSlug,
          cabinet_login: cabinetLogin,
          cabinet_password: cabinetPassword
        })
        .select()
        .single();

      if (employeeError) throw employeeError;

      const { error: historyError } = await supabase
        .from('employment_history')
        .insert({
          employee_id: employee.id,
          start_date: hireDate,
          status_type: 'worked'
        });

      if (historyError) throw historyError;

      onSuccess();
    } catch (err: any) {
      console.error('Error adding employee:', err);
      setError(err.message || 'Ошибка при добавлении сотрудника');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <h2 className="text-xl font-bold text-gray-900">Добавить сотрудника</h2>
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
            {saving ? 'Сохранение...' : 'Добавить сотрудника'}
          </button>
        </div>
      </div>
    </div>
  );
}
