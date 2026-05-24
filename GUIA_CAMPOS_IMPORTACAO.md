# 📋 Guia Completo de Campos para Importação de Arquivos

## 📌 Visão Geral

O sistema de importação de boletos suporta múltiplos formatos (Excel, CSV, TXT, XML, OS) com mapeamento automático de colunas.

---

## ✅ Campos Obrigatórios

Para que um boleto seja importado com sucesso, **DEVE TER**:

| Campo | Descrição | Formato |
|-------|-----------|---------|
| **SACADO_NOME** | Nome do cliente/pagador | Texto (não pode ser vazio) |
| **VALOR** | Valor do boleto | Numérico > 0 |
| **NUM_TITULO** | Número do documento (opcional para some casos, mas recomendado) | Texto |

**Validação**: Se faltar `SACADO_NOME` ou `VALOR <= 0`, o boleto será rejeitado.

---

## 📊 Todos os Campos Mapeáveis

### Dados do Documento

| Campo no Sistema | Alternativas de Nome no Arquivo | Tipo | Obrigatório |
|------------------|----------------------------------|------|-------------|
| **NUM_TITULO** | "Seu número"<br>"Número do documento"<br>"Documento"<br>"documento" | Texto | ⚠️ Recomendado |
| **NOSSO_NUMERO** | "Nosso número"<br>"Nosso Número" | Texto | ❌ |
| **CODIGO_BARRAS** | "Linha digitável" | Texto | ❌ |

### Datas

| Campo no Sistema | Alternativas de Nome | Tipo | Obrigatório | Formato Aceito |
|------------------|----------------------|------|-------------|-----------------|
| **EMISSAO** | "Data de emissão"<br>"Emissão"<br>"emissao" | Data | ❌ | DD/MM/YYYY ou Excel Serial |
| **VENCIMENTO** | "Data de vencimento"<br>"Vencimento"<br>"vencimento" | Data | ❌ | DD/MM/YYYY ou Excel Serial |
| **DATA_PAGAMENTO** | "Data de pagamento"<br>"Data Pago" | Data | ❌ | DD/MM/YYYY ou Excel Serial |

### Dados do Pagador/Sacado

| Campo no Sistema | Alternativas de Nome | Tipo | Obrigatório |
|------------------|----------------------|------|-------------|
| **SACADO_NOME** | "Nome do pagador"<br>"Cliente"<br>"cliente"<br>"Nome Sacado" | Texto | ✅ SIM |
| **SACADO_CIC** | "Documento federal do pagador"<br>"CPF"<br>"CNPJ"<br>"Documento" | Texto | ❌ |
| **SACADO_ENDERECO** | "Logradouro do pagador"<br>"Endereço"<br>"Endereco"<br>"Rua" | Texto | ❌ |
| **SACADO_NUMERO** | "Número Endereço"<br>"Número do Imóvel" | Texto | ❌ |
| **SACADO_BAIRRO** | "Bairro do pagador"<br>"Bairro" | Texto | ❌ |
| **SACADO_CIDADE** | "Cidade do pagador"<br>"Município" | Texto | ❌ |
| **SACADO_UF** | "UF do pagador"<br>"Estado"<br>"UF" | Texto (2 chars) | ❌ |
| **SACADO_CEP** | "CEP do pagador"<br>"CEP" | Texto | ❌ |
| **SACADO_TELEFONE** | "Telefone do pagador"<br>"Telefone"<br>"Fone" | Texto | ❌ |
| **SACADO_EMAIL** | "Email do pagador"<br>"Email"<br>"E-mail" | Texto | ❌ |

### Valores

| Campo no Sistema | Alternativas de Nome | Tipo | Obrigatório | Formatos Aceitos |
|------------------|----------------------|------|-------------|------------------|
| **VALOR** | "Valor do título"<br>"Valor"<br>"valor" | Numérico | ✅ SIM | 1000,00 ou 1000.00 |
| **VALOR_PAGAMENTO** | "Valor pago"<br>"Valor Pagamento" | Numérico | ❌ | 1000,00 ou 1000.00 |

### Avalista

