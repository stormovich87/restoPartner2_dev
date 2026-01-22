import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Users, Shield, LogOut, Plus, Truck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'independent-partners';

export default function ECourier() {
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('independent-partners');
  const navigate = useNavigate();
  const { logout, role, adminUser } = useAuth();

  const isSuperAdmin = adminUser?.is_super_admin || false;

  useEffect(() => {
    if (role?.name !== 'founder') {
      navigate('/');
      return;
    }
    if (!adminUser?.is_super_admin) {
      navigate('/super-admin/partners');
      return;
    }
  }, [role, adminUser, navigate]);

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
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-gray-700 hover:bg-blue-50"
          >
            <Users className="w-5 h-5" />
            <span>Партнёры</span>
          </button>
          {isSuperAdmin && (
            <>
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
              <button
                onClick={() => {
                  navigate('/super-admin/e-courier');
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
              >
                <Truck className="w-5 h-5" />
                <span>Е-курьер</span>
              </button>
            </>
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
          <div className="px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Е-курьер</h1>
              <p className="text-sm text-gray-600 mt-1">
                Управление независимыми партнёрами
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('independent-partners')}
                    className={`px-6 py-4 font-medium transition-colors relative ${
                      activeTab === 'independent-partners'
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    Независимые партнёры
                    {activeTab === 'independent-partners' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'independent-partners' && (
                  <div className="space-y-6">
                    {/* Header with Add button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Список независимых партнёров
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          Независимые партнёры, не связанные с текущими партнёрами фирмы
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          // TODO: Open add partner modal
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Добавить партнёра</span>
                      </button>
                    </div>

                    {/* Empty state */}
                    <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                      <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Нет независимых партнёров
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Добавьте первого независимого партнёра для начала работы
                      </p>
                      <button
                        onClick={() => {
                          // TODO: Open add partner modal
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Добавить партнёра</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
