-- ============================================================================
-- DATABASE MIGRATIONS FOR CNAB400 REMITTANCE TRACKING
-- ============================================================================
--
-- Execute these migrations in your Supabase Dashboard:
-- 1. Go to SQL Editor
-- 2. Copy and paste each migration separately
-- 3. Click "Run" for each one
--
-- These migrations are required for the CNAB400 remittance tracking feature
-- to work properly in the application.
-- ============================================================================

-- MIGRATION 1: Create capt_remessas table for tracking CNAB400 remittances
-- ============================================================================
CREATE TABLE IF NOT EXISTS "capt_remessas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conta_id" UUID NOT NULL REFERENCES "capt_contas"("id") ON DELETE CASCADE,
  "nome_arquivo" VARCHAR(255) NOT NULL,
  "data_geracao" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quantidade_boletos" INTEGER NOT NULL DEFAULT 0,
  "valor_total" DECIMAL(14, 2) DEFAULT 0,
  "boletos_ids" UUID[] NOT NULL DEFAULT '{}',
  "status" VARCHAR(50) DEFAULT 'gerado',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_remessas_conta_id ON "capt_remessas"("conta_id");
CREATE INDEX IF NOT EXISTS idx_remessas_data_geracao ON "capt_remessas"("data_geracao" DESC);

-- MIGRATION 2: Add CNAB400 tracking columns to capt_contas table
-- ============================================================================
-- This adds a column to track the last remittance date for each account
ALTER TABLE "capt_contas"
ADD COLUMN IF NOT EXISTS "cnab400_data_ultima_remessa" TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- OPTIONAL: Enable Row Level Security (RLS) for capt_remessas table
-- ============================================================================
-- Uncomment the lines below if you're using RLS policies

-- ALTER TABLE "capt_remessas" ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Users can view their own account remittances"
-- ON "capt_remessas"
-- FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM "capt_contas"
--     WHERE "capt_contas"."id" = "capt_remessas"."conta_id"
--     AND "capt_contas"."usuario_id" = auth.uid()
--   )
-- );
--
-- CREATE POLICY "Users can insert remittances for their own accounts"
-- ON "capt_remessas"
-- FOR INSERT
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM "capt_contas"
--     WHERE "capt_contas"."id" = "capt_remessas"."conta_id"
--     AND "capt_contas"."usuario_id" = auth.uid()
--   )
-- );

-- ============================================================================
-- VERIFICATION: Check if migrations were applied successfully
-- ============================================================================
-- Run these queries to verify:
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name = 'capt_remessas';
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'capt_contas'
-- AND column_name = 'cnab400_data_ultima_remessa';
