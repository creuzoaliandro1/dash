# Como gerar os relatórios de Inadimplência, Responsabilidade e Conta Corrente

Especificação das regras usadas pelo Capt para montar estes relatórios, para que
outra API produza exatamente o mesmo resultado.

- **Inadimplência**: títulos com `STATUS = 'IN'`.
- **Responsabilidade**: títulos com `STATUS IN ('DO', 'PR')`.
- **Responsabilidade + Inadimplência**: os dois conjuntos juntos.
- **Conta Corrente**: extrato de lançamentos da tabela `CTACORRENTE` de um cedente.

Implementação de referência no código:

| Arquivo | Conteúdo |
|---|---|
| `src/services/relatorioInadimplenciaService.js` | Filtros, dias de atraso, valor corrigido, totais por cedente |
| `src/utils/relatorioInadimplenciaPdf.js` | PDFs de títulos e de total por cedente |
| `src/services/relatorioContaCorrenteService.js` | Extrato, saldo, históricos |
| `src/utils/relatorioContaCorrentePdf.js` | PDF do extrato |

---

## 1. Convenções gerais

- **Banco**: o Firebird é a fonte da verdade. O Supabase tem uma réplica parcial
  (tabelas `OPEITE`, `SACADO`, `CEDENTE` com poucas colunas). Os campos marcados
  como **(só Firebird)** abaixo não existem na réplica.
- **"Hoje"**: data local do servidor, no formato `YYYY-MM-DD`, sem hora.
- **Datas**: comparadas como texto `YYYY-MM-DD` (equivale a comparar datas).
- **Dinheiro**: some em centavos (inteiros) e divida por 100 no fim, para evitar
  erro de arredondamento. Valores exibidos com 2 casas, formato `1.234,56`.
- **Tipos de título** considerados: `DUP`, `CHE`, `PRO`.
- **Status nunca incluídos**: `DC` e `CO`.

---

## 2. Inadimplência / Responsabilidade

### 2.1 Parâmetros de entrada

| Parâmetro | Tipo | Padrão | Regra |
|---|---|---|---|
| `inadimplencia` | booleano | `true` | Inclui `STATUS = 'IN'` |
| `responsabilidade` | booleano | `false` | Inclui `STATUS IN ('DO','PR')` |
| `tipos` | lista | `['DUP','CHE','PRO']` | `TIPO_TITULO IN (tipos)`. Pelo menos um. |
| `codCedente` | inteiro ou vazio | vazio (= todos) | `COD_CEDENTE = codCedente` |
| `vencimentoIni`, `vencimentoFim` | data | vazio | Sobre o **vencimento efetivo** (ver 2.3), limites inclusivos |
| `valorMin`, `valorMax` | decimal | vazio | `VR_FACE >= valorMin` / `VR_FACE <= valorMax` |
| `emissaoIni`, `emissaoFim` | data | vazio | Sobre `DT_LANCA` (OPEITE não tem data de emissão própria), inclusivos |

Pelo menos um entre `inadimplencia` e `responsabilidade` precisa estar marcado.

**Lista de status** a buscar:

```
status = []
se inadimplencia:    status += ['IN']
se responsabilidade: status += ['DO', 'PR']
```

**Nome do relatório**:

| inadimplencia | responsabilidade | Nome |
|---|---|---|
| sim | não | Inadimplência |
| não | sim | Responsabilidade |
| sim | sim | Responsabilidade + Inadimplência |

Título do PDF: `RELATÓRIO DE <NOME EM MAIÚSCULAS>`; no PDF por cedente, acrescenta ` TOTAL`.

### 2.2 Seleção dos títulos (tabela `OPEITE`)

Campos lidos: `COD_CEDENTE, COD_OPERACAO, NUM_LANCAMENTO, NUM_TITULO, DT_LANCA,
TIPO_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO`.

Chave do título: `COD_CEDENTE ~ COD_OPERACAO ~ NUM_LANCAMENTO`.

SQL de referência (Firebird):

