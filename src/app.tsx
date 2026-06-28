import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/auth-context';
import { ProtectedRoute } from './auth/protected-route';
import { AdminDashboard } from './pages/admin-dashboard';
import { CompanyDashboard } from './pages/company-dashboard';
import { EmployeeDashboard } from './pages/employee-dashboard';
import { EmployeeHandoutPage } from './pages/employee-handout-page';
import { LoginPage } from './pages/login-page';
import { ManagerDashboard } from './pages/manager-dashboard';
import { ManagerHandoutPage } from './pages/manager-handout-page';
import { ProjectSchedulePage } from './pages/project-schedule-page';

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
            <Route path="/admin" element={<AdminDashboard section="home" />} />
            <Route path="/admin/companies" element={<AdminDashboard section="companies" />} />
            <Route path="/admin/projects" element={<AdminDashboard section="projects" />} />
            <Route path="/admin/schedule" element={<ProjectSchedulePage mode="admin" />} />
            <Route path="/admin/projects/:projectId/users/new" element={<AdminDashboard section="project-users" />} />
            <Route path="/admin/projects/:projectId" element={<AdminDashboard section="project-detail" />} />
            <Route path="/admin/users" element={<Navigate to="/admin/projects" replace />} />
          </Route>

          <Route element={<ProtectedRoute roles={['company']} />}>
            <Route path="/company" element={<CompanyDashboard />} />
          </Route>

          <Route element={<ProtectedRoute roles={['manager']} />}>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/journey" element={<EmployeeHandoutPage mode="manager" />} />
            <Route path="/manager/company-journey" element={<ManagerHandoutPage />} />
            <Route path="/manager/schedule" element={<ProjectSchedulePage mode="manager" />} />
          </Route>

          <Route element={<ProtectedRoute roles={['employee']} />}>
            <Route path="/employee" element={<EmployeeDashboard />} />
            <Route path="/employee/journey" element={<EmployeeHandoutPage />} />
            <Route path="/employee/handout" element={<Navigate to="/employee/journey" replace />} />
          </Route>

          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
