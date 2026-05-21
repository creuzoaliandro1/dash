# Análise de Erro CNAB400 - Arquivo CB21050000041.REM

## 📍 Resumo do Erro

**Arquivo:** CB21050000041.REM  
**Erro relatado:** 
- Linha 1 (Header Tipo 0): **Validação 8** - erro na posição 82
- Linha 2 (Detalhe Tipo 1): **Validação 3** - erro na posição 82

**Causa:** Dígito verificador (DV) do nosso número incorreto

---

## 📋 Estrutura do Arquivo

```
Linha 1: HEADER (Tipo 0)
Linha 2: DETALHE 1 (Tipo 1) - Boleto 1
Linha 3: DETALHE 2 (Tipo 2) - Descrição Boleto 1
Linha 4: DETALHE 3 (Tipo 1) - Boleto 2
Linha 5: DETALHE 4 (Tipo 2) - Descrição Boleto 2
Linha 6: TRAILER (Tipo 9)
```

---

## 🔍 Posição 82 - Campo: NOSSO NÚMERO (Base + DV)

Na especificação CNAB400 BMP, a **posição 82** é onde está o **último dígito do nosso número (o DV)**.

### Estrutura do Nosso Número no CNAB400
```
Posições: 76-86 (11 caracteres)
├─ Posições 76-85: Base (10 dígitos do nosso número)
└─ Posição 86: DV (dígito verificador) ← ⚠️ ERRO AQUI
```

⚠️ **Nota:** Conforme a documentação anterior, o nosso número é armazenado com:
- **Base:** 11 dígitos (zero-padded)
- **DV:** 1 dígito (totalizando 12 caracteres)

Mas no CNAB400 BMP, parece estar usando apenas 11 caracteres no total.

---

## 📊 Análise das Linhas com Erro

### Linha 1 (HEADER - Tipo 0)

```
Posição: 1234567890123456789012345678901234567890...808182...
Conteúdo: 01REMESSA01COBRANCA       00000000001112506709CARRETAO...MX0000041...
```

Contando para a posição 82:
```
01REMESSA (9) + 01COBRANCA (9 + 7 espaços) + ... + números + ... = posição 82
```

A posição 82 deveria conter o **DV do nosso número do header**.  
No header, o nosso número é: **00000041**

**Cálculo esperado:**
```
Base: 00000041 (padronizado para 11: 00000000041)
Aplicar BMP274:
  Pesos: [2,3,4,5,6,7,8,9,2,3,4]
  Cálculo: 0×2 + 0×3 + 0×4 + 0×5 + 0×6 + 0×7 + 0×8 + 0×4 + 0×9 + 4×2 + 1×3
  = 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 8 + 3 = 11
  Resto = 11 % 11 = 0
  DV = '0' (resto < 2) ✅

Nosso número completo no CNAB: 000000410 (base 8 dígitos + DV)
Ou com padding 11 dígitos: 00000000410
```

---

### Linha 2 (DETALHE 1 - Tipo 1)

```
Boleto 1 nosso número: 00090000109646308 (extraído do arquivo)
```

Analisando:
```
Posição no registro tipo 1: 
  - Posição 76-86: "00090000109" (11 caracteres)

Separando:
  - Base: 0009000010 (10 dígitos)
  - DV atual: 9
```

**Cálculo esperado para base 0009000010:**
```
Padronizar para 11 dígitos: 00009000010

Aplicar BMP274:
  Dígitos:  0  0  0  0  9  0  0  0  0  1  0
  Pesos:    2  3  4  5  6  7  8  9  2  3  4
  Produtos: 0  0  0  0  54 0  0  0  0  3  0
  
Soma = 57
Resto = 57 % 11 = 2
DV = 11 - 2 = 9 ✅

Resultado: DV = 9 ✔️ CORRETO!
```

---

## ⚠️ Problema Identificado

Há uma **inconsistência na formatação** do nosso número entre:

1. **Armazenamento (CONTAS.nnumero):** 11 dígitos base + 1 DV = 12 caracteres
2. **CNAB400:** Parece estar esperando um formato diferente

