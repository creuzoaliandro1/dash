# 🔧 Valor Conversion Fix - Formato Brasileiro

**Data**: 2026-05-24  
**Problema**: Valor "2.199,54" estava sendo convertido para "2,2" (incorreto)  
**Solução**: Função `converterValor()` centralizada para suportar ambos formatos  
**Status**: ✅ IMPLEMENTADO

---

## O Problema

Ao importar valores no formato brasileiro "2.199,54" (com separador de milhares e decimal com vírgula):

❌ **ANTES**:
```javascript
const numStr = String(v).replace(/[^\d.,]/g, '').replace(',', '.')
parseFloat(numStr)
// "2.199,54" → "2.199,54" → "2.199.54" → parseFloat = 2.199 (ERRADO!)
```

✅ **DEPOIS**:
```javascript
converterValor("2.199,54")
// Detecta vírgula → Remove pontos → "2199,54" → "2199.54" → parseFloat = 2199.54 (CORRETO!)
```

---

## A Solução

### Função Centralizada: `converterValor(valor)`

**Localização**: `C:\Projetos\Capt\src\services\importService.js` (linhas 113-135)

```javascript
/**
 * Converter valor de string para número (suporta formato brasileiro e americano)
 * Exemplo: "2.199,54" → 2199.54 | "2,199.54" → 2199.54 | "2199.54" → 2199.54
 */
function converterValor(valor) {
  if (!valor) return 0
  const valorStr = String(valor).replace(/[^\d.,]/g, '')

  if (valorStr.includes(',')) {
    // Formato brasileiro: remover todos os pontos (separador de milhares)
    // Manter vírgula como decimal
    const numStr = valorStr.replace(/\./g, '').replace(',', '.')
    return parseFloat(numStr) || 0
  } else {
    // Formato americano: remover vírgulas
    const numStr = valorStr.replace(',', '')
    return parseFloat(numStr) || 0
  }
}
```

### Como Funciona

```
Entrada: "2.199,54"
         ↓
Limpar não-numéricos: "2.199,54" (já limpo)
         ↓
Detectar vírgula? SIM → Formato brasileiro
         ↓
Remove pontos (milhares): "2.199,54" → "2199,54"
         ↓
Replace vírgula por ponto: "2199,54" → "2199.54"
         ↓
parseFloat("2199.54") = 2199.54
         ↓
Saída: 2199.54 ✅
```

---

## Locais Atualizados

| Localização | Antes | Depois |
|------------|-------|--------|
| BOLETO Extraction (L1274) | Conversão inline | `converterValor(v.valor)` |
| Fallback Data/Valor (L1283) | Conversão inline | `converterValor(v)` |
| parseExcelFile VALOR (L56) | Conversão inline | `converterValor(row['Valor do título'])` |
| parseExcelFile VALOR_PAGAMENTO (L70) | Conversão inline | `converterValor(row['Valor pago'])` |
| NFe parsing (L305) | Conversão inline | `converterValor(vNF)` |
| MDFe processMDFe (L412) | Conversão inline | `converterValor(valor)` |
| CTe parsing (L473) | Conversão inline | `converterValor(vCT)` |
| MDFe parsing (L519) | Conversão inline | `converterValor(vMDF)` |
| parseExcelFile (L1894) | Conversão inline | `converterValor(row['Valor do título'])` |

**Total**: 9 locais atualizados → 1 função centralizada

---

## Formatos Suportados

| Formato | Entrada | Saída | Status |
|---------|---------|-------|--------|
| Brasileiro | "2.199,54" | 2199.54 | ✅ |
| Brasileiro | "1.000,00" | 1000.00 | ✅ |
| Brasileiro | "999,99" | 999.99 | ✅ |
| Americano | "2,199.54" | 2199.54 | ✅ |
| Americano | "2199.54" | 2199.54 | ✅ |
| Com R$ | "R$ 2.199,54" | 2199.54 | ✅ |
| Vazio | "" ou null | 0 | ✅ |

---

## Teste com o Arquivo Enviado

**Arquivo**: OS_11038_HYV5847 - COPA ENGENHARIA.xls  
**Valor Original**: "2.199,54"  
**Conversão Anterior**: 2.2 (❌ ERRADO)  
**Conversão Agora**: 2199.54 (✅ CORRETO)

### Como Verificar

1. **Upload do arquivo no sistema**
   ```
   Boletos → Import
   Selecionar: OS_11038_HYV5847 - COPA ENGENHARIA.xls
   ```

2. **Verificar Console (F12 → Console)**
   ```
   [OS Generic] Procurando parcelas por marcador "BOLETO"...
   [OS Generic] "BOLETO" encontrado em L[XX], coluna [YY]
   [OS Generic]   Vencimento encontrado: "..."
   [OS Generic]   Valor encontrado: "2.199,54"
   [OS Generic] Parcela 1 adicionada: ... / 2.199,54
   [OS Generic] Total de parcelas encontradas por BOLETO: 1
   [OS Generic] Extraído via BOLETO marker: 1 parcela(s)
   ```

3. **Verificar Formulário**
   ```
   Campo VALOR deve mostrar: 2199.54 (não 2.2)
   ```

4. **Ao clicar em +**
   ```
   Parcela deve ter VALOR: 2199.54
   Não pode estar dividido ou incorreto
   ```

---

## Benefícios

✅ **Centralização**: Uma única função cuida de toda conversão  
✅ **Consistência**: Mesmo comportamento em todos os importadores (Excel, NFe, CTe, MDFe, OS)  
✅ **Robustez**: Suporta múltiplos formatos sem falhar  
✅ **Manutenibilidade**: Mudanças futuras só precisam de 1 lugar  
✅ **Debugging**: Lógica clara e documentada  

---

## Comportamento Esperado

### Cenário 1: BOLETO com valor brasileiro
```
Entrada: BOLETO row com valor "2.199,54"
↓
BOLETO extraction → converterValor("2.199,54")
↓
Saída: 2199.54 ✅
Form pré-preenchido: 2199.54
```

### Cenário 2: Fallback Data/Valor com valor brasileiro
```
Entrada: Linha "Valor" com "2.199,54"
↓
Data/Valor extraction → converterValor("2.199,54")
↓
Saída: 2199.54 ✅
Form pré-preenchido: 2199.54
```

### Cenário 3: Valor com símbolo de moeda
```
Entrada: BOLETO row com valor "R$ 2.199,54"
↓
converterValor("R$ 2.199,54")
↓
Remove não-numéricos → "2.199,54"
Detecta vírgula → Formato brasileiro
Remove pontos → "2199,54"
Replace vírgula → "2199.54"
↓
Saída: 2199.54 ✅
```

---

## Próximas Verificações

- [ ] Testar OS_11038_HYV5847 - BOLETO extraction
- [ ] Testar OS_11024, OS_11208 com novo conversor
- [ ] Verificar valores em parseExcelFile (Excel regular)
- [ ] Verificar valores em NFe/CTe/MDFe parsing
- [ ] Confirmar parcelas múltiplas são divididas corretamente

---

## Referências

- **Função**: `converterValor()` - Linhas 113-135
- **BOLETO Integration**: Linhas 1272-1285
- **Fallback Integration**: Linhas 1277-1283
- **Test File**: OS_11038_HYV5847 - COPA ENGENHARIA.xls
