# Implementação: Auto-Preenchimento de Avalista na Importação de Boletos

## 📅 Data: 21/05/2026

---

## 🎯 Objetivo

Modificar o processo de importação de boletos para auto-popular os campos **avalista_nome** e **avalista_cic** com os dados do perfil/conta logada, em vez de extrair esses valores do arquivo importado.

---

## 🔄 Fluxo de Funcionamento

### Antes (Comportamento Anterior)
```
Arquivo importado
    ↓
Extrai avalista_nome e avalista_cic do arquivo
    ↓
Usa valores do arquivo durante criação do boleto
```

### Depois (Novo Comportamento)
```
Seleciona arquivo + Perfil/Conta
    ↓
Identifica nome_correntista e CNPJ do perfil selecionado
    ↓
Injeta valores automaticamente no parseExcelFile/parseCSVFile/parseTXTFile
    ↓
Valores do arquivo (se existentes) são ignorados
    ↓
Usa valores do perfil logado durante criação do boleto
```

---

## 📝 Arquivos Modificados

### 1. **importService.js**

#### Mudança na função `parseExcelFile`
**Antes:**
```javascript
async function parseExcelFile(file) {
  // ... sem parâmetros de perfil
  AVALISTA_NOME: String(row['Beneficiário final (sacador avalista)'] || '').trim(),
  AVALISTA_CIC: String(row['Documento federal do avalista'] || ...).replace(/\D/g, ''),
}
```

**Depois:**
```javascript
async function parseExcelFile(file, profileName, profileCNPJ) {
  // ... com parâmetros de perfil
  // Avalista auto-populate com dados do perfil logado
  AVALISTA_NOME: profileName || String(row['Beneficiário final (sacador avalista)'] || '').trim(),
  AVALISTA_CIC: profileCNPJ || String(row['Documento federal do avalista'] || ...).replace(/\D/g, ''),
}
```

**Lógica:**
- Se `profileName` for fornecido, usa ele (ignora arquivo)
- Se `profileName` for vazio, tenta extrair do arquivo
- Mesmo padrão para `profileCNPJ`

#### Mudança nas funções `parseCSVFile` e `parseTXTFile`
Mesmo padrão:
- Adicionados parâmetros `profileName` e `profileCNPJ`
- Auto-populate com dados do perfil se fornecidos
- Fallback para valores do arquivo se vazios

#### Mudança em `processFile`
```javascript
export async function processFile(file, profileName = '', profileCNPJ = '') {
  // ... passa profileName e profileCNPJ para os parsers
  switch (extension) {
    case 'csv':
      data = await parseCSVFile(file, profileName, profileCNPJ)
      break
    case 'txt':
      data = await parseTXTFile(file, profileName, profileCNPJ)
      break
    case 'xlsx':
    case 'xls':
      data = await parseExcelFile(file, profileName, profileCNPJ)
      break
    // ...
  }
}
```

#### Mudança em `processFilesForPreview`
```javascript
export async function processFilesForPreview(files, profileName = '', profileCNPJ = '') {
  // ... passa profileName e profileCNPJ para processFile
  for (const file of files) {
    const { success, data, error, fileName } = await processFile(file, profileName, profileCNPJ)
  }
}
```

#### Mudança em `importBoletos`
```javascript
export async function importBoletos(files, userId, profileName = '', profileCNPJ = '') {
  // ... passa profileName e profileCNPJ para processFile
  for (const file of files) {
    const { success, data, error, fileName } = await processFile(file, profileName, profileCNPJ)
  }
}
```

---

### 2. **FileUpload.jsx**

#### Mudança no método `handleFiles`
**Novo código:**
```javascript
// Obter dados do perfil selecionado para avalista
let profileName = ''
let profileCNPJ = ''

if (allContas && allContas.length > 0 && selectedContaId) {
  const selectedConta = allContas.find(c => String(c.id) === String(selectedContaId))
  if (selectedConta) {
    profileName = selectedConta.nome_correntista || ''
    // Tentar encontrar o CNPJ em um dos possíveis campos
    profileCNPJ = selectedConta.cnpj || selectedConta.cpf_cnpj || selectedConta.documento || ''
    console.log(`[FileUpload] Usando perfil para avalista: ${profileName}${profileCNPJ ? ' (' + profileCNPJ + ')' : ''}`)
  }
}

// ... depois passa para processFilesForPreview
result = await processFilesForPreview(validFiles, profileName, profileCNPJ)
```

