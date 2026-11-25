-- ============================================================
-- Migração 001: Tabelas de autenticação (usuários e contas)
-- Execute no banco PostgreSQL (Render / psql / painel)
-- ============================================================

-- Contas (empresas/organizações)
CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  plano VARCHAR(50) NOT NULL DEFAULT 'free',
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usuários (acesso com e-mail e senha)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  papel VARCHAR(50) NOT NULL DEFAULT 'owner',
  conta_id UUID REFERENCES contas (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_conta ON usuarios (conta_id);

-- Refresh tokens (permite revogar sessões)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens (usuario_id);

-- Refresh tokens recebem hash SHA-256 (64 chars) — ajusta tamanho da coluna
ALTER TABLE refresh_tokens ALTER COLUMN token_hash TYPE VARCHAR(64);
