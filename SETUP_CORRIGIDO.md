# ✅ SETUP CORRIGIDO - Usar Este Arquivo

Execute este SQL no Supabase SQL Editor (substitui o anterior):

```sql
-- DROPAR a constraint se existir
ALTER TABLE "BOLETOS" DROP CONSTRAINT IF EXISTS "BOLETOS_CONTA_ID_fkey";

-- RECRIAR tabela BOLETOS com bigint (compatível com CONTAS)
DROP TABLE IF EXISTS "BOLETOS" CASCADE;

CREATE TABLE "BOLETOS" (
  "ID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "CONTA_ID" BIGINT NOT NULL REFERENCES "CONTAS"("id") ON DELETE CASCADE,

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

-- RLS
ALTER TABLE "BOLETOS" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_boletos" ON "BOLETOS"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID")
  );

CREATE POLICY "users_can_insert_boletos" ON "BOLETOS"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID")
  );

CREATE POLICY "users_can_update_boletos" ON "BOLETOS"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID")
  );

CREATE POLICY "users_can_delete_boletos" ON "BOLETOS"
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID")
  );

-- Função para atualizar UPDATED_AT
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
```

## ✅ O que mudou:

- ✅ `CONTA_ID` agora é `BIGINT` (compatível com CONTAS)
- ✅ Dropar e recriar a tabela para limpar
- ✅ Adicionar todas as políticas RLS

## 📝 Passos:

1. Copie TODO este SQL acima
2. No Supabase SQL Editor → New Query
3. Cole o SQL
4. Clique em **"Run"**
5. Se aparecer ✅ sem erros, está pronto!

Agora teste fazer login com: **CIC**: `12345678901` / **Senha**: `123456`
