// src/refresh-tokens.ts
import { createHash, randomBytes } from "node:crypto";

import { pool } from "./db";

const REFRESH_TTL_DAYS = 30;

// SHA-256 basta aqui: o token tem 256 bits aleatórios, não é uma senha escolhida por pessoa.
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const generate = () => randomBytes(32).toString("base64url");

/** Cria o primeiro refresh token de uma sessão nova (login/cadastro). */
export async function insertRefreshToken(userId: string, familyId: string): Promise<string> {
  const token = generate();
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(days => $4::int))`,
    [userId, familyId, sha256(token), REFRESH_TTL_DAYS],
  );
  return token;
}

export type RotateResult =
  | { status: "ok"; userId: string; refreshToken: string }
  | { status: "invalid" } // desconhecido, expirado ou revogado
  | { status: "reuse" }; // já consumido: possível roubo; a família foi revogada

/**
 * Consome o token recebido e emite o próximo, na mesma transação.
 * O UPDATE condicional é atômico: se dois refreshes chegarem juntos com o mesmo
 * token, só um consome; o outro cai na detecção de reuso.
 */
export async function rotateRefreshToken(token: string): Promise<RotateResult> {
  const hash = sha256(token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const consumed = await client.query<{ user_id: string; family_id: string }>(
      `UPDATE refresh_tokens
          SET used_at = now()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > now()
        RETURNING user_id, family_id`,
      [hash],
    );

    if (consumed.rows[0]) {
      const { user_id, family_id } = consumed.rows[0];
      const next = generate();
      await client.query(
        `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + make_interval(days => $4::int))`,
        [user_id, family_id, sha256(next), REFRESH_TTL_DAYS],
      );
      await client.query("COMMIT");
      return { status: "ok", userId: user_id, refreshToken: next };
    }

    await client.query("ROLLBACK");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Não consumiu nada: descobre se foi reuso de um token já rotacionado.
  const { rows } = await pool.query<{ family_id: string; used_at: Date | null }>(
    `SELECT family_id, used_at FROM refresh_tokens WHERE token_hash = $1`,
    [hash],
  );
  const row = rows[0];

  if (row?.used_at) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`,
      [row.family_id],
    );
    return { status: "reuse" };
  }
  return { status: "invalid" };
}

/** Logout: revoga a sessão (família) a que o token pertence. Idempotente. */
export async function revokeByToken(token: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens
        SET revoked_at = now()
      WHERE revoked_at IS NULL
        AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
    [sha256(token)],
  );
}

/** "Sair de todos os dispositivos". */
export async function revokeAllForUser(userId: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

export async function deleteExpiredRefreshTokens(): Promise<void> {
  await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < now()`);
}