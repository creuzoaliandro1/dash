# 🔍 Sistema de Detecção de Tipo OS (Type A vs Type B)

## 📋 Visão Geral

O sistema de importação de boletos agora suporta automaticamente **dois tipos diferentes de arquivos OS**:

- **Type A**: Formato original com células fixas (D13, K16, AU54)
- **Type B**: Formato novo com palavras-chave estruturadas (Ordem de Serviço, Cliente, etc)

---

## 🎯 Detecção Automática (detectOSFileType)

### Fluxo de Detecção

```
Arquivo OS recebido
    ↓
Abrir e analisar estrutura
    ↓
├─ Procurar Marcadores Type B:
│  ├─ "Ordem de Serviço" em L8 → +3 pontos (MUITO específico)
│  ├─ "Código:" em L13 → +2 pontos
│  ├─ "Cliente:" em L16 → +2 pontos
│  ├─ "Placa/Equip:" em L14 → +2 pontos
│  ├─ "Cnpj/Cpf:" em L17 → +2 pontos
│  └─ Múltiplos "BOLETO" encontrados → +1 por ocorrência
│
└─ Procurar Marcadores Type A:
   ├─ "Saldo A Receber" em coluna AJ → +3 pontos
   └─ "Data" em coluna X → +2 pontos

Decisão:
├─ Type B scores ≥ 5 → ParseOSTypeB
├─ Type A scores ≥ 3 → ParseOSFile
├─ Type B > Type A → ParseOSTypeB
└─ Ambíguo/Erro → Type A (fallback seguro)
```

### Marcadores Type B (Muito Específicos)

#### 1. "Ordem de Serviço" (L8)
```
Linha 8:  | B:Ordem de Serviço |
           ↓
         Marcador praticamente perfeito para Type B
         Pontuação: +3 (peso alto)
```

#### 2. Estrutura de Linhas 13-20
```
L13:  Código: | D:11024 | H:Resp.
L14:  Placa / Equip.: | G:PWA8C74
L16:  Cliente: | F:136 | H:TRANSPORTES PESADOS MINAS
L17:  Cnpj / Cpf: | F:17.215.039/0017-96
L19:  Endereço: | F:ROD CE 422 KM12, S/N
L20:  Bairro: | F:TABULEIRO | O:Cep:
```

Essa estrutura é **altamente específica e distinguível**.

#### 3. Múltiplos BOLETOs
```
L45:  BOLETO | T:data1 | AB:valor1
L46:  BOLETO | T:data2 | AB:valor2
L47:  BOLETO | T:data3 | AB:valor3
```

---

## ⚙️ Parsers Específicos

### ParseOSFile (Type A)
- Procura "Saldo A Receber" em coluna AJ para encontrar linha do valor
- Procura "Data" em coluna X para extrair vencimentos múltiplos
- Usa células fixas D13, K16, AU54, etc
- Detecta múltiplas datas na coluna X (linhas abaixo de "Data")

### ParseOSTypeB (Type B)
- Procura por linhas específicas (13, 14, 16, 17, 19, 20)
- Busca por keywords: "Código:", "Cliente:", "Placa/Equip:", etc
- Procura por "BOLETO" a partir da linha 40
- Extrai data e valor das linhas com "BOLETO"
- Cria parcelas automaticamente quando múltiplos BOLETOs encontrados

---

## 📊 Arquivos Analisados

### Type B Confirmados

#### 1. OS_11024_PWA8C74 - TRANSPORTES PESADOS
- ✓ "Ordem de Serviço" em L8
- ✓ "Código: 11024" em L13
- ✓ "Cliente: TRANSPORTES PESADOS MINAS" em L16
- ✓ Múltiplos BOLETOs em B64
- Vencimentos em coluna T
- Valores em coluna BB
- Saldo A Receber em BD88

#### 2. OS_11208_PEW9C20 - EXPRESSO TCM
- ✓ "Ordem de Serviço" em L8
- ✓ "Código: 11208" em L13
- ✓ "Cliente: EXPRESSO TCM LTDA" em L16
- ✓ Múltiplos BOLETOs em L45, L46, L47
- Vencimentos em coluna X
- Valores em coluna BG
- Saldo A Receber em BJ58

---

## 🔧 Melhorias Implementadas

### 1. Detecção Mais Robusta
✅ Procura "Ordem de Serviço" como marcador Type B primário (praticamente perfeito)
✅ Sistema de scoring com pesos diferentes para cada marcador
✅ Fallback automático para Type A se houver erro

