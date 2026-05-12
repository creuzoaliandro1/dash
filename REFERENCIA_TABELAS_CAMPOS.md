# 📋 Referência: Tabelas e Campos com Aspas

**Data:** 11/05/2026  
**Nota:** Use aspas duplas (`"`) ao referenciar tabelas e campos em SQL direto

---

## 🗄️ Tabela: "CONTAS"

```sql
CREATE TABLE "CONTAS" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conta" VARCHAR(10) NOT NULL UNIQUE,
  "usuario_id" UUID NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "banco_codigo" VARCHAR(5),
  "agencia" VARCHAR(10),
  "nome_titular" VARCHAR(255),
  "documento_titular" VARCHAR(20),
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
```

**Campos:**
- `"id"` → UUID único
- `"conta"` → Número da conta (ex: 09538802)
- `"usuario_id"` → FK para usuario
- `"banco_codigo"` → Código do banco (274 = Itaú)
- `"agencia"` → Agência bancária
- `"nome_titular"` → Nome da conta
- `"documento_titular"` → CNPJ/CPF
- `"created_at"` → Data de criação
- `"updated_at"` → Data de atualização

---

## 🗄️ Tabela: "CAPT_BOLETOS"

```sql
CREATE TABLE "CAPT_BOLETOS" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo_barras" VARCHAR(50) NOT NULL UNIQUE,
  "numero_conta_id" UUID NOT NULL REFERENCES "CONTAS"("id") ON DELETE CASCADE,
  "usuario_id" UUID NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  
  -- Identificação
  "nosso_numero" VARCHAR(20),
  "seu_numero" VARCHAR(20),
  "numero_documento" VARCHAR(20),
  
  -- Pagador
  "pagador_nome" VARCHAR(255),
  "pagador_documento" VARCHAR(20),
  "pagador_email" VARCHAR(255),
  "pagador_telefone" VARCHAR(20),
  "pagador_cep" VARCHAR(10),
  "pagador_logradouro" VARCHAR(255),
  "pagador_numero" VARCHAR(10),
  "pagador_complemento" VARCHAR(255),
  "pagador_cidade" VARCHAR(100),
  "pagador_uf" VARCHAR(2),
  
  -- Valores e datas
  "valor_titulo" DECIMAL(15, 2) DEFAULT 0,
  "valor_pagamento" DECIMAL(15, 2) DEFAULT 0,
  "data_emissao" DATE,
  "data_vencimento" DATE,
  "data_limite_pagamento" DATE,
  "data_pagamento" DATE,
  
  -- Status
  "status" VARCHAR(50) DEFAULT 'pendente',
  "status_negociacao" VARCHAR(100),
  
  -- Juros e multas
  "valor_juros" DECIMAL(15, 2) DEFAULT 0,
  "valor_multa" DECIMAL(15, 2) DEFAULT 0,
  "valor_desconto" DECIMAL(15, 2) DEFAULT 0,
  
  -- Auditoria
  "criado_em" TIMESTAMP DEFAULT NOW(),
  "atualizado_em" TIMESTAMP DEFAULT NOW()
);
```

**Campos Principais:**
- `"id"` → UUID único
- `"codigo_barras"` → Linha digitável (identificador único)
- `"numero_conta_id"` → FK para contas
- `"usuario_id"` → FK para usuario
- `"valor_titulo"` → Valor original
- `"valor_pagamento"` → Valor pago
- `"data_vencimento"` → Vencimento
- `"data_pagamento"` → Quando foi pago
- `"status"` → pendente, pago, atrasado, cancelado
- `"criado_em"` → Data de importação
- `"atualizado_em"` → Data da última alteração

---

## 🗄️ Tabela: "CAPT_IMPORTACOES"

```sql
CREATE TABLE "CAPT_IMPORTACOES" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "arquivo_nome" VARCHAR(255),
  "total_registros" INT DEFAULT 0,
  "registros_inseridos" INT DEFAULT 0,
  "registros_atualizados" INT DEFAULT 0,
  "registros_erro" INT DEFAULT 0,
  "erros_detalhes" JSONB,
  "status" VARCHAR(50) DEFAULT 'processando',
  "criado_em" TIMESTAMP DEFAULT NOW(),
  "finalizado_em" TIMESTAMP
);
```

**Campos:**
- `"id"` → UUID único
- `"usuario_id"` → Quem importou
- `"arquivo_nome"` → Nome do arquivo
- `"total_registros"` → Total processado
- `"registros_inseridos"` → INSERT count
- `"registros_atualizados"` → UPDATE count
- `"registros_erro"` → ERRO count
- `"status"` → processando, sucesso, erro, parcial
- `"criado_em"` → Início
- `"finalizado_em"` → Fim

---

## 🗄️ Tabela: "CAPT_LOGS_PROCESSAMENTO"

```sql
CREATE TABLE "CAPT_LOGS_PROCESSAMENTO" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "importacao_id" UUID REFERENCES "CAPT_IMPORTACOES"("id") ON DELETE CASCADE,
  "numero_linha" INT,
  "codigo_barras" VARCHAR(50),
  "tipo_operacao" VARCHAR(20),
  "mensagem" TEXT,
  "detalhes" JSONB,
  "criado_em" TIMESTAMP DEFAULT NOW()
);
```

