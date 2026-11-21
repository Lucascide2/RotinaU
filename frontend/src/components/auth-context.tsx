// lib/auth-context.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearTokens, getToken, login, register, setUnauthorizedHandler, type AuthUser } from "../lib/auth";

type AuthContextValue = {
  /** false enquanto o token salvo ainda está sendo lido (mostre um splash). */
  ready: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  premium: boolean;
  online: boolean;
  setPremiumInfo: (p: { premium?: boolean; online?: boolean }) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_KEY = "rotinau-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [premium, setPremium] = useState(false);
  const [online, setOnline] = useState(true);

  const setPremiumInfo = useCallback((p: { premium?: boolean; online?: boolean }) => {
    if (p.premium !== undefined) setPremium(p.premium);
    if (p.online !== undefined) setOnline(p.online);
  }, []);

  // Restaura a sessão ao abrir o app.
  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        setAuthenticated(!!t);
        if (t) {
          const raw = await AsyncStorage.getItem(USER_KEY);
          if (raw) setUser(JSON.parse(raw) as AuthUser);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    console.log("[auth-context] authenticated mudou:", authenticated);
  }, [authenticated]);
  

  const signOut = useCallback(async () => {
    await clearTokens();
    AsyncStorage.removeItem(USER_KEY).catch(() => {});
    setUser(null);
    setAuthenticated(false);
    setPremium(false);
    setOnline(true);
  }, []);

  // Qualquer 401 em apiFetch derruba a sessão.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setAuthenticated(false);
      setPremium(false);
      setOnline(true);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await login(email, password);
    setUser(res.user ?? null);
    if (res.user) AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user)).catch(() => {});
    setAuthenticated(true);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const res = await register(name, email, password);
    setUser(res.user ?? null);
    if (res.user) AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user)).catch(() => {});
    setAuthenticated(true);
  }, []);

  const value = useMemo(
    () => ({ ready, isAuthenticated: authenticated, user, signIn, signUp, signOut, premium, online, setPremiumInfo }),
    [ready, authenticated, user, signIn, signUp, signOut, premium, online, setPremiumInfo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}