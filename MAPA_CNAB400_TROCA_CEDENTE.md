# Mapa de campos — CNAB400 **Troca de Cedente** (layout BMP MoneyPlus)

Fonte: `src/utils/boleto.js` → `generateCNAB400TrocaCedenteFile` (funções `buildHeaderTroca`, `buildTrocaTipo1`, `buildTrocaTipo2`, `buildTrocaTipo4`, `buildTrocaTrailer`).
Layout conforme o manual "BMP Money Plus — remessa CNAB 400 para recebimento de boletos via troca de cedentes" (v1 – 01/2026). Usado em **Ações → CNAB400 → Troca de cedente**.

- Todas as linhas têm **400 posições**, terminadas por CRLF.
- Estrutura do arquivo: `0` (header) + para cada boleto `1`+`2`+`4` (detalhe) + `9` (trailer).
- Ao final, todos os pontos (`.`) do conteúdo são trocados por espaço (padrão BMP).
- Convenções: **Num** = numérico, zeros à esquerda; **Alfa** = texto em maiúsculas sem acento, espaços à direita.
- **Regra de negócio:** o **RECEBEDOR** (header) é SEMPRE a **CAPT CAPITAL** (independe do perfil logado). O **cedente ORIGINAL** (perfil logado) vai na identificação do beneficiário original (tipo 1, 021-037) e no Sacador (tipo 1, 335-394). O sacado (pagador) vem do boleto.

---

## Registro tipo 0 — HEADER (beneficiário recebedor = CAPT CAPITAL)

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `0` |
| 02 | Id. do tipo de arquivo | 2 | 2 | 1 | Num | Fixo `1` |
| 03 | Literal REMESSA | 3 | 9 | 7 | Alfa | Fixo `REMESSA` |
| 04 | Código do serviço | 10 | 11 | 2 | Num | Fixo `01` |
| 05 | Descrição do serviço | 12 | 26 | 15 | Alfa | Fixo `COBRANCA` |
| 06 | Conta do recebedor (SEM DV) | 27 | 46 | 20 | Num | `CONTAS.conta` da CAPT **sem o último dígito (DV)**, zeros à esquerda (ex.: `09536939`→`953693`) |
| 07 | Nome do beneficiário recebedor | 47 | 76 | 30 | Alfa | `CONTAS.nome_correntista` da CAPT CAPITAL |
| 08 | Código do banco | 77 | 79 | 3 | Num | Fixo `274` |
| 09 | Nome do banco | 80 | 94 | 15 | Alfa | Fixo `MONEYPLUS` |
| 10 | Data de geração | 95 | 100 | 6 | Num | Data atual `DDMMAA` |
| 11 | Brancos | 101 | 108 | 8 | Alfa | Espaços |
| 12 | Identificação do sistema | 109 | 110 | 2 | Alfa | Fixo `MX` |
| 13 | Brancos | 111 | 394 | 284 | Alfa | Espaços (este layout **não** tem nº de remessa no header) |
| 14 | Sequencial do registro | 395 | 400 | 6 | Num | Fixo `000001` (header é a linha 1) |

---

## Registro tipo 1 — DADOS DO BOLETO

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `1` |
| 02 | Brancos | 2 | 20 | 19 | Alfa | Espaços |
| 03 | Id. do beneficiário **original** | 21 | 37 | 17 | Num | `0` + carteira `009` + agência s/DV (5) + conta c/DV (8) do **cedente original** (perfil logado) |
| 04 | Nº de controle (Seu número) | 38 | 52 | 15 | Num | `capt_boletos.numero_documento` (ou nosso_numero) |
| 05 | Complemento do seu número | 53 | 62 | 10 | Alfa | Espaços |
| 06 | Banco do beneficiário original | 63 | 65 | 3 | Num | Fixo `274` |
| 07 | Tipo de multa | 66 | 66 | 1 | Num | Fixo `3` (isenta) |
| 08 | Valor/percentual da multa | 67 | 76 | 10 | Num | Fixo `0`×10 |
| 09 | Nosso número | 77 | 87 | 11 | Num | `capt_boletos.nosso_numero` (base, 11 díg.) |
| 10 | DV do nosso número | 88 | 88 | 1 | Num | DV pelo algoritmo BMP274 (`calcNNDV`) |
| 11 | Brancos | 89 | 108 | 20 | Alfa | Espaços |
| 12 | Código de ocorrência | 109 | 110 | 2 | Num | Fixo `01` (remessa) |
| 13 | Número do documento | 111 | 120 | 10 | Alfa | Nº do título (10 primeiros dígitos) |
| 14 | Data de vencimento | 121 | 126 | 6 | Num | `capt_boletos.data_vencimento` `DDMMAA` |
| 15 | Valor do título | 127 | 139 | 13 | Num | `capt_boletos.valor` em centavos (2 dec.) |
| 16 | Brancos | 140 | 147 | 8 | Alfa | Espaços |
| 17 | Espécie | 148 | 149 | 2 | Num | `capt_boletos.especie` (default `02`=DM) |
| 18 | Identificação | 150 | 150 | 1 | Alfa | Fixo `N` |
| 19 | Data de emissão | 151 | 156 | 6 | Num | `capt_boletos.data_emissao` `DDMMAA` |
| 20 | Juros diários por atraso | 157 | 169 | 13 | Num | Fixo `0`×13 |
| 21 | Brancos | 170 | 205 | 36 | Alfa | Espaços |
| 22 | Valor do abatimento | 206 | 218 | 13 | Num | Fixo `0`×13 |
| 23 | Brancos | 219 | 334 | 116 | Alfa | Espaços |
| 24 | Sacador/Avalista (**cedente original**) | 335 | 394 | 60 | Alfa | Tipo insc. (`1`/`2`) + CPF/CNPJ (14) + ` ` + nome do **cedente original** (perfil logado) |
| 25 | Sequencial do registro | 395 | 400 | 6 | Num | Nº sequencial da linha |

