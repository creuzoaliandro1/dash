# 🌐 Deployment Guide - Capt

Guia para fazer deploy da aplicação em produção.

## Frontend - Vercel

### 1. Preparar o projeto

```bash
npm run build
```

### 2. Conectar com Vercel

```bash
npm i -g vercel
vercel
```

### 3. Configurar variáveis de ambiente

No Vercel Dashboard:
- Settings → Environment Variables
- Adicione as variáveis necessárias

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_URL=https://seu-api.com
```

## Backend - Railway / Heroku / DigitalOcean

### Opção 1: Railway (Recomendado)

```bash
npm install -g railway
railway login
railway link
railway up
```

Configurar variáveis em Railway Dashboard:
```env
SUPABASE_URL
SUPABASE_SERVICE_KEY
SUPABASE_ANON_KEY
NODE_ENV=production
PORT=3001
```

### Opção 2: Docker

Criar `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY backend ./backend

EXPOSE 3001

CMD ["node", "backend/server.js"]
```

Depois:
```bash
docker build -t capt-api .
docker run -p 3001:3001 capt-api
```

## Database - Supabase (Gerenciado)

Supabase já cuida de:
- ✅ Backups automáticos
- ✅ SSL/TLS
- ✅ Escalabilidade
- ✅ Monitoring

Nada a fazer! 🎉

## Checklist de Produção

- [ ] Variáveis de ambiente configuradas
- [ ] HTTPS habilitado
- [ ] CORS configurado corretamente
- [ ] Rate limiting implementado
- [ ] Logs configurados
- [ ] Backups automatizados
- [ ] Certificado SSL válido
- [ ] DNS apontando corretamente
- [ ] Testes end-to-end passando
- [ ] Performance otimizada

## Monitoramento

### Supabase
- Dashboard → Logs
- Monitorar queries lentas
- Verificar erros de auth

### Backend
- Implementar logging com Winston/Pino
- Monitorar performance com APM
- Alertas para erros críticos

## Scaling

Para maior volume:

1. **Frontend**: Vercel + CDN (automático)
2. **Backend**: Railway auto-scaling ou Kubernetes
3. **Database**: Supabase Pro com read replicas

## Segurança

```javascript
// Adicionar headers de segurança
app.use(helmet())

// Rate limiting
const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})
app.use('/api/', limiter)

// Validação de input
const { body, validationResult } = require('express-validator')
```

## CI/CD

Exemplo com GitHub Actions (`.github/workflows/deploy.yml`):

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run test
      - name: Deploy to Production
        run: |
          npm run deploy
```

## Troubleshooting

### Erro: "Cannot find module"
```bash
npm ci  # Usar CI para reproduzir exatamente
```

### CORS não funcionando
Verificar `VITE_API_URL` em produção

### Banco não conectando
- Verificar IP whitelist no Supabase
- Testar conexão: `psql -h host -U user`

---

**Pronto para produção!** 🚀
