// scripts/create-shared-code.ts
// Uso: npx tsx scripts/create-shared-code.ts 50 30 "turma beta"
//      (máx. de usos, dias de validade, observação)
import crypto from "crypto";
import "dotenv/config";
import { pool } from "./db";


const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = (() => {
  let s = "";
  for (let i = 0; i < 12; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
})();

const hash = crypto.createHash("sha256").update(code.replace(/[^A-Z0-9]/g, "")).digest("hex");

const maxUses = Number(process.argv[2]) || null;
const days = Number(process.argv[3]) || null;
const note = process.argv[4] ?? null;

(async () => {
  await pool.query(
    `INSERT INTO premium_shared_codes (code_hash, max_uses, expires_at, note)
     VALUES ($1, $2, CASE WHEN $3::int IS NULL THEN NULL ELSE now() + ($3::int * interval '1 day') END, $4)`,
    [hash, maxUses, days, note],
  );
  console.log("Código compartilhado:", code);
  console.log("Guarde-o agora: no banco só existe o hash.");
  await pool.end();
})();