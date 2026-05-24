# 📋 Campos Necessários para Importação de Boletos

## 🎯 Resumo Executivo

Para importar um arquivo com sucesso, **apenas 2 campos são obrigatórios**:
- ✅ **SACADO_NOME** (Nome do cliente/pagador)
- ✅ **VALOR** (Valor do boleto > 0)

**NUM_TITULO** é recomendado mas pode ser vazio em alguns casos.

---

## 📊 Tabela Completa de Campos

### ✅ Campos OBRIGATÓRIOS

| Campo | Descrição | Formato | Exemplo | Validação |
|-------|-----------|---------|---------|-----------|
| **SACADO_NOME** | Nome do cliente/pagador | Texto | João Silva | Não pode ser vazio |
| **VALOR** | Valor do boleto | Numérico | 1000,00 ou 1000.00 | Deve ser > 0 |

### ⚠️ Campos RECOMENDADOS

| Campo | Descrição | Formato | Exemplo | Padrão se vazio |
|-------|-----------|---------|---------|-----------------|
| **NUM_TITULO** | Número do documento | Texto | DOC-001 | (vazio) |
| **VENCIMENTO** | Data de vencimento | DD/MM/YYYY | 15/07/2026 | +30 dias de hoje |
| **EMISSAO** | Data de emissão | DD/MM/YYYY | 01/05/2026 | Data de hoje |

### 📝 Campos OPCIONAIS

| Campo | Descrição | Formato | Exemplo |
|-------|-----------|---------|---------|
| **NOSSO_NUMERO** | Identificador do banco | Texto | 001234567 |
| **CODIGO_BARRAS** | Linha digitável do boleto | Texto | 12345.67890 12345.678901 234567.890123 |
| **SACADO_CIC** | CPF ou CNPJ do cliente | Texto | 12.345.678/0001-90 |
| **SACADO_ENDERECO** | Endereço do cliente | Texto | Rua Teste 123 |
| **SACADO_NUMERO** | Número do endereço | Texto | 123 |
| **SACADO_BAIRRO** | Bairro | Texto | Centro |
| **SACADO_CIDADE** | Cidade | Texto | São Paulo |
| **SACADO_UF** | Estado (2 caracteres) | Texto | SP |
| **SACADO_CEP** | CEP | Texto | 12345-678 |
| **SACADO_TELEFONE** | Telefone do cliente | Texto | (11) 99999-9999 |
| **SACADO_EMAIL** | Email do cliente | Texto | cliente@email.com |
| **AVALISTA_NOME** | Nome do avalista | Texto | Empresa XYZ |
| **AVALISTA_CIC** | CPF/CNPJ do avalista | Texto | 98.765.432/0001-10 |
| **VALOR_PAGAMENTO** | Valor pago (se já pago) | Numérico | 1000,00 |
| **DATA_PAGAMENTO** | Data do pagamento | DD/MM/YYYY | 10/07/2026 |
| **STATUS** | Status do boleto | Texto | pendente, pago, atrasado, cancelado |
| **DESCRICAO** | Descrição/observação | Texto | Serviço de transporte |

---

## 🔄 Alternativas de Nomes de Colunas

O sistema **detecta automaticamente** variações de nomes (case-insensitive):

### Documento
- "Seu número"
- "Número do documento"
- "Documento"
- "Num_Titulo"
- "NUM_TITULO"

### Data Emissão
- "Data de emissão"
- "Emissão"
- "Dt Emissão"
- "emissao"
- "EMISSAO"

### Data Vencimento
- "Data de vencimento"
- "Vencimento"
- "Dt Vencimento"
- "vencimento"
- "VENCIMENTO"

### Cliente/Pagador
- "Nome do pagador"
- "Cliente"
- "Nome Sacado"
- "Sacado"
- "SACADO_NOME"

### Documento Federal
- "Documento federal do pagador"
- "CPF"
- "CNPJ"
- "Documento"
- "SACADO_CIC"

### Valor
- "Valor do título"
- "Valor"
- "Valor Boleto"
- "valor"
- "VALOR"

### Status
- "Status do boleto"
- "Status"
- "Situação"
- "STATUS"

---

