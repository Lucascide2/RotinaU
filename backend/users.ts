// src/users.ts
// Acesso ao banco. Sempre com queries parametrizadas ($1, $2...) contra SQL injection.
import { pool } from "./db";

export type PublicUser = { id: string; name: string; email: string };
export type UserWithHash = PublicUser & { password_hash: string };

/** Cria o registro e devolve só os campos públicos (nunca o hash). */
export async function createUser(name: string, email: string, passwordHash: string): Promise<PublicUser> {
  const { rows } = await pool.query<PublicUser>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email`,
    [name, email, passwordHash],
  );
  return rows[0];
}

/** Busca por e-mail (já normalizado em minúsculas). Retorna null se não existir. */
export async function findUserByEmail(email: string): Promise<UserWithHash | null> {
  const { rows } = await pool.query<UserWithHash>(
    `SELECT id, name, email, password_hash
       FROM users
      WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}