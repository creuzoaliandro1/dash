# Implementação de Suporte ao Arquivo FORTALLOG/OS

## 📋 Resumo
Foi implementado suporte para importação de arquivos Excel tipo **FORTALLOG/OS** na página de boletos.

## 🔧 Alterações Realizadas

### 1. **importService.js** - Novas Funções Adicionadas

#### `parseFortallogFile(file, profileName, profileCNPJ)`
- **Tipo**: Async Promise
- **Descrição**: Parser específico para arquivos FORTALLOG com mapeamento de células
- **Fluxo**:
  1. Carrega biblioteca XLSX se necessário
  2. Lê dados das células específicas:
     - `D13`: numero_documento
     - `AN11`: data_emissao
     - `K16`: sacado_nome
     - `F17`: sacado_cic
     - `F19`: sacado_endereco
     - `F20`: sacado_bairro
     - `T20`: sacado_cep
     - `AJ19`: sacado_cidade
     - `AU54`: valor
  3. Valida dados obrigatórios
  4. Formata data e UF (extraído de sacado_cidade)
  5. Retorna array com boleto no formato padrão

#### `isFortallogFile(fileName)`
- **Tipo**: Function
- **Descrição**: Detecta se arquivo é FORTALLOG
- **Critérios de Detecção**:
  - Nome contém "FORTALLOG" (case-insensitive)
  - OU Nome começa com "OS_" e termina com ".xls"

#### Integração em `processFile()`
- Adicionada verificação antes do switch de extensões
- Se `isFortallogFile()` retorna true, usa `parseFortallogFile()`
- Mantém retrocompatibilidade com formatos existentes

### 2. **FileUpload.jsx** - Texto Atualizado
- Mensagem informativa agora menciona "FORTALLOG" como formato aceito
- Texto: "Arraste Excel (.xlsx, .xls, FORTALLOG), CSV (.csv), TXT (.txt) ou XML (NFe, NFSe, CTe, MDFe)"

## 📊 Dados do Arquivo de Teste

Arquivo: `OS_11115_BDF5A51 - FORTALLOG-b3b063e3.xls`

```
numero_documento: 11115
data_emissao: 15/05/2026
sacado_nome: FORTALLOG
sacado_cic: 15.521.992/0001-70
sacado_endereco: RUA MANUEL RODRIGUES, 594
sacado_bairro: BOA VISTA
sacado_cep: 60.861-015
sacado_cidade: FORTALEZA - CE
valor: 5.132,25
```

## ✅ Fluxo de Uso

1. **Usuário** acessa página "Boletos"
2. **Clica** em "Selecionar arquivos" ou arrasta arquivo FORTALLOG
3. **Sistema** detecta automaticamente o tipo (por nome)
4. **Parser Fortallog** extrai dados das células específicas
5. **Preview** mostra dados para confirmar
6. **Importação** cria boleto com dados validados

## 🔍 Validações

- ✓ Número de documento obrigatório
- ✓ Nome do sacado obrigatório
- ✓ Valor > 0
- ✓ Limpeza de caracteres não-numéricos (CIC, CEP)
- ✓ Formatação de data (DD/MM/AAAA)
- ✓ Extração de UF de cidade (ex: "FORTALEZA - CE" → "CE")

## 📝 Notas

- Arquivo deve ser em formato .xls (antigo Excel)
- Nomes de coluna não precisam corresponder (usa células absolutas)
- Data de vencimento calculada como +30 dias da emissão (padrão)
- Avalistaé preenchido com dados do perfil selecionado

## 🚀 Próximos Passos (Opcional)

- [ ] Adicionar opção de escolher período de vencimento (em vez de 30 dias fixo)
- [ ] Suporte para múltiplos boletos no mesmo arquivo
- [ ] Template/guia de estrutura do arquivo FORTALLOG
- [ ] Validações adicionais de CEP/UF

