# 🔧 Adaptação: Usar Tabela "CONTAS" Existente

**Data:** 11/05/2026  
**Situação:** Você tem tabela `"CONTAS"` com estrutura diferente

---

## ✅ Estrutura Real da Tabela

```sql
CREATE TABLE public."CONTAS" (
  id BIGSERIAL PRIMARY KEY,
  agencia TEXT,
  conta TEXT NOT NULL,
  cic VARCHAR,
  data_abertura DATE,
  nome_correntista TEXT,
  email TEXT,
  telefone TEXT,
  cedente TEXT,
  nnumero INTEGER,
  cnab400 VARCHAR(255),
  cod_cedente INTEGER,
  registro INTEGER,
  updated_at TIMESTAMP,
  endereco VARCHAR(150),
  bairro VARCHAR(80),
  cidade VARCHAR(80),
  uf CHAR(2),
  cep VARCHAR(8),
  contato VARCHAR(150),
  nnumero_dv VARCHAR(1),
  logo_url VARCHAR(80),
  logo TEXT,
  boleto VARCHAR(10),
  tipo VARCHAR(1)
);
```

---

## 🔄 Mudanças na Solução

### ❌ NÃO FAZER

Ignore estes arquivos:
- ❌ `supabase_migration_capt_boletos.sql` - Não precisa recriar tabelas
- ❌ Usar `usuario_id` para RLS - Sua tabela não tem isso

### ✅ FAZER

Use estes arquivos (adaptados):
- ✅ `backend/services/boletoImportService.js` - **COM MUDANÇAS**
- ✅ `backend/server.js` - **COM MUDANÇAS**
- ✅ Apenas criar `"CAPT_BOLETOS"` e `"CAPT_IMPORTACOES"`

---

## 🎯 Principais Diferenças

| Aspecto | Original | Real |
|---------|----------|------|
| Chave primária | `id` (UUID) | `id` (BIGSERIAL) |
| Identificador de usuário | `usuario_id` (FK) | ❌ NÃO TEM |
| Campos de conta | Mínimos | Muitos (+20) |
| RLS (Row Level Security) | Sim | ❌ NÃO APLICA |

---

## 🔍 Como Buscar Conta (CORRIGIDO)

### ❌ ERRADO (Anterior)
```javascript
const { data, error } = await supabase
  .from('"CONTAS"')
  .select('"id", "conta", "usuario_id"')
  .filter('"conta"', 'like', `${numeroConta}%`)
  .limit(1)
  .single();
```

### ✅ CORRETO (Nova Solução)
```javascript
const { data, error } = await supabase
  .from('"CONTAS"')
  .select('"id", "conta", "nome_correntista", "email", "telefone"')
  .filter('"conta"', 'like', `${numeroConta}%`)
  .limit(1)
  .single();
```

---

## 📝 Tabela "CAPT_BOLETOS" (NOVA)

Você SÓ precisa criar esta tabela:

```sql
CREATE TABLE public."CAPT_BOLETOS" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo_barras" VARCHAR(50) NOT NULL UNIQUE,
  "numero_conta_id" BIGINT NOT NULL REFERENCES public."CONTAS"("id") ON DELETE CASCADE,
  
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_capt_boletos_codigo_barras 
  ON public."CAPT_BOLETOS" USING BTREE ("codigo_barras");

CREATE INDEX IF NOT EXISTS idx_capt_boletos_numero_conta 
  ON public."CAPT_BOLETOS" USING BTREE ("numero_conta_id");

CREATE INDEX IF NOT EXISTS idx_capt_boletos_status 
  ON public."CAPT_BOLETOS" USING BTREE ("status");
```

---

## 📝 Tabela "CAPT_IMPORTACOES" (NOVA)

```sql
CREATE TABLE public."CAPT_IMPORTACOES" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "arquivo_nome" VARCHAR(255),
  "total_registros" INT DEFAULT 0,
  "registros_inseridos" INT DEFAULT 0,
  "registros_atualizados" INT DEFAULT 0,
  "registros_erro" INT DEFAULT 0,
  "status" VARCHAR(50) DEFAULT 'processando',
  "criado_em" TIMESTAMP DEFAULT NOW(),
  "finalizado_em" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capt_importacoes_status 
  ON public."CAPT_IMPORTACOES" USING BTREE ("status");

CREATE INDEX IF NOT EXISTS idx_capt_importacoes_criado_em 
  ON public."CAPT_IMPORTACOES" USING BTREE ("criado_em" DESC);
```

