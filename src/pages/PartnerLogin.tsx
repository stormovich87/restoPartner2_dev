import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Store, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Partner } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function PartnerLogin() {
  const { partnerPrefix } = useParams();
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPartner();
  }, [partnerPrefix]);

  const loadPartner = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('url_suffix', partnerPrefix)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Партнёр не найден');
        setLoading(false);
        return;
      }

      if (data.status === 'deleted') {
        setError('Партнёр был удалён');
        setLoading(false);
        return;
      }

      if (data.status === 'paused') {
        setError(data.pause_message || 'Сервис временно приостановлен');
        setLoading(false);
        return;
      }

      setPartner(data);
    } catch (err) {
      console.error('Error loading partner:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!partner) return;

    try {
      if (login === '1' && password === '1') {
        const { data: superAdmin, error: superError } = await supabase
          .from('users')
          .select('*, roles(*)')
          .eq('login', '1')
          .eq('password_hash', '1')
          .is('partner_id', null)
          .maybeSingle();

        if (superError) throw superError;

        if (superAdmin) {
          authLogin(superAdmin, partner, superAdmin.roles);
          navigate(`/${partnerPrefix}/admin`);
          return;
        }
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*, roles(*)')
        .eq('login', login)
        .eq('password_hash', password)
        .eq('partner_id', partner.id)
        .maybeSingle();

      if (userError) throw userError;

      if (user) {
        if (!user.active) {
          setError('Пользователь заблокирован');
          setSubmitting(false);
          return;
        }

        authLogin(user, partner, user.roles);
        navigate(`/${partnerPrefix}/admin`);
        return;
      }

      const { data: staffMember, error: staffError } = await supabase
        .from('staff_members')
        .select(`
          *,
          positions(
            id,
            name,
            can_delete_orders,
            can_revert_order_status,
            can_skip_order_status,
            position_permissions(section),
            position_branches(branch_id)
          )
        `)
        .eq('login', login)
        .eq('password_hash', password)
        .eq('partner_id', partner.id)
        .maybeSingle();

      if (staffError) throw staffError;

      if (!staffMember) {
        setError('Неверный логин или пароль');
        setSubmitting(false);
        return;
      }

      if (!staffMember.is_active) {
        setError('Сотрудник уволен');
        setSubmitting(false);
        return;
      }

      const staffUserData = {
        id: staffMember.id,
        login: staffMember.login,
        name: `${staffMember.first_name} ${staffMember.last_name}`,
        lastName: staffMember.last_name,
        active: staffMember.is_active,
        partner_id: partner.id,
        roles: {
          id: 'staff',
          name: 'staff',
          description: 'Staff member'
        },
        position: staffMember.positions,
        is_staff: true
      };

      authLogin(staffUserData, partner, staffUserData.roles);
      navigate(`/${partnerPrefix}/admin`);
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка входа');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Загрузка...</div>
      </div>
    );
  }

  if (error && !partner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{error}</h1>
          <p className="text-slate-600">Проверьте правильность адреса</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          {partner?.logo_url ? (
            <img
              src={partner.logo_url}
              alt={partner.name}
              className="w-32 h-32 object-contain"
            />
          ) : (
            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-5 rounded-2xl shadow-lg">
              <Store className="w-10 h-10 text-white" />
            </div>
          )}
        </div>

        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3">
          {partner?.name}
        </h1>
        <p className="text-gray-600 text-center mb-8 font-medium">
          Вход в панель управления
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
            disabled={submitting}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3.5 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
