import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import type { AuthenticatedUser } from '../api/types';
import { clearSession, getStoredToken, getStoredUser, saveSession } from './storage';

type AuthContextValue = {
  token: string | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  signIn: (token: string, user: AuthenticatedUser) => void;
  signOut: () => void;
  /** Atualiza dados do usuario logado (ex.: depois de trocar a senha provisoria). */
  updateUser: (patch: Partial<AuthenticatedUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthenticatedUser | null>(() => getStoredUser());

  useEffect(() => {
    function handleUnauthorized() {
      clearSession();
      setToken(null);
      setUser(null);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const value: AuthContextValue = {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    signIn(nextToken, nextUser) {
      saveSession(nextToken, nextUser);
      setToken(nextToken);
      setUser(nextUser);
    },
    signOut() {
      clearSession();
      setToken(null);
      setUser(null);
    },
    updateUser(patch) {
      if (!token || !user) return;
      const next = { ...user, ...patch };
      saveSession(token, next);
      setUser(next);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
