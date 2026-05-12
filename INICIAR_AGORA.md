# 🚀 Iniciar Agora - Passo a Passo

**Status:** ✅ Tudo atualizado e pronto  
**Data:** 11/05/2026  
**Tempo estimado:** 30 minutos

---

## 📋 Ordem de Execução (Siga Exatamente)

### ETAPA 1: Verificação Rápida (5 min)

#### Passo 1.1: Executar verificação automática

```bash
# Abra terminal na pasta C:\Projetos\Capt\backend

cd C:\Projetos\Capt\backend
node verificar-setup.js
```

**Resultado esperado:**
```
✅ package.json existe
✅ xlsx instalado
✅ multer instalado
...
✅ SISTEMA PRONTO PARA USO!
```

Se aparecer ❌, corrija antes de continuar.

---

### ETAPA 2: Preparar Banco de Dados (10 min)

#### Passo 2.1: Criar tabelas no Supabase

1. Abra: https://app.supabase.com
2. Selecione seu projeto
3. Vá para **SQL Editor** → **New Query**
4. **COPIE TODO** o conteúdo de:
   ```
   C:\Projetos\Capt\backend\supabase_migration_capt_boletos_CORRIGIDO.sql
   ```
5. **COLE** no editor do Supabase
6. Clique **Run** (botão azul)

**Resultado esperado:**
```
Query executed successfully
3 tables created
```

#### Passo 2.2: Verificar e inserir conta (2 min)

No **Supabase SQL Editor**, execute:

```sql
-- Verificar se conta existe
SELECT COUNT(*) FROM "CONTAS" WHERE "conta" ILIKE '09538%';
```

**Se retornar 0:**
```sql
-- Inserir a conta que estava faltando
INSERT INTO "CONTAS" (
  "conta",
  "usuario_id",
  "banco_codigo",
  "nome_titular",
  "documento_titular"
)
VALUES (
  '09538802',
  '550e8400-e29b-41d4-a716-446655440000',  -- Use seu USER_ID real
  '274',
  'RETIFICA VOLANTE',
  '59849652000148'
)
ON CONFLICT ("conta") DO NOTHING;
```

**Se retornar > 0:** ✅ Conta existe, pode continuar

---

### ETAPA 3: Iniciar Backend (3 min)

#### Passo 3.1: Terminal 1 - Iniciar servidor Express

```bash
# Terminal (Novo / ou feche o anterior)
cd C:\Projetos\Capt\backend
npm install  # (só se necessário)
npm start
```

**Resultado esperado:**
```
╔════════════════════════════════════════════════════════════╗
║           🚀 Servidor CAPT Iniciado                       ║
║   http://localhost:3001                                    ║
╚════════════════════════════════════════════════════════════╝
```

✅ **Deixe este terminal aberto**

---

### ETAPA 4: Iniciar Frontend (3 min)

#### Passo 4.1: Terminal 2 - Iniciar Vite

```bash
# Terminal NOVO
cd C:\Projetos\Capt
npm install  # (só se necessário)
npm run dev
```

**Resultado esperado:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Press h to show help
```

✅ **Deixe este terminal aberto**

---

### ETAPA 5: Teste Rápido (5 min)

#### Passo 5.1: Health Check

```bash
# Terminal 3 (novo ou cmd.exe)
curl http://localhost:3001/health
```

**Esperado:**
```json
{"status":"OK","timestamp":"2026-05-11T..."}
```

#### Passo 5.2: Testar extração de 7 dígitos

```bash
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor do título": "500,00",
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
  "id": "uuid...",
  "operacao": "INSERT"
}
```

---

### ETAPA 6: Importar Arquivo Completo (5 min)

#### Opção A: Via Frontend (Recomendado)

1. Abra: http://localhost:5173/
2. Vá para página **"Importar Boletos"**
3. Clique **"Selecionar Arquivo"**
4. Escolha: `Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx`
5. Clique **"Importar"**
6. Aguarde 5-10 segundos

**Resultado esperado:**
```
✅ Importação concluída com sucesso

Resumo:
- Total: 1.113
- Inseridos: 1.113
- Atualizados: 0
- Taxa sucesso: 100.00%
```

#### Opção B: Via cURL

```bash
# Coloque o arquivo na pasta Downloads (ou ajuste o path)
curl -X POST http://localhost:3001/api/importar-boletos \
  -F "arquivo=@C:\Users\creuz\Downloads\Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx"
```

---

### ETAPA 7: Verificar Dados (2 min)

#### No Supabase SQL Editor:

```sql
-- Contar boletos
SELECT COUNT(*) FROM "CAPT_BOLETOS";
-- Resultado: 1113

-- Ver um boleto
SELECT "codigo_barras", "valor_titulo", "status"
FROM "CAPT_BOLETOS"
LIMIT 1;

-- Histórico de importações
SELECT "arquivo_nome", "registros_inseridos", "status"
FROM "CAPT_IMPORTACOES"
ORDER BY "criado_em" DESC;
```

---

## ✅ Checklist de Conclusão

- [ ] Executei `verificar-setup.js` com sucesso
- [ ] Criei tabelas no Supabase (migration SQL)
- [ ] Verifiquei/inseri conta 09538802 em CONTAS
- [ ] Backend está rodando em localhost:3001
- [ ] Frontend está rodando em localhost:5173
- [ ] Health check retorna OK
- [ ] Teste de 1 boleto funcionou (7 dígitos)
- [ ] Arquivo com 1.113 boletos foi importado
- [ ] Dados verificados no Supabase

---

## 🎯 Status Após Conclusão

### Backend
```
✅ Express rodando
✅ Supabase conectado
✅ Endpoints funcionando
✅ Extração de 7 dígitos verificada
```

### Banco de Dados
```
✅ CAPT_BOLETOS: 1.113 registros
✅ CAPT_IMPORTACOES: 1 registro
✅ CAPT_LOGS_PROCESSAMENTO: 1.113 registros
```

### Frontend
```
✅ Vite rodando
✅ API chamando corretamente
✅ Resultados exibidos
```

---

## 🆘 Se Algo Falhar

### Erro: "Conta não encontrada"
→ Verifique Passo 2.2 (inserir conta)

### Erro: "Table does not exist"
→ Verifique Passo 2.1 (migration SQL)

### Erro: "Connection refused"
→ Verifique Passo 3.1 (npm start)

### Erro: "Extraindo 095388" (6 dígitos)
→ Verifique que `substring(23, 30)` está no código
→ Reinicie backend com `npm start`

### Erro: "CORS error"
→ Backend pode estar desligado, execute Passo 3.1

---

## 📚 Documentos de Referência

Se precisar de mais detalhes:

- **Testes completos:** `TESTE_COMPLETO.md`
- **Endpoints:** `API_ENDPOINTS_ATUALIZADOS.md`
- **Problemas:** `TROUBLESHOOTING.md`
- **Implementação:** `IMPLEMENTACAO_CORRIGIDA.md`

---

## ⏱️ Timeline

```
00:00 - Verificação (verificar-setup.js)
05:00 - Banco de dados (migration SQL)
15:00 - Backend (npm start)
18:00 - Frontend (npm run dev)
23:00 - Testes (health check, 1 boleto)
28:00 - Importação completa
30:00 - ✅ SISTEMA PRONTO!
```

---

## 🎉 Sucesso!

Se chegou aqui, parabéns! Seu sistema está:
- ✅ Configurado
- ✅ Testado
- ✅ Funcionando
- ✅ Pronto para produção

Pode reimportar arquivos quando necessário! 🚀

---

**Começar agora?** Siga de ETAPA 1 → ETAPA 7 na ordem exata acima.

