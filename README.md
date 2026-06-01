# Capt — Gestão de Boletos

Uma plataforma moderna para gestão de boletos bancários construída com React, Vite, Tailwind CSS, Supabase e Node.js.

## 🚀 Tecnologias

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Charts**: Chart.js + React-ChartJS-2

## 📋 Pré-requisitos

- Node.js 20+
- npm ou yarn
- Conta Supabase (https://supabase.com)

## 🔧 Instalação

### 1. Clone o repositório e instale dependências

```bash
npm install
```

### 2. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_API_URL=http://localhost:3001

SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_KEY=sua-service-key

PORT=3001
NODE_ENV=development
```

### 3. Configure o Supabase

1. Acesse o Supabase Dashboard
2. Vá para **SQL Editor**
3. Copie todo o conteúdo de `database/migrations.sql`
4. Execute a query

Isso criará:
- Tabela `boletos`
- Tabela `pagamentos`
- RLS Policies (segurança)
- Funções triggers

### 4. Crie um usuário de teste

No Supabase Dashboard → Auth → Users, crie um usuário com:
- Email: `demo@capt.com`
- Password: `123456`

## 🏃 Rodando a aplicação

### Terminal 1 - Frontend

```bash
npm run dev
```

Acessa em: `http://localhost:5173`

### Terminal 2 - Backend

```bash
npm run server
```

Backend roda em: `http://localhost:3001`

## 📁 Estrutura do Projeto

```
capt/
├── src/
│   ├── components/
│   │   └── Layout/
│   │       ├── MainLayout.jsx
│   │       ├── Sidebar.jsx
│   │       └── Header.jsx
│   │   └── Dashboard/
│   │       └── KPICard.jsx
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   └── DashboardPage.jsx
│   ├── lib/
│   │   └── supabase.js      # Funções de integração
│   ├── styles/
│   │   └── globals.css      # Estilos globais
│   ├── App.jsx              # App principal
│   └── main.jsx             # Entry point
├── backend/
│   └── server.js            # API REST
├── database/
│   └── migrations.sql       # Schema do banco
├── index.html               # HTML principal
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## 🎯 Features Implementadas

### Frontend
- ✅ Autenticação com Supabase
- ✅ Dashboard com KPIs
- ✅ Sidebar com navegação
- ✅ Tabela de boletos recentes
- ✅ Design dark mode moderno
- ✅ Responsive (WIP)

### Backend
- ✅ CRUD de boletos
- ✅ Autenticação integrada
- ✅ Endpoints de estatísticas
- ✅ CORS configurado

### Database
- ✅ Schema completo
- ✅ RLS Policies
- ✅ Índices para performance
- ✅ Triggers para audit

## 📚 API Endpoints

### Boletos

```
GET    /boletos/:userId          → Lista todos os boletos do usuário
POST   /boletos                  → Cria novo boleto
PUT    /boletos/:id              → Atualiza boleto
DELETE /boletos/:id              → Deleta boleto
```

### Estatísticas

```
GET    /stats/:userId            → Retorna estatísticas gerais
```

## 🔐 Autenticação

O projeto usa Supabase Auth:

```javascript
import { signIn, signUp, signOut } from './lib/supabase'

// Login
const { data, error } = await signIn('email@example.com', 'password')

// Logout
await signOut()
```

## 📊 Próximas Melhorias

- [ ] Preview de boleto em PDF
- [ ] Geração de código de barras
- [ ] Integração com banco real
- [ ] Relatórios avançados
- [ ] Dark/Light mode toggle
- [ ] Mobile responsive
- [ ] Testes unitários
- [ ] CI/CD pipeline

## 🚨 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
npm install @supabase/supabase-js
```

### Erro de CORS
Verifique se o backend está rodando em `http://localhost:3001`

### Erro de autenticação
- Verifique as chaves do Supabase em `.env.local`
- Certifique-se de que o usuário existe no Supabase Auth

## 📝 Licença

MIT

## 👤 Autor

Lio - 2024
