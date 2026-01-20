import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function SuperAdminLogin() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First try admin_users
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('*, admin_permissions(*), admin_partner_access(partner_id)')
        .eq('login', login)
        .eq('password_hash', password)
        .maybeSingle();

      if (adminError) throw adminError;

      if (adminUser) {
        if (!adminUser.active) {
          setError('Пользователь заблокирован');
          setLoading(false);
          return;
        }

        const permissions = adminUser.admin_permissions?.[0] || null;
        const accessiblePartnerIds = adminUser.admin_partner_access?.map((access: any) => access.partner_id) || [];

        const adminUserWithPermissions = {
          id: adminUser.id,
          login: adminUser.login,
          password_hash: adminUser.password_hash,
          name: adminUser.name,
          is_super_admin: adminUser.is_super_admin,
          active: adminUser.active,
          created_at: adminUser.created_at,
          permissions,
          accessible_partner_ids: accessiblePartnerIds,
        };

        const founderRole = { name: 'founder', display_name: 'Супер Администратор' };
        authLogin(null, null, founderRole, adminUserWithPermissions);
        navigate('/super-admin/partners');
        return;
      }

      // Try staff_members with super admin role
      const { data: staffMember, error: staffError } = await supabase
        .from('staff_members')
        .select('*')
        .eq('login', login)
        .eq('password_hash', password)
        .eq('is_super_admin', true)
        .maybeSingle();

      if (staffError) throw staffError;

      if (staffMember) {
        if (!staffMember.is_active) {
          setError('Пользователь заблокирован');
          setLoading(false);
          return;
        }

        const adminUserWithPermissions = {
          id: staffMember.id,
          login: staffMember.login,
          password_hash: staffMember.password_hash,
          name: staffMember.first_name || staffMember.name,
          is_super_admin: true,
          active: staffMember.is_active,
          created_at: staffMember.created_at,
          permissions: null,
          accessible_partner_ids: [],
        };

        const founderRole = { name: 'founder', display_name: 'Супер Администратор' };
        authLogin(null, null, founderRole, adminUserWithPermissions);
        navigate('/super-admin/partners');
        return;
      }

      setError('Неверный логин или пароль');
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-5 rounded-2xl shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3">
          Панель администратора
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Вход для супер админа
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Логин
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3.5 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
