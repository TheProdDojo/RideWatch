import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VendorDashboard from './pages/VendorDashboard';
import Vendors from './pages/Vendors';
import Riders from './pages/Riders';
import Customers from './pages/Customers';
import Deliveries from './pages/Deliveries';
import AdminManagement from './pages/AdminManagement';
import Login from './pages/Login';
import VendorSignup from './pages/VendorSignup';
import VendorLogin from './pages/VendorLogin';
import VendorOnboarding from './pages/VendorOnboarding';
import ResetPassword from './pages/ResetPassword';
import WhatsAppGuide from './pages/WhatsAppGuide';
import { ModalProvider } from './components/ModalProvider';
import './index.css';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading, isAdmin, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // If route requires admin/superadmin access
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/vendor" replace />;
  }

  return children;
}

function VendorRoute({ children }) {
  const { user, loading, isVendor, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/vendor/login" replace />;
  }

  // Admins accessing vendor route get redirected to admin dashboard
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function SuperAdminRoute({ children }) {
  const { user, loading, isSuperAdmin, isDemoMode } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Only super admin can access (demo mode allows access for testing)
  if (!isSuperAdmin && !isDemoMode) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

// Smart home route that redirects based on role
function HomeRedirect() {
  const { isVendor, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Vendors go to vendor dashboard
  if (isVendor && !isAdmin) {
    return <Navigate to="/vendor" replace />;
  }

  // Admins/SuperAdmins go to admin dashboard
  return <Dashboard />;
}

// Redirect to landing page (outside SPA)
function LandingRedirect() {
  window.location.replace('/index.html');
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      {/* Admin login */}
      <Route path="/admin/login" element={<Login />} />

      {/* WhatsApp Guide (public) */}
      <Route path="/guide" element={<WhatsAppGuide />} />

      {/* Vendor routes */}
      <Route path="/vendor/login" element={<VendorLogin />} />
      <Route path="/vendor/signup" element={<VendorSignup />} />
      <Route path="/vendor/onboarding" element={<VendorOnboarding />} />
      <Route path="/vendor/reset-password" element={<ResetPassword />} />

      {/* Vendor dashboard route - PUBLIC (guest-first flow) */}
      <Route path="/vendor" element={<VendorDashboard />} />

      {/* Admin dashboard routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="riders" element={<Riders />} />
        <Route path="customers" element={<Customers />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route
          path="admin-management"
          element={
            <SuperAdminRoute>
              <AdminManagement />
            </SuperAdminRoute>
          }
        />
      </Route>

      {/* Root redirects to landing page (outside SPA) */}
      <Route path="/" element={<LandingRedirect />} />
      <Route path="*" element={<Navigate to="/vendor" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <AppRoutes />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

