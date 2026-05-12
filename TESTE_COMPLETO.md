# 🧪 Teste Completo do Sistema CNAB400

**Data:** 11/05/2026  
**Ambiente:** Vite (localhost:5173) + Express (localhost:3001)

---

## ✅ Checklist de Verificação Pré-Teste

### 1️⃣ Backend está correto?

```bash
# Na pasta C:\Projetos\Capt\backend\services\
# Verificar se extrairNumeroConta usa substring(23, 30):

grep -A 5 "export function extrairNumeroConta" boletoImportService.js
# Deve mostrar: return linhaDigitavel.substring(23, 30);
```

### 2️⃣ Banco de dados está preparado?

No **Supabase SQL Editor**, execute:

```sql
-- 1. Verificar se tabelas existem
\dt "CAPT_*"
-- Resultado: CAPT_BOLETOS, CAPT_IMPORTACOES, CAPT_LOGS_PROCESSAMENTO

-- 2. Verificar se conta existe
SELECT COUNT(*) FROM "CONTAS" WHERE "conta" ILIKE '09538%';
-- Resultado: > 0 (deve ter pelo menos 1 conta)

-- 3. Limpar dados de teste anteriores (OPCIONAL)
-- DELETE FROM "CAPT_BOLETOS";
-- DELETE FROM "CAPT_IMPORTACOES";
-- DELETE FROM "CAPT_LOGS_PROCESSAMENTO";
```

### 3️⃣ Servidor backend está rodando?

```bash
# Terminal (na pasta C:\Projetos\Capt\backend):
npm start

# Esperado:
# 🚀 Servidor CAPT Iniciado
# http://localhost:3001
```

### 4️⃣ Frontend está rodando?

```bash
# Terminal (na pasta C:\Projetos\Capt):
npm run dev
# ou
npm start

# Acesse: http://localhost:5173
```

---

## 🧪 Teste 1: API Health Check (30 segundos)

**Verificar se API está respondendo:**

```bash
curl http://localhost:3001/health
```

**Resultado esperado:**
```json
{
  "status": "OK",
  "timestamp": "2026-05-11T14:30:00.000Z"
}
```

---

## 🧪 Teste 2: Importar Um Boleto (1 minuto)

**Testar extração de 7 dígitos:**

```bash
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor do título": "500,00",
    "Data de vencimento": "2026-08-31",
    "Data de pagamento": "2026-08-14",
    "Status do boleto": "pago"
  }'
```

**No terminal do backend, procure por:**
```
[DEBUG] Extraído numero da conta: "0953880" (7 dígitos)
```

**Resultado esperado da API:**
```json
{
  "status": "sucesso",
  "message": "Boleto inserido com sucesso",
  "id": "uuid-aqui",
  "operacao": "INSERT",
  "timestamp": "2026-05-11T14:30:00.000Z"
}
```

**Se erro: "Conta não encontrada"**
→ Execute `INSERT_CONTAS.sql` (veja seção abaixo)

---

## 🧪 Teste 3: Importar Arquivo Completo (5-10 minutos)

### Via cURL:
```bash
cd C:\Users\creuz\Downloads  # Ou pasta onde está o arquivo

curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx"
```

### Via Frontend (Recomendado):
1. Abra http://localhost:5173/
2. Vá para a página **"Importar Boletos"**
3. Selecione o arquivo Excel
4. Clique em **"Importar"**
5. Aguarde 5-10 segundos

**Resultado esperado:**
```json
{
  "mensagem": "Importação concluída com sucesso",
  "resumo": {
    "total": 1113,
    "inseridos": 1113,
    "atualizados": 0,
    "nao_alterados": 0,
    "com_erro": 0,
    "taxa_sucesso": "100.00%"
  },
  "importacao_id": "uuid-aqui",
  "erros": []
}
```

---

## 🧪 Teste 4: Verificar Dados no Banco (2 minutos)

No **Supabase SQL Editor**, execute:

```sql
-- 1. Contar boletos importados
SELECT COUNT(*) as total_boletos FROM "CAPT_BOLETOS";
-- Resultado: 1113

-- 2. Ver histórico de importações
SELECT "id", "arquivo_nome", "status", "criado_em", "registros_inseridos"
FROM "CAPT_IMPORTACOES"
ORDER BY "criado_em" DESC
LIMIT 5;

-- 3. Verificar um boleto específico
SELECT "codigo_barras", "valor_titulo", "status", "criado_em"
FROM "CAPT_BOLETOS"
WHERE "codigo_barras" = '27490001019000000005083095388001315380000178900'
LIMIT 1;

-- 4. Estatísticas
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN "status" = 'pago' THEN 1 END) as pago,
  COUNT(CASE WHEN "status" = 'pendente' THEN 1 END) as pendente,
  SUM("valor_titulo") as valor_total
FROM "CAPT_BOLETOS";
```

