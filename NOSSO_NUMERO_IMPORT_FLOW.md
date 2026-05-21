# ✅ Fluxo Correto - Geração de Nosso Numero na Importação

## 📋 Objetivo

Garantir que **cada boleto importado** (de arquivo XLS, XML, OS) receba um nosso_numero único e sequencial, gerado a partir do contador `CONTAS.nnumero`.

---

## 🔄 Fluxo Anterior (ERRADO)

```
Importar boleto do arquivo
    ↓
ImportPreview.jsx → handleImport()
    ↓
createBoleto(contaId, boletoData)
    ↓
if (boletoData.NOSSO_NUMERO) {
    nossoNumeroFinal = boletoData.NOSSO_NUMERO  // ❌ Reutiliza do arquivo!
}
    ↓
Salva em capt_boletos
    ❌ Múltiplos boletos podem ter MESMO nosso_numero (duplicado)
    ❌ Não garante sequência única
    ❌ Contador CONTAS.nnumero não é atualizado
```

---

## ✅ Fluxo Novo (CORRETO)

```
Usuário clica "Importar" no formulário ImportPreview
    ↓
ImportPreview.jsx → handleImport()
    ↓
Para cada boleto selecionado:
    createBoleto(contaId, boletoData)
    ↓
    getNextNossoNumero(contaId)
        ├─ Busca CONTAS.nnumero (ex: 50007)
        ├─ Calcula nextBase = 50007 + 1 = 50008
        ├─ Atualiza CONTAS.nnumero = 50008
        └─ Retorna "50008" (SEM DV)
    ↓
    Salva em capt_boletos.nosso_numero = "50008"
    ↓
✅ Próximo boleto usará CONTAS.nnumero = 50008
✅ Cada boleto tem nosso_numero ÚNICO e SEQUENCIAL
✅ Não reutiliza valores do arquivo importado
```

---

## 🔧 Mudanças Implementadas

### **src/services/boletoService.js - createBoleto()**

**ANTES (ERRADO):**
```javascript
if (boletoData.NOSSO_NUMERO) {
  // Importação: usa o valor do arquivo importado
  const cleanNum = String(boletoData.NOSSO_NUMERO || '').replace(/\D/g, '')
  nossoNumeroFinal = cleanNum  // ❌ Reutiliza do arquivo
} else {
  // Novo boleto via formulário
  const { nossoNumero: gerado } = await getNextNossoNumero(contaId)
  nossoNumeroFinal = gerado
}
```

**DEPOIS (CORRETO):**
```javascript
// SEMPRE gera novo nosso_numero usando o contador CONTAS.nnumero
// Isso garante que cada boleto (importado ou novo) tenha um número único e sequencial
// Não usa NOSSO_NUMERO do arquivo importado - sempre gera um novo
const { nossoNumero: gerado } = await getNextNossoNumero(contaId)
const nossoNumeroFinal = gerado
```

**Mudanças:**
- ✅ SEMPRE chama `getNextNossoNumero()` independente da origem do boleto
- ✅ Não importa se arquivo tem NOSSO_NUMERO - geramos um novo
- ✅ Cada boleto recebe uma sequência ÚNICA
- ✅ CONTAS.nnumero é atualizado corretamente

---

## 🧪 Como Testar

### **Teste 1: Importar múltiplos boletos do mesmo arquivo**

1. **Situação inicial:**
   - CONTAS.nnumero = 50007
   
2. **Arquivo XLS com 3 boletos**
   - Boleto 1: nosso_numero no arquivo = "123456"
   - Boleto 2: nosso_numero no arquivo = "789012"
   - Boleto 3: sem nosso_numero no arquivo
   
3. **Importar os 3 boletos:**
   - ✅ Boleto 1 → capt_boletos.nosso_numero = "50008"
   - ✅ Boleto 2 → capt_boletos.nosso_numero = "50009"
   - ✅ Boleto 3 → capt_boletos.nosso_numero = "50010"
   
4. **Verificar CONTAS:**
   - ✅ CONTAS.nnumero agora = 50010
   
5. **Próximo boleto gerado:**
   - ✅ Receberá nosso_numero = "50011"

### **Teste 2: Importar arquivo OS**

1. **CONTAS.nnumero = 50010**

2. **Arquivo OS_11115_BDF5A51.xls com 1 boleto:**
   - Campo no arquivo: nosso_numero = "999999"
   
3. **Importar boleto:**
   - ✅ capt_boletos.nosso_numero = "50011" (NÃO 999999!)
   - ✅ CONTAS.nnumero = 50011

### **Teste 3: Importar arquivo XML (NFe/NFSe)**

1. **CONTAS.nnumero = 50011**

2. **Arquivo XML com 2 NFe:**
   - NFe 1: pode ter campo "nossoNumero" ou não
   - NFe 2: pode ter campo "nossoNumero" ou não
   
3. **Importar os 2 boletos:**
   - ✅ Boleto 1 → nosso_numero = "50012"
   - ✅ Boleto 2 → nosso_numero = "50013"
   - ✅ CONTAS.nnumero = 50013

---

## 📊 Dados Salvos no Banco

| Operação | CONTAS.nnumero | capt_boletos.nosso_numero |
|----------|---|---|
| Inicial | 50007 | — |
| Importar boleto 1 (XLS) | 50008 | 50008 |
| Importar boleto 2 (XLS) | 50009 | 50009 |
| Importar boleto 3 (OS) | 50010 | 50010 |
| Criar novo via form | 50011 | 50011 |
| Gerar CNAB400 | — | (nosso_numero + DV calculado) |

---

## 🔍 Verificação no CNAB400

Quando gerar o arquivo de remessa CNAB400:

```
Linha de detalhe (buildDetalhe1):
- Posição 071-081: nosso_numero (11 dígitos padded)
  Exemplo: "00000050008"
- Posição 082: DV calculado dinamicamente
  Exemplo: "1" (calculado via calcNNDV)
```

✅ O DV será calculado CORRETAMENTE porque agora o nosso_numero está armazenado SEM DV

---

## ✨ Benefícios

1. **Unicidade:** Cada boleto tem um número ÚNICO
2. **Sequência:** Números são sequenciais por conta
3. **Independência:** Não depende de valores no arquivo importado
4. **Rastreabilidade:** Fácil saber qual será o próximo número
5. **Compatibilidade:** Funciona com qualquer tipo de importação (XLS, XML, OS)

---

## 🚀 Status

**IMPLEMENTAÇÃO CONCLUÍDA**

Arquivo modificado:
- ✅ `src/services/boletoService.js` - createBoleto()

Comportamento:
- ✅ Importações agora SEMPRE usam getNextNossoNumero()
- ✅ CONTAS.nnumero é atualizado a cada boleto
- ✅ Nosso_numero é armazenado SEM DV
- ✅ DV é calculado APENAS na geração de CNAB400

**Pronto para teste!**

---

**Data**: 2026-05-21  
**Versão**: 2.0  
**Mudança**: SEMPRE gera novo nosso_numero, nunca reutiliza do arquivo
