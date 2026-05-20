# Como é Coletado o Número da Remessa - CNAB400

## 📍 Resumo Executivo

O **número da remessa** é um contador sequencial armazenado na **tabela CONTAS** (campo `cnab400`) que é **incrementado de 1 em 1** a cada geração de arquivo CNAB400.

---

## 🗂️ Fonte de Dados

### Tabela: `CONTAS`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | BIGINT | ID da conta |
| `cnab400` | INTEGER | Sequencial atual de remessas CNAB400 |

**Exemplo:**

```sql
SELECT id, cnab400 FROM CONTAS WHERE id = 12345;

-- Resultado:
-- id      | cnab400
-- 12345   | 23
```

---

## 🔄 Fluxo de Coleta

```
┌──────────────────────────────────────────────────────────────┐
│ 1. BUSCAR CONTA NO BANCO                                    │
│    SELECT cnab400 FROM CONTAS WHERE id = ?                  │
│    Resultado: cnab400 = 23                                   │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. INCREMENTAR PARA PRÓXIMA REMESSA                         │
│    novoSequencial = 23 + 1 = 24                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. USAR NÚMERO NA GERAÇÃO CNAB400                           │
│    - Header (posição 108-110): "024"                        │
│    - Nome arquivo: "CB10030000024.REM"                      │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. ATUALIZAR BANCO COM NOVO VALOR                          │
│    UPDATE CONTAS SET cnab400 = 24 WHERE id = 12345         │
│    Próxima remessa usará: 25                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 📄 Onde Aparece no Arquivo CNAB400

### Header (Tipo 0) - Posição 108-110

```
Posição: 108-110
Tamanho: 3 caracteres
Tipo: Numérico (zeros à esquerda)
Campo BD: CONTAS.cnab400

Exemplo no Header:
│...agência...│conta│    ...nome cedente...    │banco│data│ ← remessa ← brancos ← seq
01REMESSA01COBRANCA       000112429809VOLANTE...   107BMP 100326       000023         000001
                                                                         └─────┘
                                                                         Posição 108-110
```

**Análise:**
- Posição 108-110 contém: `000` (remessa 0023 formatada com 3 caracteres)
- Formato: sempre 3 dígitos com zeros à esquerda

⚠️ **IMPORTANTE**: No header, o número é formatado em **3 posições**, mas internamente é um **número progressivo ilimitado**.

---

### Nome do Arquivo

O número da remessa também aparece no **nome do arquivo**:

**Padrão**: `CBDDMMSSSSSSS.REM`

```
CB = Cobrança Bancária (fixo)
DD = Dia da geração (2 dígitos)
MM = Mês da geração (2 dígitos)
SSSSSSS = Sequencial da remessa (7 dígitos, zeros à esquerda)
.REM = Extensão (fixo)

Exemplos:
├─ Data: 10/03/2026, Sequencial: 23 → CB10030000023.REM
├─ Data: 25/12/2026, Sequencial: 1  → CB25120000001.REM
└─ Data: 01/01/2027, Sequencial: 999 → CB01010000999.REM
```

---

## 🔧 Código de Implementação

### TypeScript/JavaScript

```typescript
// ============================================================================
// 1. BUSCAR SEQUENCIAL ATUAL
// ============================================================================

async function buscarSequencialAtual(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("CONTAS")
    .select("cnab400")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Conta não encontrada");
  }

  return data.cnab400 || 0; // Se vazio, usa 0
}

// Exemplo de uso:
const sequencialAtual = await buscarSequencialAtual("12345");
console.log("Sequencial atual:", sequencialAtual); // 23

// ============================================================================
// 2. INCREMENTAR PARA PRÓXIMA REMESSA
// ============================================================================

function calcularProximoSequencial(sequencialAtual: number): number {
  return sequencialAtual + 1;
}

// Exemplo:
const proximoSequencial = calcularProximoSequencial(sequencialAtual);
console.log("Próximo sequencial:", proximoSequencial); // 24

// ============================================================================
// 3. FORMATAR PARA HEADER (3 posições)
// ============================================================================

function formatarParaHeader(sequencial: number): string {
  return String(sequencial).padStart(3, "0");
}

// Exemplos:
console.log(formatarParaHeader(23)); // "023"
console.log(formatarParaHeader(1));  // "001"
console.log(formatarParaHeader(999)); // "999"

// ============================================================================
// 4. FORMATAR PARA NOME DO ARQUIVO (7 posições)
// ============================================================================

function formatarParaNomeArquivo(sequencial: number): string {
  return String(sequencial).padStart(7, "0");
}

// Exemplos:
console.log(formatarParaNomeArquivo(23)); // "0000023"
console.log(formatarParaNomeArquivo(1));  // "0000001"
console.log(formatarParaNomeArquivo(999)); // "0000999"

// ============================================================================
// 5. GERAR NOME DO ARQUIVO COMPLETO
// ============================================================================

function gerarNomeArquivo(
  sequencial: number,
  data: Date = new Date()
): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const seq = formatarParaNomeArquivo(sequencial);

  return `CB${dia}${mes}${seq}.REM`;
}

// Exemplos:
console.log(gerarNomeArquivo(23, new Date("2026-03-10"))); // "CB10030000023.REM"
console.log(gerarNomeArquivo(1, new Date("2026-12-25")));  // "CB25120000001.REM"

// ============================================================================
// 6. ATUALIZAR BANCO COM NOVO VALOR
// ============================================================================