---

## 🔄 Função de Busca de Conta (NOVA)

Copie isto no `boletoImportService.js`:

```javascript
/**
 * VALIDAR CORRESPONDÊNCIA DE CONTA
 * Busca na tabela real "CONTAS" com estrutura existente
 */
export async function validarConta(supabase, numeroConta) {
  const { data, error } = await supabase
    .from('"CONTAS"')
    .select('"id", "conta", "nome_correntista", "email", "cedente"')
    .or(`"conta".ilike.${numeroConta}%,conta.ilike.${numeroConta}%`)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}
```

---

## 🔄 Inserir Boleto (ADAPTADO)

```javascript
// Preparar dados do novo boleto
const novosDados = {
  codigo_barras: codigoBarras,
  numero_conta_id: contaEncontrada.id,  // ← ID BIGINT da "CONTAS"
  
  // ... outros campos ...
  
  valor_titulo: normalizarValor(boleto['Valor do título']),
  valor_pagamento: normalizarValor(boleto['Valor pago']),
  data_vencimento: normalizarData(boleto['Data de vencimento']),
  data_pagamento: normalizarData(boleto['Data de pagamento']),
  
  status: boleto['Status do boleto'] || 'pendente',
};

// Inserir
const { data, error } = await supabase
  .from('"CAPT_BOLETOS"')
  .insert([novosDados])
  .select('"id"');
```

---

## 🔄 Query SQL para Inserir Conta (NÃO MAIS NECESSÁRIO)

✅ **Sua tabela `"CONTAS"` já existe!**

Você NÃO precisa executar nenhum SQL de inserção de conta.

Simplesmente:
1. Certifique-se que a conta `09538802` existe em `"CONTAS"."conta"`
2. Execute SQL das tabelas NOVAS (`"CAPT_BOLETOS"` e `"CAPT_IMPORTACOES"`)

---

## ✅ Checklist de Implementação

- [ ] Criar tabela `"CAPT_BOLETOS"` (SQL acima)
- [ ] Criar tabela `"CAPT_IMPORTACOES"` (SQL acima)
- [ ] Atualizar função `validarConta()` em `boletoImportService.js`
- [ ] Remover referências a `usuario_id` no servidor
- [ ] Testar busca de conta com código `095388`
- [ ] Importar arquivo de boletos

---

## 🧪 Testar Busca de Conta

No Supabase SQL Editor:

```sql
-- Verificar se a conta existe
SELECT "id", "conta", "nome_correntista"
FROM "CONTAS"
WHERE "conta" ILIKE '09538802%'
LIMIT 1;

-- Resultado esperado:
-- id | conta    | nome_correntista
-- 1  | 09538802 | RETIFICA VOLANTE (ou similar)
```

Se retornar vazio, você precisa inserir a conta primeiro!

---

## 📊 Após Importação

Você verá dados em:

```sql
-- Boletos importados
SELECT COUNT(*) FROM "CAPT_BOLETOS";
-- Resultado: 1000+

-- Histórico de importações
SELECT * FROM "CAPT_IMPORTACOES" ORDER BY "criado_em" DESC;

-- Verificar um boleto
SELECT * FROM "CAPT_BOLETOS" LIMIT 1;
```

---

## ⚠️ Cuidados

- ❌ **NÃO** tente recriar tabela `"CONTAS"`
- ❌ **NÃO** use `usuario_id` (não existe)
- ✅ **CRIE** apenas `"CAPT_BOLETOS"` e `"CAPT_IMPORTACOES"`
- ✅ **USE** `numero_conta_id` (BIGINT) como FK

---

**Próximo passo:** Criar as 2 tabelas novas e atualizar `boletoImportService.js`

Quer que eu crie os arquivos atualizados?