## 📐 Formatos Aceitos

### Valores Numéricos (VALOR, VALOR_PAGAMENTO)

Sistema **converte automaticamente**:

| Entrada | Saída | Tipo |
|---------|-------|------|
| `1000,00` | 1000.00 | Brasileiro |
| `1.000,00` | 1000.00 | Brasileiro com separador |
| `1000.00` | 1000.00 | Americano |
| `1,000.00` | 1000.00 | Americano com separador |
| `1000` | 1000.00 | Inteiro |

✅ Válidos: Qualquer combinação de vírgula/ponto, desde que resultado > 0

### Datas (EMISSAO, VENCIMENTO, DATA_PAGAMENTO)

Sistema **aceita múltiplos formatos**:

| Formato | Exemplo | Tipo |
|---------|---------|------|
| DD/MM/YYYY | 15/07/2026 | ✅ Preferido |
| YYYY-MM-DD | 2026-07-15 | ✅ ISO |
| Excel Serial | 45956 | ✅ Número Excel |
| DD-MM-YYYY | 15-07-2026 | ✅ Com hífen |
| DDMMYYYY | 15072026 | ❌ Não suportado |

✅ Saída: Sempre DD/MM/YYYY

### Documento (CPF/CNPJ - SACADO_CIC, AVALISTA_CIC)

Sistema **remove caracteres não numéricos**:

| Entrada | Saída |
|---------|-------|
| 12.345.678/0001-90 | 12345678000190 |
| 12345678000190 | 12345678000190 |
| 123.456.789-00 | 12345678900 |
| 12345678900 | 12345678900 |

✅ Saída: Apenas dígitos

### CEP (SACADO_CEP)

Sistema **remove caracteres não numéricos**:

| Entrada | Saída |
|---------|-------|
| 12345-678 | 12345678 |
| 12345678 | 12345678 |
| 12.345-678 | 12345678 |

✅ Saída: Apenas dígitos

### UF (SACADO_UF)

Sistema **pega apenas 2 primeiros caracteres**:

| Entrada | Saída |
|---------|-------|
| SP | SP |
| São Paulo | SÃ |
| sãO pAULO | SÃ |
| SP (BRASIL) | SP |

✅ Saída: 2 caracteres, maiúscula

---

## 🔍 Status Válidos

Sistema **mapeia automaticamente**:

| Entrada | Mapeado para |
|---------|--------------|
| Pago | `pago` |
| PAGO | `pago` |
| Vencer | `pendente` |
| Pendente | `pendente` |
| Atraso | `atrasado` |
| Atrasado | `atrasado` |
| Cancel | `cancelado` |
| Cancelado | `cancelado` |
| (vazio) | `pendente` (padrão) |

---

## 📁 Formatos de Arquivo Suportados

### 1. Excel (.xlsx, .xls)

**Requisitos:**
- ✅ Primeira linha = cabeçalhos
- ✅ Dados a partir da linha 2
- ✅ Colunas em qualquer ordem
- ✅ Nomes de coluna case-insensitive

**Exemplo:**
```
| Seu número | Nome do pagador | Valor do título | Data de vencimento |
|------------|-----------------|-----------------|-------------------|
| DOC-001    | João Silva      | 1000,00         | 15/07/2026        |
| DOC-002    | Maria Santos    | 500,50          | 20/08/2026        |
```

### 2. CSV (.csv)

**Requisitos:**
- ✅ Delimitador: Vírgula (,)
- ✅ Primeira linha = cabeçalhos
- ✅ Codificação: UTF-8

**Exemplo:**
```csv
NUM_TITULO,SACADO_NOME,VALOR,VENCIMENTO
DOC-001,João Silva,1000.00,2026-07-15
DOC-002,Maria Santos,500.50,2026-08-20
```

### 3. TXT (.txt)

**Requisitos:**
- ✅ Delimitador: Pipe (|)
- ✅ Primeira linha = cabeçalhos
- ✅ Linhas subsequentes = dados

**Exemplo:**
```
NUM_TITULO|SACADO_NOME|EMISSAO|VENCIMENTO|VALOR|STATUS
DOC-001|João Silva|01/05/2026|15/07/2026|1000.00|pendente
DOC-002|Maria Santos|02/05/2026|20/08/2026|500.50|pendente
```

