# 📦 Implementação Completa: Importação de Arquivos OS (Ordem de Serviço)

## ✅ O que foi implementado

Na página **"Boletos"** → botão **"Selecionar arquivos"**, agora é possível importar arquivos Excel do tipo **OS (Ordem de Serviço)** além dos tipos já existentes.

**Importante**: Este formato NOT é específico de um cliente. Pode vir de FORTALLOG, ou qualquer outro cliente que envie arquivos no padrão OS_*.xls.

## 🎯 Funcionalidades

### 1️⃣ Detecção Automática
O sistema detecta automaticamente se o arquivo é do tipo OS baseado no padrão:
- Nome começa com `"OS_"` (case-insensitive)
- Termina com `.xls`
- Exemplo válidos: `OS_11115_BDF5A51.xls`, `os_12345_empresa.xls`

### 2️⃣ Extração de Dados Específicos
Lê dados de células específicas do Excel:

| Campo | Célula | Exemplo |
|-------|--------|---------|
| Número do Documento | D13 | 11115 |
| Data de Emissão | AN11 | 15/05/2026 |
| Nome do Sacado | K16 | FORTALLOG |
| CIC (CPF/CNPJ) | F17 | 15521992000170 |
| Endereço | F19 | RUA MANUEL RODRIGUES, 594 |
| Bairro | F20 | BOA VISTA |
| CEP | T20 | 60861015 |
| Cidade + Estado | AJ19 | FORTALEZA - CE |
| Valor | AU54 | 5.132,25 |

### 3️⃣ Processamento Automático
- ✅ Limpeza de caracteres (remove formatação de CPF/CNPJ/CEP)
- ✅ Parsing inteligente de valores (detecta formato brasileiro 1.234,56)
- ✅ Extração de UF da cidade (ex: "FORTALEZA - CE" → "CE")
- ✅ Formatação de datas (DD/MM/AAAA)
- ✅ Validação de dados obrigatórios

### 4️⃣ Integração com Fluxo Existente
- Dados extraídos passam por **preview** (confirmar antes de importar)
- Suporta criar novo boleto ou atualizar existente (upsert)
- Mantém compatibilidade com avalista (usa dados do perfil selecionado)

## 📝 Arquivos Modificados

### `src/services/importService.js`
**Adições:**
- Função `parseOSFile()` - Parser específico para OS
- Função `processOSExcel()` - Processa arquivo com XLSX
- Função `isOSFile()` - Detecta tipo de arquivo (padrão OS_*.xls)
- Lógica aprimorada de parsing de valores

**Modificações:**
- `processFile()` - Adicionada detecção e roteamento para `parseOSFile()`

### `src/components/Boletos/FileUpload.jsx`
**Modificações:**
- Texto informativo atualizado para mencionar OS como formato aceito
- "Arraste Excel (.xlsx, .xls, OS), CSV (.csv), TXT (.txt) ou XML..."

## 🧪 Testes Realizados

✓ Detecção de arquivo (padrão OS_*.xls)  
✓ Parsing de valores brasileiros (5.132,25 → 5132.25)  
✓ Limpeza de formatação (CPF, CNPJ, CEP)  
✓ Extração de UF de cidade  
✓ Validações de dados obrigatórios  

## 🚀 Como Usar

1. Acesse a página **Boletos**
2. Clique em **"Selecionar arquivos"** ou arraste um arquivo OS (padrão `OS_*.xls`)
3. O sistema detectará automaticamente
4. Revise os dados no **preview**
5. Confirme a importação

## 📊 Exemplo de Fluxo

```
Usuário seleciona: OS_11115_BDF5A51.xls
                          ↓
Sistema detecta: Arquivo tipo OS (padrão OS_*.xls)
                          ↓
Parser lê células específicas
                          ↓
Extrai: { numero_documento: "11115", sacado_nome: "FORTALLOG", valor: 5132.25, ... }
                          ↓
Mostra preview para confirmar
                          ↓
Cria boleto no banco (ou atualiza se existir)
                          ↓
✓ Importação concluída!
```

## 💡 Detalhes Técnicos

### Parsing de Valores
Implementado sistema inteligente que detecta automaticamente:
- **Formato Brasileiro**: 1.234,56 (ponto separador, vírgula decimal)
- **Formato Internacional**: 1,234.56 (vírgula separador, ponto decimal)
- **Sem formatação**: 1234.56

Prioriza formato brasileiro se houver ambiguidade.

### Extração de UF
Padrão: "CIDADE - UF" (ex: "FORTALEZA - CE")
- Busca "-" no texto de cidade
- Extrai 2 caracteres após o hífen
- Converte para MAIÚSCULA

### Validações
Campos obrigatórios:
- Número de documento
- Nome do sacado
- Valor > 0

Se houver erro em algum campo, o arquivo é rejeitado com mensagem clara.

## 🔄 Compatibilidade

- ✅ Funciona com arquivos `.xls` (antigo Excel)
- ✅ Compatível com preview e importação existente
- ✅ Sem quebra de retrocompatibilidade
- ✅ Todos os formatos anteriores continuam funcionando

## 📌 Notas Importantes

- Arquivo deve estar em formato **`.xls`** (Excel antigo)
- O nome do arquivo **deve** seguir padrão `OS_*.xls`
- Células devem estar nos locais exatos (D13, AN11, etc)
- Data de vencimento é calculada como +30 dias (configurável futuramente)
- **Não é vinculado a cliente específico** - pode vir de FORTALLOG ou qualquer outro

## 🎓 Para Desenvolvedores

Se precisar adicionar outro tipo de arquivo estruturado:
1. Crie função `parse[Tipo]File()` em `importService.js`
2. Crie função `is[Tipo]File()` para detectar
3. Adicione lógica em `processFile()`
4. Atualize texto no `FileUpload.jsx`

Padrão já estabelecido e testado! ✨
