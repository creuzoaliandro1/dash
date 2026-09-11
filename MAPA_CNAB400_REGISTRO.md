# Mapa de campos — CNAB400 **Registro** (layout padrão BMP 274)

Fonte: `src/utils/boleto.js` → `generateCNAB400RemittanceFile` (funções `buildHeader`, `buildDetalhe1`, `buildDetalhe2`, `buildTrailer`).
Este é o layout usado em **Ações → CNAB400 → Registro / Alterar / Baixa**.

- Todas as linhas têm **400 posições**, terminadas por CRLF.
- Estrutura do arquivo: `0` (header) + para cada boleto `1`+`2` (detalhe) + `9` (trailer).
- Ao final, todos os pontos (`.`) do conteúdo são trocados por espaço (padrão BMP).
- Convenções: **Num** = numérico, zeros à esquerda; **Alfa** = texto em maiúsculas sem acento, espaços à direita.
- Origem dos dados: `CONTAS` = conta do perfil (cedente); `capt_boletos` = boleto.

---

## Registro tipo 0 — HEADER

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `0` |
| 02 | Código remessa | 2 | 2 | 1 | Num | Fixo `1` |
| 03 | Literal REMESSA | 3 | 9 | 7 | Alfa | Fixo `REMESSA` |
| 04 | Código do serviço | 10 | 11 | 2 | Num | Fixo `01` |
| 05 | Tipo de serviço | 12 | 26 | 15 | Alfa | Fixo `COBRANCA` |
| 06 | Código do cedente | 27 | 44 | 18 | Num | `1` + `CONTAS.cedente` (ou convenio/cpf_cnpj), zeros à esquerda |
| 07 | Código do banco | 45 | 46 | 2 | Num | Fixo `09` |
| 08 | Nome do cedente | 47 | 76 | 30 | Alfa | `CONTAS.nome_correntista` |
| 09 | Código do banco (BMP) | 77 | 79 | 3 | Num | Fixo `274` |
| 10 | Nome do banco | 80 | 94 | 15 | Alfa | Fixo `BMP MONEY PLUS` |
| 11 | Data de geração | 95 | 100 | 6 | Num | Data atual `DDMMAA` |
| 12 | Brancos | 101 | 108 | 8 | Alfa | Espaços |
| 13 | Identificação do sistema | 109 | 110 | 2 | Alfa | Fixo `MX` |
| 14 | Sequencial da remessa | 111 | 117 | 7 | Num | Nº da remessa (`nextSeq`), zeros à esquerda |
| 15 | Brancos | 118 | 394 | 277 | Alfa | Espaços |
| 16 | Sequencial do registro | 395 | 400 | 6 | Num | Fixo `000001` (header é a linha 1) |

---

