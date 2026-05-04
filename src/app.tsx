import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/auth-context';
import { ProtectedRoute } from './auth/protected-route';
import { AdminDashboard } from './pages/admin-dashboard';
import { CompanyDashboard } from './pages/company-dashboard';
import { EmployeeDashboard } from './pages/employee-dashboard';
import { LoginPage } from './pages/login-page';
import { ManagerDashboard } from './pages/manager-dashboard';

function DefaultRedirect() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/${user.role}`} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route element={<ProtectedRoute roles={['company']} />}>
            <Route path="/company" element={<CompanyDashboard />} />
          </Route>

          <Route element={<ProtectedRoute roles={['manager']} />}>
            <Route path="/manager" element={<ManagerDashboard />} />
          </Route>

          <Route element={<ProtectedRoute roles={['employee']} />}>
            <Route path="/employee" element={<EmployeeDashboard />} />
          </Route>

          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
