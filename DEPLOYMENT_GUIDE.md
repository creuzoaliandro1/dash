# 🚀 Guia de Deployment - Importação CNAB400

Data: 11/05/2026  
Status: ✅ Pronto para Implementação

---

## 📋 O Que Foi Implementado

### Arquivos Criados/Modificados

```
backend/
├── server.js                                  [✏️ ATUALIZADO]
├── package.json                               [✏️ ATUALIZADO]
├── services/
│   └── boletoImportService.js                 [✨ NOVO]
└── supabase_migration_capt_boletos.sql        [✨ NOVO]
```

### Endpoints Novos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/importar-boletos` | Importa arquivo Excel |
| POST | `/api/importar-boleto-individual` | Testa com um boleto |
| GET | `/api/capt-boletos/:usuarioId` | Lista boletos importados |
| GET | `/api/capt-boletos-stats/:usuarioId` | Estatísticas |
| GET | `/api/capt-importacoes/:usuarioId` | Histórico de importações |
| GET | `/api/capt-logs-importacao/:id` | Logs detalhados |

---

## 🔧 Passo 1: Instalar Dependências

```bash
cd backend
npm install

# Ou se já instalado, atualize:
npm install xlsx multer
```

---

## 🗄️ Passo 2: Criar Tabelas no Supabase

### Via Supabase Dashboard (Interface Web)

1. Abra https://app.supabase.com
2. Vá para seu projeto
3. Menu: **SQL Editor** → **New Query**
4. Cole o conteúdo de `supabase_migration_capt_boletos.sql`
5. Clique **Run**

### Via CLI (Alternativa)

```bash
# Instale Supabase CLI
npm install -g supabase

# Login
supabase login

# Apply migration
supabase db push
```

---

## ✅ Passo 3: Verificar Tabelas Criadas

No Supabase Dashboard → **Table Editor**, você deve ver:

- ✅ `contas` (se não existir)
- ✅ `capt_boletos`
- ✅ `capt_importacoes`
- ✅ `capt_logs_processamento`

---

## 🧪 Passo 4: Testar Localmente

### Iniciar o servidor

```bash
cd backend
npm run dev
```

Você deve ver:

```
╔════════════════════════════════════════════════════════════╗
║           🚀 Servidor CAPT Iniciado                       ║
║   http://localhost:3001                                   ║
╚════════════════════════════════════════════════════════════╝
```

### Teste 1: Health Check

```bash
curl http://localhost:3001/health
```

**Resultado esperado:**
```json
{"status": "OK", "timestamp": "2026-05-11T..."}
```

### Teste 2: Importar Um Boleto Individual

```bash
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "X-Perfil: master" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor pago": "500,00",
    "Data de pagamento": "14/08/2026",
    "Status de negociação": "aberto",
    "Status do boleto": "aberto"
  }'
```

**Resultado esperado:**
```json
{
  "status": "sucesso",
  "message": "Boleto inserido com sucesso",
  "id": "f7b4c9e1-2a3b-4c5d-6e7f-8g9h0i1j2k3l",
  "operacao": "INSERT",
  "timestamp": "2026-05-11T18:30:00.000Z"
}
```

### Teste 3: Importar Arquivo Excel Completo

```bash
curl -X POST http://localhost:3001/api/importar-boletos \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "X-Perfil: master" \
  -F "arquivo=@/path/to/Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx"
```

**Resultado esperado:**
```json
{
  "mensagem": "Importação concluída com sucesso",
  "resumo": {
    "total": 1113,
    "inseridos": 1050,
    "atualizados": 0,
    "nao_alterados": 50,
    "com_erro": 13,
    "taxa_sucesso": "94.33%"
  },
  "importacao_id": "550e8400-e29b-41d4-a716-446655440001",
  "erros": [
    {
      "status": "erro",
      "message": "Conta não encontrada...",
      "codigo_barras": "..."
    }
  ]
}
```

### Teste 4: Listar Boletos Importados

```bash
curl http://localhost:3001/api/capt-boletos/550e8400-e29b-41d4-a716-446655440000
```

### Teste 5: Ver Estatísticas

```bash
curl http://localhost:3001/api/capt-boletos-stats/550e8400-e29b-41d4-a716-446655440000
```

**Resultado esperado:**
```json
{
  "total": 1050,
  "pendente": 950,
  "pago": 100,
  "atrasado": 0,
  "cancelado": 0,
  "valor_total_titulo": 525000.00,
  "valor_total_pago": 50000.00,
  "valor_total_pendente": 475000.00
}
```

---

## 🔐 Configuração de Autenticação

### Como passar o user-id?

Você tem 3 opções:

#### Opção 1: Header HTTP (Recomendado para testes)
```bash
curl -H "X-User-Id: user-uuid-aqui" \
     -H "X-Perfil: master"
```

