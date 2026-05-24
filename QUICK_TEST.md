# ✅ Quick Test - OS File Import Fix

## What was fixed

**Root Cause:** Vencimento/Valor extraction was using unreliable "Data"/"Valor" label search, now using marker-based "BOLETO" detection

**Issues Fixed:**
1. ✅ Type B detection threshold lowered from `>= 5` to `>= 2`
2. ✅ Default parser changed to Type B (more robust)
3. ✅ Search functions now search ENTIRE worksheet, not just first 30 rows
4. ✅ Search strings updated to handle label variations ("Cliente:" vs "Cliente :")
5. ✅ Smart filtering to skip numeric codes and find real names
6. ✅ **NEW**: BOLETO marker-based extraction for vencimentos/valores (replaces Data/Valor label search)
7. ✅ **NEW**: Automatic parcel detection from BOLETO rows (supports multiple installments)

## How to Test

### Method 1: Browser Testing
1. Open this file in your browser: `C:\Projetos\Capt\test_import_debug.html`
2. Upload your OS file
3. See detailed extraction results

### Method 2: In App Testing  
1. Go to Boletos → Import
2. Upload OS files (OS_11024, OS_11198, OS_11208, etc)
3. Check if form pre-fills correctly
4. Should see:
   - ✅ **NUM_TITULO** filled
   - ✅ **SACADO_NOME** filled
   - ✅ **VALOR** filled
   - ✅ Multiple installments if multiple vencimentos found

## Expected Results

### File: OS_11198_RUN5F79 - TRANSPORTES PESADOS

**Should Extract:**
- NUM_TITULO: `11198`
- SACADO_NOME: `TRANSPORTES PESADOS MINAS S.A.`
- SACADO_CIC: `17215039001796`
- SACADO_ENDERECO: `ROD CE 422 KM12, S/N`
- SACADO_BAIRRO: `TABULEIRO`
- SACADO_CEP: `62670000`
- SACADO_CIDADE: `SAO GONCALO DO AMARANTE`
- SACADO_UF: `CE`
- VENCIMENTO: `30/05/2026`
- VALOR: `4625.89`

**Status:** ✅ Should import successfully

## If Still Not Working

1. **Open Browser Console** (F12)
2. **Look for messages starting with:**
   - `[OS Detection]` - Shows type detection
   - `[OS Generic]` - Shows BOLETO extraction and fallback attempts
   - `[OS TypeB]` - Shows validation

3. **Expected console output:**
   ```
   [OS Detection] Analisando OS_11198..., 53 linhas encontradas
   [OS Detection] ✓ "Ordem de Serviço" encontrado na L8
   [OS Detection] ✓ "Código:" encontrado na L13
   [OS Detection] ✓ "Cliente:" encontrado na L16
   [OS Detection] Contagem: Type B=7, Type A=0
   [OS Detection] ✓ Tipo B detectado (Score: 7)
   [OS Generic] Procurando parcelas por marcador "BOLETO"...
   [OS Generic] "BOLETO" encontrado em L40, coluna AU
   [OS Generic]   Vencimento encontrado: "30/05/2026"
   [OS Generic]   Valor encontrado: "4625.89"
   [OS Generic] Parcela 1 adicionada: 30/05/2026 / 4625.89
   [OS Generic] Total de parcelas encontradas por BOLETO: 1
   [OS Generic] Extraído via BOLETO marker: 1 parcela(s)
   [OS Generic] NUM_TITULO: 11198
   [OS Generic] SACADO_NOME: TRANSPORTES PESADOS MINAS S.A.
   [OS TypeB] Boleto construído: {...}
   ```

4. **If you see fallback message:**
   ```
   [OS Generic] Nenhuma parcela encontrada pelo marcador BOLETO, tentando busca fallback
   [OS Generic] Extraído via fallback Data/Valor: 1 vencimento(s), 1 valor(es)
   ```
   - BOLETO marker not found in file
   - Using older Data/Valor label search as backup
   - This is normal for legacy format files

## Changes Made

### File: `C:\Projetos\Capt\src\services\importService.js`

**Vencimento/Valor Extraction (Line ~1238):**
```javascript
// OLD:
let vencimentos = findValuesBelow(jsonData, 'Data', 'VENCIMENTO')
let valores = findValuesBelow(jsonData, 'Valor', 'VALOR')

// NEW:
const parcelasData = findBoletoParcelasByBoletoMarker(jsonData)
if (parcelasData && parcelasData.length > 0) {
  vencimentos = parcelasData.map(p => p.vencimento)
  valores = parcelasData.map(v => {
    const numStr = String(v.valor).replace(/[^\d.,]/g, '').replace(',', '.')
    return parseFloat(numStr) || 0
  })
} else {
  // Fallback to Data/Valor search if BOLETO not found
  vencimentos = findValuesBelow(jsonData, 'Data', 'VENCIMENTO')
  valores = findValuesBelow(jsonData, 'Valor', 'VALOR')
}
```

**New BOLETO Marker Function (Line ~960):**
```javascript
function findBoletoParcelasByBoletoMarker(jsonData) {
  // Searches for "BOLETO" marker in worksheet
  // When found, extracts vencimento (DD/MM/YYYY) and valor (numeric) from columns to the right
  // Supports multiple BOLETO lines = multiple parcelas
  // Returns: [{vencimento, valor, linha}, ...]
}
```

**Detection Logic (Line ~1400):**
```javascript
if (typeAMarkers > 10 && typeBMarkers === 0) { use Type A }
else if (typeBMarkers >= 2) { use Type B }
else { default Type B }
```

**Field Extraction (Line ~1090):**
```javascript
findValueAfterText(jsonData, 'Cliente') || 
findValueAfterText(jsonData, 'Cliente:')
```

**Search Range (Line ~887):**
```javascript
for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++)  // Search entire worksheet
```

## Support

If import still fails:
1. ✅ Test with `test_import_debug.html`
2. ✅ Check browser console output
3. ✅ Share the exact error message
4. ✅ Share console logs
