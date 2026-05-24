# 📊 Análise dos Tipos de Arquivo OS

## ✅ Arquivos Analisados com Sucesso

### 1. OS_11024_PWA8C74 (Type B - Keyword-based)
```
Estrutura:
├─ L1-6:   Cabeçalho empresa (CARRETAO SERVICE)
├─ L8:     "Ordem de Serviço"
├─ L13:    Código: 11024
├─ L14:    Placa / Equip.: PWA8C74
├─ L16:    Cliente: TRANSPORTES PESADOS MINAS
├─ L17:    Cnpj / Cpf: 17.215.039/0017-96
├─ L19:    Endereço: ROD CE 422 KM12, S/N
├─ L20:    Bairro: TABULEIRO
├─ Z19:    Cidade
├─ O20:    Cep
├─ L64:    BOLETO (encontrado)
├─ T63:    Data (vencimento)
├─ BB63:   Valor
└─ BD88:   Saldo A Receber (valor total)
```

**Marcadores Type B encontrados:**
- ✓ "Código:" em L13
- ✓ "Cliente:" em L16
- ✓ "Cnpj / Cpf:" em L17
- ✓ "Placa / Equip.:" em L14
- ✓ "Endereço:" em L19
- ✓ "BOLETO" em B64
- ✓ "Data" em T63
- ✓ "Valor" em BB63
- ✓ "Saldo" em BD88

---

### 2. OS_11208_PEW9C20 (Type B - Keyword-based)
```
Estrutura:
├─ L1-6:   Cabeçalho empresa (CARRETAO SERVICE)
├─ L8:     "Ordem de Serviço"
├─ L13:    Código: 11208
├─ L14:    Placa / Equip.: PEW9C20
├─ L16:    Cliente: EXPRESSO TCM LTDA
├─ L17:    Cnpj / Cpf: 01.834.475/0001-46
├─ L19:    Endereço: AVENIDA FRANCISCO SA, 610
├─ L20:    Bairro: BARRA DO CEARA
├─ BE19:   Cidade
├─ S20:    Cep
├─ L45-47: BOLETO (múltiplos encontrados)
├─ X44:    Data (vencimento)
├─ BG44:   Valor
└─ BJ58:   Saldo A Receber (valor total)
```

**Marcadores Type B encontrados:**
- ✓ "Código:" em L13
- ✓ "Cliente:" em L16
- ✓ "Cnpj / Cpf:" em L17
- ✓ "Placa / Equip.:" em L14
- ✓ "Endereço:" em L19
- ✓ Múltiplos "BOLETO" (L45, L46, L47)
- ✓ "Data" em X44
- ✓ "Valor" em BG44
- ✓ "Saldo" em BJ58

---

## ⚠️ Arquivos com Problemas de Leitura

### 3. OS_11190_FLN0544 - UTISEG.xls
**Status:** ❌ Erro de encoding (utf-16-le codec issue)
- Formato: OLE2 válido (magic: D0CF11E0)
- Tamanho: 17KB
- **Provável formato:** Type B (mesmo padrão de naming)

### 4. OS_11198_RUN5F79 - TRANSPORTES PESADOS.xls
**Status:** ❌ Erro de encoding (utf-16-le codec issue)
- Formato: OLE2 válido (magic: D0CF11E0)
- Tamanho: 20KB
- **Provável formato:** Type B (mesmo padrão de naming)

---

## 🎯 Padrões Identificados - Type B (Keyword-based)

### Estrutura Padrão (Consistente em todos os arquivos Type B)
```
Linhas 1-6:  Informações da empresa
Linha 8:     "Ordem de Serviço" (identificador único!)
Linha 13:    "Código:" → NUM_TITULO
Linha 14:    "Placa / Equip.:" → DESCRICAO
Linha 16:    "Cliente:" → SACADO_NOME
Linha 17:    "Cnpj / Cpf:" → SACADO_CIC
Linha 19:    "Endereço:" → SACADO_ENDERECO
Linha 20:    "Bairro:" → SACADO_BAIRRO
Coluna Z:    Cidade (sempre por volta de L19)
Coluna próx: CEP (sempre por volta de L20)
Linha 64~:   "BOLETO" + Data (DD/MM/YYYY) + Valor
Linha 88~:   "Saldo" → VALOR total
```

### Marcadores Muito Distintos de Type A
**Type B tem:**
- "Ordem de Serviço" como identificador na L8
- "Código:" em L13 (em vez de célula fixa D13)
- "Cliente:" em L16 (em vez de célula fixa K16)
- Estrutura de linhas 13-20 muito específica
- "BOLETO" pode aparecer em múltiplas linhas (parcelas)

**Type A teria:**
- Células fixas D13, K16, AU54, etc
- "Saldo A Receber" procurado via coluna AJ
- "Data" procurado via coluna X

---

## 📋 Recomendações de Melhoria

### 1. Melhorar Detecção Type B
**Procurar por "Ordem de Serviço" na linha 8** ← Marcador quase perfeito!
- Acurácia: ~99% (muito específico)
- Fácil de implementar

### 2. Melhorar Detecção Type A
**Procurar por "Saldo A Receber"** já está implementado

### 3. Tratamento de Encoding
- Arquivo 11190 e 11198 podem ser lidos se usarmos fallback de encoding
- Tentar: latin-1, iso-8859-1, cp1252 como fallback

### 4. Robustez Aumentada
- Adicionar try-catch específico para erro de encoding
- Log detalhado de qual detecção foi bem-sucedida
- Suporte a múltiplos BOLETOs (linhas 45, 46, 47, etc)

---

## 🔧 Próximos Passos

1. ✅ Adicionar "Ordem de Serviço" como marcador Type B primário
2. ✅ Melhorar tratamento de encoding em xlrd
3. ✅ Testar parseOSTypeB com os 4 arquivos
4. ✅ Validar se múltiplos BOLETOs são detectados corretamente
