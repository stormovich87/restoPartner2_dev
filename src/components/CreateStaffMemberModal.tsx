import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Position {
  id: string;
  name: string;
  branches?: Array<{ name: string }>;
}

interface CreateStaffMemberModalProps {
  partnerId: string;
  staffToEdit?: {
    id: string;
    first_name: string;
    last_name: string;
    position_id: string;
    phone: string | null;
    telegram_user_id: string | null;
    telegram_username: string | null;
    login: string;
    is_active: boolean;
    created_at?: string;
    password_hash?: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateStaffMemberModal({ partnerId, staffToEdit, onClose, onSuccess }: CreateStaffMemberModalProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [positionId, setPositionId] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramUserId, setTelegramUserId] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPositions();
  }, []);

  useEffect(() => {
    if (staffToEdit) {
      setFirstName(staffToEdit.first_name);
      setLastName(staffToEdit.last_name);
      setPositionId(staffToEdit.position_id);
      setPhone(staffToEdit.phone || '');
      setTelegramUserId(staffToEdit.telegram_user_id || '');
      setTelegramUsername(staffToEdit.telegram_username || '');
      setLogin(staffToEdit.login);
      setIsActive(staffToEdit.is_active);
    }
  }, [staffToEdit]);

  const loadPositions = async () => {
    try {
      const { data: positionsData } = await supabase
        .from('positions')
        .select('id, name')
        .eq('partner_id', partnerId)
        .order('name');

      if (positionsData) {
        const positionsWithBranches = await Promise.all(
          positionsData.map(async (position) => {
            const { data: branchLinks } = await supabase
              .from('position_branches')
              .select('branch_id, branches(name)')
              .eq('position_id', position.id);

            return {
              ...position,
              branches: branchLinks?.map(link => ({ name: (link as any).branches.name })) || []
            };
          })
        );

        setPositions(positionsWithBranches);
      }
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const hashPassword = (password: string): string => {
    return password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      alert('Введите имя и фамилию');
      return;
    }

    if (!positionId) {
      alert('Выберите должность');
      return;
    }

    if (!login.trim()) {
      alert('Введите логин');
      return;
    }

    if (!staffToEdit && !password.trim()) {
      alert('Введите пароль');
      return;
    }

    setLoading(true);
    try {
      if (staffToEdit) {
        const updateData: any = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          position_id: positionId,
          phone: phone.trim() || null,
          telegram_user_id: telegramUserId.trim() || null,
          telegram_username: telegramUsername.trim() || null,
          login: login.trim(),
          is_active: isActive,
          updated_at: new Date().toISOString()
        };

        if (password.trim()) {
          updateData.password_hash = hashPassword(password.trim());
        }

        const { error: updateError } = await supabase
          .from('staff_members')
          .update(updateData)
          .eq('id', staffToEdit.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('staff_members')
          .insert({
            partner_id: partnerId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            position_id: positionId,
            phone: phone.trim() || null,
            telegram_user_id: telegramUserId.trim() || null,
            telegram_username: telegramUsername.trim() || null,
            login: login.trim(),
            password_hash: hashPassword(password.trim()),
            is_active: isActive
          });

        if (insertError) {
          throw insertError;
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving staff member:', error);
      if (error.code === '23505') {
        alert('Работник с таким логином уже существует');
      } else {
        alert(`Ошибка при сохранении работника: ${error.message || 'неизвестная ошибка'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {staffToEdit ? 'Редактировать работника' : 'Добавить работника'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Имя
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Имя"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Фамилия
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Фамилия"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Должность
              </label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Выберите должность</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
              {positionId && (() => {
                const selectedPosition = positions.find(p => p.id === positionId);
                if (selectedPosition && selectedPosition.branches && selectedPosition.branches.length > 0) {
                  return (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Доступные филиалы:</p>
                      <p className="text-sm text-blue-700">
                        {selectedPosition.branches.map(b => b.name).join(', ')}
                      </p>
                    </div>
                  );
                } else if (selectedPosition) {
                  return (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600">Доступ ко всем филиалам</p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Номер телефона
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={telegramUserId}
                  onChange={(e) => setTelegramUserId(e.target.value)}
                  placeholder="Telegram User ID"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder="@username"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Данные для входа в админку
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Логин
                  </label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Логин"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Пароль {staffToEdit && <span className="text-gray-500 text-xs">(оставьте пустым, чтобы не менять)</span>}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    required={!staffToEdit}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {staffToEdit && staffToEdit.created_at && (
              <div className="text-sm text-gray-500">
                Дата добавления: {new Date(staffToEdit.created_at).toLocaleDateString('ru-RU')}
              </div>
            )}

            <div>
              <label className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <div>
                  <span className="text-gray-900 font-semibold block">
                    Работает
                  </span>
                  <span className="text-sm text-gray-600">
                    Выключите, если работник уволен
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t bg-white rounded-b-2xl flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : staffToEdit ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