### 2. Extração de Dados Estruturada
✅ Type B procura valores em linhas específicas (13, 14, 16, 17, 19, 20)
✅ Type A mantém busca por coluna (AJ para Saldo, X para Data)
✅ Ambos suportam múltiplas parcelas/vencimentos

### 3. Logging Detalhado
✅ Console mostra qual tipo foi detectado e por quê
✅ Mostra marcadores encontrados e suas pontuações
✅ Útil para debugging de arquivos novos

### 4. Tratamento de Erros
✅ Se detecção falhar, fallback seguro para Type A
✅ Se parseOSTypeB falhar, tenta parseOSFile como fallback
✅ Mensagens de erro claras indicando qual parser tentou

---

## 📝 Exemplo de Saída no Console

```javascript
[OS Detection] Analisando OS_11208_PEW9C20 - EXPRESSO TCM.xls, 100 linhas encontradas
[OS Detection] ✓ "Ordem de Serviço" encontrado na L8
[OS Detection] ✓ "Código:" encontrado na L13
[OS Detection] ✓ "Cliente:" encontrado na L16
[OS Detection] ✓ "Placa/Equip" encontrado na L14
[OS Detection] ✓ "Cnpj/Cpf" encontrado na L17
[OS Detection] ✓ "3" ocorrência(s) de "BOLETO" encontrada(s)
[OS Detection] Contagem: Type B=12, Type A=0
[OS Detection] ✓ Tipo B detectado (Score: 12)

[OS TypeB] Processando arquivo OS_11208_PEW9C20 - EXPRESSO TCM.xls
[OS TypeB] NUM_TITULO extraído de L13: 11208
[OS TypeB] EMISSAO encontrado em L7: 20/02/2026
[OS TypeB] SACADO_NOME (L16): EXPRESSO TCM LTDA
[OS TypeB] SACADO_CIC (L17): 01834475000146
[OS TypeB] SACADO_ENDERECO (L19): AVENIDA FRANCISCO SA, 610
[OS TypeB] SACADO_CIDADE: FORTALEZA, SACADO_UF: CE
[OS TypeB] DESCRICAO (L14): PEW9C20
[OS TypeB] BOLETO encontrado em L46
[OS TypeB] Data encontrada: 28/09/2026
[OS TypeB] Valor encontrado: 1000.00
[OS TypeB] Total de vencimentos encontrados: 3
[OS TypeB] Boleto com 3 parcelas criado
```

---

## ✅ Checklist de Arquivos Suportados

### Type A (Original)
- [x] Arquivos com "Saldo A Receber" em coluna AJ
- [x] Arquivos com "Data" em coluna X
- [x] Múltiplos vencimentos em coluna X
- [x] Valores em células fixas (AU54, etc)

### Type B (Novo)
- [x] Arquivos com "Ordem de Serviço" em L8
- [x] Arquivos com "Código:" em L13
- [x] Arquivos com "Cliente:" em L16
- [x] Arquivos com "Placa/Equip:" em L14
- [x] Arquivos com "Cnpj/Cpf:" em L17
- [x] Arquivos com "Endereço:" em L19
- [x] Arquivos com "Bairro:" em L20
- [x] Múltiplos BOLETOs (parcelas)
- [x] Vencimentos em colunas variadas
- [x] Valores em colunas variadas

---

## 🚀 Próximos Passos (Opcional)

1. **Suporte para Type C/D/E**: Se surgirem novos padrões de OS
2. **Validação de CIC**: Incluir CIC do sacado nas validações
3. **Detecção de Cidade/UF**: Extrair automaticamente da coluna Z ou similares
4. **Tratamento de Encoding**: Melhorar suporte para arquivos com encoding UTF-16

---

## 📞 Troubleshooting

### "Arquivo não reconhecido como Type B"
1. Verifique se tem "Ordem de Serviço" em L8
2. Verifique se tem "Código:" em L13
3. Procure por "BOLETO" nas linhas 40+
4. Verifique console para logs detalhados

### "Erro de leitura do arquivo"
1. Pode ser um encoding especial (UTF-16)
2. Tente converter para XLSX e reimportar
3. Verifique console para mensagem de erro específica

### "Valores zerados ou não encontrados"
1. Procure a coluna exata com os valores no arquivo
2. Verifique o formato dos valores (1000,00 vs 1000.00)
3. Consulte a análise ANALISE_OS_FILES.md para as colunas específicas
