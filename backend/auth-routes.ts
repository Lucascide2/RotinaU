// src/auth-routes.ts
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import {
  HttpError,
  loginUser,
  refreshSession,
  registerUser,
  revokeAllSessions,
  revokeSession,
} from "./auth-service";
import { requireAuth } from "./require-auth";
import { createInviteForUser } from "./invites";

export const authRouter = Router();

/* ---------- Rate limit por IP (camada geral; o bloqueio por conta fica no serviço) ---------- */

const message = { erro: "Muitas tentativas. Aguarde um pouco e tente de novo." };

// login e cadastro
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

// refresh e logout: mais folgado, pois o app renova o token de tempos em tempos
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/* ---------- Validação do body ---------- */

const email = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .email("Informe um e-mail válido.")
  .max(254, "E-mail longo demais.");

const registerSchema = z.object({
  name: z.string({ error: "Informe seu nome." }).trim().min(2, "Informe seu nome.").max(100, "Nome longo demais."),
  email,
  // bcrypt só considera os primeiros 72 bytes; limitar evita senhas truncadas em silêncio
  password: z
    .string({ error: "Informe a senha." })
    .min(8, "Use pelo menos 8 caracteres.")
    .max(72, "A senha pode ter no máximo 72 caracteres."),
});

const loginSchema = z.object({
  email,
  password: z.string({ error: "Informe a senha." }).min(1, "Informe a senha.").max(72),
});

const refreshSchema = z.object({
  refreshToken: z.string({ error: "Token ausente." }).min(20).max(200),
});

/* ---------- Helpers ---------- */

function sendError(res: Response, e: unknown) {
  if (e instanceof HttpError) {
    if (e.retryAfter) res.set("Retry-After", String(e.retryAfter));
    return res.status(e.status).json({ erro: e.message });
  }
  console.error("[auth]", e); // detalhes só no log, nunca na resposta
  return res.status(500).json({ erro: "Erro interno. Tente novamente." });
}

/* ---------- Rotas ---------- */

authRouter.post("/register", credentialsLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues[0].message });

  try {
    const { name, email, password } = parsed.data;
    const result = await registerUser(name, email, password);

    // Falha ao gerar o convite não deve derrubar o cadastro já concluído.
    try {
      await createInviteForUser(result.user.id, name); // ajuste se o retorno tiver outro formato
    } catch (e) {
      console.error("[register] falha ao criar convite premium:", e);
    }

    return res.status(201).json(result); // o código NUNCA volta na resposta
  } catch (e) {
    return sendError(res, e);
  }
});

// POST /api/auth/login  { email, password }  ->  { token, refreshToken, user }
authRouter.post("/login", credentialsLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.issues[0].message });

  try {
    const { email, password } = parsed.data;
    // req.ip só é o IP real do cliente com `app.set("trust proxy", ...)` atrás de proxy
    return res.status(200).json(await loginUser(email, password, req.ip ?? "desconhecido"));
  } catch (e) {
    return sendError(res, e);
  }
});

// POST /api/auth/refresh  { refreshToken }  ->  { token, refreshToken }
authRouter.post("/refresh", tokenLimiter, async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: "Token inválido." });

  try {
    return res.status(200).json(await refreshSession(parsed.data.refreshToken));
  } catch (e) {
    return sendError(res, e);
  }
});

// POST /api/auth/logout  { refreshToken }  ->  204
// Usa o refresh token como credencial: funciona mesmo com o access token já expirado.
authRouter.post("/logout", tokenLimiter, async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) {
    try {
      await revokeSession(parsed.data.refreshToken);
    } catch (e) {
      console.error("[auth] logout", e);
    }
  }
  return res.sendStatus(204); // sempre 204: não revela se o token existia
});

// POST /api/auth/logout-all  (Authorization: Bearer)  ->  204
authRouter.post("/logout-all", tokenLimiter, requireAuth, async (_req: Request, res: Response) => {
  try {
    await revokeAllSessions(res.locals.userId);
    return res.sendStatus(204);
  } catch (e) {
    return sendError(res, e);
  }
});