```sql
SELECT o.COD_CEDENTE, o.COD_OPERACAO, o.NUM_LANCAMENTO, o.NUM_TITULO, o.DT_LANCA,
       o.TIPO_TITULO, o.VR_FACE, o.DT_VENCI, o.DT_VENCI_NOVO, o.STATUS, o.COD_SACADO,
       o.TAXA_OCORRE, o.VR_SALDO,                              -- (só Firebird)
       COALESCE(o.DT_VENCI_NOVO, o.DT_VENCI) AS VENCIMENTO,
       s.NOME_CORRENTISTA AS NOME_SACADO, s.CIC AS CIC_SACADO,
       COALESCE(c.RAZAO_SOCIAL, c.NOME_FANTASIA) AS NOME_CEDENTE,
       c.TAXA_OCORRENCIA                                       -- (só Firebird)
FROM OPEITE o
LEFT JOIN SACADO  s ON s.COD_SACADO  = o.COD_SACADO
LEFT JOIN CEDENTE c ON c.COD_CEDENTE = o.COD_CEDENTE
WHERE o.STATUS IN (:status)                 -- nunca DC nem CO
  AND o.TIPO_TITULO IN (:tipos)
  AND (:codCedente   IS NULL OR o.COD_CEDENTE = :codCedente)
  AND (:codBordero   IS NULL OR EXISTS (SELECT 1 FROM OPECABWEB b
         WHERE b.COD_BORDERO  = :codBordero
           AND b.COD_CEDENTE  = o.COD_CEDENTE
           AND b.COD_OPERACAO = o.COD_OPERACAO))
  AND (:valorMin     IS NULL OR o.VR_FACE >= :valorMin)
  AND (:valorMax     IS NULL OR o.VR_FACE <= :valorMax)
  AND (:emissaoIni   IS NULL OR o.DT_LANCA >= :emissaoIni)
  AND (:emissaoFim   IS NULL OR o.DT_LANCA <= :emissaoFim)
  AND (:vencimentoIni IS NULL OR COALESCE(o.DT_VENCI_NOVO, o.DT_VENCI) >= :vencimentoIni)
  AND (:vencimentoFim IS NULL OR COALESCE(o.DT_VENCI_NOVO, o.DT_VENCI) <= :vencimentoFim)
ORDER BY o.COD_CEDENTE, o.COD_OPERACAO, o.NUM_LANCAMENTO
```

Observação: com filtro de vencimento, títulos **sem** vencimento ficam de fora.

Borderô: OPEITE não tem `COD_BORDERO`. O filtro passa por `OPECABWEB`
(`COD_CEDENTE`, `COD_BORDERO` → `COD_OPERACAO`); só entram títulos de borderôs
enviados pela web que já viraram operação.

### 2.3 Campos calculados por título

**Vencimento efetivo**

```
VENCIMENTO = DT_VENCI_NOVO se existir, senão DT_VENCI
PRORROGADO = DT_VENCI_NOVO existe        -- no PDF o vencimento ganha um "*"
```

**Dias de atraso** (dias corridos):

```
DIAS_ATRASO = max(0, hoje - VENCIMENTO)   -- 0 se não houver vencimento
```

**Taxa de atraso** (% ao mês), na ordem:

1. `OPEITE.TAXA_OCORRE` do próprio título, se não for nulo **(só Firebird)**;
2. senão `CEDENTE.TAXA_OCORRENCIA` do cedente, se não for nulo **(só Firebird)**;
3. senão: **sem taxa**.

Um valor `0` explícito conta como taxa definida (resulta em corrigido = base).

**Base da correção**

```
BASE = OPEITE.VR_SALDO se > 0 (só Firebird), senão VR_FACE
```

**Valor corrigido** — juros compostos mensais pro rata die, o mesmo critério do
`VR_JUROS` gravado pelo sistema:

```
se não há taxa:                    CORRIGIDO = nulo   (exibe "—")
senão se DIAS_ATRASO = 0 ou taxa <= 0:  CORRIGIDO = BASE
senão: CORRIGIDO = arredonda2( BASE × (1 + taxa/100) ^ (DIAS_ATRASO / 30) )
```

Exemplo: base 1.198,29, taxa 1% a.m., 276 dias →
1.198,29 × 1,01^(276/30) = 1.313,16 (juros 114,87).

**Regra de Responsabilidade (DO/PR) a vencer** — sobrescreve as regras acima:

```
se STATUS <> 'IN' e DIAS_ATRASO = 0:
    CORRIGIDO = VR_FACE        -- repete o valor
```

DO/PR **já vencidos** são corrigidos exatamente como os `IN`.

**Valor para totais**: `CORRIGIDO` se existir, senão `VR_FACE`.

### 2.4 Totais

- **Total do relatório**: quantidade de títulos, soma de `VR_FACE`, soma do valor para totais.
- **Por cedente** (usado quando o cedente é "todos"): agrupar por `COD_CEDENTE`
  com `qtd`, `total = Σ VR_FACE` e `corrigido = Σ valor para totais`.
  Ordenar por `total` **decrescente**.

### 2.5 Lista de cedentes do filtro

Mostrar só cedentes que têm ao menos um título (`TIPO_TITULO IN ('DUP','CHE','PRO')`)
nos status selecionados:

