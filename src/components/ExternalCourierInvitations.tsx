import { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Trash2, User, Search, Filter, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TelegramIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
  </svg>
);

const ViberIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.177.693 6.698.623 9.82c-.06 3.11-.13 8.95 5.5 10.541v2.42s-.038.97.602 1.17c.79.25 1.24-.499 1.99-1.299l1.4-1.58c3.85.32 6.8-.419 7.14-.529.78-.25 5.181-.811 5.901-6.652.74-6.031-.36-9.831-2.34-11.551l-.01-.002c-.6-.55-3-2.3-8.37-2.32 0 0-.396-.025-1.038-.016zm.067 1.697c.545-.003.88.02.88.02 4.54.01 6.711 1.38 7.221 1.84 1.67 1.429 2.528 4.856 1.9 9.892-.6 4.88-4.17 5.19-4.83 5.4-.28.09-2.88.73-6.152.52 0 0-2.439 2.941-3.199 3.701-.12.13-.26.17-.35.15-.13-.03-.17-.19-.16-.41l.02-4.019c-4.771-1.32-4.491-6.302-4.441-8.902.06-2.6.55-4.732 2-6.172 1.957-1.77 5.475-2.01 7.11-2.02zm.36 2.6a.299.299 0 0 0-.3.299.3.3 0 0 0 .3.3 5.631 5.631 0 0 1 4.03 1.59 5.83 5.83 0 0 1 1.722 4.04.3.3 0 0 0 .3.3.3.3 0 0 0 .299-.3 6.436 6.436 0 0 0-1.918-4.47 6.246 6.246 0 0 0-4.432-1.76zm-3.954.698a.955.955 0 0 0-.615.12h-.012c-.41.24-.788.54-1.148.94-.27.32-.421.639-.461.949a1.24 1.24 0 0 0 .05.541l.02.01a13.722 13.722 0 0 0 1.2 2.6 15.383 15.383 0 0 0 2.32 3.171l.03.04.04.03.03.03.03.03a15.603 15.603 0 0 0 3.18 2.33c1.32.72 2.122 1.06 2.602 1.2v.01c.14.04.268.06.398.06a1.84 1.84 0 0 0 1.102-.472c.398-.36.688-.738.93-1.148v-.01c.23-.43.15-.841-.18-1.121a13.632 13.632 0 0 0-2.15-1.54c-.51-.28-1.03-.11-1.24.17l-.45.569c-.23.28-.65.24-.65.24l-.012.01c-3.12-.8-3.95-3.959-3.95-3.959s-.04-.43.25-.65l.56-.45c.27-.22.46-.74.17-1.25a13.522 13.522 0 0 0-1.54-2.15.843.843 0 0 0-.504-.3zm4.473.89a.3.3 0 0 0 .002.6 4.43 4.43 0 0 1 3.162 1.2 4.24 4.24 0 0 1 1.282 3.166.3.3 0 1 0 .599-.004 4.843 4.843 0 0 0-1.462-3.614 5.03 5.03 0 0 0-3.583-1.348zm.43 1.607a.299.299 0 1 0 .032.597 3.028 3.028 0 0 1 1.96.7 2.732 2.732 0 0 1 .768 1.942.3.3 0 0 0 .3.299.3.3 0 0 0 .3-.3 3.333 3.333 0 0 0-.94-2.362 3.63 3.63 0 0 0-2.42-.876z"/>
  </svg>
);

interface Invite {
  id: string;
  partner_id: string;
  phone: string;
  name: string | null;
  invite_code: string;
  created_at: string;
  started_at: string | null;
  registered_at: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  courier_id: string | null;
  status: 'created' | 'started' | 'registered' | 'ignored';
}

interface ExternalCourierInvitationsProps {
  partnerId: string;
  botUsername: string | null;
  onOpenCourier?: (courierId: string) => void;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return '+38' + digits;
  }
  if (digits.startsWith('38') && digits.length === 12) {
    return '+' + digits;
  }
  if (digits.startsWith('380') && digits.length === 12) {
    return '+' + digits;
  }
  if (!digits.startsWith('+')) {
    return '+' + digits;
  }
  return phone;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('380')) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }
  return phone;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  created: { label: 'Создано', color: 'bg-gray-100 text-gray-700' },
  started: { label: 'Нажал /start', color: 'bg-yellow-100 text-yellow-700' },
  registered: { label: 'Зарегистрирован', color: 'bg-green-100 text-green-700' },
  ignored: { label: 'Игнорировано', color: 'bg-red-100 text-red-700' },
};

