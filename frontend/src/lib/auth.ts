// lib/auth.ts
// Tokens + cliente HTTP. Access token (JWT, 15 min) e refresh token (opaco, 30 dias)
// ficam no expo-secure-store (Keychain no iOS, Keystore no Android).
//   npx expo install expo-secure-store

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_KEY = "rotina.access_token";
const REFRESH_KEY = "rotina.refresh_token";
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export type AuthUser = { id: string; name: string; email: string };
type AuthResponse = { token: string; refreshToken: string; user?: AuthUser };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/* ---------- Armazenamento dos tokens ---------- */

// SecureStore não existe na web; lá os tokens vivem só em memória (somem ao recarregar).
const useSecureStore = Platform.OS !== "web";

// Cache em memória: evita ler o armazenamento seguro a cada requisição.
let cachedAccess: string | null | undefined;
let cachedRefresh: string | null | undefined;

const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function getToken(): Promise<string | null> {
  if (cachedAccess === undefined) {
    cachedAccess = useSecureStore ? await SecureStore.getItemAsync(ACCESS_KEY) : null;
  }
  return cachedAccess;
}

export async function getRefreshToken(): Promise<string | null> {
  if (cachedRefresh === undefined) {
    cachedRefresh = useSecureStore ? await SecureStore.getItemAsync(REFRESH_KEY) : null;
  }
  return cachedRefresh;
}

/** Existe sessão se há refresh token, mesmo com o access token já expirado. */
export async function hasSession(): Promise<boolean> {
  return !!(await getRefreshToken());
}

async function setTokens(access: string, refresh: string) {
  cachedAccess = access;
  cachedRefresh = refresh;
  if (useSecureStore) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, access, secureOptions),
      SecureStore.setItemAsync(REFRESH_KEY, refresh, secureOptions),
    ]);
  }
}

export async function clearTokens() {
  cachedAccess = null;
  cachedRefresh = null;
  if (useSecureStore) {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
  }
}

/* ---------- Sessão expirada ---------- */

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/* ---------- Renovação do access token ---------- */

type RefreshOutcome = "ok" | "expired" | "failed";

async function doRefresh(): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return "expired";

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    // Só um 401/400 definitivo encerra a sessão. Rede fora do ar ou erro 5xx
    // ("failed") não deslogam o usuário: ele tenta de novo depois.
    if (res.status === 401 || res.status === 400) return "expired";
    if (!res.ok) return "failed";

    const data = await res.json().catch(() => null);
    if (!data?.token || !data?.refreshToken) return "failed";

    await setTokens(data.token, data.refreshToken);
    return "ok";
  } catch {
    return "failed";
  }
}

// Uma renovação por vez: várias requisições que tomam 401 juntas compartilham a mesma.
// Isso é essencial, pois o servidor trata um refresh token usado duas vezes como roubo.
let inflight: Promise<RefreshOutcome> | null = null;
function refreshTokens(): Promise<RefreshOutcome> {
  if (!inflight) {
    inflight = doRefresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/* ---------- Requisições autenticadas ---------- */

async function send(path: string, init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

// Use no lugar de fetch para rotas protegidas (ex.: /api/chat).
// Se o access token expirou, renova e repete a requisição uma vez, de forma transparente.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await send(path, init, await getToken());
  if (res.status !== 401) return res;

  const outcome = await refreshTokens();
  if (outcome === "ok") return send(path, init, await getToken());

  if (outcome === "expired") {
    await clearTokens();
    onUnauthorized?.(); // volta ao login
  }
  return res;
}

/* ---------- Login, cadastro e logout ---------- */

function messageFor(status: number, serverMessage?: string) {
  if (status === 401) return "E-mail ou senha incorretos.";
  if (status === 409) return "Este e-mail já está cadastrado. Entre na sua conta.";
  // No 429 o servidor informa quanto tempo falta, então preferimos a mensagem dele
  if (status === 429) return serverMessage || "Muitas tentativas. Aguarde um pouco e tente de novo.";
  return serverMessage || "Não foi possível concluir. Tente novamente.";
}

async function postAuth(path: string, body: object): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor. Verifique sua internet.", 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(messageFor(res.status, data?.erro ?? data?.error ?? data?.message), res.status);
  if (!data?.token || !data?.refreshToken) throw new ApiError("Resposta inválida do servidor.", res.status);

  await setTokens(data.token, data.refreshToken);
  return data as AuthResponse;
}

export const login = (email: string, password: string) =>
  postAuth("/api/auth/login", { email: email.trim().toLowerCase(), password });

export const register = (name: string, email: string, password: string) =>
  postAuth("/api/auth/register", { name: name.trim(), email: email.trim().toLowerCase(), password });

/** Sai da conta: apaga os tokens locais e revoga a sessão no servidor (sem travar se estiver offline). */
export async function logout() {
  const refreshToken = await getRefreshToken();
  await clearTokens();

  if (refreshToken) {
    fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
}