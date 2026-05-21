# Implementação de Suporte ao Arquivo OS (Ordem de Serviço)

## 📋 Resumo
Foi implementado suporte para importação de arquivos Excel tipo **OS (Ordem de Serviço)** na página de boletos.

## 🎯 Detalhe Importante
- **Tipo de Arquivo**: OS (Ordem de Serviço)
- **Não está vinculado a cliente específico**: Pode vir de FORTALLOG, ou qualquer outro cliente
- **Padrão de Nome**: `OS_*.xls` (exemplo: OS_11115_BDF5A51.xls)

## 🔧 Alterações Realizadas

### 1. **importService.js** - Novas Funções Adicionadas

#### `parseOSFile(file, profileName, profileCNPJ)`
- **Tipo**: Async Promise
- **Descrição**: Parser específico para arquivos OS com mapeamento de células
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

#### `isOSFile(fileName)`
- **Tipo**: Function
- **Descrição**: Detecta se arquivo é do tipo OS
- **Critério de Detecção**:
  - Nome começa com `"OS_"` (case-insensitive) E termina com `.xls`

#### Integração em `processFile()`
- Adicionada verificação antes do switch de extensões
- Se `isOSFile()` retorna true, usa `parseOSFile()`
- Mantém retrocompatibilidade com formatos existentes

### 2. **FileUpload.jsx** - Texto Atualizado
- Mensagem informativa agora menciona "OS" como formato aceito
- Texto: "Arraste Excel (.xlsx, .xls, OS), CSV (.csv), TXT (.txt) ou XML (NFe, NFSe, CTe, MDFe)"

## 📊 Exemplo: Dados de Arquivo OS

```
Arquivo: OS_11115_BDF5A51.xls
(Pode vir de FORTALLOG ou qualquer outro cliente)

numero_documento:   11115
data_emissao:       15/05/2026
sacado_nome:        FORTALLOG
sacado_cic:         15.521.992/0001-70
sacado_endereco:    RUA MANUEL RODRIGUES, 594
sacado_bairro:      BOA VISTA
sacado_cep:         60.861-015
sacado_cidade:      FORTALEZA - CE
valor:              5.132,25
```

## ✅ Fluxo de Uso

1. **Usuário** acessa página "Boletos"
2. **Clica** em "Selecionar arquivos" ou arrasta arquivo OS
3. **Sistema** detecta automaticamente pelo padrão `OS_*.xls`
4. **Parser OS** extrai dados das células específicas
5. **Preview** mostra dados para confirmar
6. **Importação** cria boleto com dados validados

## 🔍 Validações

- ✓ Número de documento obrigatório
- ✓ Nome do sacado obrigatório
- ✓ Valor > 0
- ✓ Limpeza de caracteres não-numéricos (CIC, CEP)
- ✓ Formatação de data (DD/MM/AAAA)
- ✓ Extração de UF de cidade (ex: "FORTALEZA - CE" → "CE")

## 📝 Notas Técnicas

- Arquivo deve ser em formato `.xls` (antigo Excel)
- Nome **deve** seguir padrão `OS_*.xls`
- Nomes de coluna não precisam corresponder (usa células absolutas)
- Data de vencimento calculada como +30 dias da emissão (padrão)
- Avalista é preenchido com dados do perfil selecionado

## 🚀 Próximos Passos (Opcional)

- [ ] Adicionar opção de escolher período de vencimento
- [ ] Suporte para múltiplos boletos no mesmo arquivo
- [ ] Template/guia de estrutura do arquivo OS
- [ ] Validações adicionais de CEP/UF
