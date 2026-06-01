# ⚡ SETUP RÁPIDO - EXECUTE EM 2 MINUTOS

## PASSO 1: Abrir Supabase

1. Vá para: https://app.supabase.com
2. Selecione seu projeto
3. Clique em **SQL Editor** (menu esquerdo)
4. Clique em **New Query**

## PASSO 2: Copiar e Colar o SQL

Copie TODO isto abaixo e cole no Supabase SQL Editor:

```sql
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

CREATE TABLE IF NOT EXISTS "BOLETOS" (
  "ID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "CONTA_ID" UUID NOT NULL REFERENCES "CONTAS"("id") ON DELETE CASCADE,
  "CEDENTE_EFACTOR" character varying(20) null,
  "CEDENTE_CIC" character varying(20) null,
  "CEDENTE_NOME" character varying(255) null,
  "CEDENTE_COD" character varying(20) null,
  "CEDENTE_CONTA" character varying(20) null,
  "NOSSO_NUMERO" character varying(20) null,
  "NUM_TITULO" character varying(20) null,
  "SACADO_NOME" character varying(255) null,
  "SACADO_CIC" character varying(20) null,
  "SACADO_CEP" character varying(10) null,
  "SACADO_ENDERECO" character varying(255) null,
  "SACADO_NUMERO" character varying(20) null,
  "SACADO_CIDADE" character varying(255) null,
  "SACADO_UF" character varying(255) null,
  "EMISSAO" date null,
  "REGISTRO" date null,
  "VENCIMENTO" date null,
  "LIMITE" date null,
  "VALOR" numeric(15, 2) null,
  "DIGITAVEL" character varying(50) null,
  "AVALISTA" character varying(255) null,
  "JUROS_TIPO" character varying(255) null,
  "JUROS_VALOR" numeric(15, 2) null,
  "DESCONTO_VALOR" numeric(15, 2) null,
  "DESCONTO_DATA" date null,
  "ABATIMENTO" numeric(15, 2) null,
  "VALOR_PAGO" numeric(15, 2) null,
  "DATA_PAGO" date null,
  "DATA_CREDITO" date null,
  "CANAL" character varying(255) null,
  "DESCRICAO" character varying(255) null,
  "STATUS" character varying(255) null,
  "SITUACAO" character varying(255) null,
  "CREATED_AT" TIMESTAMP DEFAULT NOW(),
  "UPDATED_AT" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_boletos_conta_id" ON "BOLETOS"("CONTA_ID");
CREATE INDEX IF NOT EXISTS "idx_boletos_vencimento" ON "BOLETOS"("VENCIMENTO");
CREATE INDEX IF NOT EXISTS "idx_boletos_status" ON "BOLETOS"("STATUS");

ALTER TABLE "BOLETOS" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_boletos" ON "BOLETOS"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID")
  );

CREATE POLICY "users_can_insert_boletos" ON "BOLETOS"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM "CONTAS" WHERE "CONTAS"."id" = "BOLETOS"."CONTA_ID")
  );

INSERT INTO "CONTAS" ("cic", "pass", "name", "email") VALUES
  ('12345678901', '123456', 'Usuário Teste', 'teste@example.com')
ON CONFLICT ("cic") DO NOTHING;
```

## PASSO 3: Executar no Supabase

1. Clique em **"Run"** (botão no canto superior direito)
2. Aguarde 2-3 segundos
3. Se aparecer ✅ sem erros, está pronto!

## PASSO 4: Testar na Aplicação

Na sua aplicação (http://localhost:5173):

1. **CIC**: `12345678901`
2. **Senha**: `123456`
3. Clique em **"Boletos"**
4. Clique em **"+ Emitir boleto"**
5. Preencha e clique em **"Emitir Boleto"** ✅

---

**Pronto!** Os dados serão salvos automaticamente no Supabase 🎉
