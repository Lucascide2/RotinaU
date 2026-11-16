// src/db.ts
import { Pool } from "pg";

// DATABASE_URL=postgres://usuario:senha@localhost:5432/rotinau
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Em provedores gerenciados (Neon, Supabase, Render...) costuma ser necessário:
  // ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("[db] erro inesperado no pool:", err);
});