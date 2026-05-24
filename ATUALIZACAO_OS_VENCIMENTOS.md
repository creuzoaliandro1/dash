# Atualização: Importação de OS com Múltiplos Vencimentos e Parcelas

## 📋 Resumo das Mudanças

O sistema foi atualizado para detectar e processar automaticamente **Ordens de Serviço (OS)** que possuem múltiplos vencimentos, criando parcelas pré-preenchidas com os valores e datas corretas.

---

## 🔧 Como Funciona Agora

### 1️⃣ Detecção de Vencimentos (Coluna X)

O sistema procura pela palavra **"Data"** na **coluna X** do arquivo Excel:

```
Coluna X
├─ Data (cabeçalho encontrado)
├─ 07/07/2026 (1º vencimento)
├─ 18/08/2026 (2º vencimento)
├─ 28/09/2026 (3º vencimento)
└─ (célula vazia = fim da busca)
```

### 2️⃣ Cálculo de Parcelas

- **Número de parcelas** = quantidade de datas encontradas
- **Valor por parcela** = Valor total ÷ Número de parcelas

**Exemplo:**
- Valor total: R$ 3.000,00
- Vencimentos encontrados: 3 (07/07, 18/08, 28/09)
- Valor por parcela: R$ 1.000,00

### 3️⃣ Exibição no Formulário

Quando importado, o arquivo mostrará as parcelas já preenchidas:

| Parcela | Data Vencimento | Valor     |
|---------|-----------------|-----------|
| 1 de 3  | 07/07/2026      | 1.000,00  |
| 2 de 3  | 18/08/2026      | 1.000,00  |
| 3 de 3  | 28/09/2026      | 1.000,00  |

---

## 📝 Mudanças Técnicas

### Arquivo: `importService.js` - Função `parseOSFile()`

#### Nova lógica adicionada:

```javascript
// Procurar coluna X com "Data"
// ↓
// Extrair vencimentos abaixo
// ↓
// Criar array de parcelas com:
//   - Número: NUM_TITULO-1, NUM_TITULO-2, etc
//   - Vencimento: data extraída
//   - Valor: valor_total / quantidade_vencimentos
// ↓
// Adicionar ao objeto boleto como _parcelas
```

#### Novos campos no objeto boleto:
- `_parcelas`: Array com as parcelas pré-preenchidas
- `_totalParcelas`: Número total de parcelas

### Arquivo: `ImportPreview.jsx`

#### Modificação no `useState` inicial:

O componente agora detecta se há `_parcelas` e já carrega o array `_records` com as parcelas pré-preenchidas ao invés de uma única linha.

---

## ✅ Exemplo de Uso

**Arquivo OS_11208.xls:**

```
Célula D13: 11208                  (NUM_TITULO)
Célula K16: Transportadora LTDA   (SACADO_NOME)
Célula AU54: 3000,00               (VALOR total)

Coluna X:
├─ Linha 30: "Data"
├─ Linha 31: 07/07/2026
├─ Linha 32: 18/08/2026
├─ Linha 33: 28/09/2026
└─ Linha 34: (vazio)
```

**Resultado após importação:**

O sistema automaticamente criará 3 registros com:
- `11208-1` | 07/07/2026 | R$ 1.000,00
- `11208-2` | 18/08/2026 | R$ 1.000,00
- `11208-3` | 28/09/2026 | R$ 1.000,00

---

## 🐛 Comportamentos de Erro

### Cenário 1: Coluna X sem "Data"
→ Sistema retorna 1 boleto com vencimento padrão (30 dias)

### Cenário 2: Coluna X com "Data" mas sem vencimentos abaixo
→ Sistema retorna 1 boleto com vencimento padrão

### Cenário 3: Coluna X com datas inválidas
→ Sistema para na primeira data inválida e retorna as parcelas encontradas até então

---

## 📊 Validações

O sistema valida:
- ✅ Formato de data (DD/MM/YYYY)
- ✅ Valor total > 0
- ✅ Número de documento não vazio
- ✅ Nome do sacado não vazio

Se qualquer validação falhar, o arquivo é rejeitado com mensagem de erro clara.

---

## 🔍 Debug/Logs

O console mostrará logs como:

```
[OS] Processando arquivo OS_11208.xls
[OS] "Saldo A Receber" encontrado na linha 54, coluna AJ
[OS] Valor obtido da célula AU54: 3000
[OS] "Data" encontrado na coluna X, linha 30
[OS] Vencimento encontrado em X31: 07/07/2026
[OS] Vencimento encontrado em X32: 18/08/2026
[OS] Vencimento encontrado em X33: 28/09/2026
[OS] X34 não é uma data válida, parando busca
[OS] Total de vencimentos encontrados: 3
[OS] Boleto com 3 parcelas criado
```

---

## ⚠️ Limitações Atuais

1. A busca por vencimentos se limita a 70 linhas abaixo do "Data" (linhas 1-100)
2. Interrompe na primeira célula vazia da coluna X
3. Suporta apenas formato DD/MM/YYYY para datas

Se precisar de ajustes, favor avisar!
