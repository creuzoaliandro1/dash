# Antecipação → gravação na base Firebird (OPECABWEB / OPEITEWEB / SACADOWEB)

Especificação completa do fluxo que o botão **Antecipar** dispara para alimentar a base **Firebird** (`Dados.gdb`) do ContaCapt. Use este documento como prompt/refererência no outro projeto que já tem acesso a essa base.

---

## 1. A API Firebird (REST)

- **Base URL:** `https://dash.contacapt.com.br/api/firebird`
- **Autenticação:** header `X-API-Key: capt_...` (chave write-capable gerada no servidor ContaCapt).
- **Timeout:** ~30 s no servidor (usar ~32 s no cliente).
- **Content-Type:** `application/json` nos métodos com corpo (POST/PUT).

### Endpoints
| Ação | Método + rota | Observações |
|---|---|---|
| Introspecção do schema | `GET /_tables` | Lista tabelas, colunas e PKs. Rode 1x para conferir. |
| Listar (filtro por igualdade) | `GET /:table?campo=valor&limit=&offset=` | `limit` máx **500**; paginar com `offset`. Só filtra por **igualdade**. |
| Buscar 1 linha pela PK | `GET /:table/:id` | |
| Criar | `POST /:table` | PK **obrigatória** no corpo. |
| Atualizar | `PUT /:table/:id` | Não envie a PK no corpo. |
| Remover | `DELETE /:table/:id` | Retorna 204 sem corpo. |

### Formato do `:id` (PK composta)
Valores da PK **na ordem**, unidos por `~`:
- `OPECABWEB` → `"{COD_CEDENTE}~{COD_BORDERO}"`  (ex.: `"6~1"`)
- `OPEITEWEB` → `"{COD_CEDENTE}~{COD_BORDERO}~{COD_TITULO}"`  (ex.: `"6~1~20781"`)
- `SACADOWEB` → `"{CIC_SACADO}"`

### Formato das respostas
- Listar: `{ "rows": [ {...}, ... ] }`
- Buscar 1: `{ "row": {...} }`
- Criar/Atualizar: a linha gravada.
- Remover: HTTP 204 (sem corpo).

### Semântica de status HTTP (importante para retry/fila)
- **2xx** → sucesso.
- **409** → (a) *lock* do `efactor-sync` → re-tentar algumas vezes (ex.: 3× com 1,5 s); ou (b) **PK duplicada** (mensagem contém "existe"/"duplicat") → tratar como **idempotente/sucesso** (já aplicado).
- **400/401/403/404** → erro de **negócio** → devolver ao usuário (NÃO re-tentar, NÃO usar fallback).
- **5xx / timeout / sem resposta** → Firebird **fora do ar** → enfileirar a escrita para reprocessar depois.

### PKs confirmadas (via `GET /_tables`, 2026-09)
- `OPECABWEB` PK = (COD_CEDENTE, COD_BORDERO)
- `OPEITEWEB` PK = (COD_CEDENTE, COD_BORDERO, COD_TITULO)
- `SACADOWEB` PK = (CIC_SACADO)

---

## 2. Alocação de códigos (autoritativa do Firebird)

Antes de gravar, ler o Firebird para alocar os próximos códigos:

- **COD_BORDERO** (global) = `max(OPECABWEB.COD_BORDERO) + 1`
- **COD_OPERACAO** (por cedente) = `max(OPECABWEB.COD_OPERACAO onde COD_CEDENTE = ced) + 1`
- **COD_TITULO** (sequência global) = `max(OPEITEWEB.COD_TITULO no último borderô) + 1`
  - Validado: o maior COD_TITULO global está sempre no último borderô, então basta `GET /OPEITEWEB?COD_BORDERO={maxBordero}&limit=500` e pegar o maior.

> Para COD_BORDERO/COD_OPERACAO: listar `OPECABWEB` inteira (paginando de 500 em 500) e calcular os máximos em memória.
> Se o Firebird estiver fora do ar **nesta etapa**, aborte a antecipação e peça para o usuário tentar de novo (não dá pra alocar código com segurança offline).

---

## 3. Sequência do "Antecipar"

Entrada: lista de boletos selecionados + a conta (`contaData.cod_cedente`). Ordem:

**Passo 1 — Alocar códigos** (seção 2). Define `proximoCodBordero`, `proximoCodOperacao` e `codTitulo` inicial.

**Passo 2 — SACADOWEB** (1 POST por boleto, *best-effort*; duplicata de CIC é OK/ignorada):
```
POST /SACADOWEB
{
  "CIC_SACADO":       soDigitos(sacado_cic).slice(0,14),   // PK
  "NOME_SACADO":      trunc(sacado_nome, 60),
  "CEP":              trunc(sacado_cep, 9),
  "NOME_LOGRADOURO":  trunc(sacado_endereco, 60),
  "BAIRRO":           trunc(sacado_bairro, 40),
  "LOCALIDADE":       trunc(sacado_cidade, 40),
  "UF":               trunc(sacado_uf, 2)
}
```
(Se `CIC_SACADO` vazio, pula o sacado.)

**Passo 3 — OPECABWEB** (cabeçalho do borderô, 1 POST):
```
POST /OPECABWEB           id = "{cod_cedente}~{proximoCodBordero}"
{
  "COD_CEDENTE":  cod_cedente,           // int  (PK)
  "COD_BORDERO":  proximoCodBordero,     // int  (PK)
  "COD_OPERACAO": proximoCodOperacao,    // int
  "DT_RECEPCAO":  hoje "YYYY-MM-DD",
  "HR_RECEPCAO":  agora "HH:mm:ss",
  "STATUS":       "R"                     // R = Recebido/aberto (permite retorno)
}
```