### 4. OS Type A (.xls)

**Requisitos:**
- ✅ Nomeação: `OS_*.xls`
- ✅ Contém "Saldo A Receber" em coluna AJ
- ✅ Contém "Data" em coluna X (para múltiplos vencimentos)

**Mapeamento automático:**
- D13 → NUM_TITULO
- K16 → SACADO_NOME
- F17 → SACADO_CIC
- F19 → SACADO_ENDERECO
- F20 → SACADO_BAIRRO
- AJ19 → SACADO_CIDADE
- Coluna AJ → encontra linha SALDO → Coluna AU → VALOR
- Coluna X → extrai VENCIMENTOS

### 5. OS Type B (.xls)

**Requisitos:**
- ✅ Nomeação: `OS_*.xls`
- ✅ Contém "Ordem de Serviço" em L8
- ✅ Contém "Código:" em L13
- ✅ Contém "Cliente:" em L16

**Mapeamento automático (flexível):**
- L13 "Código:" → NUM_TITULO
- L14 "Placa/Equip:" → DESCRICAO
- L16 "Cliente:" → SACADO_NOME (procura em colunas variadas)
- L17 "Cnpj/Cpf:" → SACADO_CIC
- L19 "Endereço:" → SACADO_ENDERECO
- L20 "Bairro:" → SACADO_BAIRRO
- L41+ "BOLETO" → extrai vencimentos e valores (procura em toda linha)

### 6. XML (NFe, NFSe, CTe, MDFe)

**Requisitos:**
- ✅ Tags específicas para cada tipo
- ✅ Extração automática de dados relevantes

**NFe:**
```xml
<nNF>123456</nNF> → NUM_TITULO
<nomeRecebedor>Cliente</nomeRecebedor> → SACADO_NOME
<vNF>1000.00</vNF> → VALOR
```

**NFSe:**
```xml
<Numero>123456</Numero> → NUM_TITULO
<RazaoSocial>Cliente</RazaoSocial> → SACADO_NOME
<ValorServicos>1000.00</ValorServicos> → VALOR
```

---

## ✅ Validações

Sistema **valida automaticamente**:

| Validação | Condição | Ação se falhar |
|-----------|----------|----------------|
| SACADO_NOME não vazio | `length > 0` | ❌ Boleto rejeitado |
| VALOR > 0 | `valor > 0` | ❌ Boleto rejeitado |
| Formato de data | DD/MM/YYYY ou variações | ⚠️ Usa data atual como padrão |
| Formato de valor | Numérico com , ou . | ⚠️ Tenta converter |
| CPF/CNPJ formato | 11 ou 14 dígitos | ⚠️ Aceita mesmo assim |
| UF válido | 2 caracteres | ⚠️ Aceita qualquer valor |

---

## 🚀 Checklist Antes de Importar

- [ ] Arquivo tem extensão suportada (.xlsx, .xls, .csv, .txt, .xml)?
- [ ] Primeira linha contém cabeçalhos?
- [ ] Existe coluna "Nome do pagador" ou similar?
- [ ] Existe coluna "Valor" com valores > 0?
- [ ] Datas estão em DD/MM/YYYY ou formato Excel?
- [ ] Valores usam vírgula (1.000,00) ou ponto (1000.00)?
- [ ] Para CSV/TXT: delimitador correto (vírgula ou pipe)?
- [ ] Para OS: nomeação correta (OS_*.xls) e estrutura detectável?
- [ ] Sem caracteres especiais que quebrem delimitador?
- [ ] Arquivo não está corrompido ou com encoding estranho?

---

## 📝 Templates Prontos para Usar

### Template Excel

```
| Seu número | Nome do pagador | Documento federal do pagador | Data de emissão | Data de vencimento | Valor do título | Nosso número | Logradouro do pagador | Bairro do pagador | CEP do pagador | Cidade do pagador | UF do pagador | Telefone do pagador | Email do pagador | Status do boleto | Descrição |
|------------|-----------------|------------------------------|-----------------|-------------------|-----------------|--------------|----------------------|-------------------|----------------|-------------------|---------------|---------------------|-----------------|-----------------|----------
| DOC-001    | Cliente Teste   | 12.345.678/0001-90          | 01/05/2026      | 15/07/2026        | 1.000,00        | 001234567    | Rua Teste 123        | Centro            | 12345-678      | São Paulo         | SP            | (11) 99999-9999     | teste@email.com | Pendente        | Serviço de transporte |
```