export default function ExternalCourierInvitations({ partnerId, botUsername, onOpenCourier }: ExternalCourierInvitationsProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingInvite, setDeletingInvite] = useState<Invite | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadInvites = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('external_courier_invites')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filtered = data || [];

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(inv =>
          inv.phone.toLowerCase().includes(q) ||
          (inv.name && inv.name.toLowerCase().includes(q))
        );
      }

      const now = new Date();
      const updatedInvites = filtered.map(inv => {
        if (inv.status === 'created' && !inv.started_at) {
          const createdAt = new Date(inv.created_at);
          const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          if (hoursDiff > 48) {
            return { ...inv, status: 'ignored' as const };
          }
        }
        return inv;
      });

      const toUpdate = updatedInvites.filter((inv, idx) =>
        inv.status === 'ignored' && filtered[idx].status !== 'ignored'
      );

      if (toUpdate.length > 0) {
        await supabase
          .from('external_courier_invites')
          .update({ status: 'ignored' })
          .in('id', toUpdate.map(i => i.id));
      }

      setInvites(updatedInvites);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      setLoading(false);
    }
  }, [partnerId, statusFilter, searchQuery]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleCreate = async () => {
    if (!newPhone.trim()) return;

    setCreating(true);
    try {
      const normalizedPhone = normalizePhone(newPhone);
      const inviteCode = generateInviteCode();

      const { data, error } = await supabase
        .from('external_courier_invites')
        .insert({
          partner_id: partnerId,
          phone: normalizedPhone,
          name: newName.trim() || null,
          invite_code: inviteCode,
          status: 'created',
        })
        .select()
        .single();

      if (error) throw error;

      setInvites(prev => [data, ...prev]);
      setShowCreateModal(false);
      setNewPhone('');
      setNewName('');
    } catch (error) {
      console.error('Error creating invite:', error);
      alert('Ошибка при создании приглашения');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingInvite) return;

    try {
      const { error } = await supabase
        .from('external_courier_invites')
        .delete()
        .eq('id', deletingInvite.id);

      if (error) throw error;

      setInvites(prev => prev.filter(i => i.id !== deletingInvite.id));
      setDeletingInvite(null);
    } catch (error) {
      console.error('Error deleting invite:', error);
      alert('Ошибка при удалении приглашения');
    }
  };

  const copyInviteLink = async (invite: Invite) => {
    if (!botUsername) {
      alert('Бот не настроен');
      return;
    }

    const link = `https://t.me/${botUsername}?start=i_${invite.invite_code}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  const openTelegramChat = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    window.open(`https://t.me/+${digits}`, '_blank');
  };

  const openViberChat = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    window.open(`viber://chat?number=${digits}`, '_blank');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Приглашения</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${
              showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Фильтры
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Пригласить курьера
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Телефон или имя..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Все</option>
              <option value="created">Создано</option>
              <option value="started">Нажал /start</option>
              <option value="registered">Зарегистрирован</option>
              <option value="ignored">Игнорировано</option>
            </select>
          </div>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="px-3 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Сбросить
            </button>
          )}
        </div>
      )}

      {invites.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
          <p className="text-gray-600 font-medium mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Приглашения не найдены'
              : 'У вас пока нет приглашений'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Пригласить первого курьера
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Телефон</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Имя</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Статус</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Добавлен</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">/start</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Регистрация</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{formatPhone(invite.phone)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{invite.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[invite.status]?.color || 'bg-gray-100'}`}>
                        {statusLabels[invite.status]?.label || invite.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(invite.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(invite.started_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(invite.registered_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => copyInviteLink(invite)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Копировать ссылку"
                        >
                          {copiedId === invite.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openTelegramChat(invite.phone)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Открыть в Telegram"
                        >
                          <TelegramIcon />
                        </button>
                        <button
                          onClick={() => openViberChat(invite.phone)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Открыть в Viber"
                        >
                          <ViberIcon />
                        </button>
                        {invite.status === 'registered' && invite.courier_id && onOpenCourier && (
                          <button
                            onClick={() => onOpenCourier(invite.courier_id!)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Открыть курьера"
                          >
                            <User className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingInvite(invite)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Пригласить курьера
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Телефон <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+380501234567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Имя (опционально)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPhone('');
                  setNewName('');
                }}
                disabled={creating}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newPhone.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-semibold disabled:opacity-50"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Удаление приглашения
            </h3>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить приглашение для <span className="font-semibold">{formatPhone(deletingInvite.phone)}</span>?
              {deletingInvite.status === 'registered' && (
                <span className="block mt-2 text-sm text-gray-500">
                  Курьер уже зарегистрирован и не будет удален.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingInvite(null)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
