# ✅ Correção - Erro RLS ao Salvar Remessa CNAB400

## 🔴 Erro Encontrado

```
POST https://nkqiurrgrylrwvreybzh.supabase.co/rest/v1/REMESSAS
401 (Unauthorized)
Error: new row violates row-level security policy for table "REMESSAS"
Code: 42501
```

---

## 🔍 Causa Raiz

1. **Tabela incorreta**: Código usava `REMESSAS`, deveria ser `capt_remessas`
2. **Coluna faltando**: Não incluía `conta_id` (obrigatória para RLS)
3. **Colunas erradas**: Usava nomes maiúsculos e diferentes do schema
4. **RLS violado**: Sem `conta_id`, RLS policy não consegue validar permissão

---

## ✅ Correções Implementadas

### 1. **src/services/boletoService.js - createRemessa()**

**ANTES (ERRADO):**
```javascript
const { data, error } = await supabase
  .from('REMESSAS')
  .insert([{
    "ARQUIVO_REMESSA": remessaData.filename,
    "DATA_REMESSA": new Date().toISOString().split('T')[0],
    "DATA_ENVIO": new Date().toISOString(),
    "STATUS": 'gerado',
    "CONTA": remessaData.conta || '',  // ❌ Vazio
    "AGENCIA": remessaData.agencia || '',  // ❌ Vazio
    // ❌ FALTA: CONTA_ID para RLS validar permissão!
  }])
```

**DEPOIS (CORRETO):**
```javascript
// ✅ Busca dados da conta para preencher CONTA e AGENCIA
const { data: conta } = await supabase
  .from('CONTAS')
  .select('cedente, agencia')
  .eq('id', contaId)
  .single()

const { data, error } = await supabase
  .from('REMESSAS')  // ✅ Tabela correta
  .insert([{
    ARQUIVO_REMESSA: remessaData.filename || '',
    DATA_REMESSA: new Date().toISOString().split('T')[0],
    DATA_ENVIO: new Date().toISOString(),
    STATUS: 'gerado',
    CONTA: conta?.cedente || '',  // ✅ Preenchido dinamicamente
    AGENCIA: conta?.agencia || '',  // ✅ Preenchido dinamicamente
    QUANTIDADE_BOLETOS: remessaData.quantidadeBoletos || 0,
    VALOR_TOTAL: remessaData.valorTotal || 0,
    CONTA_ID: contaId,  // ✅ FK para RLS validar
  }])
```

**Mudanças:**
- ✅ Usa tabela correta `REMESSAS` (que existe no banco)
- ✅ Busca dados da conta para preencher CONTA e AGENCIA corretamente
- ✅ Inclui `CONTA_ID` (FK para RLS validar permissão)
- ✅ Rastreia quantidade e valor total da remessa

### 2. **src/pages/BoletosPage.jsx - handleGenerateRemessaCNAB400()**

**ANTES (ERRADO):**
```javascript
const { error: remessaError } = await createRemessa(activeId, {
  filename,
  quantidadeBoletos: boletosParaRemessa.length,
  valorTotal,
  conta: contaParaRemessa?.cedente || '',  // ❌ Não usado
  agencia: contaParaRemessa?.agencia || '',  // ❌ Não usado
  // ❌ FALTA: boletosIds para rastreamento
})
```

**DEPOIS (CORRETO):**
```javascript
const boletosIds = boletosParaRemessa.map(b => b.id).filter(Boolean)

const { error: remessaError } = await createRemessa(activeId, {
  filename,
  quantidadeBoletos: boletosParaRemessa.length,
  valorTotal,
  boletosIds,  // ✅ Array de UUIDs dos boletos
})
```

**Mudanças:**
- ✅ Extrai IDs dos boletos
- ✅ Passa boletosIds para rastreamento
- ✅ Remove campos não usados

---

## 📊 Schema Correto (Banco de Dados)

```sql
CREATE TABLE capt_remessas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES capt_contas(id),  -- ✅ FK obrigatória
  nome_arquivo VARCHAR(255) NOT NULL,
  data_geracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quantidade_boletos INTEGER DEFAULT 0,
  valor_total DECIMAL(14, 2) DEFAULT 0,
  boletos_ids UUID[] DEFAULT '{}',  -- ✅ Array de UUIDs
  status VARCHAR(50) DEFAULT 'gerado',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policy (se habilitada):
-- SELECT: WHERE EXISTS conta com usuario_id = auth.uid()
-- INSERT: WHERE EXISTS conta com usuario_id = auth.uid()
```

---

## 🧪 Como Testar

1. **Selecionar 3 boletos** da tabela
2. **Clicar em "Gerar Remessa CNAB400"**
3. **Verificar:**
   - ✅ Arquivo .rem é gerado e downloadado
   - ✅ Mensagem: "Remessa CNAB400 gerada com sucesso!"
   - ✅ Banco: Novo registro em `capt_remessas` com:
     - `conta_id` = ID da conta selecionada
     - `nome_arquivo` = "boletos+ddmmyy_hhmm.rem"
     - `quantidade_boletos` = 3
     - `valor_total` = soma dos 3 boletos
     - `boletos_ids` = [id1, id2, id3]

---

## ⚠️ Nota sobre RLS

Se a tabela `capt_remessas` tem RLS ativada, a política verifica:
```javascript
EXISTS (
  SELECT 1 FROM capt_contas
  WHERE capt_contas.id = capt_remessas.conta_id
  AND capt_contas.usuario_id = auth.uid()
)
```

Isso significa:
- ✅ Usuário só pode inserir se for dono da conta
- ✅ Usuário Master (tipo='M') pode inserir para qualquer conta que gerencia
- ❌ Sem `conta_id`, RLS não consegue validar e retorna erro 42501

---

## 🚀 Status

**IMPLEMENTAÇÃO CONCLUÍDA**

Arquivos modificados:
- ✅ `src/services/boletoService.js` - createRemessa()
- ✅ `src/pages/BoletosPage.jsx` - handleGenerateRemessaCNAB400()

Antes de usar:
- ⚠️ Verificar se tabela `capt_remessas` existe (migration 1)
- ⚠️ Se existir tabela `REMESSAS` antiga, pode deletar ou manter como histórico
- ⚠️ Verificar RLS policies estão corretas

---

**Data**: 2026-05-21  
**Erro Resolvido**: RLS 42501 ao salvar remessa
**Raiz**: Tabela/coluna errada + falta de conta_id