---

## 🧪 Teste 5: Testar Endpoints de Consulta (2 minutos)

### Lista de Boletos:
```bash
curl "http://localhost:3001/api/capt-boletos?page=1&limit=5"
```

**Resultado esperado:**
```json
{
  "data": [
    {
      "id": "uuid",
      "codigo_barras": "27490001019...",
      "valor_titulo": 500.00,
      "status": "pago",
      "criado_em": "2026-05-11T14:30:00.000Z"
    }
  ],
  "paginacao": {
    "total": 1113,
    "pagina": 1,
    "limit": 5,
    "total_paginas": 223
  }
}
```

### Estatísticas:
```bash
curl "http://localhost:3001/api/capt-boletos-stats"
```

**Resultado esperado:**
```json
{
  "total": 1113,
  "pendente": 50,
  "pago": 1000,
  "atrasado": 50,
  "cancelado": 13,
  "valor_total_titulo": 1234567.89,
  "valor_total_pago": 1200000.00,
  "valor_total_pendente": 34567.89
}
```

### Histórico de Importações:
```bash
curl "http://localhost:3001/api/capt-importacoes"
```

### Logs de Uma Importação:
```bash
# Pegue o import_id da resposta anterior
curl "http://localhost:3001/api/capt-logs-importacao/[import_id]?limit=10"
```

---

## 🆘 Se Tiver Erro: "Conta não encontrada"

### Passo 1: Verificar contas
```sql
SELECT "id", "conta" FROM "CONTAS" LIMIT 10;
```

### Passo 2: Se faltam contas, inserir
```sql
INSERT INTO "CONTAS" (
  "conta",
  "usuario_id",
  "banco_codigo",
  "nome_titular",
  "documento_titular"
)
VALUES (
  '09538802',
  'seu-user-id-uuid',  -- ← Copiar de Authentication → Users
  '274',
  'RETIFICA VOLANTE',
  '59849652000148'
)
ON CONFLICT ("conta") DO NOTHING;
```

### Passo 3: Testar novamente
```bash
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d '{"Linha digitável": "27490001019000000005083095388001315380000178900"}'
```

---

## 📊 Teste 6: Teste de Reimportação (Idempotência)

**Importar o mesmo arquivo 2 vezes:**

```bash
# 1ª vez:
curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@seu_arquivo.xlsx"
# Esperado: 1113 INSERT, 0 UPDATE

# 2ª vez (mesmo arquivo):
curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@seu_arquivo.xlsx"
# Esperado: 0 INSERT, 1113 UPDATE (sem mudanças detectadas) ou NOOP
```

**Resultado esperado (2ª importação):**
```json
{
  "resumo": {
    "total": 1113,
    "inseridos": 0,
    "atualizados": 0,
    "nao_alterados": 1113,  ← Nenhuma mudança
    "com_erro": 0,
    "taxa_sucesso": "100.00%"
  }
}
```

---

## 🎯 Checklist Final

- [ ] **Backend rodando** em localhost:3001
- [ ] **Frontend rodando** em localhost:5173
- [ ] **Health check** retorna OK
- [ ] **Teste 1 boleto** funciona (7 dígitos extraídos)
- [ ] **Arquivo importado** com sucesso
- [ ] **Dados no banco** confirmados
- [ ] **Endpoints consultam** dados corretamente
- [ ] **Reimportação** não duplica registros

---

## 📈 Resultados Esperados

### Após primeira importação:
```
✅ 1.113 boletos inseridos
✅ 0 atualizações (primeira vez)
✅ 0 erros
✅ Taxa sucesso: 100%
```

### Estrutura de dados:
```
CAPT_BOLETOS: 1.113 registros
CAPT_IMPORTACOES: 1 registro (1 importação)
CAPT_LOGS_PROCESSAMENTO: 1.113 registros (log de cada boleto)
```

---

## 🚀 Próximo Passo

Se todos os testes passarem:
1. ✅ Sistema está pronto para produção
2. ✅ Você pode reimportar arquivos quando necessário
3. ✅ Os dados estarão sempre atualizados

**Tempo total de testes: ~20 minutos**

---

## 📞 Troubleshooting Rápido

| Erro | Solução |
|------|---------|
| "Connection refused" em 3001 | `npm start` no backend |
| "Conta não encontrada" | Executar INSERT_CONTAS.sql |
| "Table not found" | Executar migration SQL |
| "Extraindo 095388" (6 dígitos) | Verify substring(23, 30) |
| "CORS error" | Verificar CORS no server.js |

---

**Pronto para testar? Comece pelo Teste 1!** ✅

