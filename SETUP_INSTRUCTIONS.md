# 🎯 Instruções de Setup Completo - Capt

Siga estes passos para ter sua aplicação rodando em menos de 10 minutos!

## 📦 Passo 1: Instalar Dependências

```bash
# Instalar dependências do frontend
npm install

# Instalar dependências do backend
cd backend
npm install
cd ..
```

## 🔐 Passo 2: Configurar Supabase

### 2.1 Criar Conta no Supabase
1. Acesse https://supabase.com
2. Clique em "Start your project"
3. Sign up com sua conta
4. Crie um novo projeto

### 2.2 Obter Credenciais
1. Vá para Project Settings → API
2. Copie:
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_KEY`

### 2.3 Criar arquivo `.env.local`
Na **raiz** do projeto (C:\Projetos\Capt), crie um arquivo chamado `.env.local`:

```env
# Frontend
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (copie seu anon key)
VITE_API_URL=http://localhost:3001

# Backend
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJ... (mesmo anon key)
SUPABASE_SERVICE_KEY=eyJ... (service role key)

# Server
PORT=3001
NODE_ENV=development
```

## 🗄️ Passo 3: Criar Banco de Dados

### 3.1 Executar Migrations
1. No Supabase Dashboard, vá para **SQL Editor**
2. Clique em "New Query"
3. **Copie TODO** o conteúdo de `database/migrations.sql`
4. **Cole** no editor SQL do Supabase
5. Clique em "Run"

Isso criará:
- ✅ Tabela `boletos`
- ✅ Tabela `pagamentos`
- ✅ RLS Policies (segurança)
- ✅ Índices (performance)
- ✅ Triggers (audit)

### 3.2 Verificar Criação
No Supabase:
- Vá para **Table Editor**
- Você deve ver `boletos` e `pagamentos`

## 👤 Passo 4: Criar Usuário de Teste

No Supabase Dashboard:
1. Vá para **Authentication** → **Users**
2. Clique em "Invite user"
3. Preencha:
   - Email: `demo@capt.com`
   - Password: `123456`
   - Auto generate password: ❌ (desmarque)
4. Clique "Send invite"

## ✅ Passo 5: Iniciar a Aplicação

### Terminal 1 - Frontend
```bash
# Na pasta raiz: C:\Projetos\Capt
npm run dev
```

Será aberto em: **http://localhost:5173**

### Terminal 2 - Backend
```bash
# Em outro terminal, na pasta raiz: C:\Projetos\Capt
npm run server
```

Backend roda em: **http://localhost:3001**

## 🔓 Passo 6: Fazer Login

Na aplicação (http://localhost:5173):
- Email: `demo@capt.com`
- Senha: `123456`

Clique em **Entrar**

## 🎉 Pronto!

Você agora tem:
- ✅ Frontend React rodando
- ✅ Backend API rodando
- ✅ Banco de dados configurado
- ✅ Autenticação funcionando
- ✅ Dashboard com dados de exemplo

## 📊 Testar a Aplicação

1. **Dashboard**: Veja os KPIs e tabela de boletos
2. **Novo Boleto**: Clique "📝 Novo Boleto" para criar
3. **Listagem**: A tabela mostra boletos de exemplo
4. **Sair**: Clique no avatar e depois "Sair"

## 🐛 Troubleshooting

### Erro: "Cannot find module '@supabase/supabase-js'"
```bash
npm install @supabase/supabase-js
```

### Erro: "CORS policy"
- Verifique se `VITE_API_URL` está correto
- Backend deve estar rodando em http://localhost:3001

### Erro: "Authentication error"
- Verifique credenciais em `.env.local`
- Confirme que usuário existe no Supabase Auth

### Erro: "Cannot connect to database"
- Verifique SQL foi executado no Supabase
- Verifique `SUPABASE_SERVICE_KEY` está correto
- Aguarde alguns segundos após executar SQL

## 📚 Próximos Passos

1. **Conhecer a estrutura**:
   - Leia `STRUCTURE.md` para entender as pastas
   - Leia `README.md` para documentação completa

2. **Adicionar features**:
   - Veja `EXAMPLES.md` para integrações
   - Customize o design conforme necessário

3. **Fazer deploy**:
   - Leia `DEPLOYMENT.md` para colocar em produção
   - Configure CI/CD com GitHub Actions

## 📞 Suporte

Documentação disponível:
- 📖 `README.md` - Documentação principal
- ⚡ `QUICKSTART.md` - Setup rápido
- 📁 `STRUCTURE.md` - Estrutura do projeto
- 🔌 `EXAMPLES.md` - Exemplos de integração
- 🚀 `DEPLOYMENT.md` - Fazer deploy
- 🎯 Este arquivo - Instruções passo a passo

---

**Tudo pronto! Boa sorte com sua aplicação!** 🚀

Para dúvidas, consulte a documentação oficial:
- Supabase: https://supabase.com/docs
- React: https://react.dev
- Tailwind: https://tailwindcss.com