**Passo 4 — OPEITEWEB** (1 POST por boleto, COD_TITULO sequencial):
```
POST /OPEITEWEB           id = "{cod_cedente}~{proximoCodBordero}~{codTitulo}"
{
  "COD_CEDENTE":   cod_cedente,          // int (PK)
  "COD_BORDERO":   proximoCodBordero,    // int (PK)
  "COD_TITULO":    codTitulo,            // int (PK) — incrementa a cada boleto
  "TIPO":          "DUP",                // duplicata
  "DT_BORDERO":    hoje "YYYY-MM-DD",
  "VR_FACE":       parseFloat(valor),    // valor de face
  "DT_VENCIMENTO": data_vencimento,      // "YYYY-MM-DD" (ou null)
  "NUMERO":        numeroDoc,            // varchar(8) — ver regra abaixo
  "NOME_EMITENTE": trunc(sacado_nome, 60),   // sacado/pagador = emitente
  "CIC_EMITENTE":  soDigitos(sacado_cic).slice(0,14),
  "NOSSO_NUMERO":  nossoNumeroCompleto,  // varchar(30) — ver regra abaixo
  "NOME_AVALISTA": trunc(avalista_nome, 25),
  "CIC_AVALISTA":  soDigitos(avalista_cic).slice(0,14),
  "STATUS":        "R"
}
```
`codTitulo` incrementa +1 a cada boleto do lote.

**Passo 5 — (lado da app, fora do Firebird)** marca os boletos como enviados: `capt_boletos.status_efactor = 'Enviado'` (é do Supabase; não vai pro Firebird).

### Regras de derivação de campo
- **NOSSO_NUMERO** = prefixo fixo `"36877480"` (8 díg.) + `nosso_numero` preenchido à esquerda com zeros até 9 díg. → total 17, e cortado em 30 (`slice(0,30)`).
  Ex.: nosso_numero `12401` → `36877480` + `000012401` = `36877480000012401`.
- **NUMERO** (varchar 8): se `numero_documento` for só dígitos, remove zeros à esquerda; senão usa como está; pega os **últimos 8** caracteres; se vazio → `"0"`.
- **CIC_EMITENTE / CIC_AVALISTA / CIC_SACADO**: só dígitos, cortados em 14 (SACADOWEB usa o CIC como PK).
- **trunc(s, n)**: corta a string em `n` caracteres (tamanhos do Firebird: NOME_SACADO/NOME_LOGRADOURO/NOME_EMITENTE=60, BAIRRO/LOCALIDADE=40, NOME_AVALISTA=25, CEP=9, UF=2).
- **DT_RECEPCAO / DT_BORDERO** = data de hoje `YYYY-MM-DD`; **HR_RECEPCAO** = `HH:mm:ss`.
- **STATUS = 'R'** em OPECABWEB e OPEITEWEB (marca o borderô/título como recém-recebido; é o que habilita o "Retornar").
- **TIPO = 'DUP'** (duplicata).

### Resiliência (escrita)
Cada POST de OPECABWEB/OPEITEWEB passa por um "write-through":
1. tenta no Firebird;
2. **409 (duplicado)** → considera sucesso idempotente;
3. **409 (lock efactor-sync)** → re-tenta ~3× (1,5 s entre tentativas);
4. **fora do ar (5xx/timeout)** → **enfileira** (outbox) para um worker reprocessar; a antecipação retorna `enfileirados > 0`;
5. **erro de negócio (4xx)** → aborta e devolve o erro.
(SACADOWEB é best-effort: erro/duplicata é ignorado.)

### Retorno da função (sucesso)
```
{ codBordero, codOperacao, quantidadeBoletos, codTituloInicio, codTituloFim, gravados, enfileirados }
```

---

## 4. "Retornar" (desfazer a antecipação)

Regra: só retorna se o **cabeçalho** (OPECABWEB) do borderô estiver com `STATUS = 'R'`. Para cada boleto:
1. Monta a chave `NOSSO_NUMERO = "36877480" + nosso_numero.padStart(9,'0')`.
2. `GET /OPEITEWEB?NOSSO_NUMERO={chave}&limit=10`; filtra os do `COD_CEDENTE` correto.
3. Para cada título achado: `GET /OPECABWEB/{ced}~{COD_BORDERO}` → se `STATUS != 'R'`, **bloqueia** (não retorna). Senão `DELETE /OPEITEWEB/{ced}~{COD_BORDERO}~{COD_TITULO}`.
4. Se o borderô ficou **sem títulos** (`GET /OPEITEWEB?COD_CEDENTE=&COD_BORDERO=&limit=1` vazio) → `DELETE /OPECABWEB/{ced}~{COD_BORDERO}`.

Retorno: `{ retornados, bloqueados, naoEncontrados, bloqueadosTitulos }`.

---

## 5. Campos de entrada (boleto) usados
`sacado_nome, sacado_cic, sacado_cep, sacado_endereco, sacado_bairro, sacado_cidade, sacado_uf, nosso_numero, numero_documento, valor, data_vencimento, avalista_nome, avalista_cic` + `contaData.cod_cedente`.

## 6. Tabelas físicas no Firebird (allowlist)
`AVALISTA, CEDENTE, CTACORRENTE, NNOPEITE, OPECAB, OPEITE, OPEITEWEB, OPECABWEB, SACADO, SACADOWEB, OCORRENCIA, LANCACTA, DEBENTURE, MENSAGEM` (+ `_tables`).
As tabelas `*WEB` são o *staging* que o efactor-sync do ContaCapt consome; `OPECAB/OPEITE/SACADO` (sem WEB) são as efetivadas.
