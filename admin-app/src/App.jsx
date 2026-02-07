import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import Riders from './pages/Riders';
import Customers from './pages/Customers';
import Deliveries from './pages/Deliveries';
import AdminManagement from './pages/AdminManagement';
import Login from './pages/Login';
import VendorSignup from './pages/VendorSignup';
import VendorOnboarding from './pages/VendorOnboarding';
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
    return <Navigate to="/login" replace />;
  }

  // If route requires admin/superadmin access
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
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
    return <Navigate to="/login" replace />;
  }

  // Only super admin can access (demo mode allows access for testing)
  if (!isSuperAdmin && !isDemoMode) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/vendor/signup" element={<VendorSignup />} />
      <Route path="/vendor/onboarding" element={<VendorOnboarding />} />

      {/* Admin dashboard routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute requireAdmin>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
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
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
