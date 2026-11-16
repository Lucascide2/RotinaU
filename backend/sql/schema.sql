-- sql/schema.sql
-- Idempotente: pode ser reaplicado sobre um banco que já tem a tabela users.
-- Aplicar com: psql "$DATABASE_URL" -f sql/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(), -- nativo no PostgreSQL 13+
  name          text        NOT NULL,
  email         text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

-- Refresh tokens: guardamos só o SHA-256 do token, nunca o token em si.
-- Cada login abre uma "família"; cada refresh consome um token e cria o próximo
-- na mesma família. Se um token já consumido reaparecer (roubo), a família inteira é revogada.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   uuid        NOT NULL,
  token_hash  text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx  ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens (expires_at);

-- Tentativas de login que falharam (por e-mail, exista a conta ou não,
-- para o bloqueio se comportar igual nos dois casos e não revelar contas).
CREATE TABLE IF NOT EXISTS login_attempts (
  id          bigserial   PRIMARY KEY,
  email       text        NOT NULL,
  ip          text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email, created_at DESC);