### Comparação:

| Campo | Tamanho | Exemplo | Formato |
|-------|---------|---------|---------|
| CONTAS.nnumero | 12 chars | 000000000410 | Base (11) + DV (1) |
| CNAB Header | ? | MX0000041 | ??? |
| CNAB Detalhe | 11 chars | 00090000109 | Parece ser base (10) + DV (1) |

---

## 🔧 Possíveis Causas do Erro

### Causa 1: DV Sendo Gerado com Base Incorreta

O DV está sendo calculado sobre uma base diferente do esperado.

```javascript
// ❌ ERRADO - Se feito assim:
appendDV('50007') // Trata '50007' como base de 5 dígitos

// ✅ CORRETO - Deveria ser:
appendDV('00000050007') // Base de 11 dígitos
```

### Causa 2: DV Sendo Inserido na Posição Errada

O DV pode estar sendo colocado em uma posição que não corresponde à especificação CNAB400.

### Causa 3: Mismatch entre Sistema e Banco

O BMP pode estar esperando um formato específico de nosso número que difere do implementado.

---

## 📌 Recomendações

### 1. Verificar a Posição Exata no CNAB400

Você precisa consultar a **especificação CNAB400 BMP** de seu banco para confirmar:
- Posição exata do nosso número (não é sempre 76-86)
- Tamanho: 11 ou 12 caracteres?
- DV está incluído ou separado?

### 2. Validar o Cálculo do DV

```javascript
// Teste com os números do arquivo:
calcNossoNumeroDV('00000000041')  // Header: dever retornar '0'
calcNossoNumeroDV('00009000010')  // Detalhe: dever retornar '9'
```

### 3. Revisar a Função appendDV()

```javascript
const appendDV = (nossoNumeroBase) => {
  const base = String(nossoNumeroBase || '').replace(/\D/g, '')
  if (!base) return ''
  const basePad = base.padStart(11, '0').slice(0, 11)  // ✅ Certificar que é 11
  const dv = calcNossoNumeroDV(basePad)
  return base + dv  // ⚠️ Verificar se está retornando correto
}
```

### 4. Verificar o Preenchimento no CNAB

Confirmar que o nosso número está sendo inserido corretamente na linha CNAB:
- Campo está na posição correta?
- Tamanho é respeitado?
- Padding (zeros à esquerda) está correto?

---

## 📞 Próximas Etapas

1. **Obter especificação CNAB400 BMP do seu banco**
   - Confirmar posições exatas dos campos
   - Confirmar tamanho e formato do nosso número
   - Conferir se há regras especiais para o DV

2. **Teste com números conhecidos**
   - Gerar um arquivo com um nosso número que você sabe estar correto
   - Submeter ao banco e verificar se passa

3. **Debug do código de geração**
   - Adicionar logs nas funções `appendDV()` e `calcNossoNumeroDV()`
   - Imprimir valores intermediários (base, soma, resto, DV)
   - Verificar se o DV calculado é realmente inserido no arquivo

4. **Contato com o banco**
   - Se confirmar que o cálculo está correto, o erro pode ser em outra validação
   - Solicitar ao banco a especificação exata de validação 8 e validação 3

---

## 📊 Exemplo de Debug Recomendado

```javascript
// Adicionar ao código de geração CNAB:
const baseNumero = '00000000041'
const dvCalculado = calcNossoNumeroDV(baseNumero)
const numeroCompleto = baseNumero + dvCalculado

console.log('[CNAB Debug] Nosso Número:')
console.log(`  Base: ${baseNumero}`)
console.log(`  DV Calculado: ${dvCalculado}`)
console.log(`  Completo: ${numeroCompleto}`)
console.log(`  Tamanho: ${numeroCompleto.length} caracteres`)
console.log(`  Posição 82 conterá: ${numeroCompleto[numeroCompleto.length - 1]}`)
```

---

**Análise realizada:** 21/05/2026  
**Arquivo analisado:** CB21050000041.REM  
**Status:** Requer validação em relação à especificação do banco
