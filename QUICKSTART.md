# 🚀 Quick Start - Capt

Comece em 5 minutos!

## 1️⃣ Clonar e Instalar

```bash
cd C:\Projetos\Capt
npm install
```

## 2️⃣ Configurar Supabase

### 2a. Criar um projeto Supabase
- Vá para https://supabase.com
- Crie novo projeto
- Copie as credenciais

### 2b. Criar arquivo `.env.local`

Crie na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_API_URL=http://localhost:3001

SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_KEY=sua-service-key

PORT=3001
```

### 2c. Executar migrations

1. No Supabase Dashboard → SQL Editor
2. Cole todo o conteúdo de `database/migrations.sql`
3. Clique "Run"

### 2d. Criar usuário de teste

No Supabase Dashboard → Auth → Users:
- Email: `demo@capt.com`
- Password: `123456`

## 3️⃣ Rodar a Aplicação

### Terminal 1 - Frontend
```bash
npm run dev
```
→ http://localhost:5173

### Terminal 2 - Backend
```bash
npm run server
```
→ http://localhost:3001

## 4️⃣ Login

Use as credenciais:
- Email: `demo@capt.com`
- Senha: `123456`

## ✨ Pronto!

Você agora tem:
- ✅ Dashboard funcional
- ✅ Autenticação
- ✅ Banco de dados
- ✅ API backend

## 📚 Próximos Passos

1. **Criar um boleto**: Clique "+ Novo Boleto"
2. **Ver listagem**: Navegue até "Boletos"
3. **Adicionar dados**: Insira informações do cliente
4. **Integrar API**: Conecte com provedores de boletos reais

## 🆘 Dúvidas?

- Verifique `README.md` para documentação completa
- Confira `database/migrations.sql` para schema do banco
- Leia `src/lib/supabase.js` para ver funções disponíveis

---

**Boa sorte!** 🎉
