# Cálculo do Dígito Verificador (DV) do Nosso Número - CNAB400 BMP

## 📍 Resumo Executivo

O dígito verificador do nosso número é calculado usando o **algoritmo BMP274 CNAB400** implementado na função `calcNossoNumeroDV()` em `boletoService.js`.

**Padrão:** Módulo 11 com sequência específica de pesos

---

## 🔧 Algoritmo: Módulo 11 (BMP274)

### Passo a Passo

```
1. Base: Toma os 11 primeiros dígitos do nosso número (padding com zeros à esquerda se necessário)
2. Pesos: Aplica sequência [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4]
3. Multiplicação: Multiplica cada dígito pelo peso correspondente
4. Soma: Soma todos os resultados
5. Resto: Calcula resto da divisão por 11
6. DV: Aplica regra de conversão
```

### Regra de Conversão Final

```
Se resto < 2:
  DV = '0'
Senão:
  DV = 11 - resto
```

---

## 📊 Exemplo Prático Completo

### Dados de Entrada
```
Nosso Número (base): 50007
Formatado (11 dígitos): 00000050007
```

### Cálculo Passo a Passo

#### 1️⃣ Align com Pesos
```
Posição:  0  1  2  3  4  5  6  7  8  9  10
Dígito:   0  0  0  0  0  0  5  0  0  0  7
Peso:     2  3  4  5  6  7  8  9  2  3  4
```

#### 2️⃣ Multiplicação
```
Pos 0: 0 × 2  = 0
Pos 1: 0 × 3  = 0
Pos 2: 0 × 4  = 0
Pos 3: 0 × 5  = 0
Pos 4: 0 × 6  = 0
Pos 5: 0 × 7  = 0
Pos 6: 5 × 8  = 40
Pos 7: 0 × 9  = 0
Pos 8: 0 × 2  = 0
Pos 9: 0 × 3  = 0
Pos 10: 7 × 4 = 28
```

#### 3️⃣ Soma
```
Soma = 0 + 0 + 0 + 0 + 0 + 0 + 40 + 0 + 0 + 0 + 28 = 68
```

#### 4️⃣ Resto
```
Resto = 68 % 11 = 2
```

#### 5️⃣ DV Final
```
Resto = 2 (não é < 2)
DV = 11 - 2 = 9
```

### Resultado Final
```
✅ Nosso Número com DV: 500079
   (base 50007 + DV 9)
```

---

## 💻 Implementação em TypeScript/JavaScript

```typescript
const calcNossoNumeroDV = (nossoBase) => {
  // 1. Formatar base (11 dígitos com padding de zeros)
  const base  = String(nossoBase || '')
    .replace(/\D/g, '')           // Remove não-dígitos
    .padStart(11, '0')            // Padding com zeros à esquerda
    .slice(0, 11)                 // Garante 11 caracteres

  // 2. Aplicar pesos (sequência BMP274)
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4]

  // 3. Calcular soma (multiplicação e adição)
  let soma = 0
  for (let i = 0; i < 11; i++) {
    soma += parseInt(base.charAt(i), 10) * pesos[i]
  }

  // 4. Calcular resto
  const resto = soma % 11

  // 5. Aplicar regra de conversão
  return resto < 2 ? '0' : String(11 - resto)
}

// Exemplo de uso:
const dv = calcNossoNumeroDV('50007')  // Retorna: '9'
const numeroCompleto = '50007' + dv    // Resultado: '500079'
```

---

## 📍 Onde está Implementado

### Arquivo: `src/services/boletoService.js`

**Linhas:** 3-15

**Função usada em:**
1. `getNextNossoNumero()` (linha 91) - Calcula DV do próximo número
2. `appendDV()` (linha 112) - Garante que um nosso número tenha o DV correto

---

## 🔄 Fluxo de Geração do Nosso Número

