# Preenchimento Automático de Avalista

## 🎯 O que foi implementado

Quando o usuário seleciona um arquivo para importar boletos, o sistema agora **preenche automaticamente** os campos do avalista com os dados do perfil selecionado:
- `AVALISTA_NOME` ← `CONTAS.nome_correntista`
- `AVALISTA_CIC` ← `CONTAS.cic`

## 🔧 Como funciona

### 1. **BoletosPage.jsx**
```javascript
// Antes
<FileUpload
  userId={getActiveContaId()}
  onShowPreview={handleShowPreview}
  onImportError={handleImportError}
  userType={userType}
  selectedContaId={selectedContaId}
  allContas={allContas}
/>

// Depois (adicionado contaData)
<FileUpload
  userId={getActiveContaId()}
  onShowPreview={handleShowPreview}
  onImportError={handleImportError}
  userType={userType}
  selectedContaId={selectedContaId}
  allContas={allContas}
  contaData={contaData}  // ← NOVO
/>
```

### 2. **FileUpload.jsx** - Lógica de Busca

**Prioridade:**
1. **Usuário Master**: Busca em `allContas` (lista de todas as contas)
2. **Usuário Normal**: Usa `contaData` (dados da conta atual)

```javascript
// Tentar obter de allContas (para Master)
if (allContas && allContas.length > 0 && selectedContaId) {
  const selectedConta = allContas.find(c => String(c.id) === String(selectedContaId))
  if (selectedConta) {
    profileName = selectedConta.nome_correntista || ''
    profileCNPJ = selectedConta.cic || selectedConta.cpf_cnpj || ...
  }
}

// Se não encontrou, tentar contaData (para usuários não-Master)
if (!profileName && !profileCNPJ && contaData) {
  profileName = contaData.nome_correntista || ''
  profileCNPJ = contaData.cic || contaData.cpf_cnpj || ...
}
```

### 3. **importService.js** - Integração
Os valores (`profileName`, `profileCNPJ`) são passados aos parsers:

```javascript
// Em parseExcelFile()
AVALISTA_NOME: profileName || String(row['Beneficiário final (sacador avalista)'] || '').trim(),
AVALISTA_CIC: profileCNPJ || String(row['Documento federal do avalista'] || ...).replace(/\D/g, ''),

// Em parseOSFile()
AVALISTA_NOME: profileName || '',
AVALISTA_CIC: profileCNPJ || '',
```

## 🔄 Fluxo Completo

```
Usuário seleciona arquivo para importar
    ↓
FileUpload.jsx busca dados do perfil selecionado:
  1. Tenta allContas (Master)
  2. Se falhar, usa contaData (usuário normal)
    ↓
Passa profileName e profileCNPJ aos parsers
    ↓
Parsers preenchem AVALISTA_NOME e AVALISTA_CIC
    ↓
Preview mostra avalista preenchido
    ↓
Importação cria boleto com avalista automático
```

## ✅ Casos Cobertos

| Tipo de Usuário | Fonte de Dados | Resultado |
|-----------------|----------------|-----------|
| Master (M) | allContas | ✅ Preenche com dados do perfil selecionado |
| Usuário Normal (U) | contaData | ✅ Preenche com dados da conta atual |
| Sem dados | - | ✅ Deixa em branco (sem erro) |

## 📝 Campos Afetados

Nas seguintes importações, o avalista é preenchido automaticamente:
- ✅ **Excel** (.xlsx, .xls) - parseExcelFile()
- ✅ **CSV** (.csv) - parseCSVFile()
- ✅ **TXT** (.txt) - parseTXTFile()
- ✅ **OS** (.xls padrão OS_) - parseOSFile()
- ✅ **XML** (NFe, NFSe, CTe, MDFe) - parseXMLFile()

## 🧪 Testes Recomendados

1. **Usuário Master**:
   - [ ] Selecionar arquivo
   - [ ] Verificar preview: avalista preenchido com dados da conta selecionada

2. **Usuário Normal**:
   - [ ] Selecionar arquivo
   - [ ] Verificar preview: avalista preenchido com dados da conta atual

3. **Sem dados de conta**:
   - [ ] Selecionar arquivo
   - [ ] Verificar preview: avalista em branco (sem erro)

## 📊 Exemplo de Resultado

**Antes da importação:**
```
Avalista Nome: [vazio]
Avalista CIC:  [vazio]
```

**Depois da importação (após selecionar arquivo):**
```
Avalista Nome: "EMPRESA LTDA"
Avalista CIC:  "12345678000190"
```
(Preenchido automaticamente com dados de CONTAS.nome_correntista e CONTAS.cic)

## 🔍 Fallback para Dados do Arquivo

Se o arquivo contiver dados de avalista (coluna específica), e o perfil selecionado não tiver dados:
```javascript
// Se profileName está vazio, usa dados do arquivo
AVALISTA_NOME: profileName || String(row['Beneficiário final (sacador avalista)'] || '').trim()
```

Isso garante que não fique em branco se o arquivo tiver dados.
