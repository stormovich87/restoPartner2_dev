import { BrowserRouter, Routes, Route, useParams, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DevModeProvider } from './contexts/DevModeContext';
import SuperAdminLogin from './pages/SuperAdminLogin';
import PartnersList from './pages/PartnersList';
import PartnerForm from './pages/PartnerForm';
import PartnerLogin from './pages/PartnerLogin';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import Accesses from './pages/Accesses';
import CourierCabinet from './pages/CourierCabinet';
import EmployeeCabinet from './pages/EmployeeCabinet';
import { AlertCircle } from 'lucide-react';

const RESERVED_PREFIXES = ['employee', 'courier', 'courier-cabinet', 'super-admin', 'admin'];

function isReservedPath(pathname: string): boolean {
  const firstSegment = pathname.split('/')[1];
  return RESERVED_PREFIXES.includes(firstSegment);
}

function PartnerLoginGuard() {
  const { partnerPrefix } = useParams();
  const location = useLocation();

  if (!partnerPrefix || isReservedPath(location.pathname)) {
    return <NotFound />;
  }
  return <PartnerLogin />;
}

function PartnerDashboardGuard() {
  const { partnerPrefix } = useParams();
  const location = useLocation();

  if (!partnerPrefix || isReservedPath(location.pathname)) {
    return <NotFound />;
  }
  return <PartnerDashboard />;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Страница не найдена</h1>
        <p className="text-gray-600 mb-6">
          Запрошенная страница не существует или была перемещена.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          На главную
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <DevModeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Cabinet Routes - completely isolated, no admin auth required */}
            <Route path="/employee/:employee_slug" element={<EmployeeCabinet />} />
            <Route path="/courier/:cabinet_slug" element={<CourierCabinet />} />
            <Route path="/courier-cabinet/:token" element={<CourierCabinet />} />

            {/* Root/Login */}
            <Route path="/" element={<SuperAdminLogin />} />

            {/* Super Admin Routes */}
            <Route path="/super-admin/partners" element={<PartnersList />} />
            <Route path="/super-admin/accesses" element={<Accesses />} />
            <Route path="/admin/partners/create" element={<PartnerForm />} />
            <Route path="/admin/partners/edit/:id" element={<PartnerForm />} />

            {/* Partner Routes with guards - these use dynamic :partnerPrefix */}
            <Route path="/:partnerPrefix/login" element={<PartnerLoginGuard />} />
            <Route path="/:partnerPrefix/admin">
              <Route index element={<PartnerDashboardGuard />} />
              <Route path=":cabinetSlug" element={<CourierCabinet />} />
            </Route>

            {/* Catch-all - show NotFound instead of redirect */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DevModeProvider>
    </AuthProvider>
  );
}

export default App;
