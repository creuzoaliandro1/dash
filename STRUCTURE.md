# 📁 Estrutura do Projeto - Capt

Guia completo sobre a organização de pastas e convenções de código.

## Árvore de Pastas

```
capt/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── Layout/          # Componentes de layout
│   │   │   ├── MainLayout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Footer.jsx
│   │   ├── Dashboard/       # Componentes específicos do dashboard
│   │   │   ├── KPICard.jsx
│   │   │   ├── RevenueChart.jsx
│   │   │   └── ActivityChart.jsx
│   │   ├── Table/           # Componentes de tabela
│   │   │   ├── BoletoTable.jsx
│   │   │   └── TableHeader.jsx
│   │   ├── Modal/           # Modais
│   │   │   ├── CreateBoletoModal.jsx
│   │   │   ├── EditBoletoModal.jsx
│   │   │   └── ConfirmModal.jsx
│   │   ├── Forms/           # Formulários
│   │   │   ├── BoletoForm.jsx
│   │   │   └── FilterForm.jsx
│   │   └── Common/          # Componentes comuns
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Badge.jsx
│   │       └── Toast.jsx
│   │
│   ├── pages/               # Páginas/Views
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── BoletosPage.jsx
│   │   ├── RelatoriosPage.jsx
│   │   └── SettingsPage.jsx
│   │
│   ├── lib/                 # Bibliotecas e utilitários
│   │   ├── supabase.js      # Cliente Supabase
│   │   ├── api.js           # Funções de API
│   │   └── utils.js         # Funções utilitárias
│   │
│   ├── hooks/               # Custom React Hooks
│   │   ├── useAuth.js
│   │   ├── useBoletos.js
│   │   ├── useFilters.js
│   │   └── useTheme.js
│   │
│   ├── services/            # Serviços (lógica de negócio)
│   │   ├── boletoService.js
│   │   ├── authService.js
│   │   ├── exportService.js
│   │   └── emailService.js
│   │
│   ├── styles/              # Estilos globais
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── animations.css
│   │
│   ├── context/             # React Context
│   │   ├── AuthContext.jsx
│   │   └── AppContext.jsx
│   │
│   ├── App.jsx              # Componente raiz
│   └── main.jsx             # Entry point
│
├── backend/                 # Node.js Backend
│   ├── routes/              # Rotas da API
│   │   ├── auth.js
│   │   ├── boletos.js
│   │   ├── stats.js
│   │   └── webhooks.js
│   │
│   ├── controllers/         # Lógica de controle
│   │   ├── authController.js
│   │   ├── boletosController.js
│   │   └── statsController.js
│   │
│   ├── middleware/          # Middlewares
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validation.js
│   │
│   ├── services/            # Serviços
│   │   ├── boletoService.js
│   │   ├── emailService.js
│   │   └── externalAPIs.js
│   │
│   ├── integrations/        # Integrações externas
│   │   ├── asaas.js
│   │   ├── picpay.js
│   │   └── stripe.js
│   │
│   ├── config/              # Configurações
│   │   ├── database.js
│   │   ├── supabase.js
│   │   └── constants.js
│   │
│   └── server.js            # Entry point do backend
│
├── database/                # Scripts e migrations
│   ├── migrations.sql       # Schema do banco
│   ├── seeds.sql            # Dados iniciais
│   └── indexes.sql          # Índices de performance
│
├── public/                  # Arquivos estáticos
│   └── favicon.svg
│
├── docs/                    # Documentação adicional
│   ├── API.md
│   ├── DATABASE.md
│   └── ARCHITECTURE.md
│
├── .github/                 # GitHub Actions e configurações
│   └── workflows/
│       └── deploy.yml
│
├── index.html               # HTML principal
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── QUICKSTART.md
├── DEPLOYMENT.md
├── EXAMPLES.md
└── STRUCTURE.md (este arquivo)
```

## 📋 Convenções de Código

### Componentes React

