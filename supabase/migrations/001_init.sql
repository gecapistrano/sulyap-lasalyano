-- Sulyap Lasalyano — core schema for Supabase (Postgres)
-- Safe to re-run: uses IF NOT EXISTS.
-- All visitor/curator access goes through FastAPI + DATABASE_URL (Postgres role).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  hashed_password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

CREATE TABLE IF NOT EXISTS presidents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  service VARCHAR(80) NOT NULL DEFAULT '',
  icon VARCHAR(16) NOT NULL DEFAULT '👤'
);

CREATE INDEX IF NOT EXISTS ix_presidents_id ON presidents (id);
CREATE INDEX IF NOT EXISTS ix_presidents_name ON presidents (name);

CREATE TABLE IF NOT EXISTS artifacts (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users (id),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url VARCHAR(500) NOT NULL,
  model_url VARCHAR(500) NOT NULL DEFAULT '',
  rd_code VARCHAR(32) NOT NULL DEFAULT '',
  owner_name VARCHAR(200) NOT NULL DEFAULT '',
  year VARCHAR(32) NOT NULL DEFAULT '',
  subtitle VARCHAR(200) NOT NULL DEFAULT '',
  icon VARCHAR(16) NOT NULL DEFAULT '🏺',
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_artifacts_id ON artifacts (id);
CREATE INDEX IF NOT EXISTS ix_artifacts_owner_id ON artifacts (owner_id);
CREATE INDEX IF NOT EXISTS ix_artifacts_rd_code ON artifacts (rd_code);
CREATE INDEX IF NOT EXISTS ix_artifacts_owner_name ON artifacts (owner_name);
CREATE INDEX IF NOT EXISTS ix_artifacts_published ON artifacts (published);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  token_id VARCHAR(128) NOT NULL UNIQUE,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  replaced_by VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_id ON refresh_tokens (id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_token_id ON refresh_tokens (token_id);

-- Lock tables from Supabase anon/authenticated API keys.
-- FastAPI uses the Postgres connection string (table owner) and is not blocked.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE presidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
