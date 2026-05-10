# Guia de Importação de Boletos

## Visão Geral

O sistema de importação permite adicionar múltiplos boletos ao banco de dados através de arquivo em lote. Suportamos os seguintes formatos:

- **Planilhas**: Excel (.xlsx, .xls), CSV (.csv), TXT (.txt)
- **Documentos Fiscais**: NFe, NFSe, CTe, MDFe (em formato XML)

## Formatos Suportados

### 1. Excel (.xlsx ou .xls)

A planilha deve conter as seguintes colunas (case-insensitive):

```
NUM_TITULO | SACADO_NOME | EMISSAO | VENCIMENTO | VALOR | NOSSO_NUMERO | STATUS
DOC-001    | Empresa A   | 01/05/2026 | 15/05/2026 | 1500.00 | 123456 | pendente
```

**Colunas obrigatórias:**
- `NUM_TITULO` (ou `Documento`) - Identificador único do boleto
- `SACADO_NOME` (ou `Cliente`) - Nome da empresa/cliente
- `EMISSAO` (ou `Emissão`) - Data de emissão (formato: DD/MM/YYYY)
- `VENCIMENTO` (ou `Vencimento`) - Data de vencimento (formato: DD/MM/YYYY)
- `VALOR` (ou `Valor`) - Valor do boleto (número com até 2 casas decimais)

**Colunas opcionais:**
- `NOSSO_NUMERO` (ou `Nosso Número`) - Número do boleto no banco
- `STATUS` (ou `Status`) - Status do boleto (pendente, pago, atrasado, cancelado)

### 2. CSV (.csv)

Mesmo formato do Excel, separado por vírgulas:

```csv
NUM_TITULO,SACADO_NOME,EMISSAO,VENCIMENTO,VALOR,NOSSO_NUMERO,STATUS
DOC-001,Empresa A,01/05/2026,15/05/2026,1500.00,123456,pendente
DOC-002,Empresa B,02/05/2026,16/05/2026,2500.50,123457,pendente
```

### 3. TXT (.txt)

Formato de texto com pipe (|) como separador:

```
NUM_TITULO|SACADO_NOME|EMISSAO|VENCIMENTO|VALOR|NOSSO_NUMERO|STATUS
DOC-001|Empresa A|01/05/2026|15/05/2026|1500.00|123456|pendente
DOC-002|Empresa B|02/05/2026|16/05/2026|2500.50|123457|pendente
```

### 4. XML - Nota Fiscal Eletrônica (NFe)

O sistema detecta automaticamente o tipo de documento fiscal e extrai:
- Número da NF (como NUM_TITULO)
- Razão social do destinatário (SACADO_NOME)
- Valor total da NF (VALOR)
- Data de emissão (EMISSAO)
- Vencimento (padrão: 30 dias após emissão)

**Exemplo:**
```xml
<?xml version="1.0"?>
<NFe>
  <infNFe Id="NFe35210101234567000195550010000000011234567890">
    <ide>
      <nNF>1</nNF>
      <dhEmi>2026-05-01T10:00:00-03:00</dhEmi>
    </ide>
    <dest>
      <xNome>Empresa Destinatária Ltda</xNome>
    </dest>
    <total>
      <vNF>5000.00</vNF>
    </total>
  </infNFe>
</NFe>
```

### 5. XML - Nota Fiscal de Serviço (NFSe)

Extrai informações de nota fiscal de serviço eletrônica.

### 6. XML - Conhecimento de Transporte Eletrônico (CTe)

Extrai informações de documento de transporte.

### 7. XML - Manifesto de Documento Fiscal Eletrônico (MDFe)

Extrai informações de manifesto de documento fiscal.

## Como Usar

### Método 1: Clicar no Botão

1. Acesse a página **Boletos**
2. Na seção "Importar boletos em lote", clique no botão **"Selecionar arquivos"**
3. Escolha um ou mais arquivos nos formatos suportados
4. Clique em "Abrir"
5. O sistema processará os arquivos automaticamente

