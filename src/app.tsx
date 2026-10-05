import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/auth-context';
import { ProtectedRoute } from './auth/protected-route';
import { ErrorBoundary } from './components/error-boundary';
import { ToastProvider } from './components/toast';
import { ConfirmProvider } from './components/ui';
import { AdminDashboard } from './pages/admin-dashboard';
import { CompanyAccessPage } from './pages/company-access-page';
import { CompanyDashboard } from './pages/company-dashboard';
import { EmployeeDashboard } from './pages/employee-dashboard';
import { EmployeeHandoutPage } from './pages/employee-handout-page';
import { LoginPage } from './pages/login-page';
import { ManagerDashboard } from './pages/manager-dashboard';
import { MeetingsPage } from './pages/meetings-page';
import { ManagerHandoutPage } from './pages/manager-handout-page';
import { ProjectSchedulePage } from './pages/project-schedule-page';
import { ProductsModulesPage } from './pages/products-modules-page';
import { PlatformCompaniesPage } from './pages/platform-companies-page';
import { PlatformAccessPackagesPage } from './pages/platform-access-packages-page';
import { PlatformAdministratorsPage } from './pages/platform-administrators-page';
import { PlatformRequestsPage } from './pages/platform-requests-page';
import { PlatformCompanyDetailPage } from './pages/platform-company-detail-page';
import { OrganizationManagementPage } from './pages/organization-management-page';
import { ProjectOperationsPage } from './pages/project-operations-page';
import { ResearchOperationsPage } from './pages/research-operations-page';
import { FagulhaAdminPage } from './pages/fagulha-admin-page';
import { FagulhaPublicPage } from './pages/fagulha-public-page';
import { FagulhaActivationPage } from './pages/fagulha-activation-page';

function DefaultRedirect() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    if (user.platform_admin) return <Navigate to="/platform-admin/companies" replace />;
    return <Navigate to={user.admin_product_ids?.includes('product-jornadas') ? '/admin' : '/fagulha-admin'} replace />;
  }
  return <Navigate to={`/${user.role}`} replace />;
}

export function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
    <ToastProvider>
    <ConfirmProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/fagulha/:companyId/:slug" element={<FagulhaPublicPage />} />
          <Route path="/fagulha/ativar/:token" element={<FagulhaActivationPage />} />

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard section="projects" />} />
            <Route path="/admin/companies" element={<AdminDashboard section="companies" />} />
            <Route path="/admin/projects" element={<AdminDashboard section="projects" />} />
            <Route path="/admin/schedule" element={<ProjectSchedulePage mode="admin" />} />
            <Route path="/admin/meetings" element={<MeetingsPage mode="admin" />} />
            <Route path="/admin/research" element={<ResearchOperationsPage />} />
            <Route path="/admin/products-modules" element={<ProductsModulesPage />} />
            <Route path="/admin/projects/:projectId/users/new" element={<AdminDashboard section="project-users" />} />
            <Route path="/admin/projects/:projectId/operations" element={<ProjectOperationsPage />} />
            <Route path="/admin/projects/:projectId" element={<AdminDashboard section="project-detail" />} />
            <Route path="/admin/users" element={<Navigate to="/admin/projects" replace />} />
            <Route path="/fagulha-admin" element={<FagulhaAdminPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} platformAdmin />}>
            <Route path="/platform-admin" element={<Navigate to="/platform-admin/companies" replace />} />
            <Route path="/platform-admin/companies" element={<PlatformCompaniesPage />} />
            <Route path="/platform-admin/companies/new" element={<AdminDashboard section="companies" mode="platform" />} />
            <Route path="/platform-admin/companies/:companyId" element={<PlatformCompanyDetailPage />} />
            <Route path="/platform-admin/products" element={<ProductsModulesPage />} />
            <Route path="/platform-admin/organization" element={<OrganizationManagementPage />} />
            <Route path="/platform-admin/access-packages" element={<PlatformAccessPackagesPage />} />
            <Route path="/platform-admin/requests" element={<PlatformRequestsPage />} />
            <Route path="/platform-admin/administrators" element={<PlatformAdministratorsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['company']} />}>
            <Route path="/company" element={<CompanyDashboard />} />
            <Route path="/company/access" element={<CompanyAccessPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['manager']} />}>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/journey" element={<EmployeeHandoutPage mode="manager" />} />
            <Route path="/manager/company-journey" element={<ManagerHandoutPage />} />
            <Route path="/manager/schedule" element={<ProjectSchedulePage mode="manager" />} />
            <Route path="/manager/meetings" element={<MeetingsPage mode="manager" />} />
          </Route>

          <Route element={<ProtectedRoute roles={['employee']} />}>
            <Route path="/employee" element={<EmployeeDashboard />} />
            <Route path="/employee/journey" element={<EmployeeHandoutPage />} />
            <Route path="/employee/handout" element={<Navigate to="/employee/journey" replace />} />
          </Route>

          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </Router>
    </ConfirmProvider>
    </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
