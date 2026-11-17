// lib/auth-context.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { clearTokens, getToken, login, register, setUnauthorizedHandler, type AuthUser } from "../lib/auth";

type AuthContextValue = {
  /** false enquanto o token salvo ainda está sendo lido (mostre um splash). */
  ready: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Restaura a sessão ao abrir o app.
  useEffect(() => {
    getToken()
      .then((t) => setAuthenticated(true))
      .finally(() => setReady(true));
  }, []);
  

  const signOut = useCallback(async () => {
    await clearTokens();
    setUser(null);
    setAuthenticated(false);
  }, []);

  // Qualquer 401 em apiFetch derruba a sessão.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setAuthenticated(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await login(email, password);
    setUser(res.user ?? null);
    setAuthenticated(true);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const res = await register(name, email, password);
    setUser(res.user ?? null);
    setAuthenticated(true);
  }, []);

  const value = useMemo(
    () => ({ ready, isAuthenticated: authenticated, user, signIn, signUp, signOut }),
    [ready, authenticated, user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}