```javascript
// ✅ BOM: Componente bem estruturado
export default function BoletoCard({ boleto, onEdit, onDelete }) {
  const handleEdit = () => {
    onEdit(boleto.id)
  }

  return (
    <div className="card">
      <h3>{boleto.descricao}</h3>
      <p>R$ {boleto.valor.toFixed(2)}</p>
      <button onClick={handleEdit}>Editar</button>
      <button onClick={() => onDelete(boleto.id)}>Deletar</button>
    </div>
  )
}

// ❌ RUIM: Muita lógica dentro do componente
export default function BoletoCard(props) {
  // ... muita lógica aqui
}
```

### Nomeação de Arquivos

```
✅ CORRETO:
- src/components/Dashboard/KPICard.jsx
- src/pages/DashboardPage.jsx
- src/lib/supabase.js
- src/hooks/useAuth.js

❌ INCORRETO:
- src/components/dashboard/kpicard.jsx (minúscula)
- src/pages/dashboard.jsx (falta "Page")
- src/lib/index.js (muito genérico)
- src/hooks/auth.js (falta "use")
```

### Estrutura de Componentes

```javascript
// 1. Imports
import { useState, useEffect } from 'react'
import { formatCurrency } from '../lib/utils'

// 2. Componente
export default function MyComponent({ prop1, prop2 }) {
  // 3. Estado
  const [state, setState] = useState(null)

  // 4. Effects
  useEffect(() => {
    // ...
  }, [])

  // 5. Handlers
  const handleClick = () => {
    // ...
  }

  // 6. Render
  return (
    <div className="container">
      {/* JSX aqui */}
    </div>
  )
}
```

### Estilos Tailwind

```html
<!-- ✅ CORRETO: Classes em ordem lógica -->
<div className="flex items-center justify-between w-full p-4 bg-white rounded-lg shadow-sm">
  ...
</div>

<!-- ❌ INCORRETO: Classes desorganizadas -->
<div className="p-4 flex shadow-sm rounded-lg w-full bg-white justify-between items-center">
  ...
</div>
```

### Variáveis de Ambiente

```env
# ✅ CORRETO: Prefixo claro e descritivo
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://...
VITE_APP_NAME=Capt

# ❌ INCORRETO: Nomes ambíguos
API_URL=...
URL=...
NAME=...
```

## 🎨 Padrões de Design

### Custom Hooks

```javascript
// src/hooks/useBoletos.js
export const useBoletos = () => {
  const [boletos, setBoletos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const data = await getBoletos()
      setBoletos(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return { boletos, loading, error, fetch }
}

// Uso:
const { boletos, loading } = useBoletos()
```

### Context API

```javascript
// src/context/AuthContext.jsx
import { createContext, useState } from 'react'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // ... lógica

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// Uso:
const { user } = useContext(AuthContext)
```

## 📝 Comentários e Documentação

```javascript
// ✅ BOM: Comentário explicando o "por quê"
// Aguardar 300ms antes de fazer fetch para evitar múltiplas requisições
useEffect(() => {
  const timer = setTimeout(() => {
    fetchBoletos(search)
  }, 300)
  return () => clearTimeout(timer)
}, [search])

// ❌ RUIM: Comentário óbvio
// Fazer fetch
fetchBoletos()
```

## 🚀 Performance

### Code Splitting

```javascript
// ✅ Lazy load de páginas
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const RelatoriosPage = lazy(() => import('./pages/RelatoriosPage'))

// Com Suspense
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/dashboard" element={<DashboardPage />} />
  </Routes>
</Suspense>
```

### Memoization

```javascript
// ✅ Memorizar componentes pesados
const BoletoTable = memo(function BoletoTable({ boletos }) {
  return (/* ... */)
})

// ✅ Memorizar callbacks
const handleDelete = useCallback((id) => {
  deleteBoleto(id)
}, [])
```

## 🔒 Segurança

- ❌ Nunca commitar `.env.local`
- ✅ Usar `.env.example` com valores de exemplo
- ✅ Validar dados no backend
- ✅ Usar HTTPS em produção
- ✅ RLS policies no Supabase

---

**Mantenha a estrutura consistente!** 🎯
