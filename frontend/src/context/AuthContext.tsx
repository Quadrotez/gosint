import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitialState(): AuthState {
  try {
    const token = localStorage.getItem('osint_token');
    const userStr = localStorage.getItem('osint_user');
    if (token && userStr) {
      return { token, user: JSON.parse(userStr) };
    }
  } catch {
    // corrupt storage
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem('osint_token', token);
    localStorage.setItem('osint_user', JSON.stringify(user));
    setState({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('osint_token');
    localStorage.removeItem('osint_user');
    setState({ token: null, user: null });
  }, []);

  const updateUser = useCallback((user: User) => {
    localStorage.setItem('osint_user', JSON.stringify(user));
    setState(s => ({ ...s, user }));
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      updateUser,
      isAuthenticated: !!state.token && !!state.user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