```sql
SELECT DISTINCT COD_CEDENTE FROM OPEITE
WHERE STATUS IN (:status) AND TIPO_TITULO IN ('DUP','CHE','PRO')
```

### 2.6 Saídas (PDF, A4 retrato)

**Relatório de títulos** — cabeçalho: título, "Emitido em dd/mm/aaaa hh:mm" e linha
de filtros (`Cedente: … · Borderô: … (se filtrado) · Vencimento: … · Valor: … · Emissão: … · Tipos: … · Status: …`, mais `Agrupado por cedente/sacado` quando houver).
Sem rodapé.

**Agrupamento** (rádio na tela: Sem agrupar · Por Cedente · Por Sacado; vale para a
tabela da tela e para este PDF, sem nova busca):
- Por Cedente: grupos por `COD_CEDENTE`; Por Sacado: grupos por `COD_SACADO`.
- Grupos em ordem alfabética do nome (cedente: razão social/fantasia; sacado:
  `NOME_CORRENTISTA`); dentro do grupo, a ordem da tela.
- Cada grupo tem uma linha de cabeçalho (código/nome do cedente, ou nome + CPF/CNPJ do
  sacado) e uma linha `SUBTOTAL (n títulos)` com Valor e Corrigido; no fim, o TOTAL geral.
- Agrupado por cedente, o "Somatório por cedente" do fim do PDF é omitido (repetiria
  os subtotais).

| Coluna | Origem |
|---|---|
| CED. | `COD_CEDENTE` |
| OPER. | `COD_OPERACAO` |
| Nº LANÇ. | `NUM_LANCAMENTO` |
| Nº TÍTULO | `NUM_TITULO` |
| TIPO | `TIPO_TITULO` |
| SACADO | `NOME_SACADO` |
| CPF/CNPJ | `CIC_SACADO` formatado |
| EMISSÃO | `DT_LANCA` |
| VENC. | `VENCIMENTO` (+ `*` se prorrogado) |
| DIAS | `DIAS_ATRASO` |
| VALOR | `VR_FACE` |
| CORRIGIDO | `CORRIGIDO` ou "—" |

Linha final `TOTAL (n títulos)` com soma de VALOR e CORRIGIDO, separada por uma
linha preta acima (sem fundo). Com cedente "todos", segue o bloco
**SOMATÓRIO POR CEDENTE** (CÓD., CEDENTE, QTD, TOTAL, CORRIGIDO) e `TOTAL GERAL`.

**Relatório total por cedente** — mesmo cabeçalho; uma linha por cedente:
CÓD., CEDENTE, QTD TÍTULOS, VALOR, CORRIGIDO; linha `TOTAL (n cedentes)`.

---

## 3. Conta Corrente (extrato do cedente)

### 3.1 Parâmetros

| Parâmetro | Obrigatório | Regra |
|---|---|---|
| `codCedente` | sim | Um cedente (não existe "todos") |
| `dataInicial` | não | Vazio = desde o último saldo zerado (ver 3.4) |

### 3.2 Origem dos dados

Tabela **`CTACORRENTE`** (só Firebird; PK `NUM_OCORRENCIA`). Ler **todos** os
lançamentos do cedente, porque o saldo anterior depende do histórico inteiro.

Campos usados: `NUM_OCORRENCIA, DT_REFERENCIA, TIPO_LANCAMENTO ('C'/'D'), VALOR,
HISTORICO, IDENTIFICADOR, NUM_LANCAMENTO`.

```sql
SELECT NUM_OCORRENCIA, DT_REFERENCIA, TIPO_LANCAMENTO, VALOR,
       HISTORICO, IDENTIFICADOR, NUM_LANCAMENTO
FROM CTACORRENTE
WHERE COD_CEDENTE = :codCedente
ORDER BY DT_REFERENCIA, NUM_OCORRENCIA
```

Pela API REST do Firebird (sem ordenação, máximo 500 linhas): chamar
`GET CTACORRENTE?COD_CEDENTE=<cod>&limit=500&offset=0,500,1000…` até vir menos de
500 linhas, eliminar repetidos por `NUM_OCORRENCIA` e ordenar no código.

**Ordem dos lançamentos**: `DT_REFERENCIA` crescente e, no mesmo dia,
`NUM_OCORRENCIA` crescente. Essa ordem define o saldo acumulado.

### 3.3 Saldo

```
sinal = +1 se TIPO_LANCAMENTO = 'C', senão -1
saldo acumulado = Σ sinal × VALOR   (em centavos)
```

Separar os lançamentos:

