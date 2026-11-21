// src/invites.ts
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { pool } from "./db";

const MAX_ATTEMPTS = 10;
const WINDOW = "1 hour"; // para um limite vitalício, remova o filtro de data na query de contagem

const GLOBAL_MAX_FAILS = 20;    // erros somados de todos os usuários
const GLOBAL_BLOCK = "15 minutes";

// Salvar o código em texto só fora de produção (ou com liberação explícita).
const SAVE_PLAINTEXT =
  process.env.NODE_ENV !== "production" || process.env.SAVE_PLAINTEXT_CODES === "true";
const CODES_FILE = process.env.CODES_FILE ?? path.resolve(process.cwd(), "codigos.txt");

// Sem caracteres ambíguos (0/O, 1/I/L). 32 símbolos -> 256 % 32 == 0, então sem viés no sorteio.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ajuste para ter exatamente 32 símbolos, veja nota abaixo

function generateCode(): string {
  const bytes = crypto.randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`; // ex.: K7M2-9QXA-4TBP
}

/** Normaliza o que o usuário digita: maiúsculas, sem hífen nem espaços. */
function normalize(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(normalize(code)).digest("hex");
}

/** Gera o convite no cadastro: hash no banco, código em texto no codigos.txt. */
export async function createInviteForUser(userId: string, name: string): Promise<void> {
  const code = generateCode();

  const { rowCount } = await pool.query(
    `INSERT INTO premium_invites (user_id, code_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, hashCode(code)],
  );
  if (!rowCount) return; // já existia convite para este usuário

  if (SAVE_PLAINTEXT) {
    // Remove quebras de linha do nome para ninguém "forjar" linhas no arquivo.
    const safeName = name.replace(/[\r\n\t]+/g, " ").trim();
    await fs.appendFile(CODES_FILE, `${safeName} | ${code}\n`, { mode: 0o600 });
  }
}

export type RedeemResult = "ok" | "invalid" | "rate_limited";

/** Conta um erro de qualquer usuário. Ao chegar em 20, bloqueia por 15 min e zera o contador. */
async function recordGlobalFailure(): Promise<void> {
  await pool.query(
    `UPDATE premium_global_guard
        SET fail_count    = CASE WHEN fail_count + 1 >= $1 THEN 0 ELSE fail_count + 1 END,
            blocked_until = CASE WHEN fail_count + 1 >= $1
                                 THEN now() + interval '${GLOBAL_BLOCK}'
                                 ELSE blocked_until END
      WHERE id = 1`,
    [GLOBAL_MAX_FAILS],
  );
}

/** Só o acerto do código COMPARTILHADO zera o contador. */
async function resetGlobalFailures(): Promise<void> {
  await pool.query(`UPDATE premium_global_guard SET fail_count = 0 WHERE id = 1`);
}

export async function redeemInvite(userId: string, ip: string, code: string): Promise<RedeemResult> {
  // 1) Limite por usuário: registra a tentativa ANTES de checar.
  await pool.query(`INSERT INTO premium_redeem_attempts (user_id, ip) VALUES ($1, $2)`, [userId, ip]);
  const { rows: count } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM premium_redeem_attempts
      WHERE user_id = $1 AND created_at > now() - interval '${WINDOW}'`,
    [userId],
  );
  if (Number(count[0].n) > MAX_ATTEMPTS) return "rate_limited";

  // 2) Transação de resgate
  const hash = hashCode(code);
  let outcome: RedeemResult = "invalid";
  let sharedHit = false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 2a) Código pessoal
    const { rows } = await client.query<{ code_hash: string; redeemed_at: Date | null }>(
      `SELECT code_hash, redeemed_at FROM premium_invites WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const invite = rows[0];
    const personalMatch =
      !!invite &&
      !invite.redeemed_at &&
      crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(invite.code_hash, "hex"));

    if (personalMatch) {
      await client.query(`UPDATE premium_invites SET redeemed_at = now() WHERE user_id = $1`, [userId]);
      outcome = "ok";
    } else {
      // 2b) Bloqueio global do código compartilhado
      const { rows: g } = await client.query<{ blocked: boolean }>(
        `SELECT (blocked_until IS NOT NULL AND blocked_until > now()) AS blocked
           FROM premium_global_guard WHERE id = 1`,
      );

      if (g[0]?.blocked) {
        outcome = "rate_limited"; // bloqueado: não conta como erro novo
      } else {
        // 2c) Código compartilhado
        const { rows: shared } = await client.query<{ id: string }>(
          `SELECT id FROM premium_shared_codes
            WHERE code_hash = $1
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > now())
              AND (max_uses IS NULL OR uses < max_uses)
            FOR UPDATE`,
          [hash],
        );

        if (shared[0]) {
          const ins = await client.query(
            `INSERT INTO premium_shared_redemptions (code_id, user_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [shared[0].id, userId],
          );
          if (ins.rowCount) {
            await client.query(`UPDATE premium_shared_codes SET uses = uses + 1 WHERE id = $1`, [shared[0].id]);
          }
          sharedHit = true;
          outcome = "ok";
        }
        // senão: outcome continua "invalid"
      }
    }

    if (outcome === "ok") {
      await client.query(`UPDATE users SET llm_enabled = true WHERE id = $1`, [userId]);
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // 3) Contador global, FORA da transação (senão o ROLLBACK desfaria o incremento)
  if (outcome === "invalid") await recordGlobalFailure();

  if (outcome === "ok") {
    if (sharedHit) await resetGlobalFailures(); // só o acerto do compartilhado zera
    await pool.query(`DELETE FROM premium_redeem_attempts WHERE user_id = $1`, [userId]);
  }

  return outcome;
}

