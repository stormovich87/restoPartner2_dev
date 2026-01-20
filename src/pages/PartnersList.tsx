import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Pause, Play, ExternalLink, LogOut, Copy, Check, Menu, X, Users, Shield, Code } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Partner } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDevMode } from '../contexts/DevModeContext';

export default function PartnersList() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { logout, role, adminUser } = useAuth();
  const { setDevViewPartnerPrefix } = useDevMode();

  const isSuperAdmin = adminUser?.is_super_admin || false;
  const hasAccessAllPartners = adminUser?.permissions?.access_all_partners || isSuperAdmin;
  const canCreatePartners = adminUser?.permissions?.can_create_partners || isSuperAdmin;
  const canEditPartners = adminUser?.permissions?.can_edit_partners || isSuperAdmin;
  const canPausePartners = adminUser?.permissions?.can_pause_partners || isSuperAdmin;
  const canDeletePartners = adminUser?.permissions?.can_delete_partners || isSuperAdmin;
  const accessiblePartnerIds = adminUser?.accessible_partner_ids || [];

  useEffect(() => {
    loadPartners();
  }, [navigate]);

  const loadPartners = async () => {
    try {
      let query = supabase
        .from('partners')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (!hasAccessAllPartners && accessiblePartnerIds.length > 0) {
        query = query.in('id', accessiblePartnerIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPartners(data || []);
    } catch (err) {
      console.error('Error loading partners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого партнёра?')) return;

    try {
      const { error } = await supabase
        .from('partners')
        .update({ status: 'deleted' })
        .eq('id', id);

      if (error) throw error;
      loadPartners();
    } catch (err) {
      console.error('Error deleting partner:', err);
      alert('Ошибка при удалении партнёра');
    }
  };

  const handleTogglePause = async (partner: Partner) => {
    const newStatus = partner.status === 'paused' ? 'active' : 'paused';

    try {
      const { error } = await supabase
        .from('partners')
        .update({ status: newStatus })
        .eq('id', partner.id);

      if (error) throw error;
      loadPartners();
    } catch (err) {
      console.error('Error updating partner:', err);
      alert('Ошибка при обновлении статуса');
    }
  };

  const handleOpenAdmin = (prefix: string) => {
    navigate(`/${prefix}/admin`);
  };

  const handleOpenAsDeveloper = (prefix: string) => {
    setDevViewPartnerPrefix(prefix);
    navigate(`/${prefix}/admin`);
  };

  const handleCopyUrl = async (prefix: string, partnerId: string) => {
    const url = `${window.location.origin}/${prefix}/login`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(partnerId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 overflow-y-auto flex flex-col shadow-lg fixed lg:relative h-screen z-50`}
      >
        <div className="p-6 border-b border-gray-200/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900">
                {adminUser?.name || adminUser?.login || 'Админ'}
              </div>
              <div className="text-xs text-gray-500">
                {isSuperAdmin ? 'Супер Администратор' : 'Администратор'}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => {
              navigate('/super-admin/partners');
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
          >
            <Users className="w-5 h-5" />
            <span>Партнёры</span>
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => {
                navigate('/super-admin/accesses');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-gray-700 hover:bg-blue-50"
            >
              <Shield className="w-5 h-5" />
              <span>Доступы</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200/50 flex-shrink-0">
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

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
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
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Управление партнёрами</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/partners/create')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Добавить партнёра</span>
          </button>
        </div>

        {partners.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
            <p className="text-gray-600 font-medium">Пока нет партнёров</p>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Логотип</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Название</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Дата создания</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Статус</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-5">
                      {partner.logo_url ? (
                        <img src={partner.logo_url} alt={partner.name} className="w-12 h-12 object-contain" />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center text-blue-600 text-xs font-semibold">
                          Нет
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 font-semibold text-gray-900">{partner.name}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-600 font-mono bg-gray-50 px-3 py-1.5 rounded-lg">
                          /{partner.url_suffix}/login
                        </div>
                        <button
                          onClick={() => handleCopyUrl(partner.url_suffix, partner.id)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Копировать полную ссылку на вход"
                        >
                          {copiedId === partner.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm text-gray-600">
                        {formatDate(partner.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex px-3 py-1.5 text-xs font-bold rounded-full ${
                        partner.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
                        partner.status === 'paused' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                        'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {partner.status === 'active' ? 'Активен' : partner.status === 'paused' ? 'На паузе' : 'Удалён'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleOpenAsDeveloper(partner.url_suffix)}
                            className="p-2.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors shadow-sm border border-purple-200"
                            title="Открыть как разработчик"
                          >
                            <Code className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/partners/edit/${partner.id}`)}
                          className="p-2.5 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors shadow-sm border border-cyan-200"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTogglePause(partner)}
                          className="p-2.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors shadow-sm border border-yellow-200"
                          title={partner.status === 'paused' ? 'Запустить' : 'Пауза'}
                        >
                          {partner.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(partner.id)}
                          className="p-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shadow-sm border border-red-200"
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
        )}
        </main>
      </div>
    </div>
  );
}