#### Opção 2: Body JSON
```bash
curl -d '{"usuario_id": "user-uuid-aqui", "perfil": "master"}'
```

#### Opção 3: JWT Token (Produção)
```typescript
// No server.js, adicione middleware de autenticação JWT:
import jwt from 'jsonwebtoken'

app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
  }
  next()
})

// Depois use:
const usuarioId = req.user?.id || req.headers['x-user-id']
```

---

## 🚨 Troubleshooting

### Erro: "Module not found: xlsx"

```bash
npm install xlsx multer
npm run dev
```

### Erro: "Supabase connection failed"

1. Verifique `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` em `.env.local`
2. Teste a conexão:
```bash
curl https://nkqiurrgrylrwvreybzh.supabase.co/rest/v1/
```

### Erro: "Tabelas não existem"

Execute novamente a migration SQL:
```sql
-- Cole o conteúdo de supabase_migration_capt_boletos.sql no SQL Editor
```

### Erro: "RLS policy violation"

Se usar autenticação JWT real:
1. As policies RLS estão ativadas
2. O usuário pode apenas ver seus próprios registros
3. Desative RLS para testes (⚠️ apenas desenvolvimento):
```sql
ALTER TABLE capt_boletos DISABLE ROW LEVEL SECURITY;
```

---

## 📊 Monitorar Importações

### Via Supabase Dashboard

1. Vá para **Table Editor**
2. Abra `capt_importacoes`
3. Veja histórico de importações

### Via API

```bash
# Ver histórico
curl http://localhost:3001/api/capt-importacoes/user-id

# Ver logs de uma importação
curl http://localhost:3001/api/capt-logs-importacao/importacao-id
```

---

## 🎯 Próximas Ações

- [ ] Executar migration SQL no Supabase
- [ ] Instalar `npm install xlsx multer`
- [ ] Testar endpoint `/health`
- [ ] Testar importação de um boleto
- [ ] Testar importação do arquivo completo (1113 registros)
- [ ] Verificar estatísticas
- [ ] Implementar autenticação JWT real (em produção)
- [ ] Adicionar validações adicionais (dígito verificador, etc.)
- [ ] Configurar logs persistentes (Sentry, LogRocket, etc.)

---

## 📈 Estrutura de Dados Final

```
capt_boletos (1113+ registros esperados)
├── codigo_barras (UNIQUE) ← Identificador principal
├── numero_conta_id (FK) ← Conta do titular
├── usuario_id (FK) ← Usuário que importou
├── valor_titulo, valor_pagamento
├── data_vencimento, data_pagamento
├── status (pendente, pago, atrasado, cancelado)
├── criado_em, atualizado_em
└── ... (20+ campos adicionais)

capt_importacoes
├── id
├── usuario_id
├── total_registros: 1113
├── registros_inseridos: 1050
├── registros_atualizados: 0
├── registros_erro: 13
└── status: sucesso | parcial | erro

capt_logs_processamento
├── importacao_id (FK)
├── numero_linha (ex: 2, 3, 4, ...)
├── tipo_operacao (INSERT, UPDATE, ERRO)
├── mensagem
└── detalhes (JSON)
```

---

## 🔍 Endpoints de Debugging

```bash
# Ver todas as importações de um usuário
curl "http://localhost:3001/api/capt-importacoes/user-id"

# Ver logs de uma importação específica
curl "http://localhost:3001/api/capt-logs-importacao/importacao-id" | jq .

# Ver boletos com erro
curl "http://localhost:3001/api/capt-logs-importacao/importacao-id?tipo=ERRO" | jq .

# Contar registros no Supabase
# (via Dashboard → SQL Editor)
SELECT COUNT(*) FROM capt_boletos;
SELECT COUNT(*) FROM capt_importacoes;
SELECT COUNT(*) FROM capt_logs_processamento WHERE tipo_operacao = 'ERRO';
```

---

## ✨ Recursos Implementados

✅ Extração automática do número da conta (posição 24-30)  
✅ Validação e normalização de dados  
✅ Detecção de mudanças (valor, data, status)  
✅ Controle de perfil (Master/Normal)  
✅ Tratamento de erros com logs  
✅ Auditoria completa  
✅ Paginação  
✅ Estatísticas em tempo real  
✅ Idempotência (seguro reimportar)  
✅ RLS (Row Level Security)

---

## 📞 Suporte

Dúvidas? Revise:
- `README_IMPORTACAO_BOLETOS.md` - Especificação técnica
- `Implementacao_Importacao_Boletos_CNAB400.docx` - Código comentado
- Logs do servidor: `npm run dev`

---

**Tudo pronto! 🎉**

Próximo passo: Execute a migration SQL e teste os endpoints.