- **até hoje**: `DT_REFERENCIA <= hoje` → entram no extrato e no saldo;
- **futuros**: `DT_REFERENCIA > hoje` → listados à parte em "Lançamentos Futuro",
  **não** entram no saldo.

### 3.4 Ponto de início

**Com `dataInicial`:**

```
saldo anterior   = Σ (lançamentos até hoje com DT_REFERENCIA < dataInicial)
data do saldo    = dataInicial - 1 dia
lançamentos      = até hoje com DT_REFERENCIA >= dataInicial
```

**Sem `dataInicial` (padrão) — desde o último saldo zerado:**

```
percorrer os lançamentos até hoje na ordem, acumulando o saldo;
corte = índice do ÚLTIMO lançamento após o qual o saldo acumulado ficou exatamente 0

se existe corte:
    saldo anterior = 0
    data do saldo  = DT_REFERENCIA do lançamento do corte
    lançamentos    = os que vêm DEPOIS do corte
senão (nunca zerou):
    saldo anterior = 0, lançamentos = todos até hoje
```

Se a conta zerou no último lançamento, o extrato fica vazio (só o saldo anterior 0,00).

### 3.5 Histórico exibido

Para cada lançamento, nesta ordem:

1. `HISTORICO` começa com **"Juros de prorrogação"** e há `NUM_LANCAMENTO` →
   `PRORR <TIPO_TITULO> <NUM_TITULO> <VR_FACE> <DT_VENCI dd/mm/aa> <NOME_SACADO>`
2. `HISTORICO` começa com **"Montante de cobertura"** e há `NUM_LANCAMENTO` →
   `COBER <TIPO_TITULO> <NUM_TITULO> <VR_FACE> <DT_VENCI dd/mm/aa> <NOME_SACADO>`
3. `IDENTIFICADOR` preenchido → `<HISTORICO> - <IDENTIFICADOR>`
   (ex.: `LANC.MAN. - PIX EM CONTA REF DUP …`, `Transação Eletrônica - PIX - 001.0001.00001.PJ - volante`)
4. Senão → `HISTORICO` como está.

O título é buscado em `OPEITE` por `COD_CEDENTE + NUM_LANCAMENTO`; o sacado em
`SACADO.NOME_CORRENTISTA` por `COD_SACADO`. Usar `DT_VENCI` (vencimento
**original**, não o prorrogado). Se o título não for encontrado, cai na regra 3/4.

Exemplo: `PRORR DUP 9126-02 2.000,00 30/09/26 ORG MANUNTEÇÃO DE TRATORES`.

### 3.6 Indicador C/D do saldo

```
saldo > 0  → "C"
saldo < 0  → "D"   (exibe o valor absoluto)
saldo = 0  → "D"   (no saldo bloqueado zerado, "C")
```

### 3.7 Saldo bloqueado

`CEDENTE.VR_BLOQUEADO` **(só Firebird)**, exibido como `SALDO BLOQUEADO <valor> <C/D>`.

### 3.8 Saídas

**Tela**: lançamentos do **mais novo para o mais antigo**, com a linha "Saldo
anterior" no fim; informa o saldo atual (saldo após o último lançamento até hoje).

**PDF (A4 retrato)** — em ordem **cronológica**, igual ao extrato do sistema:

```
CAPT PAY
                 Extrato conta-corrente
                 A partir de dd/mm/aaaa
Cedente : <RAZÃO SOCIAL>

Data        Valor  D/C  Histórico                     Saldo  C/D
<data saldo>              Saldo anterior               x,xx  C/D
<lançamentos…>

                                    SALDO BLOQUEADO    x,xx  C
                   Lançamentos Futuro
Data        Valor  D/C  Histórico
<futuros ou "Nenhum lançamento futuro.">

SISTEMA GESTOR DE FACTORING      dd/mm/aaaa hh:mm:ss      Página N
```

### 3.9 Caso de teste (conferido)

Cedente **402 – VOLANTE COMERCIO E SERVICOS AUTOMOTORES LTDA**, data inicial
**01/10/2026**, emitido em 10/11/2026:

- saldo anterior em 30/09/2026: **2.901,00 C**;
- 1º lançamento: `01/10/2026 64,00 D PRORR DUP 9126-02 2.000,00 30/09/26 ORG MANUNTEÇÃO DE TRATORES` → saldo 2.837,00 C;
- 174 lançamentos; saldo final **5.470,29 C**; saldo bloqueado 0,00 C;
- as 171 linhas do extrato emitido pelo sistema conferem uma a uma.

Sem data inicial, o mesmo cedente começa em **06/11/2026** (PIX de 6.717,86 D que
zerou a conta), saldo anterior 0,00, 15 lançamentos até 5.470,29 C.
