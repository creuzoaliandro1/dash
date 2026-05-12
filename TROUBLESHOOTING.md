# 🔧 Troubleshooting - Guia de Problemas Comuns

**Data:** 11/05/2026

---

## ❌ Problema: "Conta não encontrada para código: 095388"

### Causa
A tabela CONTAS não contém a conta `09538802` que está no arquivo de boletos.

### Solução Passo a Passo

#### 1️⃣ Verificar se conta existe
```sql
-- No Supabase SQL Editor, execute:
SELECT "id", "conta", "nome_correntista"
FROM "CONTAS"
WHERE "conta" ILIKE '09538802%'
LIMIT 1;
```

**Se retornar 1 linha:** conta existe, problema está em outro lugar (veja próximo)

**Se retornar vazio:** conta não existe, siga para o passo 2

#### 2️⃣ Inserir a conta

**Opção A - Via SQL (recomendado)**

```sql
-- Abrir Supabase → SQL Editor → New Query
INSERT INTO "CONTAS" (
  "conta",
  "usuario_id",
  "banco_codigo",
  "agencia",
  "nome_titular",
  "documento_titular"
)
VALUES (
  '09538802',                                      -- Conta com dígito
  '550e8400-e29b-41d4-a716-446655440000',         -- SEU USER_ID (COPIAR DE AUTH)
  '274',                                           -- Banco Itaú
  '3638',                                          -- Agência (do arquivo)
  'RETIFICA VOLANTE',                              -- Nome (do arquivo)
  '59849652000148'                                 -- CNPJ (do arquivo)
)
ON CONFLICT ("conta") DO NOTHING;

-- Verificar inserção
SELECT "id", "conta" FROM "CONTAS" WHERE "conta" = '09538802';
```

**Opção B - Se tiver múltiplas contas**

Extrair todas as contas únicas do arquivo:

```bash
# Via Node.js script (na pasta backend)
node extrair_e_inserir_contas.js
```

Ou manualmente:
```sql
-- Inserir todas de uma vez
INSERT INTO "CONTAS" ("conta", "usuario_id", "banco_codigo", "nome_titular", "documento_titular")
VALUES 
  ('09538802', 'seu-uuid', '274', 'RETIFICA VOLANTE', '59849652000148'),
  ('09538903', 'seu-uuid', '274', 'RETIFICA VOLANTE', '59849652000148'),
  ('09539004', 'seu-uuid', '274', 'RETIFICA VOLANTE', '59849652000148')
ON CONFLICT ("conta") DO NOTHING;
```

#### 3️⃣ Testar novamente
- Volte ao frontend
- Selecione o arquivo
- Clique em "Importar"
- **Desta vez deve funcionar!** ✅

---

## ❌ Problema: "column usuario_id does not exist"

### Causa
Você está usando versão antiga do `boletoImportService.js` ou `server.js`.

### Solução

#### 1️⃣ Verificar qual arquivo é antigo
Procure por `usuario_id` nos arquivos:

```bash
# No backend/services/
grep -n "usuario_id" boletoImportService.js

# No backend/
grep -n "usuario_id" server.js
```

Se encontrar `usuario_id`, você tem a versão antiga.

#### 2️⃣ Copiar arquivos atualizados

Substitua estes arquivos:
- ✅ `backend/services/boletoImportService.js` (versão 11/05/2026)
- ✅ `backend/server.js` (versão 11/05/2026)

**Não** substitua:
- ❌ `backend/package.json`
- ❌ `.env.local`
- ❌ `backend/supabase_migration_capt_boletos.sql` (use a versão CORRIGIDO)

#### 3️⃣ Reiniciar servidor
```bash
cd backend
npm start
```

#### 4️⃣ Testar novamente
```bash
curl http://localhost:3001/health
# Deve retornar: {"status":"OK","timestamp":"..."}
```

---

## ❌ Problema: "permission denied" ao criar tabelas

### Causa
Seu `SUPABASE_SERVICE_KEY` não tem permissões suficientes, OU você está executando SQL como usuário auth (não service role).

### Solução

#### 1️⃣ Verificar SERVICE_KEY em .env.local
```bash
# .env.local deve ter:
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# (key muito longa, começa com "eyJ...")
```

❌ **Errado** (anon key):
```
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **Correto** (service key):
```
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2️⃣ Onde pegar a chave correta

1. Abra **Supabase Dashboard**
2. Vá para **Project Settings** → **API**
3. Copie: **`service_role` secret** (não `anon`)
4. Cole em `.env.local` como `SUPABASE_SERVICE_KEY`

