-- ========================================
-- EXECUTE ESTE ARQUIVO NO SUPABASE
-- ========================================
-- 1. Vá para: https://app.supabase.com
-- 2. Selecione seu projeto
-- 3. Vá para: SQL Editor
-- 4. Cole TODO este arquivo
-- 5. Clique em "Run"
-- ========================================

-- ==========================================
-- TABELA: CONTAS (se ainda não existir)
-- ==========================================

CREATE TABLE IF NOT EXISTS "CONTAS" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "cic" VARCHAR(50) UNIQUE NOT NULL,
  "pass" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255),
  "email" VARCHAR(255),
  "ativo" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_contas_cic" ON "CONTAS"("cic");

ALTER TABLE "CONTAS" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TABELA: BOLETOS (Criar agora)
-- ==========================================

CREATE TABLE IF NOT EXISTS "BOLETOS" (
  "ID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "CONTA_ID" UUID NOT NULL REFERENCES "CONTAS"("id") ON DELETE CASCADE,

  -- Cedente
  "CEDENTE_EFACTOR" character varying(20) null,
  "CEDENTE_CIC" character varying(20) null,
  "CEDENTE_NOME" character varying(255) null,
  "CEDENTE_COD" character varying(20) null,
  "CEDENTE_CONTA" character varying(20) null,

  -- Boleto
  "NOSSO_NUMERO" character varying(20) null,
  "NUM_TITULO" character varying(20) null,

  -- Sacado
  "SACADO_NOME" character varying(255) null,
  "SACADO_CIC" character varying(20) null,
  "SACADO_CEP" character varying(10) null,
  "SACADO_ENDERECO" character varying(255) null,
  "SACADO_NUMERO" character varying(20) null,
  "SACADO_CIDADE" character varying(255) null,
  "SACADO_UF" character varying(255) null,

  -- Datas
  "EMISSAO" date null,
  "REGISTRO" date null,
  "VENCIMENTO" date null,
  "LIMITE" date null,

  -- Valores
  "VALOR" numeric(15, 2) null,
  "DIGITAVEL" character varying(50) null,

  -- Avalista
  "AVALISTA" character varying(255) null,

  -- Juros
  "JUROS_TIPO" character varying(255) null,
  "JUROS_VALOR" numeric(15, 2) null,

  -- Desconto
  "DESCONTO_VALOR" numeric(15, 2) null,
  "DESCONTO_DATA" date null,

  -- Abatimento
  "ABATIMENTO" numeric(15, 2) null,

  -- Pagamento
  "VALOR_PAGO" numeric(15, 2) null,
  "DATA_PAGO" date null,
  "DATA_CREDITO" date null,

  -- Status
  "CANAL" character varying(255) null,
  "DESCRICAO" character varying(255) null,
  "STATUS" character varying(255) null,
  "SITUACAO" character varying(255) null,

  -- Metadados
  "CREATED_AT" TIMESTAMP DEFAULT NOW(),
  "UPDATED_AT" TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS "idx_boletos_conta_id" ON "BOLETOS"("CONTA_ID");
CREATE INDEX IF NOT EXISTS "idx_boletos_vencimento" ON "BOLETOS"("VENCIMENTO");
CREATE INDEX IF NOT EXISTS "idx_boletos_status" ON "BOLETOS"("STATUS");
CREATE INDEX IF NOT EXISTS "idx_boletos_sacado_cic" ON "BOLETOS"("SACADO_CIC");

-- RLS
ALTER TABLE "BOLETOS" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_boletos" ON "BOLETOS"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID"
    )
  );

CREATE POLICY "users_can_insert_boletos" ON "BOLETOS"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID"
    )
  );

CREATE POLICY "users_can_update_boletos" ON "BOLETOS"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID"
    )
  );

CREATE POLICY "users_can_delete_boletos" ON "BOLETOS"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID"
    )
  );

-- Function para atualizar UPDATED_AT
CREATE OR REPLACE FUNCTION update_boletos_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."UPDATED_AT" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS update_boletos_updated_at ON "BOLETOS";
CREATE TRIGGER update_boletos_updated_at
  BEFORE UPDATE ON "BOLETOS"
  FOR EACH ROW
  EXECUTE FUNCTION update_boletos_updated_at_column();

-- ==========================================
-- DADOS DE TESTE (DESCOMENTE PARA USAR)
-- ==========================================

-- INSERT INTO "CONTAS" ("cic", "pass", "name", "email") VALUES
--   ('12345678901', '123456', 'Teste Usuario', 'teste@example.com')
-- ON CONFLICT ("cic") DO NOTHING;

-- INSERT INTO "BOLETOS" ("CONTA_ID", "NUM_TITULO", "NOSSO_NUMERO", "EMISSAO", "VENCIMENTO", "VALOR", "SACADO_NOME", "SACADO_CIC", "STATUS")
-- SELECT
--   "id",
--   'DOC-001',
--   '0015660992',
--   CURRENT_DATE,
--   CURRENT_DATE + INTERVAL '15 days',
--   1500.00,
--   'Agro Plantar Ltda',
--   '89.012.345/0001-34',
--   'pendente'
-- FROM "CONTAS" WHERE "cic" = '12345678901'
-- ON CONFLICT DO NOTHING;

-- ========================================
-- FIM DAS MIGRATIONS
-- ========================================
-- ✅ Se não tiver erro, tudo foi criado!
-- ✅ Tabelas: CONTAS, BOLETOS
-- ✅ Índices: criados
-- ✅ RLS: habilitado
-- ✅ Triggers: ativos
-- ========================================