### Template CSV

```csv
NUM_TITULO,SACADO_NOME,SACADO_CIC,EMISSAO,VENCIMENTO,VALOR,NOSSO_NUMERO,SACADO_ENDERECO,SACADO_BAIRRO,SACADO_CEP,SACADO_CIDADE,SACADO_UF,SACADO_TELEFONE,SACADO_EMAIL,STATUS,DESCRICAO
DOC-001,Cliente Teste,12345678000190,01/05/2026,15/07/2026,1000.00,001234567,Rua Teste 123,Centro,12345678,São Paulo,SP,(11)999999999,teste@email.com,pendente,Serviço de transporte
```

### Template TXT

```
NUM_TITULO|SACADO_NOME|SACADO_CIC|EMISSAO|VENCIMENTO|VALOR|NOSSO_NUMERO|SACADO_ENDERECO|SACADO_BAIRRO|SACADO_CEP|SACADO_CIDADE|SACADO_UF|SACADO_TELEFONE|SACADO_EMAIL|STATUS|DESCRICAO
DOC-001|Cliente Teste|12345678000190|01/05/2026|15/07/2026|1000.00|001234567|Rua Teste 123|Centro|12345678|São Paulo|SP|(11)999999999|teste@email.com|pendente|Serviço de transporte
```

---

## ❓ Dúvidas Frequentes

**P: Posso deixar campos vazios?**  
R: Sim! Apenas SACADO_NOME e VALOR são obrigatórios. Outros campos usam padrões quando vazios.

**P: O sistema detecta automaticamente o formato?**  
R: Sim! Baseado na extensão (.xlsx, .csv, .txt) e estrutura do arquivo.

**P: Preciso de TODOS os campos?**  
R: Não. Sistema importa apenas os campos que você tem e usa defaults para o resto.

**P: Posso usar nomes diferentes de coluna?**  
R: Sim! Sistema aceita múltiplas variações (veja tabela acima).

**P: O que acontece com datas inválidas?**  
R: Sistema usa a data atual como padrão.

**P: Preciso limpar o arquivo antes de importar?**  
R: Sistema faz limpeza automática (remove caracteres especiais, converte formatos, etc).

**P: Posso importar arquivos com merged cells?**  
R: Sim! Sistema desmerga automaticamente.

**P: Quantos boletos posso importar por vez?**  
R: Sem limite técnico. Recomenda-se até 1000 por arquivo para performance.

---

## 📞 Problemas na Importação?

### Erro: "Dados obrigatórios faltando"
✅ Verificar: Tem coluna com nome do cliente? Tem coluna com valor > 0?

### Erro: "Arquivo inválido"
✅ Verificar: Extensão correta? Primeira linha são cabeçalhos? Sem caracteres estranhos?

### Erro: "Formato não suportado"
✅ Verificar: Extensão é .xlsx, .xls, .csv, .txt ou .xml?

### Dados zerados ou vazios
✅ Verificar: Nomes de coluna corretos? Valores realmente presentes no arquivo?

### OS não reconhecido
✅ Verificar: Nome começa com "OS_"? Estrutura é Type A (Saldo A Receber) ou Type B (Ordem de Serviço)?

---

## 📚 Mais Informações

- [Guia de Campos GUIA_CAMPOS_IMPORTACAO.md](./GUIA_CAMPOS_IMPORTACAO.md)
- [Detecção de Tipo OS README_OS_TYPE_DETECTION.md](./src/services/README_OS_TYPE_DETECTION.md)
- [Desmeragem de Células README_UNMERGE_CELLS.md](./src/services/README_UNMERGE_CELLS.md)
- [Flexibilidade Type B README_OSDTYPE_B_FLEXIVEL.md](./src/services/README_OSDTYPE_B_FLEXIVEL.md)
