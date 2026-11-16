// src/login-attempts.ts
// Bloqueio temporário de login por conta, em dois níveis:
//  - e-mail + IP: 5 falhas em 15 min. Trava só o IP do atacante; o dono da conta,
//    em outro IP, continua entrando (evita que alguém "tranque" a conta de outra pessoa).
//  - e-mail (qualquer IP): 20 falhas em 15 min. Freia ataque distribuído por vários IPs.
import { pool } from "./db";

const WINDOW_SECONDS = 15 * 60;
const LIMIT_PER_EMAIL_AND_IP = 5;
const LIMIT_PER_EMAIL = 20;

/**
 * Se houver `limit` falhas ou mais na janela, devolve em quantos segundos a mais antiga
 * delas sai da janela (o que derruba a contagem abaixo do limite). Senão, 0.
 */
async function secondsUntilUnblocked(email: string, ip: string | null, limit: number): Promise<number> {
  const { rows } = await pool.query<{ s: number }>(
    `SELECT CEIL(EXTRACT(EPOCH FROM (created_at + make_interval(secs => $3::int) - now())))::int AS s
       FROM login_attempts
      WHERE email = $1
        AND ($2::text IS NULL OR ip = $2::text)
        AND created_at > now() - make_interval(secs => $3::int)
      ORDER BY created_at DESC
     OFFSET $4::int LIMIT 1`,
    [email, ip, WINDOW_SECONDS, limit - 1],
  );
  return Math.max(0, rows[0]?.s ?? 0);
}

/** Segundos restantes de bloqueio para este login; 0 se estiver liberado. */
export async function loginBlockedSeconds(email: string, ip: string): Promise<number> {
  const [byIp, byEmail] = await Promise.all([
    secondsUntilUnblocked(email, ip, LIMIT_PER_EMAIL_AND_IP),
    secondsUntilUnblocked(email, null, LIMIT_PER_EMAIL),
  ]);
  return Math.max(byIp, byEmail);
}

export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  await pool.query(`INSERT INTO login_attempts (email, ip) VALUES ($1, $2)`, [email, ip]);
}

export async function clearFailedLogins(email: string): Promise<void> {
  await pool.query(`DELETE FROM login_attempts WHERE email = $1`, [email]);
}

export async function deleteOldAttempts(): Promise<void> {
  await pool.query(`DELETE FROM login_attempts WHERE created_at < now() - make_interval(secs => $1::int)`, [
    WINDOW_SECONDS,
  ]);
}