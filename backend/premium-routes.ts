// src/premium-routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { redeemInvite } from "./invites";
import { getUserPermissions } from "./users";
/// import { requireAllowedOrigin } from "./require-allowed-origin"; // ajuste os imports
import { requireAuth } from "./require-auth";

export const premiumRouter = Router();

const redeemSchema = z.object({ code: z.string().trim().min(1).max(32) });

// POST /api/premium/redeem  { code }  ->  { premium: true }
premiumRouter.post("/redeem", requireAuth, async (req: Request, res: Response) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Informe o código." });

  try {
    const result = await redeemInvite(res.locals.userId as string, req.ip ?? "unknown", parsed.data.code);

    if (result === "rate_limited") {
      return res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
    }
    if (result === "invalid") {
      // Mensagem genérica: não revela se o código expirou, já foi usado etc.
      return res.status(400).json({ error: "Código inválido." });
    }
    return res.json({ premium: true });
  } catch (err) {
    console.error("[/api/premium/redeem]", err);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

// GET /api/premium/status  ->  { premium: boolean }  (para o app esconder/mostrar a coroa)
premiumRouter.get("/status", requireAuth, async (_req: Request, res: Response) => {

  const perms = await getUserPermissions(res.locals.userId as string);
  if (!perms) return res.status(401).json({ error: "Sessão inválida. Entre novamente." });
  return res.json({ premium: perms.llm_enabled });
});