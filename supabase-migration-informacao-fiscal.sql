-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: adiciona campos da Informação Fiscal à tabela pedidos
-- Execute no SQL Editor do Supabase
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS numero_if          TEXT,
  ADD COLUMN IF NOT EXISTS numero_processo    TEXT;

-- Cria a tabela de análise documental (caso ainda não exista)
CREATE TABLE IF NOT EXISTS documentos_analise (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id     uuid REFERENCES pedidos(id) ON DELETE CASCADE UNIQUE,
  resultado_json jsonb NOT NULL,
  created_at    timestamptz DEFAULT now()
);
