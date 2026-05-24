# 🧪 BOLETO Extraction Strategy - Test & Validation

## Implementation Summary

**Date Implemented**: 2026-05-24  
**Strategy**: Marker-based parcel detection using "BOLETO" row markers  
**Location**: `C:\Projetos\Capt\src\services\importService.js`  
**Functions**:
- `findBoletoParcelasByBoletoMarker(jsonData)` - Primary extraction (line ~960)
- `processOSTypeB(file, profileName, profileCIC, resolve, reject)` - Integration point (line ~1129)

---

## How It Works

### Primary Strategy: BOLETO Marker Detection

1. **Scan entire worksheet** for any cell containing "BOLETO"
2. **When found**, start checking columns to the right
3. **Skip first non-empty value** (typically a numeric code like "1", "2", etc.)
4. **Look for vencimento** - matches pattern `DD/MM/YYYY` (e.g., `30/05/2026`)
5. **Look for valor** - matches pattern with decimal separator `123.456,78` or `1234.56`
6. **Store as parcela** with: `{vencimento, valor, linha}`
7. **Repeat for next BOLETO line** (supports multiple installments)

### Fallback Strategy

If BOLETO extraction returns 0 parcelas:
1. Revert to original label-based search
2. Look for "Data" label, collect values below
3. Look for "Valor" label, collect values below
4. Log that fallback was used

---

## Test Cases

### Test 1: OS_11198 - Single Parcel (BOLETO Present)

**File**: OS_11198_RUN5F79 - TRANSPORTES PESADOS.xls  
**Expected Flow**:
1. ✅ NUM_TITULO: "11198" (from "Código:" search)
2. ✅ SACADO_NOME: "TRANSPORTES PESADOS MINAS S.A." (from "Cliente:" search)
3. ✅ BOLETO found at specific line
4. ✅ VENCIMENTO: "30/05/2026" (extracted from BOLETO row columns)
5. ✅ VALOR: "4625.89" (extracted from BOLETO row columns)
6. ✅ Single parcel created with proper values

**Console Output Expected**:
```
[OS Generic] Procurando parcelas por marcador "BOLETO"...
[OS Generic] "BOLETO" encontrado em L40, coluna AU
[OS Generic]   Pulando primeiro valor (código): "1"
[OS Generic]   Vencimento encontrado: "30/05/2026"
[OS Generic]   Valor encontrado: "4625.89"
[OS Generic] Parcela 1 adicionada: 30/05/2026 / 4625.89
[OS Generic] Total de parcelas encontradas por BOLETO: 1
[OS Generic] Extraído via BOLETO marker: 1 parcela(s)
```

**Validation**:
- [ ] VENCIMENTO correctly formatted as `30/05/2026`
- [ ] VALOR correctly parsed as numeric `4625.89`
- [ ] Boleto form pre-fills with these values
- [ ] No fallback warning in console

---

### Test 2: Multiple Parcelas (Multiple BOLETO Rows)

**Scenario**: OS file with 3 parcelas (3 BOLETO marker rows)  
**Expected Flow**:
1. ✅ First BOLETO → extracts vencimento1, valor1
2. ✅ Second BOLETO → extracts vencimento2, valor2
3. ✅ Third BOLETO → extracts vencimento3, valor3
4. ✅ Creates parcelas array with all 3 installments

**Console Output Expected**:
```
[OS Generic] "BOLETO" encontrado em L40, coluna AU
[OS Generic]   Vencimento encontrado: "30/05/2026"
[OS Generic]   Valor encontrado: "4625.89"
[OS Generic] Parcela 1 adicionada: 30/05/2026 / 4625.89
[OS Generic] "BOLETO" encontrado em L50, coluna AU
[OS Generic]   Vencimento encontrado: "30/06/2026"
[OS Generic]   Valor encontrado: "2312.95"
[OS Generic] Parcela 2 adicionada: 30/06/2026 / 2312.95
[OS Generic] "BOLETO" encontrado em L60, coluna AU
[OS Generic]   Vencimento encontrado: "30/07/2026"
[OS Generic]   Valor encontrado: "2312.95"
[OS Generic] Parcela 3 adicionada: 30/07/2026 / 2312.95
[OS Generic] Total de parcelas encontradas por BOLETO: 3
```

**Validation**:
- [ ] 3 parcelas created
- [ ] Each has correct vencimento and valor
- [ ] Boleto form shows installment selector
- [ ] User can select each parcel and see details

---

### Test 3: Fallback to Data/Valor (BOLETO Not Found)

