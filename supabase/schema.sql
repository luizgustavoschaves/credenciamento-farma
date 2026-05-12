-- ============================================================
-- Schema do Supabase — Credenciamento Atacadista de Medicamentos
-- SEFAZ-MA · Substituição Tributária
-- ============================================================

-- Tabela principal: pedidos de credenciamento / renovação
CREATE TABLE IF NOT EXISTS pedidos (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj          TEXT    NOT NULL,
  razao_social  TEXT,
  tipo          TEXT    NOT NULL CHECK (tipo IN ('credenciamento', 'renovacao')),
  status        TEXT    NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'aprovado', 'indeferido')),
  resultado_json JSONB  NOT NULL,   -- ResultadoAnalise completo
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pareceres (texto gerado pela IA + revisão do auditor)
CREATE TABLE IF NOT EXISTS pareceres (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id     UUID    NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  texto_gerado  TEXT    NOT NULL,   -- texto original da IA
  texto_final   TEXT,               -- texto após edição do auditor
  auditor       TEXT,               -- nome do auditor responsável
  aprovado_em   TIMESTAMPTZ,        -- data/hora da aprovação
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pedidos_cnpj       ON pedidos (cnpj);
CREATE INDEX IF NOT EXISTS idx_pedidos_status     ON pedidos (status);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pareceres_pedido   ON pareceres (pedido_id);

-- Trigger: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedidos_updated_at
BEFORE UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