| Campo no Sistema | Alternativas de Nome | Tipo | Obrigatório |
|------------------|----------------------|------|-------------|
| **AVALISTA_NOME** | "Beneficiário final (sacador avalista)"<br>"Avalista" | Texto | ❌ |
| **AVALISTA_CIC** | "Documento federal do avalista"<br>"CPF/CNPJ do avalista"<br>"CIC do avalista" | Texto | ❌ |

### Status e Descrição

| Campo no Sistema | Alternativas de Nome | Tipo | Obrigatório | Valores Automáticos |
|------------------|----------------------|------|-------------|---------------------|
| **STATUS** | "Status do boleto"<br>"Status" | Texto | ❌ | • "Pago" → pago<br>• "Vencer" → pendente<br>• "Atraso" → atrasado<br>• "Cancel" → cancelado<br>• Padrão: pendente |
| **DESCRICAO** | "Descrição"<br>"Descricao"<br>"Descrição do Boleto" | Texto | ❌ | - |

---

## 📁 Formato por Tipo de Arquivo

### 1️⃣ EXCEL (.xlsx, .xls)

**Mapeamento**: Automático por nome de coluna (case-insensitive)

```
Coluna A          Coluna B              Coluna C
"Número do documento" | "Nome do pagador" | "Valor do título"
DOC-001           | João Silva        | 1000,00
DOC-002           | Maria Santos      | 500,50
```

**Suporta**: Datas em formato Excel Serial (automaticamente convertidas)

---

### 2️⃣ CSV (.csv)

**Formato**: Primeira linha = cabeçalhos, linhas subsequentes = dados

```csv
NUM_TITULO,SACADO_NOME,VALOR,VENCIMENTO
DOC-001,João Silva,1000.00,2026-07-15
DOC-002,Maria Santos,500.50,2026-08-20
```

**Delimitador**: Vírgula (,)

---

### 3️⃣ TXT (.txt)

**Formato**: Pipe-delimited (|)

```
NUM_TITULO|SACADO_NOME|EMISSAO|VENCIMENTO|VALOR|NOSSO_NUMERO|STATUS
DOC-001|João Silva|01/05/2026|15/07/2026|1000.00|001234567|pendente
DOC-002|Maria Santos|02/05/2026|20/08/2026|500.50|001234568|pendente
```

**Delimitador**: Pipe (|)

---

### 4️⃣ OS - Ordem de Serviço (.xls)

**Mapeamento**: Células específicas + extração dinâmica

```
D13  → NUM_TITULO
K16  → SACADO_NOME
F17  → SACADO_CIC
F19  → SACADO_ENDERECO
F20  → SACADO_BAIRRO
T20  → SACADO_CEP
AJ19 → SACADO_CIDADE
AN11 → EMISSAO
AJ (linhas múltiplas) → SACADO_CIDADE (extrai UF)
X (coluna) → Procura "Data" e extrai VENCIMENTOS (múltiplos)
AU (linha com "Saldo A Receber") → VALOR
```

**Especial**: Detecta múltiplos vencimentos e cria parcelas automaticamente!

---

### 5️⃣ XML (NFe, NFSe, CTe, MDFe)

**Mapeamento**: Extração de tags XML específicas

**NFe:**
```xml
<nNF>123456</nNF> → NUM_TITULO
<nomeRecebedor> → SACADO_NOME
<vNF>1000.00</vNF> → VALOR
```

**NFSe:**
```xml
<Numero>123456</Numero> → NUM_TITULO
<RazaoSocial>Cliente</RazaoSocial> → SACADO_NOME
<ValorServicos>1000.00</ValorServicos> → VALOR
```

---

## 🎯 Exemplo: Arquivo Excel Completo

### Cenário: Importar boletos de fornecedor

```
| Seu número | Nome do pagador | Documento federal | Data de emissão | Data de vencimento | Valor do título | Nosso número | Status do boleto |
|------------|-----------------|-------------------|-----------------|-------------------|-----------------|--------------|-----------------|
| 001        | Empresa ABC     | 12.345.678/0001-90| 01/05/2026      | 15/07/2026        | 5.000,00        | 123456       | Pendente        |
| 002        | Empresa XYZ     | 98.765.432/0001-10| 02/05/2026      | 20/08/2026        | 3.500,50        | 123457       | Pendente        |
```

