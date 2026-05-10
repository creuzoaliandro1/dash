-- ==========================================
-- TABELA: BOLETOS (Sistema de Gestão de Boletos)
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

-- ==========================================
-- ÍNDICES
-- ==========================================

CREATE INDEX IF NOT EXISTS "idx_boletos_conta_id" ON "BOLETOS"("CONTA_ID");
CREATE INDEX IF NOT EXISTS "idx_boletos_vencimento" ON "BOLETOS"("VENCIMENTO");
CREATE INDEX IF NOT EXISTS "idx_boletos_status" ON "BOLETOS"("STATUS");
CREATE INDEX IF NOT EXISTS "idx_boletos_sacado_cic" ON "BOLETOS"("SACADO_CIC");

-- ==========================================
-- RLS - Row Level Security
-- ==========================================

ALTER TABLE "BOLETOS" ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas boletos da sua conta
CREATE POLICY "users_can_view_own_boletos" ON "BOLETOS"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID" AND "CONTAS"."id" = 'user_id'
    )
  );

-- ==========================================
-- FUNÇÃO: atualizar UPDATED_AT automaticamente
-- ==========================================

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
