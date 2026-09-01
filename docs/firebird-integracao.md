# Integração com a API Firebird do ContaCapt

Base URL: `https://dash.contacapt.com.br/api/firebird` · Auth: header `X-API-Key`.

A chave é **write-capable** e NÃO pode ficar no bundle do front (é uma SPA Vite —
todo `VITE_*` vira público). Por isso o app fala com o Firebird **só através da
Edge Function `firebird-proxy`**, que guarda a chave como *secret*.

## Componentes criados

| Arquivo | Papel |
|---|---|
| `supabase/functions/firebird-proxy/index.ts` | Proxy: guarda a `X-API-Key`, repassa CRUD, devolve envelope `{ok,status,data,firebirdDown}` |
| `supabase/functions/firebird-outbox-worker/index.ts` | Reprocessa a fila `firebird_outbox` |
| `database/firebird_outbox.sql` | Tabela-fila para escritas feitas com o Firebird fora do ar |
| `src/config/firebird.js` | Flag `VITE_FIREBIRD_ENABLED` (default OFF) + lista de tabelas |
| `src/services/firebirdMappings.js` | Nomes de coluna / PK por tabela (**a conferir contra `_tables`**) |
| `src/services/firebirdApi.js` | Cliente do front (chama o proxy) |
| `src/services/firebirdRepo.js` | `readThrough` (leitura c/ fallback) e `writeThrough` (escrita c/ fila) |

## Política de roteamento

- **Leitura**: tenta Firebird; em qualquer falha, cai para o Supabase (nunca regride).
- **Escrita**: tenta Firebird; em `409` (lock do efactor-sync) retransmite; se o
  Firebird estiver fora, **enfileira** em `firebird_outbox` para reprocessar.
- Erro de negócio (`400/401/403/404`) é devolvido — não vira fallback nem fila.
- Tudo passa pela flag `firebirdConfig.enabled`. Desligada = 100% Supabase (comportamento atual).

## Passos de deploy

1. **Girar a chave exposta.** A chave `capt_...` compartilhada no chat deve ser
   **revogada** e uma nova gerada (`npm run create:apikey ...` no servidor ContaCapt).
2. **Secrets** (nunca no repo):
   ```
   supabase secrets set FIREBIRD_API_KEY="capt_...nova..."
   supabase secrets set FIREBIRD_API_URL="https://dash.contacapt.com.br/api/firebird"
   ```
3. **Deploy das functions**:
   ```
   supabase functions deploy firebird-proxy
   supabase functions deploy firebird-outbox-worker   # p/ agendar: verify_jwt=false ou chamar com service key
   ```
4. **Fila**: rodar `database/firebird_outbox.sql` (SQL editor / migration).
5. **Verificar o schema real** (ver abaixo) e ajustar `firebirdMappings.js`.
6. Só então: `VITE_FIREBIRD_ENABLED=true` no `.env` do front e rebuild/redeploy.

## Probe (JÁ EXECUTADO — resultados na seção de testes)

Não consegui validar o schema real do Firebird (a API não estava alcançável).
Antes de `VITE_FIREBIRD_ENABLED=true`, rode no ambiente onde a API responde e me
mande o resultado — daí eu finalizo a escrita (antecipação) e as leituras:

```
# 1) Colunas, tipos e CHAVE PRIMÁRIA de cada tabela:
curl -H "X-API-Key: $CHAVE" "https://dash.contacapt.com.br/api/firebird/_tables"

# 2) Uma linha real de cada _WEB, p/ ver o formato do _id e as colunas:
curl -H "X-API-Key: $CHAVE" "https://dash.contacapt.com.br/api/firebird/OPECABWEB?limit=1"
curl -H "X-API-Key: $CHAVE" "https://dash.contacapt.com.br/api/firebird/OPEITEWEB?limit=1"
curl -H "X-API-Key: $CHAVE" "https://dash.contacapt.com.br/api/firebird/SACADOWEB?limit=1"
curl -H "X-API-Key: $CHAVE" "https://dash.contacapt.com.br/api/firebird/CEDENTE?limit=1"
curl -H "X-API-Key: $CHAVE" "https://dash.contacapt.com.br/api/firebird/SACADO?limit=1"
```

Duas perguntas que o probe precisa responder para a **antecipação (escrita)**:
1. Qual a **PK real** de `OPECABWEB` / `OPEITEWEB` / `SACADOWEB` (e o formato do `_id`)?
2. No `POST`, o Firebird **gera** `COD_BORDERO`/`COD_TITULO` (generator/sequence) ou o
   cliente precisa informar? Se o cliente informa, **como obter o próximo valor** —
   a API não tem `ORDER BY` e `OPEITEWEB` tem >500 linhas (o `?limit=500` não varre tudo).
   Isso decide como alocar os códigos sem colidir.

## Limitações da API de leitura (importante)

Filtra só por **igualdade** e `limit` máx. **500**, sem ordenação. Por isso só
migramos *point-lookups* (1 linha por chave). Varreduras grandes e buscas com
`.in([...])`/`.range()` (ex.: `SACADO` com 86 mil linhas, reconciliações) **ficam
no Supabase** — migrar exigiria endpoints novos na API (paginação por cursor,
filtro `IN`, ordenação).

## Estado atual

- ✅ Fundação (proxy, cliente, repo, fila, worker, config, mapeamento).
- ✅ Schema real validado via `_tables` (PKs confirmadas, colunas das _WEB).
- ✅ Antecipação (escrita) implementada em `src/services/firebirdAntecipacao.js`
  (`criarAntecipacaoFirebird` / `retornarAntecipacaoFirebird`); `boletoService`
  faz branch pela flag.
- ✅ Leitura de referência: endereço do SACADO na duplicata (`BoletoTable.jsx`).
- ⏳ Demais leituras em massa: seguem no Supabase (limitação da API — ver acima).

## Resultado dos testes (validado em produção, 2026-09-01)

Testado chamando a API Firebird de dentro do Postgres do Supabase (extensão `http`),
já que a rede da sessão de dev estava bloqueada:

- CRUD ponta-a-ponta OK: `POST`→201, `GET/:id`→200 `{row:{…,_id}}`, `DELETE`→204, `GET` após delete→404.
- PKs confirmadas: OPECABWEB (COD_CEDENTE,COD_BORDERO), OPEITEWEB (COD_CEDENTE,COD_BORDERO,COD_TITULO), SACADOWEB (CIC_SACADO); `_id` no formato `a~b~c`.
- Escrita real das 3 tabelas da antecipação testada com um borderô descartável (999999) e removida em seguida — payload aceito e persistido corretamente.
- Alocação de códigos validada: `COD_BORDERO` = max(OPECABWEB)+1; `COD_TITULO` = max(OPEITEWEB do último borderô)+1 (confirmado que o maior título global está sempre no último borderô); `COD_OPERACAO` = max por cedente +1.

Para ligar em produção: girar a chave exposta, setar os secrets, deploy das
functions, rodar o SQL da fila e então `VITE_FIREBIRD_ENABLED=true`.