**Resultado após importação**:
- ✅ 2 boletos válidos
- ✅ Nomes extraídos
- ✅ Valores parseados (converte vírgula para ponto)
- ✅ Datas formatadas
- ✅ Status mapeado

---

## 🔄 Conversão Automática de Valores

O sistema converte automaticamente:

| Formato Entrada | Formato Saída |
|-----------------|---------------|
| `1000,00` | `1000.00` |
| `1.000,00` | `1000.00` |
| `1000.00` | `1000.00` |
| `1,000.00` | `1000.00` |
| `1000` | `1000.00` |

---

## 🔄 Conversão Automática de Datas

O sistema aceita:

| Formato Entrada | Formato Saída |
|-----------------|---------------|
| `01/05/2026` | `01/05/2026` |
| `2026-05-01` | `01/05/2026` |
| Excel Serial (44850) | `01/05/2026` |

---

## ⚠️ Limpeza Automática

O sistema remove automaticamente:

- **Documento/CIC**: Caracteres não numéricos (`12.345.678/0001-90` → `12345678000190`)
- **CEP**: Caracteres não numéricos (`12345-678` → `12345678`)
- **UF**: Pega apenas os 2 primeiros caracteres (`SÃO PAULO` → `SÃ`)

---

## 🚀 Checklist para Criar Novo Arquivo

Antes de importar, verifique:

- [ ] Arquivo tem extensão suportada (.xlsx, .xls, .csv, .txt, .xml)?
- [ ] Primeira linha contém cabeçalhos?
- [ ] Existe coluna com "Nome do pagador" ou similar?
- [ ] Existe coluna com "Valor" > 0?
- [ ] Datas estão em formato DD/MM/YYYY ou Excel?
- [ ] Valores usam vírgula (1.000,00) ou ponto (1000.00)?
- [ ] Sem caracteres especiais que quebrem o delimitador (CSV/TXT)?

---

## 📝 Template Pronto para Usar

### Excel Template

```
Seu número | Nome do pagador | Documento federal do pagador | Data de emissão | Data de vencimento | Valor do título | Nosso número | Logradouro do pagador | Bairro do pagador | CEP do pagador | Cidade do pagador | UF do pagador | Telefone do pagador | Email do pagador | Status do boleto | Descrição
-----------|-----------------|------------------------------|-----------------|-------------------|-----------------|--------------|----------------------|-------------------|----------------|-------------------|---------------|---------------------|-----------------|-----------------|----------
DOC-001    | Cliente Teste   | 12.345.678/0001-90          | 01/05/2026      | 15/07/2026        | 1.000,00        | 001234567    | Rua Teste 123        | Centro            | 12345-678      | São Paulo         | SP            | (11) 99999-9999     | teste@email.com | Pendente        | Serviço de transporte
```

### CSV Template

```csv
NUM_TITULO,SACADO_NOME,SACADO_CIC,EMISSAO,VENCIMENTO,VALOR,NOSSO_NUMERO,SACADO_ENDERECO,SACADO_BAIRRO,SACADO_CEP,SACADO_CIDADE,SACADO_UF,SACADO_TELEFONE,SACADO_EMAIL,STATUS,DESCRICAO
DOC-001,Cliente Teste,12345678000190,01/05/2026,15/07/2026,1000.00,001234567,Rua Teste 123,Centro,12345678,São Paulo,SP,(11)999999999,teste@email.com,pendente,Serviço de transporte
```

---

## ❓ Dúvidas Frequentes

**P: Posso deixar campos vazios?**
R: Sim! Apenas `SACADO_NOME` e `VALOR > 0` são obrigatórios.

**P: O sistema detecta automaticamente o formato?**
R: Sim! Baseado na extensão do arquivo (.xlsx, .csv, .txt, etc)

**P: Preciso de todos os campos?**
R: Não, mapeie apenas os que você tem. O sistema usa defaults quando necessário.

**P: Posso usar nomes diferentes de coluna?**
R: Sim! O sistema aceita múltiplas variações (veja tabela acima).

**P: O que acontece com datas inválidas?**
R: O sistema usa a data atual como padrão se não conseguir parsear.

---

## 📞 Precisa de um Novo Formato?

Se seu arquivo não se encaixa nesses padrões, entre em contato com a equipe!