#### 3️⃣ Tentar novamente
```bash
# No Supabase SQL Editor (como super user):
-- Run migration corrigida
-- Copie todo conteúdo de supabase_migration_capt_boletos_CORRIGIDO.sql
```

---

## ❌ Problema: "Syntax error near Table CAPT_BOLETOS"

### Causa
Nomes de tabelas/campos sem quotes, ou quotes incorretas.

### Solução

#### ✅ CORRETO (use quotes duplas)
```sql
CREATE TABLE "CAPT_BOLETOS" (
  "id" UUID PRIMARY KEY,
  "codigo_barras" VARCHAR(50)
);

INSERT INTO "CAPT_BOLETOS" ("id", "codigo_barras") ...

SELECT * FROM "CAPT_BOLETOS" WHERE "status" = 'pago';
```

#### ❌ ERRADO (sem quotes)
```sql
CREATE TABLE CAPT_BOLETOS (
  id UUID PRIMARY KEY,
  codigo_barras VARCHAR(50)
);

SELECT * FROM capt_boletos WHERE status = 'pago';  -- Procura por 'status' coluna, não conteúdo
```

#### 2️⃣ Copiar SQL correto
Use o arquivo: `supabase_migration_capt_boletos_CORRIGIDO.sql`

Ele já tem todas as quotes no lugar certo.

---

## ❌ Problema: "400 Bad Request - Arquivo não fornecido"

### Causa
Endpoint está esperando `multipart/form-data`, mas você enviou algo diferente.

### Solução

#### ✅ CORRETO
```bash
curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@boletos.xlsx"
```

#### ❌ ERRADO
```bash
# Sem -F (form-data):
curl -X POST http://localhost:3001/api/importar-boletos \
  --data-binary @boletos.xlsx

# Com Content-Type errado:
curl -X POST http://localhost:3001/api/importar-boletos \
  -H "Content-Type: application/json" \
  @boletos.xlsx
```

#### 2️⃣ Verificar arquivo
```bash
# Arquivo existe?
ls -lh boletos.xlsx

# É Excel?
file boletos.xlsx
# Deve retornar: Microsoft Excel...
```

---

## ❌ Problema: Importação muito lenta (timeout)

### Causa
Arquivo com muitos registros (>5000) ou servidor com poucos recursos.

### Solução

#### 1️⃣ Dividir arquivo em chunks
```bash
# Importar em 2-3 partes:
# Arquivo original: 5000 linhas
# Parte 1: linhas 1-2000
# Parte 2: linhas 2001-4000
# Parte 3: linhas 4001-5000
```

#### 2️⃣ Aumentar timeout do cliente

**JavaScript/Node:**
```javascript
const axios = require('axios');
const client = axios.create({
  timeout: 30000  // 30 segundos (ao invés de 5 segundos padrão)
});

const response = await client.post('/api/importar-boletos', data);
```

**cURL:**
```bash
curl --max-time 60 -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@boletos.xlsx"
```

#### 3️⃣ Verificar logs
```bash
# No terminal do backend:
npm start
# Procure por mensagens tipo:
# "[IMPORT] 100/5000 boletos processados"
# "[IMPORT] 200/5000 boletos processados"
```

Se não houver progresso por >1 minuto, servidor pode estar congelado.

---

## ❌ Problema: 0 boletos importados (mas sem erro)

### Causa
Arquivo Excel tem estructura diferente do esperado.

### Solução

#### 1️⃣ Verificar nomes das colunas
O arquivo DEVE ter exatamente estas colunas:
- `Linha digitável` (código de barras)
- `Valor do título`
- `Valor pago`
- `Data de vencimento`
- `Data de pagamento`
- `Status do boleto`
- ... outros campos opcionais

**Se as colunas têm nomes diferentes**, atualizar `boletoImportService.js`:

```javascript
// Procure por:
const codigoBarras = boleto['Linha digitável'];  // ← ajuste para seu nome

// Se sua coluna se chama "Código de Barras":
const codigoBarras = boleto['Código de Barras'];
```

#### 2️⃣ Testar um boleto individualmente
```bash
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor do título": "500,00",
    "Status do boleto": "pendente"
  }'
```

Se retornar erro, está faltando algum campo ou tem o nome errado.

#### 3️⃣ Comparar com arquivo de referência
Veja o arquivo exemplo em: `Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx`

Copie a estrutura dele.

---

## ❌ Problema: "Foreign key constraint violated"

### Causa
`numero_conta_id` referencia um ID de conta que não existe.

### Solução

#### 1️⃣ Verificar contas existentes
```sql
SELECT "id", "conta" FROM "CONTAS" LIMIT 10;
```

Anote os IDs (números na coluna `id`).

