# 📡 API Endpoints - Guia Rápido (Atualizado)

**Data:** 11/05/2026

---

## 🚀 Endpoints CNAB400

### 1️⃣ POST `/api/importar-boletos`

**Importa arquivo Excel com múltiplos boletos**

#### Request (multipart/form-data)
```bash
curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@Relatorio_Gestao_Boletos.xlsx"
```

#### Response (201 Success)
```json
{
  "mensagem": "Importação concluída com sucesso",
  "resumo": {
    "total": 1113,
    "inseridos": 1000,
    "atualizados": 50,
    "nao_alterados": 63,
    "com_erro": 0,
    "taxa_sucesso": "100.00%"
  },
  "importacao_id": "550e8400-e29b-41d4-a716-446655440000",
  "erros": []
}
```

#### Response (400 Error)
```json
{
  "erro": "Arquivo não fornecido"
}
```

**Status Codes:**
- `200` - Importação concluída (com sucesso ou parcial)
- `400` - Arquivo inválido ou vazio
- `500` - Erro no servidor

---

### 2️⃣ POST `/api/importar-boleto-individual`

**Importa um único boleto para teste**

#### Request (application/json)
```bash
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor do título": "500,00",
    "Data de pagamento": "14/08/2026",
    "Status do boleto": "pago"
  }'
```

#### Response (201 Success - INSERT)
```json
{
  "status": "sucesso",
  "message": "Boleto inserido com sucesso",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "operacao": "INSERT",
  "timestamp": "2026-05-11T14:30:00Z"
}
```

#### Response (201 Success - UPDATE)
```json
{
  "status": "sucesso",
  "message": "Boleto atualizado com mudanças detectadas",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "operacao": "UPDATE",
  "timestamp": "2026-05-11T14:30:00Z"
}
```

#### Response (200 No Change)
```json
{
  "status": "sem-mudanca",
  "message": "Boleto já existe e não há mudanças",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "operacao": "NOOP",
  "timestamp": "2026-05-11T14:30:00Z"
}
```

#### Response (400 Error)
```json
{
  "status": "erro",
  "message": "Conta 095388 não encontrada no banco de dados",
  "codigo_barras": "27490001019000000005083095388001315380000178900"
}
```

---

### 3️⃣ GET `/api/capt-boletos`

**Lista todos os boletos importados com paginação**

#### Request
```bash
curl "http://localhost:3001/api/capt-boletos?page=1&limit=50&status=pendente"
```

#### Query Parameters
| Param | Type | Default | Descrição |
|-------|------|---------|-----------|
| `page` | int | 1 | Página (começando em 1) |
| `limit` | int | 50 | Registros por página |
| `status` | string | (vazio) | Filtrar por status: pendente, pago, atrasado, cancelado |

#### Response (200 Success)
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "codigo_barras": "27490001019000000005083095388001315380000178900",
      "numero_conta_id": 1,
      "valor_titulo": 500.00,
      "valor_pagamento": 500.00,
      "data_vencimento": "2026-08-14",
      "data_pagamento": "2026-08-14",
      "status": "pago",
      "criado_em": "2026-05-11T10:00:00Z",
      "atualizado_em": "2026-05-11T10:00:00Z"
    }
  ],
  "paginacao": {
    "total": 1113,
    "pagina": 1,
    "limit": 50,
    "total_paginas": 23
  }
}
```

#### Query Examples
```bash
# Todos os boletos, primeira página
curl "http://localhost:3001/api/capt-boletos"

# Apenas boletos pendentes
curl "http://localhost:3001/api/capt-boletos?status=pendente"

# Página 3 com 100 registros por página
curl "http://localhost:3001/api/capt-boletos?page=3&limit=100"

# Boletos pagos na página 2
curl "http://localhost:3001/api/capt-boletos?page=2&status=pago"
```

---

### 4️⃣ GET `/api/capt-boletos-stats`

**Estatísticas resumidas de todos os boletos**

#### Request
```bash
curl "http://localhost:3001/api/capt-boletos-stats"
```

#### Response (200 Success)
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

---

### 5️⃣ GET `/api/capt-importacoes`

**Histórico de importações realizadas**

#### Request
```bash
curl "http://localhost:3001/api/capt-importacoes"
```

#### Response (200 Success)
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "arquivo_nome": "arquivo_importacao.xlsx",
    "total_registros": 1113,
    "registros_inseridos": 1000,
    "registros_atualizados": 50,
    "registros_erro": 0,
    "status": "sucesso",
    "criado_em": "2026-05-11T10:00:00Z",
    "finalizado_em": "2026-05-11T10:05:30Z"
  },
  {
    "id": "660f9511-f30c-52e5-b827-557766551111",
    "arquivo_nome": "arquivo_importacao.xlsx",
    "total_registros": 1113,
    "registros_inseridos": 50,
    "registros_atualizados": 1050,
    "registros_erro": 13,
    "status": "parcial",
    "criado_em": "2026-05-10T14:00:00Z",
    "finalizado_em": "2026-05-10T14:03:15Z"
  }
]
```

---