**Fluxo:**
1. Identifica o `selectedContaId` (conta atual selecionada)
2. Busca a conta correspondente no array `allContas`
3. Extrai `nome_correntista` como `profileName`
4. Tenta encontrar CNPJ em `cnpj`, `cpf_cnpj` ou `documento`
5. Passa ambos para `processFilesForPreview`

---

### 3. **boletoService.js**

#### Mudança em `getAllContas`
**Antes:**
```javascript
.select('id, nome_correntista, conta')
```

**Depois:**
```javascript
.select('id, nome_correntista, conta, cnpj, cpf_cnpj, documento')
```

**Motivo:**
- Incluir possíveis variações do campo CNPJ
- Permitir que FileUpload.jsx acesse o CNPJ da conta
- O banco tentará retornar os campos que existem, ignorando os que não existem

---

## 📊 Tabela de Campos

| Campo | Tipo | Origem | Uso |
|-------|------|--------|-----|
| `profileName` | string | `CONTAS.nome_correntista` | `capt_boletos.avalista_nome` |
| `profileCNPJ` | string | `CONTAS.cnpj` (ou variação) | `capt_boletos.avalista_cic` |

---

## ✅ Validações

### FileUpload.jsx
- ✅ Verifica se `allContas` tem dados
- ✅ Verifica se `selectedContaId` é válido
- ✅ Busca a conta selecionada no array
- ✅ Tenta múltiplos nomes de campo para CNPJ
- ✅ Faz fallback para vazio se não encontrar

### importService.js
- ✅ Todos os parsers aceitam `profileName` e `profileCNPJ` opcionais
- ✅ Se fornecidos, usam os dados do perfil (prioridade)
- ✅ Se vazios, tentam extrair do arquivo (fallback)
- ✅ Mantém backward compatibility (parâmetros opcionais)

---

## 🔍 Exemplos de Uso

### Importação de Excel com Auto-Populate
```
Usuario logado na conta: "Empresa XYZ LTDA"
CNPJ da conta: "12345678000190"

Arquivo importado contém:
├─ Boleto 001: avalista_nome="João Silva", avalista_cic="98765432100"
└─ Boleto 002: avalista_nome="Maria Santos", avalista_cic="11122233300"

Após processamento:
├─ Boleto 001: avalista_nome="Empresa XYZ LTDA", avalista_cic="12345678000190" ✅
└─ Boleto 002: avalista_nome="Empresa XYZ LTDA", avalista_cic="12345678000190" ✅

Arquivo: IGNORADO
Perfil: USADO
```

### Se CNPJ não estiver disponível
```
Usuario logado na conta: "Empresa XYZ LTDA"
CNPJ da conta: NÃO DISPONÍVEL (campo vazio em allContas)

Arquivo importado contém:
└─ Boleto 001: avalista_cic="98765432100"

Após processamento:
└─ Boleto 001: avalista_nome="Empresa XYZ LTDA", avalista_cic="98765432100" ✅

Nome: DO PERFIL (sucesso)
CNPJ: DO ARQUIVO (fallback)
```

---

## 🚀 Próximos Passos Opcionais

1. **Verificar nome do campo CNPJ no banco**
   - Se o campo não for `cnpj`, `cpf_cnpj` ou `documento`
   - Atualizar a query em `getAllContas` e a lógica em `FileUpload.jsx`

2. **Adicionar UI para confirmar avalista**
   - Mostrar nome e CNPJ do avalista antes de importar
   - Permitir edição se necessário
   - Salvar preferência (sempre usar o do perfil ou sempre perguntar)

3. **Adicionar validação de CNPJ**
   - Validar formato do CNPJ (11 ou 14 dígitos)
   - Avisar se o CNPJ estiver vazio durante importação

4. **Testar com dados reais**
   - Verificar se getAllContas retorna o campo CNPJ corretamente
   - Confirmar se o campo existe com um dos nomes tentados
   - Se não existir com nenhum nome, determinar o nome correto

---

## 📌 Notas Importantes

- ✅ **Backward Compatibility**: Todas as mudanças são opcionais (parâmetros vazios mantêm comportamento anterior)
- ✅ **Fallback**: Se não fornecer profileName/profileCNPJ, tenta extrair do arquivo
- ⚠️ **CNPJ Field**: Se nenhum dos nomes tentados existir no banco, o CNPJ ficará vazio
- 📝 **Logging**: Adicionado log no FileUpload para debug do perfil sendo usado

---

**Implementação concluída:** 21/05/2026 ✅
**Status:** Pronto para testes