## Registro tipo 1 — DETALHE (dados do boleto)

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `1` |
| 02 | Agência | 2 | 6 | 5 | Num | Fixo `00000` |
| 03 | Dígito da agência | 7 | 7 | 1 | Alfa | Espaço |
| 04 | Razão da conta | 8 | 19 | 12 | Num | Fixo `000000000000` |
| 05 | Brancos | 20 | 20 | 1 | Alfa | Espaço |
| 06 | Carteira + variação | 21 | 29 | 9 | Num | Fixo `000900001` (carteira 009) |
| 07 | Conta do cedente | 30 | 37 | 8 | Num | `CONTAS.conta` (com DV), zeros à esquerda |
| 08 | Número do título (Seu número) | 38 | 52 | 15 | Num | `capt_boletos.numero_documento` (ou nosso_numero) |
| 09 | Brancos | 53 | 62 | 10 | Alfa | Espaços |
| 10 | Zeros | 63 | 70 | 8 | Num | Fixo `00000000` |
| 11 | Nosso número | 71 | 81 | 11 | Num | `capt_boletos.nosso_numero` (base, 11 díg.) |
| 12 | DV do nosso número | 82 | 82 | 1 | Num | DV recalculado (algoritmo BMP274 `calcNNDV`) |
| 13 | Zeros | 83 | 92 | 10 | Num | Fixo `0000000000` |
| 14 | Tipo de impressão | 93 | 93 | 1 | Num | Fixo `2` (banco emite) |
| 15 | Identificação da emissão | 94 | 94 | 1 | Alfa | Fixo `N` |
| 16 | Brancos | 95 | 105 | 11 | Alfa | Espaços |
| 17 | Operação do banco | 106 | 106 | 1 | Num | Fixo `0` |
| 18 | Brancos | 107 | 108 | 2 | Alfa | Espaços |
| 19 | Código de ocorrência | 109 | 110 | 2 | Num | `01`=registro/entrada, `02`=baixa, `06`=alteração |
| 20 | Seu número | 111 | 120 | 10 | Alfa | Nº do título (10 primeiros) |
| 21 | Data de vencimento | 121 | 126 | 6 | Num | `capt_boletos.data_vencimento` `DDMMAA` |
| 22 | Valor do título | 127 | 139 | 13 | Num | `capt_boletos.valor` em centavos (2 dec.) |
| 23 | Carteira | 140 | 140 | 1 | Num | Fixo `0` |
| 24 | Identificação da operação | 141 | 150 | 10 | Alfa | Fixo `000000002N` |
| 25 | Data de emissão | 151 | 156 | 6 | Num | `capt_boletos.data_emissao` `DDMMAA` |
| 26 | Primeira instrução | 157 | 160 | 4 | Num | Fixo `0000` |
| 27 | Juros de mora / dia | 161 | 173 | 13 | Num | Valor × 0,2% ao dia, em centavos (2 dec.) |
| 28 | Zeros | 174 | 218 | 45 | Num | Fixo `0`×45 |
| 29 | Tipo de inscrição do sacado | 219 | 220 | 2 | Num | `01`=CPF, `02`=CNPJ (pelo `sacado_cic`) |
| 30 | CPF/CNPJ do sacado | 221 | 234 | 14 | Num | `capt_boletos.sacado_cic` |
| 31 | Nome do sacado | 235 | 274 | 40 | Alfa | `capt_boletos.sacado_nome` |
| 32 | Endereço do sacado | 275 | 314 | 40 | Alfa | `capt_boletos.sacado_endereco` |
| 33 | Brancos | 315 | 326 | 12 | Alfa | Espaços |
| 34 | CEP do sacado | 327 | 334 | 8 | Num | `capt_boletos.sacado_cep` |
| 35 | Tipo do avalista | 335 | 335 | 1 | Alfa | `1`=CPF, `2`=CNPJ, ` `=sem avalista |
| 36 | CPF/CNPJ do avalista | 336 | 350 | 15 | Alfa | `capt_boletos.avalista_cic` |
| 37 | Nome do avalista | 351 | 394 | 44 | Alfa | `capt_boletos.avalista_nome` |
| 38 | Sequencial do registro | 395 | 400 | 6 | Num | Nº sequencial da linha |

---

## Registro tipo 2 — DETALHE (mensagens / endereço complementar)

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `2` |
| 02 | Mensagem — protesto | 2 | 81 | 80 | Alfa | Fixo `BOLETO SUJEITO A PROTESTO E NEGATIVACAO...` |
| 03 | Mensagem 1 | 82 | 161 | 80 | Alfa | `capt_boletos.mensagem1` (ou `descricao`) |
| 04 | Brancos | 162 | 241 | 80 | Alfa | Espaços |
| 05 | Mensagem — garantia | 242 | 321 | 80 | Alfa | Fixo `O TITULO PODERA SER USADO COMO GARANTIA...` |
| 06 | Brancos | 322 | 327 | 6 | Alfa | Espaços |
| 07 | Bairro do sacado | 328 | 347 | 20 | Alfa | `capt_boletos.sacado_bairro` (alinhado à direita) |
| 08 | UF do sacado | 348 | 349 | 2 | Alfa | `capt_boletos.sacado_uf` |
| 09 | Cidade do sacado | 350 | 379 | 30 | Alfa | `capt_boletos.sacado_cidade` |
| 10 | Brancos | 380 | 394 | 15 | Alfa | Espaços |
| 11 | Sequencial do registro | 395 | 400 | 6 | Num | Nº sequencial da linha |

---

## Registro tipo 9 — TRAILER

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `9` |
| 02 | Brancos | 2 | 394 | 393 | Alfa | Espaços |
| 03 | Total de linhas | 395 | 400 | 6 | Num | Quantidade total de registros do arquivo |

---

### Observações
- **Nome do arquivo:** `CB[DD][MM][SSSSSSS].REM` (ex.: `CB09090000183.REM`).
- **Juros de mora** ficam na posição **161-173** neste layout (diferente do layout de Troca de Cedente).
- O sacado (pagador) vai **dentro do próprio registro tipo 1** (pos. 219-334) + bairro/UF/cidade no tipo 2 — **não há registro tipo 4**.
- DV do nosso número é sempre **recalculado** pelo `calcNNDV` (BMP274), independentemente do que estiver armazenado.