---

## Registro tipo 2 — MENSAGENS (até 4 linhas de 80)

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `2` |
| 02 | Mensagem 1 | 2 | 81 | 80 | Alfa | Texto (protesto + mensagem do boleto + garantia, reflowado) |
| 03 | Mensagem 2 | 82 | 161 | 80 | Alfa | Continuação |
| 04 | Mensagem 3 | 162 | 241 | 80 | Alfa | Continuação |
| 05 | Mensagem 4 | 242 | 321 | 80 | Alfa | Continuação |
| 06 | Brancos | 322 | 394 | 73 | Alfa | Espaços |
| 07 | Sequencial do registro | 395 | 400 | 6 | Num | Nº sequencial da linha |

> O texto das mensagens é montado como: `BOLETO SUJEITO A PROTESTO E NEGATIVACAO...` + `capt_boletos.mensagem1`/`descricao` + `O TITULO PODERA SER USADO COMO GARANTIA...`, distribuído nos 4 blocos de 80.

---

## Registro tipo 4 — DADOS DO PAGADOR (sacado)

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `4` |
| 02 | Tipo de inscrição do pagador | 2 | 3 | 2 | Num | `01`=CPF, `02`=CNPJ (pelo `sacado_cic`) |
| 03 | Nº de inscrição do pagador | 4 | 17 | 14 | Num | `capt_boletos.sacado_cic` |
| 04 | Nome do pagador | 18 | 57 | 40 | Alfa | `capt_boletos.sacado_nome` |
| 05 | Endereço do pagador | 58 | 97 | 40 | Alfa | `capt_boletos.sacado_endereco` |
| 06 | Nº do endereço | 98 | 103 | 6 | Alfa | Espaços |
| 07 | Bairro do pagador | 104 | 123 | 20 | Alfa | `capt_boletos.sacado_bairro` |
| 08 | Cidade do pagador | 124 | 153 | 30 | Alfa | `capt_boletos.sacado_cidade` |
| 09 | UF do pagador | 154 | 155 | 2 | Alfa | `capt_boletos.sacado_uf` |
| 10 | CEP do pagador | 156 | 163 | 8 | Num | `capt_boletos.sacado_cep` |
| 11 | E-mail do pagador | 164 | 263 | 100 | Alfa | Espaços |
| 12 | Telefone do pagador | 264 | 274 | 11 | Alfa | Espaços |
| 13 | Brancos | 275 | 394 | 120 | Alfa | Espaços |
| 14 | Sequencial do registro | 395 | 400 | 6 | Num | Nº sequencial da linha |

---

## Registro tipo 9 — TRAILER

| Nº | Nome | Início | Fim | Tam. | Tipo | Conteúdo |
|----|------|:------:|:---:|:----:|:----:|----------|
| 01 | Tipo de registro | 1 | 1 | 1 | Num | Fixo `9` |
| 02 | Brancos | 2 | 394 | 393 | Alfa | Espaços |
| 03 | Total de linhas | 395 | 400 | 6 | Num | Quantidade total de registros do arquivo |

---

### Diferenças em relação ao CNAB400 de Registro
- Estrutura por título é **1 + 2 + 4** (tem registro **tipo 4** de pagador); no Registro é **1 + 2** e o sacado fica embutido no tipo 1.
- **Header:** conta em **027-046** (20 pos, SEM DV) e nome do **recebedor = CAPT CAPITAL**; banco = `MONEYPLUS` (no Registro é `BMP MONEY PLUS`); **não há** nº de remessa no header.
- **Juros** ficam em **157-169** (no Registro, 161-173).
- **Nosso número** em **077-088** (no Registro, 071-082).
- O **cedente original** aparece em 021-037 e no Sacador (335-394); o **recebedor (CAPT)** só no header.
- **Nome do arquivo:** `<NOMECEDENTE>_DDMMAAAAHHMM.rem` (ex.: `CAPTCAPITALSA_091120261230.rem`).
