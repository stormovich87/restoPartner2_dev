import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Users, Shield, LogOut, Plus, Edit, Trash2, Save, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Partner } from '../types';

interface AdminUser {
  id: string;
  login: string;
  password_hash: string;
  name: string | null;
  last_name: string | null;
  phone: string | null;
  is_super_admin: boolean;
  active: boolean;
  created_at: string;
}

interface AdminPermission {
  id: string;
  admin_user_id: string;
  can_pause_partners: boolean;
  can_delete_partners: boolean;
  can_create_partners: boolean;
  can_edit_partners: boolean;
  access_all_partners: boolean;
}

interface AdminPartnerAccess {
  id: string;
  admin_user_id: string;
  partner_id: string;
}

interface AdminUserWithPermissions extends AdminUser {
  permissions?: AdminPermission;
  partner_access?: AdminPartnerAccess[];
}

export default function Accesses() {
  const [adminUsers, setAdminUsers] = useState<AdminUserWithPermissions[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [totalPartnerCount, setTotalPartnerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserWithPermissions | null>(null);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();
  const { logout, role, adminUser } = useAuth();

  const [formData, setFormData] = useState({
    login: '',
    password: '',
    name: '',
    last_name: '',
    phone: '',
    can_pause_partners: false,
    can_delete_partners: false,
    can_create_partners: false,
    can_edit_partners: false,
    access_all_partners: true,
    selected_partners: [] as string[],
  });

  useEffect(() => {
    if (role?.name !== 'founder') {
      navigate('/');
      return;
    }
    if (!adminUser?.is_super_admin) {
      navigate('/super-admin/partners');
      return;
    }
    loadData();
  }, [role, adminUser, navigate]);

  const loadData = async () => {
    try {
      const [usersResult, partnersResult] = await Promise.all([
        supabase
          .from('admin_users')
          .select(`
            *,
            admin_permissions!admin_permissions_admin_user_id_fkey(*),
            admin_partner_access!admin_partner_access_admin_user_id_fkey(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('partners')
          .select('*')
          .neq('status', 'deleted')
          .order('name', { ascending: true }),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (partnersResult.error) throw partnersResult.error;

      const usersWithPermissions = (usersResult.data || []).map((user: any) => ({
        ...user,
        permissions: user.admin_permissions?.[0] || null,
        partner_access: user.admin_partner_access || [],
      }));

      setAdminUsers(usersWithPermissions);
      setPartners(partnersResult.data || []);
      setTotalPartnerCount((partnersResult.data || []).length);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: AdminUserWithPermissions) => {
    if (user.is_super_admin) return;

    const accessAll = user.permissions?.access_all_partners || false;
    const partnerIds = user.partner_access?.map((pa) => pa.partner_id) || [];

    setEditingUser(user);
    setFormData({
      login: user.login,
      password: '',
      name: user.name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      can_pause_partners: user.permissions?.can_pause_partners || false,
      can_delete_partners: user.permissions?.can_delete_partners || false,
      can_create_partners: user.permissions?.can_create_partners || false,
      can_edit_partners: user.permissions?.can_edit_partners || false,
      access_all_partners: accessAll,
      selected_partners: accessAll ? partners.map(p => p.id) : partnerIds,
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: string, isSuperAdmin: boolean) => {
    if (isSuperAdmin) {
      alert('Супер-админ не может быть удалён');
      return;
    }

    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

    try {
      const { error } = await supabase.from('admin_users').delete().eq('id', userId);

      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Ошибка при удалении пользователя');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        const updates: any = {
          login: formData.login,
          name: formData.name,
          last_name: formData.last_name,
          phone: formData.phone,
        };

        if (formData.password) {
          updates.password_hash = formData.password;
        }

        const { error: userError } = await supabase
          .from('admin_users')
          .update(updates)
          .eq('id', editingUser.id);

        if (userError) throw userError;

        const { error: permError } = await supabase
          .from('admin_permissions')
          .update({
            can_pause_partners: true,
            can_delete_partners: true,
            can_create_partners: true,
            can_edit_partners: true,
            access_all_partners: true,
          })
          .eq('admin_user_id', editingUser.id);

        if (permError) throw permError;

        await supabase
          .from('admin_partner_access')
          .delete()
          .eq('admin_user_id', editingUser.id);

        if (formData.selected_partners.length > 0) {
          const accessRecords = formData.selected_partners.map((partnerId) => ({
            admin_user_id: editingUser.id,
            partner_id: partnerId,
          }));

          const { error: accessError } = await supabase
            .from('admin_partner_access')
            .insert(accessRecords);

          if (accessError) throw accessError;
        }
      } else {
        const { data: newUser, error: userError } = await supabase
          .from('admin_users')
          .insert({
            login: formData.login,
            password_hash: formData.password,
            name: formData.name,
            last_name: formData.last_name,
            phone: formData.phone,
            is_super_admin: false,
            active: true,
          })
          .select()
          .single();

        if (userError) throw userError;

        const { error: permError } = await supabase.from('admin_permissions').insert({
          admin_user_id: newUser.id,
          can_pause_partners: true,
          can_delete_partners: true,
          can_create_partners: true,
          can_edit_partners: true,
          access_all_partners: true,
        });

        if (permError) throw permError;

        const allPartnerIds = partners.map(p => p.id);
        if (allPartnerIds.length > 0) {
          const accessRecords = allPartnerIds.map((partnerId) => ({
            admin_user_id: newUser.id,
            partner_id: partnerId,
          }));

          const { error: accessError } = await supabase
            .from('admin_partner_access')
            .insert(accessRecords);

          if (accessError) throw accessError;
        }
      }

      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Error saving user:', err);
      const errorMessage = err?.message || err?.error_description || 'Неизвестная ошибка';
      alert(`Ошибка при сохранении пользователя: ${errorMessage}`);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({
      login: '',
      password: '',
      name: '',
      last_name: '',
      phone: '',
      can_pause_partners: false,
      can_delete_partners: false,
      can_create_partners: false,
      can_edit_partners: false,
      access_all_partners: true,
      selected_partners: [],
    });
  };

  const togglePartnerAccess = (partnerId: string) => {
    setFormData((prev) => ({
      ...prev,
      selected_partners: prev.selected_partners.includes(partnerId)
        ? prev.selected_partners.filter((id) => id !== partnerId)
        : [...prev.selected_partners, partnerId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-slate-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 overflow-hidden flex flex-col shadow-lg fixed lg:relative h-screen z-50`}
      >
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900">Админ-панель</div>
              <div className="text-xs text-gray-500">Управление</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => {
              navigate('/super-admin/partners');
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-gray-700 hover:bg-blue-50"
          >
            <Users className="w-5 h-5" />
            <span>Партнёры</span>
          </button>
          <button
            onClick={() => {
              navigate('/super-admin/accesses');
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
          >
            <Shield className="w-5 h-5" />
            <span>Доступы</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200/50">
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold"
          >
            <LogOut className="w-5 h-5" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2.5 hover:bg-blue-50 rounded-xl transition-colors"
                >
                  {sidebarOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
                </button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Управление доступами
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Добавить пользователя</span>
            </button>
          </div>

          {showForm && (
            <div className="mb-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Логин</label>
                    <input
                      type="text"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Пароль {editingUser && '(оставьте пустым для сохранения текущего)'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required={!editingUser}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Имя</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Фамилия</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Телефон</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Доступные партнёры</label>
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {partners.map((partner) => (
                        <label
                          key={partner.id}
                          className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selected_partners.includes(partner.id)}
                            onChange={() => {
                              const isCurrentlySelected = formData.selected_partners.includes(partner.id);
                              const newSelected = isCurrentlySelected
                                ? formData.selected_partners.filter(id => id !== partner.id)
                                : [...formData.selected_partners, partner.id];

                              setFormData({
                                ...formData,
                                selected_partners: newSelected
                              });
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{partner.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg font-semibold"
                  >
                    <Save className="w-5 h-5" />
                    <span>Сохранить</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          {adminUsers.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
              <p className="text-gray-600 font-medium">Нет пользователей</p>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Логин</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Имя и Фамилия</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Телефон</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Права</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Доступ</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{user.login}</span>
                          {user.is_super_admin && (
                            <span className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full">
                              SUPER
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-gray-700">
                        {user.name || user.last_name ? `${user.name || ''} ${user.last_name || ''}`.trim() : '—'}
                      </td>
                      <td className="px-6 py-5 text-gray-700">{user.phone || '—'}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1">
                          {user.permissions?.can_create_partners && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Создание</span>
                          )}
                          {user.permissions?.can_edit_partners && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">Редактирование</span>
                          )}
                          {user.permissions?.can_pause_partners && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Пауза</span>
                          )}
                          {user.permissions?.can_delete_partners && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Удаление</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {user.is_super_admin || user.permissions?.access_all_partners ? (
                          <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full border border-blue-200">
                            {totalPartnerCount} партнёр(ов)
                          </span>
                        ) : (
                          <span className="text-sm text-gray-600">
                            {user.partner_access?.length || 0} партнёр(ов)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            disabled={user.is_super_admin}
                            className="p-2.5 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors shadow-sm border border-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={user.is_super_admin ? 'Супер-админ не редактируется' : 'Редактировать'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.is_super_admin)}
                            disabled={user.is_super_admin}
                            className="p-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shadow-sm border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={user.is_super_admin ? 'Супер-админ не удаляется' : 'Удалить'}
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
          )}
        </main>
      </div>
    </div>
  );
}
