# 🔥 EXECUTE AS MIGRATIONS AGORA

Siga estes passos para ativar as tabelas CONTAS e BOLETOS:

## 📝 Passo 1: Abrir o Supabase SQL Editor

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Clique em **SQL Editor** (menu esquerdo)
4. Clique em **New Query**

## 📋 Passo 2: Copiar e Colar o SQL

1. Abra o arquivo: `database/EXECUTE_AGORA.sql`
2. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
3. Volte ao Supabase SQL Editor
4. **Cole** no editor (Ctrl+V)

## ▶️ Passo 3: Executar

1. Clique no botão **"Run"** (canto superior direito)
2. Aguarde a execução...
3. Se tudo correr bem, você verá: ✅ "Query executed successfully"

## ✅ Verificar se Funcionou

Após executar o SQL:

1. No Supabase, vá para **Table Editor** (menu esquerdo)
2. Você deve ver:
   - ✅ Tabela **CONTAS** (com colunas: id, cic, pass, name, email, etc)
   - ✅ Tabela **BOLETOS** (com colunas: ID, CONTA_ID, NUM_TITULO, VALOR, etc)

Se ambas as tabelas aparecerem, **SUCESSO!** 🎉

## 🧪 Teste: Criar um Usuário

Para inserir um usuário de teste, execute este SQL:

```sql
INSERT INTO "CONTAS" ("cic", "pass", "name", "email") VALUES
  ('12345678901', '123456', 'Usuário Teste', 'teste@example.com');
```

Depois tente fazer login na aplicação com:
- **CIC**: `12345678901`
- **Senha**: `123456`

## 🚀 Próximo Passo

Após criar o usuário, clique em **"Boletos"** no menu da aplicação e comece a emitir boletos! 

Os dados serão salvos na tabela BOLETOS do Supabase automaticamente.

---

**Dúvidas?** Verifique se:
- ✅ O SQL foi colado **completamente**
- ✅ Não há caracteres especiais no início
- ✅ O projeto Supabase está correto
- ✅ Você tem permissão para criar tabelas (conta ativa)

Se houver erro, copie a mensagem de erro e tente novamente! 💪
