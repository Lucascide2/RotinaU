// src/invites.ts
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { pool } from "./db";

const MAX_ATTEMPTS = 10;
const WINDOW = "1 hour"; // para um limite vitalício, remova o filtro de data na query de contagem

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

export async function redeemInvite(userId: string, ip: string, code: string): Promise<RedeemResult> {
  // 1) Registra a tentativa ANTES de checar. Assim requisições simultâneas
  //    também são contadas e não furam o limite.
  await pool.query(`INSERT INTO premium_redeem_attempts (user_id, ip) VALUES ($1, $2)`, [userId, ip]);
  const { rows: count } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM premium_redeem_attempts
      WHERE user_id = $1 AND created_at > now() - interval '${WINDOW}'`,
    [userId],
  );
  if (Number(count[0].n) > MAX_ATTEMPTS) return "rate_limited";

  // 2) Compara hash com hash, em tempo constante, dentro de uma transação.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ code_hash: string; redeemed_at: Date | null }>(
      `SELECT code_hash, redeemed_at FROM premium_invites WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const invite = rows[0];

    const given = Buffer.from(hashCode(code), "hex");
    const stored = invite ? Buffer.from(invite.code_hash, "hex") : Buffer.alloc(32);
    const match = crypto.timingSafeEqual(given, stored) && !!invite && !invite.redeemed_at;

    if (!match) {
      await client.query("ROLLBACK");
      return "invalid";
    }

    await client.query(`UPDATE premium_invites SET redeemed_at = now() WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE users SET llm_enabled = true WHERE id = $1`, [userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // 3) Sucesso: limpa as tentativas.
  await pool.query(`DELETE FROM premium_redeem_attempts WHERE user_id = $1`, [userId]);
  return "ok";
}