async function atualizarSequencial(
  userId: string,
  novoSequencial: number
): Promise<void> {
  const { error } = await supabase
    .from("CONTAS")
    .update({ cnab400: novoSequencial })
    .eq("id", userId);

  if (error) {
    throw new Error(`Erro ao atualizar sequencial: ${error.message}`);
  }
}

// Exemplo:
await atualizarSequencial("12345", 24);

// ============================================================================
// 7. FLUXO COMPLETO
// ============================================================================

async function gerarRemessa(userId: string, titulos: any[]) {
  // 1. Buscar conta e sequencial
  const contaData = await buscarConta(userId); // sua função
  const sequencialAtual = contaData.cnab400;
  const proximoSequencial = sequencialAtual + 1;

  // 2. Gerar arquivo CNAB400 (usa formatação interna)
  const header = `0...${formatarParaHeader(proximoSequencial)}...000001`;
  const nomeArquivo = gerarNomeArquivo(proximoSequencial);

  // 3. Salvar arquivo
  await salvarArquivo(nomeArquivo, header);

  // 4. Atualizar banco de dados
  await atualizarSequencial(userId, proximoSequencial);

  // 5. Retornar resultado
  return {
    nomeArquivo,
    numeroRemessa: proximoSequencial,
    quantidadeTitulos: titulos.length,
  };
}
```

---

## 📋 Tabela de Mapeamento

| Contexto | Campo BD | Tamanho | Formato | Exemplo |
|----------|----------|---------|---------|---------|
| **Armazenamento** | `CONTAS.cnab400` | INTEGER | Número simples | `23` |
| **Header Tipo 0** | Pos. 108-110 | 3 caracteres | Zeros à esquerda | `023` |
| **Nome Arquivo** | Nome arquivo | 7 dígitos | Zeros à esquerda | `0000023` |
| **Histórico** | `REMESSAS.NUMERO_REMESSA` | INTEGER | Número simples | `23` |

---

## ⚠️ Casos Especiais

### Caso 1: Banco sem histórico (cnab400 = NULL ou 0)

```sql
-- Se a coluna cnab400 for NULL ou 0, começar do 1:
UPDATE CONTAS SET cnab400 = 0 WHERE id = ?;

-- Primeira remessa:
novoSequencial = 0 + 1 = 1 → CB10030000001.REM
```

### Caso 2: Migração de dados

Se você estiver migrando remessas antigas:

```sql
-- Contar remessas já geradas
SELECT COUNT(*) FROM REMESSAS WHERE numero_conta_id = ?;
-- Resultado: 23

-- Atualizar CONTAS com o máximo
UPDATE CONTAS SET cnab400 = 23 WHERE id = ?;

-- Próxima remessa será: 24
```

### Caso 3: Resetar sequencial (cuidado!)

```sql
-- ⚠️ CUIDADO: Esta operação pode gerar conflitos de arquivo
UPDATE CONTAS SET cnab400 = 0 WHERE id = ?;

-- Use apenas se tiver certeza que nenhum arquivo foi gerado com esse sequencial
```

---

## 📊 Fluxo de Exemplo Prático

Suponha uma conta com histórico:

```
Remessas já geradas:
├─ Remessa 1: CB10030000001.REM (10/03)
├─ Remessa 2: CB15030000002.REM (15/03)
├─ Remessa 3: CB20030000003.REM (20/03)
├─ Remessa 4: CB25030000004.REM (25/03)
└─ Remessa 5: CB01040000005.REM (01/04) ← Última gerada

Estado atual:
CONTAS.cnab400 = 5

Nova geração (10/04/2026):
├─ Buscar cnab400: 5
├─ Calcular: 5 + 1 = 6
├─ Gerar Header: posição 108-110 = "006"
├─ Gerar arquivo: "CB10040000006.REM"
├─ Atualizar CONTAS.cnab400 = 6
└─ Retornar: numeroRemessa = 6

Próxima geração:
└─ Usará cnab400 = 6 (base para calcular 7)
```

---

## 🔍 Validações

```typescript
// Validar se o número é válido
function validarSequencial(sequencial: number): boolean {
  // Deve ser positivo
  if (sequencial <= 0) return false;

  // Deve ser inteiro
  if (!Number.isInteger(sequencial)) return false;

  // Não deve exceder 9999999 (7 dígitos)
  if (sequencial > 9999999) return false;

  return true;
}

// Exemplos:
validarSequencial(0);        // false
validarSequencial(1);        // true
validarSequencial(23);       // true
validarSequencial(9999999);  // true
validarSequencial(10000000); // false
validarSequencial(-5);       // false
validarSequencial(1.5);      // false
```

---

## 📌 Resumo Final

| Pergunta | Resposta |
|----------|----------|
| **Onde é armazenado?** | Tabela `CONTAS`, campo `cnab400` |
| **Como é coletado?** | Leitura do campo `CONTAS.cnab400` |
| **Como é calculado?** | `novo = atual + 1` |
| **Como aparece no arquivo?** | Header posição 108-110 (3 dígitos) |
| **Como aparece no nome?** | Padrão `CBDDMMSSSSSSS.REM` (7 dígitos) |
| **Como é armazenado após uso?** | `UPDATE CONTAS SET cnab400 = novo` |
| **Limite máximo?** | 9.999.999 (7 dígitos) |
| **Incrementa por quê?** | Para garantir unicidade de remessas |

---

**Atualizado:** 20/05/2026  
**Baseado em:** ESPECIFICACAO_COMPLETA_CNAB400_BMP.md
