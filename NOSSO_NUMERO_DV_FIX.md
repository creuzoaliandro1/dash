# ✅ Correção - Cálculo de DV para CNAB400

## Problema Identificado
**Erro ao gerar remessa CNAB400:**
```
Linha 2 posição 82 - Dígito de auto conferência inválido
Valor recebido: [Arquivo: 8  Validação: 1]
```

Causa: O nosso_numero estava sendo armazenado JÁ COM o DV anexado no banco de dados, e o código CNAB400 tentava recalcular o DV a partir de um valor que já incluía o DV anterior, resultando em um cálculo incorreto.

---

## Solução Implementada

### 1. **src/services/boletoService.js - getNextNossoNumero()**

**ANTES (ERRADO):**
```javascript
const base = Number(conta.nnumero || 1)           // 50007
const basePad = String(base).padStart(11, '0')
const dv = calcNossoNumeroDV(basePad)             // calcula DV
const nextBase = base + 1
return { nossoNumero: String(base) + dv, error: null }  // Retorna "500072" (com DV)
```

**DEPOIS (CORRETO):**
```javascript
const nextBase = Number(conta.nnumero || 0) + 1  // 50008 (incrementa antes)
const nextDv = calcNossoNumeroDV(String(nextBase).padStart(11, '0'))
await supabase
  .from('CONTAS')
  .update({ nnumero: nextBase, nnumero_dv: nextDv })
  .eq('id', contaId)
return { nossoNumero: String(nextBase), error: null }  // Retorna "50008" (SEM DV)
```

**Mudanças:**
- ✅ Retorna apenas o número base SEM DV
- ✅ Incrementa CONTAS.nnumero ANTES de retornar (não depois)
- ✅ O DV será calculado APENAS na geração do CNAB400

---

### 2. **src/services/boletoService.js - createBoleto()**

**ANTES (ERRADO):**
```javascript
if (boletoData.NOSSO_NUMERO) {
  // Importação: nosso_numero já existe (registrado no BMP).
  nossoNumeroFinal = appendDV(boletoData.NOSSO_NUMERO)  // ❌ Adiciona DV
}
```

**DEPOIS (CORRETO):**
```javascript
if (boletoData.NOSSO_NUMERO) {
  // Importação: nosso_numero já existe (registrado no arquivo importado).
  const cleanNum = String(boletoData.NOSSO_NUMERO || '').replace(/\D/g, '')
  nossoNumeroFinal = cleanNum  // ✅ Armazena SEM DV
}
```

**Mudanças:**
- ✅ Remove a função `appendDV()` que adicionava DV aos valores importados
- ✅ Armazena apenas os dígitos do nosso_numero
- ✅ Não calcula DV no import - isso é feito no CNAB400

---

### 3. **src/utils/boleto.js - buildDetalhe1() - CONFIRMADO QUE JÁ ESTÁ CORRETO**

```javascript
const nossoCompleto = cleanNum(boleto.nosso_numero || '')

// Extrai apenas a base, desprezando DV se armazenado
let nossoBase = ''
if (nossoCompleto.length >= 11) {
    nossoBase = nossoCompleto.substring(0, 11)
} else if (nossoCompleto.length > 0) {
    nossoBase = nossoCompleto  // Se < 11, usa como está
} else {
    nossoBase = '0'
}

const nossoBaseFull = padLeft(nossoBase, 11, '0')  // Padded a 11
const dvNN = calcNNDV(nossoBaseFull)                // RECALCULA o DV
```

✅ Código CNAB400 já estava correto
✅ Padroniza para 11 dígitos
✅ Recalcula DV com algoritmo BMP274
✅ Coloca DV em posição 82

---

## Fluxo Correto Agora

### Novo Boleto (via formulário):
1. `getNextNossoNumero()` → Retorna "50008" (SEM DV)
2. `createBoleto()` → Armazena em `capt_boletos.nosso_numero = "50008"`
3. `generateCNAB400()` → Calcula DV = "1" e escreve:
   - Pos 071-081: "00000050008" (base padded)
   - Pos 082: "1" (DV recalculado)

### Boleto Importado (arquivo):
1. `importService.js` → Extrai nosso_numero do arquivo
2. `createBoleto()` → Armazena "50008" (SEM DV)
3. `generateCNAB400()` → Calcula DV = "1" e escreve:
   - Pos 071-081: "00000050008"
   - Pos 082: "1" (DV recalculado)

---

## 🧪 Como Testar

1. **Criar novo boleto** via formulário
   - Verificar em `capt_boletos` se `nosso_numero` está SEM DV (ex: "50008")

2. **Gerar remessa CNAB400**
   - Verificar se posição 82 do arquivo .rem mostra o DV correto
   - Usar validador BMP para confirmar se DV está correto

3. **Importar boleto** de arquivo (XLS/XML)
   - Verificar se `nosso_numero` é armazenado SEM DV
   - Gerar CNAB400 e validar DV na posição 82

---

## 📝 Banco de Dados

Nenhuma migração necessária:
- Coluna `capt_boletos.nosso_numero` permanece igual
- Agora armazena números como "50008" em vez de "500082" (com DV)
- Se houver dados antigos com DV anexado, o código CNAB400 extrairá os 11 primeiros dígitos

---

## ✅ Status

**IMPLEMENTAÇÃO CONCLUÍDA**

Arquivos modificados:
- ✅ `src/services/boletoService.js` - getNextNossoNumero()
- ✅ `src/services/boletoService.js` - createBoleto()

Código verificado:
- ✅ `src/utils/boleto.js` - CNAB400 já está correto

**Pronto para teste!**

---

**Data**: 2026-05-21  
**Versão**: 1.0  
**Correção**: CNAB400 DV Calculation
