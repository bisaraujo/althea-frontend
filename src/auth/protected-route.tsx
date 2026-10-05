import { Navigate, Outlet } from 'react-router-dom';

import type { UserRole } from '../api/types';
import { useAuth } from './auth-context';

type ProtectedRouteProps = {
  roles?: UserRole[];
  platformAdmin?: boolean;
};

export function ProtectedRoute({ roles, platformAdmin }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  if (platformAdmin && !user.platform_admin) {
    return <Navigate to={user.admin_product_ids?.includes('product-jornadas') ? '/admin' : '/fagulha-admin'} replace />;
  }

  return <Outlet />;
}