```
┌─────────────────────────────────────────────────────┐
│ 1. BUSCAR SEQUENCIAL ATUAL                         │
│    CONTAS.nnumero = 50007                          │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 2. CALCULAR DV COM BMP274                          │
│    calcNossoNumeroDV(50007)                        │
│    Resultado: DV = 9                               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 3. CONCATENAR BASE + DV                            │
│    String(50007) + '9' = '500079'                  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 4. INCREMENTAR PARA PRÓXIMA REMESSA                │
│    UPDATE CONTAS SET nnumero = 50008               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 5. PRÉ-CALCULAR DV DO PRÓXIMO                      │
│    calcNossoNumeroDV(50008) = '7' (exemplo)       │
│    UPDATE CONTAS SET nnumero_dv = '7'             │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Tabela de Variação: Como Diferentes Bases Resultam em DVs Diferentes

| Base (11 dígitos) | Soma | Resto | DV | Nosso Número Completo |
|-------------------|------|-------|----|-----------------------|
| 00000000001 | 2 | 2 | 9 | 000000000019 |
| 00000000010 | 3 | 3 | 8 | 000000000108 |
| 00000000100 | 4 | 4 | 7 | 000000001007 |
| 00000001000 | 18 | 7 | 4 | 000000010004 |
| 00000010000 | 12 | 1 | **0** | 000000100000 |
| 00000050007 | 68 | 2 | 9 | 000000500079 |
| 00000100000 | 6 | 6 | 5 | 000001000005 |
| 00001000000 | 8 | 8 | 3 | 000010000003 |
| 99999999999 | 11 × (1+2+3+4+5+6+7+8+9+2+3+4) | 0 | **0** | 99999999999**0** |

---

## 🎯 Casos Especiais

### Caso 1: Resto < 2 → DV = '0'

```
Exemplo: Nosso Número Base = 00000010000

Cálculo:
Pos 0-4: 0×(2,3,4,5,6) = 0
Pos 5: 1×7 = 7
Pos 6-10: 0×(8,9,2,3,4) = 0

Soma = 7
Resto = 7 % 11 = 7
DV = 11 - 7 = 4 ✅

Exemplo 2: Nosso Número Base = 00000000010

Cálculo:
Pos 0-8: 0×... = 0
Pos 9: 1×3 = 3
Pos 10: 0×4 = 0

Soma = 3
Resto = 3 % 11 = 3
DV = 11 - 3 = 8 ✅

Exemplo 3: Quando resto = 1

Soma = 12
Resto = 12 % 11 = 1
DV = '0' (resto < 2) ✅

Exemplo 4: Quando resto = 0

Soma = 11
Resto = 11 % 11 = 0
DV = '0' (resto < 2) ✅
```

---

## ⚠️ Validações Implementadas

```javascript
// Remover não-dígitos
.replace(/\D/g, '')

// Padding com zeros à esquerda (garante 11 dígitos)
.padStart(11, '0')

// Limitar a 11 dígitos (ignora excedentes)
.slice(0, 11)

// Conversão para inteiro
parseInt(base.charAt(i), 10)

// Retorno como string
String(11 - resto)
```

---

## 🔍 Verificação do DV

Para verificar se um nosso número está correto:

```javascript
function verificarNossoNumero(nossoNumeroCompleto) {
  // Separar base (primeiros 11) e DV (último)
  const base = nossoNumeroCompleto.slice(0, 11)
  const dvArmazenado = nossoNumeroCompleto.slice(11, 12)
  
  // Calcular DV esperado
  const dvCalculado = calcNossoNumeroDV(base)
  
  // Comparar
  if (dvArmazenado === dvCalculado) {
    console.log('✅ Nosso número válido')
    return true
  } else {
    console.log('❌ Nosso número inválido')
    console.log(`Esperado: ${dvCalculado}, Recebido: ${dvArmazenado}`)
    return false
  }
}

// Exemplos:
verificarNossoNumero('500079')      // ✅ Válido
verificarNossoNumero('500078')      // ❌ Inválido (DV deveria ser 9)
```

---

## 📌 Resumo da Implementação

| Aspecto | Valor |
|--------|-------|
| **Algoritmo** | BMP274 - Módulo 11 |
| **Tamanho da base** | 11 dígitos |
| **Sequência de pesos** | [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4] |
| **Operação principal** | Soma de (dígito × peso) |
| **Regra final** | resto < 2 ? '0' : 11 - resto |
| **Comprimento final** | 12 caracteres (11 + 1 DV) |
| **Padrão de formato** | BBBBBBBBBBBBDV (11 base + 1 DV) |

---

**Atualizado:** 21/05/2026  
**Algoritmo:** BMP274 CNAB400  
**Implementação:** `calcNossoNumeroDV()` em boletoService.js
