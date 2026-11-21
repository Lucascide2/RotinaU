// src/premium-api.ts (ajuste o caminho do import do apiFetch)
import { apiFetch } from "../lib/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL

export type RedeemResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "rate_limited" | "unauthorized" | "server" | "network"; message: string };

/** Para mostrar/esconder a coroa conforme o usuário já é premium. */
export type PremiumStatus = { online: boolean; premium: boolean };

/** Resgata o código premium. Nunca lança: sempre devolve um resultado tratável pela UI. */
export async function redeemPremiumCode(code: string): Promise<RedeemResult> {

  const endpoint = `${process.env.EXPO_PUBLIC_API_URL}/api/premium/redeem`;
  try {
    const res = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });

    if (res.ok) return { ok: true };

    switch (res.status) {
      case 400:
        return { ok: false, reason: "invalid", message: "Código inválido." };
      case 429:
        return { ok: false, reason: "rate_limited", message: "Muitas tentativas. Tente novamente mais tarde." };
      case 401:
        return { ok: false, reason: "unauthorized", message: "Sessão expirada. Entre novamente." };
      default:
        return { ok: false, reason: "server", message: "Erro interno. Tente novamente." };
    }
  } catch {
    return { ok: false, reason: "network", message: "Sem conexão. Verifique sua internet." };
  }
}



export async function getPremiumStatus(): Promise<PremiumStatus> {
  try {
    const res = await apiFetch(`${API_URL}/api/premium/status`);
    
    if (!res.ok) return { online: true, premium: false }; // 401 etc.: servidor respondeu

    const data = (await res.json()) as { premium: boolean };
    return { online: true, premium: data.premium === true };
  } catch (e) {
    console.warn("[getPremiumStatus] corpo inválido:", e);
    return { online: false, premium: false }; // falha de rede, CORS ou timeout
  }
}