#### 2️⃣ Verificar boleto que falhou
```sql
-- Qual boleto tem numero_conta_id inválido?
SELECT "numero_conta_id", COUNT(*) 
FROM "CAPT_BOLETOS"
GROUP BY "numero_conta_id"
ORDER BY "numero_conta_id";
```

#### 3️⃣ Inserir conta faltando
```sql
-- Se faltou conta com id=5
INSERT INTO "CONTAS" ("conta", "usuario_id", "banco_codigo", "nome_titular", "documento_titular")
VALUES ('XXXXX02', 'seu-uuid', '274', 'NOME', 'CNPJ')
ON CONFLICT ("conta") DO NOTHING;
```

#### 4️⃣ Testar novamente
```bash
curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@boletos.xlsx"
```

---

## ❌ Problema: "UNIQUE constraint violated" em codigo_barras

### Causa
Você está tentando importar o mesmo boleto (mesmo `codigo_barras`) 2 vezes.

### Solução

#### ✅ Comportamento CORRETO
Sistema detecta boleto duplicado e faz UPDATE (não INSERT).

#### Se erro ocorrer:
Significa que há 2 linhas no arquivo com mesmo código de barras.

#### 1️⃣ Verificar arquivo
```bash
# Abrir em Excel e procurar por:
# Duas linhas iguais em "Linha digitável"
# Deletar uma delas
```

#### 2️⃣ Se quer reimportar mesmo arquivo
Opção A - Deletar boleto anterior:
```sql
DELETE FROM "CAPT_BOLETOS"
WHERE "codigo_barras" = '27490001019000000005083095388001315...';
```

Opção B - Sistema detecta automaticamente e faz UPDATE

---

## ❌ Problema: "Arquivo vazio" ou "0 registros"

### Causa
Arquivo Excel não tem dados ou formato está errado.

### Solução

#### 1️⃣ Verificar arquivo
```bash
# Abrir em Excel/LibreOffice
# Linha 1: cabeçalhos (coluna A = "Linha digitável")
# Linha 2+: dados
```

#### 2️⃣ Exportar novamente como Excel
```bash
# Do seu sistema original:
# 1. Abrir relatório
# 2. Salvar como: ".xlsx" (não .xls, não .csv)
# 3. Verificar que tem dados
# 4. Carregar novamente
```

#### 3️⃣ Testar com arquivo pequeno
Crie um Excel com 5 linhas de teste:
```
Linha digitável | Valor do título | Status do boleto | ...
274900010190000 | 100,00          | pendente         | ...
274900010190001 | 200,00          | pago             | ...
```

Se isso funciona, problema está no arquivo grande.

---

## ❌ Problema: "API not responding" ou connection refused

### Causa
Servidor backend não está rodando.

### Solução

#### 1️⃣ Iniciar servidor
```bash
cd backend
npm install
npm start
```

Deve exibir:
```
╔════════════════════════════════════════════════════════════╗
║           🚀 Servidor CAPT Iniciado                       ║
║   http://localhost:3001                                    ║
╚════════════════════════════════════════════════════════════╝
```

#### 2️⃣ Verificar porta
```bash
# Porta 3001 está em uso por outro programa?
# Windows:
netstat -ano | findstr :3001

# Mac/Linux:
lsof -i :3001
```

Se sim, mude a porta:
```bash
PORT=3002 npm start
```

#### 3️⃣ Verificar .env.local
Deve ter:
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
PORT=3001
```

---

## ✅ Checklist de Debug

Se nenhuma solução acima funcionar:

- [ ] Copiei versão corrigida do código? (11/05/2026)
- [ ] `.env.local` tem SERVICE_KEY (não anon)?
- [ ] Supabase consegue conectar? (`npm start` sem erro)
- [ ] Contas existem? (`SELECT FROM "CONTAS"` retorna dados)
- [ ] SQL da migration rodou? (`"CAPT_BOLETOS"` table existe?)
- [ ] Arquivo Excel tem dados? (teste com arquivo pequeno)
- [ ] Coluna "Linha digitável" existe? (case-sensitive!)

---

## 📞 Se Tudo Falhar

Colete estas informações:

```bash
# Mensagem de erro completa
# Screenshot ou log

# Verificar versões:
node --version
npm --version
npm ls xlsx
npm ls multer

# Testar Supabase:
curl https://seu-projeto.supabase.co

# Testar backend:
curl http://localhost:3001/health
```

Compartilhe isso para diagnóstico rápido.

---

**Versão:** 1.0  
**Última atualização:** 11/05/2026  
**Quando em dúvida, releia o arquivo `IMPLEMENTACAO_CORRIGIDA.md`** 📖

