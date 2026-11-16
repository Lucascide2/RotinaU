// src/auth-service.ts
import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { clearFailedLogins, deleteOldAttempts, loginBlockedSeconds, recordFailedLogin } from "./login-attempts";
import {
  deleteExpiredRefreshTokens,
  insertRefreshToken,
  revokeAllForUser,
  revokeByToken,
  rotateRefreshToken,
} from "./refresh-tokens";
import { createUser, findUserByEmail, type PublicUser } from "./users";

const BCRYPT_COST = 12;
const ISSUER = "rotinau-api";
const AUDIENCE = "rotinau-app";

export class HttpError extends Error {
  status: number;
  retryAfter?: number; // segundos, vira o header Retry-After
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/* ---------- Configuração (lida sob demanda, depois do dotenv) ---------- */

function secret(): string {
  const s = process.env.JWT_SECRET ?? "";
  if (s.length < 32) throw new Error("JWT_SECRET ausente ou curto demais (mínimo de 32 caracteres).");
  return s;
}

/** Chame uma vez na inicialização do servidor para falhar cedo se faltar configuração. */
export function assertAuthConfig() {
  secret();
}

// Hash descartável: usado quando o e-mail não existe, para o login levar o mesmo
// tempo nos dois casos e não revelar quais e-mails estão cadastrados.
const DUMMY_HASH = bcrypt.hashSync("senha-descartavel", BCRYPT_COST);

/* ---------- Access token (JWT de vida curta) ---------- */

export function signToken(userId: string): string {
  return jwt.sign({}, secret(), {
    algorithm: "HS256",
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "15m") as jwt.SignOptions["expiresIn"],
  });
}

/** Valida assinatura, algoritmo, emissor, audiência e expiração. Retorna o id do usuário. */
export function verifyToken(token: string): string {
  const payload = jwt.verify(token, secret(), {
    algorithms: ["HS256"], // fixa o algoritmo: bloqueia "alg: none" e troca de algoritmo
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload === "string" || !payload.sub) throw new Error("Token sem subject");
  return payload.sub;
}

/* ---------- Sessão: access token + refresh token ---------- */

export type Session = { token: string; refreshToken: string; user: PublicUser };

async function issueSession(user: PublicUser): Promise<Session> {
  // Cada login/cadastro abre uma família nova de refresh tokens
  const refreshToken = await insertRefreshToken(user.id, randomUUID());
  return { token: signToken(user.id), refreshToken, user };
}

export async function registerUser(name: string, email: string, password: string): Promise<Session> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let user: PublicUser;
  try {
    user = await createUser(name, email, passwordHash);
  } catch (e) {
    // 23505 = unique_violation do PostgreSQL (e-mail já existe)
    if ((e as { code?: string }).code === "23505") {
      throw new HttpError(409, "Este e-mail já está cadastrado.");
    }
    throw e;
  }
  return issueSession(user);
}

export async function loginUser(email: string, password: string, ip: string): Promise<Session> {
  // 1) Bloqueio por conta: checado ANTES de qualquer comparação de senha.
  //    Depende só do e-mail digitado (existindo ou não), então não revela contas.
  const wait = await loginBlockedSeconds(email, ip);
  if (wait > 0) {
    throw new HttpError(
      429,
      `Muitas tentativas de login para esta conta. Tente novamente em ${Math.ceil(wait / 60)} min.`,
      wait,
    );
  }

  const row = await findUserByEmail(email);

  // Sempre executa a comparação, mesmo sem usuário (ver DUMMY_HASH)
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);

  if (!row || !ok) {
    await recordFailedLogin(email, ip);
    // Mesma mensagem para "não existe" e "senha errada"
    throw new HttpError(401, "E-mail ou senha incorretos.");
  }

  await clearFailedLogins(email);
  return issueSession({ id: row.id, name: row.name, email: row.email });
}

/** Troca um refresh token por um novo par (rotação). */
export async function refreshSession(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  const result = await rotateRefreshToken(refreshToken);

  if (result.status === "reuse") {
    console.warn("[auth] reuso de refresh token detectado; sessão revogada");
  }
  if (result.status !== "ok") throw new HttpError(401, "Sessão expirada. Entre novamente.");

  return { token: signToken(result.userId), refreshToken: result.refreshToken };
}

export const revokeSession = (refreshToken: string) => revokeByToken(refreshToken);
export const revokeAllSessions = (userId: string) => revokeAllForUser(userId);

/** Limpeza periódica de registros que já não servem para nada. */
export async function cleanupExpired() {
  await Promise.all([deleteExpiredRefreshTokens(), deleteOldAttempts()]);
}