### Método 2: Drag and Drop

1. Acesse a página **Boletos**
2. Arraste um ou mais arquivos para a área de upload
3. Os arquivos serão processados automaticamente

## Resultado da Importação

Após a importação, você verá uma janela com:

- **Número total de boletos importados**
- **Detalhes por arquivo:**
  - Quantidade de boletos importados com sucesso
  - Quantidade de erros por arquivo
  - Mensagem de erro (se houver)

## Validações

O sistema realiza as seguintes validações:

1. **Formato de arquivo**: Apenas arquivos com extensão válida são aceitos
2. **Estrutura de dados**: 
   - Verifica se as colunas obrigatórias existem
   - Tenta mapear automaticamente variações de nomes (com/sem acentos)
3. **Valores numéricos**: 
   - VALOR deve ser conversível para número decimal
4. **Datas**: 
   - Devem estar em formato DD/MM/YYYY
5. **Duplicação**: 
   - Boletos com mesmo NUM_TITULO sobrescrevem registros anteriores

## Tratamento de Erros

| Erro | Causa | Solução |
|------|-------|---------|
| "Formato de arquivo não suportado" | Extensão do arquivo não reconhecida | Use um dos formatos suportados |
| "Campo obrigatório ausente" | Planilha sem coluna necessária | Adicione as colunas obrigatórias |
| "Valor inválido para número" | VALOR não é um número válido | Verifique formatação do valor |
| "Data inválida" | Data não está em DD/MM/YYYY | Corrija o formato da data |

## Exemplos de Arquivos

### Arquivo CSV Exemplo

Veja `exemplo_boletos.csv` na raiz do projeto.

### Criar um Excel

1. Crie uma nova planilha com as seguintes colunas:
   - Coluna A: `NUM_TITULO`
   - Coluna B: `SACADO_NOME`
   - Coluna C: `EMISSAO`
   - Coluna D: `VENCIMENTO`
   - Coluna E: `VALOR`
   - Coluna F: `NOSSO_NUMERO`
   - Coluna G: `STATUS`

2. Preencha com seus dados

3. Salve como `.xlsx` ou `.xls`

4. Importe via interface

## Limites

- **Tamanho máximo por arquivo**: 5 MB (recomendado)
- **Número máximo de boletos por arquivo**: Sem limite definido
- **Número máximo de arquivos simultâneos**: Sem limite definido

## Integração com Banco de Dados

Os boletos importados são salvos na tabela `BOLETOS` com os seguintes campos:

- `ID` (UUID, gerado automaticamente)
- `CONTA_ID` (ID da conta do usuário logado)
- `NUM_TITULO` - Identificador do título
- `SACADO_NOME` - Nome do cliente
- `EMISSAO` - Data de emissão
- `VENCIMENTO` - Data de vencimento
- `VALOR` - Valor do título
- `NOSSO_NUMERO` - Número interno do banco
- `STATUS` - Status do título (pendente, pago, atrasado, cancelado)
- `CREATED_AT` - Data/hora de criação (automática)
- `UPDATED_AT` - Data/hora da última atualização (automática)

## Troubleshooting

### Boletos não aparecem após importação

1. Verifique se a página foi atualizada
2. Veja se houve erro na janela de resultado
3. Verifique se está logado com a conta correta
4. Consulte os logs do navegador (F12 > Console)

### Alguns boletos não foram importados

Verifique a janela de resultado para ver qual arquivo teve erro. Corrija os dados e importe novamente.

### Arquivo não está sendo aceito

Verifique:
1. Se a extensão está correta (.xlsx, .xls, .csv, .txt, .xml)
2. Se o arquivo não está corrompido
3. Se o tamanho do arquivo é menor que 5 MB

## Suporte

Para reportar problemas ou sugerir melhorias no sistema de importação, entre em contato com o suporte técnico.
