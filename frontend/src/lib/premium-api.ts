// src/premium-api.ts (ajuste o caminho do import do apiFetch)
import { apiFetch } from "../lib/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL

export type RedeemResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "rate_limited" | "unauthorized" | "server" | "network"; message: string };

/** Resgata o código premium. Nunca lança: sempre devolve um resultado tratável pela UI. */
export async function redeemPremiumCode(code: string): Promise<RedeemResult> {
  try {
    const res = await apiFetch("/api/premium/redeem", {
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

/** Para mostrar/esconder a coroa conforme o usuário já é premium. */
export async function getPremiumStatus(): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_URL}/api/premium/status`, {method: "GET"});
    if (!res.ok) return false;
    const data = (await res.json()) as { premium: boolean };
    return data.premium === true;
  } catch {
    return false;
  }
}