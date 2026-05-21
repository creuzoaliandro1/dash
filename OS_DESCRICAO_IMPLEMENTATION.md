# ✅ Implementação - Descrição para Arquivos OS

## 📝 Objetivo
Ao importar boletos de um arquivo OS (Ordem de Serviço), combinar os campos **G14** (Placa/Equipamento) e **L14** (Descrição do Veículo) para preencher automaticamente o campo `capt_boletos.descricao`.

## 🔧 Mudanças Implementadas

### 1. **src/services/importService.js - processOSExcel()**
- Adicionada extração dos campos G14 e L14 (linhas 573-579)
- Criada lógica de combinação: 
  ```javascript
  const descricao = placa && equipamento ? `${placa} - ${equipamento}`
                  : placa ? placa
                  : equipamento ? equipamento
                  : ''
  ```
- Adicionado campo `DESCRICAO` ao objeto boleto retornado (linha 649)

**Resultado para arquivo exemplo:**
```
G14 = "BDF5A51"
L14 = "M.BENZ M.BENZ/ACTROS 2651S BRANCA (DIESEL 2020 / 2020)"
→ DESCRICAO = "BDF5A51 - M.BENZ M.BENZ/ACTROS 2651S BRANCA (DIESEL 2020 / 2020)"
```

### 2. **src/components/Boletos/ImportPreview.jsx**
- Adicionado campo de entrada `DESCRICAO` na terceira linha da visualização
- Campo é editável inline como os outros campos
- Posicionado entre VALOR e SACADO_NOME
- Suporta edição e visualização com truncagem

### 3. **Suporte Existente**
- ✅ `createBoleto()` em boletoService.js já suporta `descricao` (linha 162)
- ✅ Banco de dados (`capt_boletos`) já tem a coluna `descricao`
- ✅ Query SELECT já inclui `descricao` (linha 48)

## 🧪 Como Testar

1. **Fazer refresh** da página (F5)
2. **Ir para página "Boletos"**
3. **Selecionar arquivo OS** (ex: `OS_11115_BDF5A51.xls`)
4. **Verificar no preview** se:
   - Campo "Descrição" aparece na linha 3
   - Mostra: `"BDF5A51 - M.BENZ M.BENZ/ACTROS 2651S ..."`
5. **Confirmar importação**
6. **Verificar no banco** se `capt_boletos.descricao` foi preenchido corretamente

## 📊 Exemplo de Resultado

| Campo | Valor |
|-------|-------|
| NUM_TITULO | 11115 |
| SACADO_NOME | FORTALLOG |
| **DESCRICAO** | **BDF5A51 - M.BENZ M.BENZ/ACTROS 2651S BRANCA (DIESEL 2020 / 2020)** |
| VALOR | 1.234,56 |
| DATA_EMISSAO | 15/04/2026 |
| DATA_VENCIMENTO | 15/05/2026 |

## 🔍 Verificação de Campos

Os campos extraídos do arquivo OS agora são:
- ✅ D13 → NUM_TITULO
- ✅ AN11 → DATA_EMISSAO
- ✅ K16 → SACADO_NOME
- ✅ F17 → SACADO_CIC
- ✅ F19 → SACADO_ENDERECO
- ✅ F20 → SACADO_BAIRRO
- ✅ T20 → SACADO_CEP
- ✅ AJ19 → SACADO_CIDADE
- ✅ AU54 → VALOR
- ✅ **G14 → DESCRICAO (PLACA)**
- ✅ **L14 → DESCRICAO (EQUIPAMENTO)**

## ✨ Benefícios

1. **Automático**: Não precisa digitar a descrição manualmente
2. **Completo**: Combina placa + descrição do equipamento
3. **Editável**: Usuário pode editar a descrição no preview se necessário
4. **Persistente**: Salvo no banco de dados junto com o boleto

## 🚀 Status

**PRONTO PARA TESTE** ✅

Todas as mudanças foram implementadas e integradas com sucesso.

---

**Data**: 2026-05-21  
**Arquivos Modificados**: 2  
**Funcionalidade**: Importação de Arquivos OS com Descrição Automática
