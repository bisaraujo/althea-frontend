import { Navigate, Outlet } from 'react-router-dom';

import type { UserRole } from '../api/types';
import { useAuth } from './auth-context';

type ProtectedRouteProps = {
  roles?: UserRole[];
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return <Outlet />;
}