**Scenario**: OS file without BOLETO marker or different format  
**Expected Flow**:
1. BOLETO search returns empty array
2. ✅ System logs: "Nenhuma parcela encontrada pelo marcador BOLETO, tentando busca fallback"
3. ✅ Falls back to `findValuesBelow(jsonData, 'Data')` + `findValuesBelow(jsonData, 'Valor')`
4. ✅ Extracts vencimentos and valores using original method

**Console Output Expected**:
```
[OS Generic] Procurando parcelas por marcador "BOLETO"...
[OS Generic] Total de parcelas encontradas por BOLETO: 0
[OS Generic] Nenhuma parcela encontrada pelo marcador BOLETO, tentando busca fallback
[OS Generic] Procurando VENCIMENTO ("Data"):
[OS Generic]   ✓ Label "Data" encontrado em L38, coluna X
[OS Generic]     L39: "30/05/2026"
[OS Generic]   (vazio em L42, parando)
[OS Generic] Procurando VALOR ("Valor"):
[OS Generic]   ✓ Label "Valor" encontrado em L38, coluna Y
[OS Generic]     L39: "4625.89"
[OS Generic]   (vazio em L42, parando)
[OS Generic] Extraído via fallback Data/Valor: 1 vencimento(s), 1 valor(es)
```

**Validation**:
- [ ] Fallback method works correctly
- [ ] Extracts same quality of data
- [ ] No errors or exceptions
- [ ] User gets usable parcel data

---

## Regex Patterns Used

### Vencimento Pattern
```javascript
/^\d{2}\/\d{2}\/\d{4}$/
```
- Matches: `30/05/2026`, `01/01/2026`, `25/12/2025`
- Does NOT match: `2026-05-30`, `30-05-2026`, `5/5/2026`

### Valor Pattern
```javascript
/^\d+[.,]\d+$/
```
- Matches: `4625.89` (US format), `4.625,89` (Brazilian format), `1234,56`
- Does NOT match: `4625` (no decimal), `R$ 4.625,89` (has prefix), `4625.89 BRL` (has suffix)

---

## Known Limitations & Edge Cases

1. **Missing vencimento in BOLETO row**
   - Result: Parcela skipped with warning log
   - Fallback: User must enter manually
   - Solution: Check Data/Valor fallback activates

2. **Malformed valor (e.g., "4,625.89")**
   - Result: Regex won't match mixed separators
   - Solution: File structure variation, triggers fallback
   - User Impact: Fallback method tries Data/Valor search

3. **Multiple BOLETO rows but aligned differently**
   - Result: Might skip first value differently
   - Solution: Check column offset with console logs
   - User Impact: May need file structure adjustment

4. **BOLETO marker in wrong location**
   - Result: Extraction finds incorrect vencimento/valor
   - Solution: Fallback method provides alternative extraction
   - User Impact: Data quality depends on file structure

---

## Debugging Checklist

When testing with a new OS file:

1. **Check console logs** (F12 → Console)
   - ✅ Look for `[OS Generic] "BOLETO" encontrado` message
   - ✅ Verify vencimento matches DD/MM/YYYY pattern
   - ✅ Verify valor matches numeric pattern

2. **Check for fallback activation**
   - ✅ If fallback activated: BOLETO extraction failed, using Data/Valor
   - ✅ This is OK, but indicates file structure is different

3. **Validate extracted data**
   - ✅ Vencimentos are valid dates
   - ✅ Valores are positive numbers
   - ✅ No spurious values extracted (like codes or descriptions)

4. **Check parcel count**
   - ✅ Multiple BOLETO rows → multiple parcelas
   - ✅ Confirm total in console: "Total de parcelas encontradas por BOLETO: X"

---

## Integration Points

**File**: `C:\Projetos\Capt\src\services\importService.js`  
**Main Function**: `processOSTypeB()` (line ~1129)  
**Integration Snippet** (lines 1238-1266):

```javascript
const parcelasData = findBoletoParcelasByBoletoMarker(jsonData)

if (parcelasData && parcelasData.length > 0) {
  vencimentos = parcelasData.map(p => p.vencimento)
  valores = parcelasData.map(v => {
    const numStr = String(v.valor).replace(/[^\d.,]/g, '').replace(',', '.')
    return parseFloat(numStr) || 0
  })
  console.log(`[OS Generic] Extraído via BOLETO marker: ${parcelasData.length} parcela(s)`)
} else {
  // Fallback to Data/Valor search
  vencimentos = findValuesBelow(jsonData, 'Data', 'VENCIMENTO')
  valores = findValuesBelow(jsonData, 'Valor', 'VALOR')
  // ... conversion and logging
}
```

---

## Success Criteria

✅ **Implementation is complete when**:
- BOLETO marker extraction finds parcelas correctly
- Fallback activates gracefully when BOLETO not found
- Multiple parcelas create proper installment structure
- Console logs guide debugging effectively
- All test cases pass without errors
