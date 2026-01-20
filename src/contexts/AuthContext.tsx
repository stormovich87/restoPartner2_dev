import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AdminUserWithPermissions } from '../types';

interface AuthContextType extends AuthState {
  login: (user: AuthState['user'], partner: AuthState['partner'], role: AuthState['role'], adminUser?: AdminUserWithPermissions | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : { user: null, partner: null, role: null, adminUser: null };
  });

  useEffect(() => {
    localStorage.setItem('auth', JSON.stringify(authState));
  }, [authState]);

  const login = (user: AuthState['user'], partner: AuthState['partner'], role: AuthState['role'], adminUser?: AdminUserWithPermissions | null) => {
    setAuthState({ user, partner, role, adminUser: adminUser || null });
  };

  const logout = () => {
    setAuthState({ user: null, partner: null, role: null, adminUser: null });
    localStorage.removeItem('auth');
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
