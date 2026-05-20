-- ============================================================
-- MIGRATION: Adicionar campos de status Efactor na tabela CAPT_BOLETOS
-- Data: 20/05/2026
-- ============================================================

-- Adicionar coluna status_efactor (Antecipação)
ALTER TABLE public."CAPT_BOLETOS"
ADD COLUMN IF NOT EXISTS "status_efactor" VARCHAR(100);

-- Adicionar coluna status_efator (Registro)
ALTER TABLE public."CAPT_BOLETOS"
ADD COLUMN IF NOT EXISTS "status_efator" VARCHAR(100);

-- Comentários das novas colunas
COMMENT ON COLUMN public."CAPT_BOLETOS"."status_efactor"
  IS 'Status de antecipação do boleto na Efactor';

COMMENT ON COLUMN public."CAPT_BOLETOS"."status_efator"
  IS 'Status de registro do boleto na Efator';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