**Campos:**
- `"id"` → UUID único
- `"importacao_id"` → FK para importação
- `"numero_linha"` → Linha do Excel
- `"codigo_barras"` → Código processado
- `"tipo_operacao"` → INSERT, UPDATE, ERRO, NOOP
- `"mensagem"` → Descrição
- `"detalhes"` → JSON com mais info
- `"criado_em"` → Timestamp

---

## 📝 Queries Comuns com Aspas

### Inserir Conta

```sql
INSERT INTO "contas" ("conta", "usuario_id", "banco_codigo", "nome_titular", "documento_titular")
VALUES ('09538802', 'seu-user-id', '274', 'RETIFICA VOLANTE', '59849652000148');
```

### Listar Boletos de um Usuário

```sql
SELECT "id", "codigo_barras", "valor_titulo", "status", "criado_em"
FROM "CAPT_BOLETOS"
WHERE "usuario_id" = 'seu-user-id'
ORDER BY "criado_em" DESC;
```

### Buscar por Código de Barras

```sql
SELECT * FROM "CAPT_BOLETOS"
WHERE "codigo_barras" = '27490001019000000005083095388001315380000178900';
```

### Estatísticas

```sql
SELECT 
  COUNT(*) as "total",
  COUNT(CASE WHEN "status" = 'pago' THEN 1 END) as "pagos",
  COUNT(CASE WHEN "status" = 'pendente' THEN 1 END) as "pendentes",
  SUM("valor_pagamento") as "valor_total_pago"
FROM "CAPT_BOLETOS"
WHERE "usuario_id" = 'seu-user-id';
```

### Ver Histórico de Importações

```sql
SELECT "id", "arquivo_nome", "total_registros", "registros_inseridos", "registros_erro", "status", "criado_em"
FROM "CAPT_IMPORTACOES"
WHERE "usuario_id" = 'seu-user-id'
ORDER BY "criado_em" DESC;
```

### Ver Logs de uma Importação

```sql
SELECT "numero_linha", "tipo_operacao", "mensagem", "criado_em"
FROM "CAPT_LOGS_PROCESSAMENTO"
WHERE "importacao_id" = 'importacao-id-aqui'
ORDER BY "numero_linha";
```

### Ver Erros de uma Importação

```sql
SELECT "numero_linha", "codigo_barras", "mensagem"
FROM "CAPT_LOGS_PROCESSAMENTO"
WHERE "importacao_id" = 'importacao-id-aqui'
AND "tipo_operacao" = 'ERRO';
```

---

## ✅ Checklist de Campos Importantes

### Para Importação

- [x] `"contas"."conta"` - Deve existir antes de importar
- [x] `"capt_boletos"."codigo_barras"` - Identificador único
- [x] `"capt_boletos"."numero_conta_id"` - FK obrigatória
- [x] `"capt_boletos"."usuario_id"` - Quem importou
- [x] `"capt_boletos"."status"` - Estado do boleto
- [x] `"capt_boletos"."valor_titulo"` - Valor original
- [x] `"capt_boletos"."valor_pagamento"` - Valor pago
- [x] `"capt_boletos"."data_vencimento"` - Data importante

### Para Auditoria

- [x] `"capt_importacoes"."id"` - Rastrear importação
- [x] `"capt_importacoes"."status"` - sucesso/erro/parcial
- [x] `"capt_logs_processamento"."tipo_operacao"` - INSERT/UPDATE/ERRO
- [x] `"capt_boletos"."criado_em"` - Quando foi importado
- [x] `"capt_boletos"."atualizado_em"` - Quando foi alterado

---

## 🔍 Aliases Úteis

```sql
-- Contar por status
SELECT "status", COUNT(*) as "quantidade"
FROM "CAPT_BOLETOS"
WHERE "usuario_id" = 'seu-user-id'
GROUP BY "status";

-- Valor por status
SELECT "status", SUM("valor_titulo") as "valor_total"
FROM "CAPT_BOLETOS"
WHERE "usuario_id" = 'seu-user-id'
GROUP BY "status";

-- Progresso de importação
SELECT 
  "status",
  "registros_inseridos",
  "registros_atualizados",
  "registros_erro",
  ROUND(100.0 * ("registros_inseridos" + "registros_atualizados") / "total_registros", 2) as "taxa_sucesso"
FROM "CAPT_IMPORTACOES"
WHERE "usuario_id" = 'seu-user-id'
ORDER BY "criado_em" DESC
LIMIT 1;
```

---

## 📌 Lembre-se

✅ Sempre use aspas duplas (`"`) em SQL direto  
✅ Supabase JS SDK cuida das aspas automaticamente  
✅ Use `LEFT("conta", 7)` para comparar sem dígito  
✅ `"codigo_barras"` é UNIQUE - não há duplicatas  
✅ `"usuario_id"` determina permissões (RLS)

---

**Referência rápida criada em 11/05/2026**