### 6️⃣ GET `/api/capt-logs-importacao/:importacaoId`

**Logs detalhados de uma importação específica**

#### Request
```bash
curl "http://localhost:3001/api/capt-logs-importacao/550e8400-e29b-41d4-a716-446655440000"
```

#### Path Parameters
| Param | Descrição |
|-------|-----------|
| `importacaoId` | UUID da importação (retornado em /api/importar-boletos) |

#### Response (200 Success)
```json
[
  {
    "id": "770g0622-g41d-63f6-c938-668877662222",
    "importacao_id": "550e8400-e29b-41d4-a716-446655440000",
    "numero_linha": 2,
    "codigo_barras": "27490001019000000005083095388001315380000178900",
    "tipo_operacao": "INSERT",
    "mensagem": "Boleto inserido com sucesso",
    "detalhes": {
      "status": "sucesso",
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    },
    "criado_em": "2026-05-11T10:00:15Z"
  },
  {
    "id": "880h1733-h52e-74g7-d049-779988773333",
    "importacao_id": "550e8400-e29b-41d4-a716-446655440000",
    "numero_linha": 3,
    "codigo_barras": "27490001019000000005083095389001315380000178901",
    "tipo_operacao": "NOOP",
    "mensagem": "Boleto já existe e não há mudanças",
    "detalhes": {
      "status": "sem-mudanca",
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
    },
    "criado_em": "2026-05-11T10:00:20Z"
  },
  {
    "id": "990i2844-i63f-85h8-e150-880099884444",
    "importacao_id": "550e8400-e29b-41d4-a716-446655440000",
    "numero_linha": 4,
    "codigo_barras": "27490001019000000005083095390001315380000178902",
    "tipo_operacao": "ERRO",
    "mensagem": "Conta 095390 não encontrada no banco de dados",
    "detalhes": {
      "status": "erro"
    },
    "criado_em": "2026-05-11T10:00:25Z"
  }
]
```

#### Campos detalhes por tipo_operacao
| tipo_operacao | Significado |
|---|---|
| `INSERT` | Novo boleto inserido |
| `UPDATE` | Boleto atualizado (mudanças em valor_pagamento, data_pagamento ou status) |
| `NOOP` | No Operation - boleto já existe, sem mudanças |
| `ERRO` | Erro ao processar (conta não encontrada, dados inválidos, etc) |

---

## 📝 Exemplos Práticos

### Cenário 1: Importar arquivo completo
```bash
# 1. Upload do arquivo
IMPORT_ID=$(curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@boletos.xlsx" | jq -r '.importacao_id')

echo "Importação: $IMPORT_ID"

# 2. Ver estatísticas gerais
curl "http://localhost:3001/api/capt-boletos-stats"

# 3. Ver logs da importação específica
curl "http://localhost:3001/api/capt-logs-importacao/$IMPORT_ID" | jq '.[0:5]'
```

### Cenário 2: Listar boletos pendentes
```bash
# Página 1
curl "http://localhost:3001/api/capt-boletos?status=pendente&limit=20"

# Página 2
curl "http://localhost:3001/api/capt-boletos?status=pendente&limit=20&page=2"
```

### Cenário 3: Testar um boleto antes de importar arquivo
```bash
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor do título": "1000,00",
    "Data de vencimento": "2026-08-31",
    "Status do boleto": "pendente"
  }' | jq '.'
```

### Cenário 4: Verificar histórico e erros
```bash
# Últimas importações
curl "http://localhost:3001/api/capt-importacoes" | jq '.[] | {id, arquivo_nome, status, registros_erro}'

# Filtrar apenas as com erro
curl "http://localhost:3001/api/capt-importacoes" | jq '.[] | select(.status != "sucesso")'
```

---

## 🔧 Troubleshooting

### Erro: "Conta não encontrada"
```bash
# Verificar se conta existe
psql -U postgres -h localhost -d seu_db -c \
  'SELECT "id", "conta" FROM "CONTAS" WHERE "conta" LIKE "095388%"'
  
# Se vazio, inserir:
# Veja INSERT_CONTAS.sql
```

### Erro: "column usuario_id does not exist"
- Significa código antigo ainda em uso
- Copie novamente `boletoImportService.js` e `server.js` atualizados

### Timeout em importação grande
- Aumentar timeout no client (axios, fetch)
- Usar arquivo em chunks se tiver mais de 5000 linhas
- Verificar `npm logs` no servidor para detalhes

### Dados incorretos após reimportar
- Sistema detecta duplicatas por `codigo_barras`
- Para forçar re-import, deletar boleto anterior:
  ```sql
  DELETE FROM "CAPT_BOLETOS" WHERE "codigo_barras" = 'XXXX...';
  ```

---

## 🔐 Segurança (Recomendações Futuras)

Adicionar autenticação JWT:
```javascript
// Futura validação
const token = req.headers.authorization?.split(' ')[1];
const user = verifyToken(token);
// Então usar user.id para auditoria
```

---

**Versão:** 1.0  
**Última atualização:** 11/05/2026  
**Pronto para produção? Sim! ✅**

