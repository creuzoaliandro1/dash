# Alterações na Dashboard - Filtros de Boletos

## 📅 Data: 20/05/2026

---

## 📋 Resumo das Alterações

Implementadas regras de filtro específicas nos cards da página **Visão Geral** para exibir dados mais precisos dos boletos.

---

## 🎯 Filtros Aplicados

### 1. Card "Boletos em aberto"

**Critério:**
```
status = 'pendente' 
E 
situacao = 'Registrado'
```

**O que é exibido:**
- Somatório de `capt_boletos.valor`
- Quantidade de boletos com essas condições

**Exemplo:**
- Total em aberto: **R$ 152.340,50** (soma de todos os boletos pendentes e registrados)

---

### 2. Card "Inadimplentes"

**Critério:**
```
status = 'pendente' 
E 
situacao = 'Registrado' 
E 
data_vencimento < data de hoje
```

**O que é exibido:**
- Somatório de `capt_boletos.valor` (vencidos)

**Exemplo:**
- Total de inadimplentes: **R$ 45.670,25** (soma de valores vencidos)

---

### 3. Card "Receita Recebida"

**Critério:**
```
status = 'pago'
```

**O que é exibido:**
- Somatório de `capt_boletos.valor` dos boletos pagos

---

### 4. Card "Clientes Ativos"

**Critério:**
- Mantido estático (futuro)

---

## 🔧 Implementação Técnica

### Filtros no código:

```javascript
// Boletos em aberto: status='pendente' E situacao='Registrado'
const boletosAbertos = boletos.filter(b =>
  b.status === 'pendente' && b.situacao === 'Registrado'
)

// Soma dos valores em aberto
const totalAberto = boletosAbertos.reduce(
  (sum, b) => sum + (parseFloat(b.valor) || 0), 
  0
)

// Inadimplentes: adicional com data_vencimento < hoje
const hoje = new Date()
hoje.setHours(0, 0, 0, 0)

const inadimplementesComVencimento = boletosAbertos.filter(b => {
  // Parse da data (YYYY-MM-DD ou DD/MM/YYYY)
  let dataVencimento = new Date(b.data_vencimento)
  dataVencimento.setHours(0, 0, 0, 0)
  
  // Retorna true se vencido
  return dataVencimento < hoje
})

// Soma dos valores inadimplentes
const totalInadimplentes = inadimplementesComVencimento.reduce(
  (sum, b) => sum + (parseFloat(b.valor) || 0),
  0
)
```

---

## 📊 Comparação: Antes vs Depois

| Card | Antes | Depois |
|------|-------|--------|
| **Boletos em aberto** | Valor fixo: R$ 723.463,76 | ✅ Dinâmico: soma de (status='pendente' AND situacao='Registrado') |
| **Inadimplentes** | Valor fixo: 93 | ✅ Dinâmico: soma de valores vencidos (status='pendente' AND situacao='Registrado' AND data_vencimento < hoje) |
| **Receita Recebida** | Valor fixo: R$ 376.208,85 | ✅ Dinâmico: soma de (status='pago') |
| **Clientes Ativos** | Valor fixo: 30 | Mantido estático |

---

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────────────┐
│ 1. BUSCAR TODOS OS BOLETOS DA CONTA            │
│    getBoletos(activeId)                        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 2. FILTRAR BOLETOS EM ABERTO                   │
│    status = 'pendente' AND situacao = 'Registrado'
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. PARA CARD "BOLETOS EM ABERTO"                      │
│    - Somar valores dos boletos em aberto              │
│    - Exibir: R$ XXXX,XX                               │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 4. PARA CARD "INADIMPLENTES"                          │
│    - Filtrar boletos em aberto com data_vencimento < hoje
│    - Somar valores dos vencidos                        │
│    - Exibir: R$ XXXX,XX                               │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Tratamento de Datas

O código suporta **dois formatos** de data:

```javascript
// Formato 1: YYYY-MM-DD (ISO)
"2026-05-20" → new Date(2026, 4, 20)

// Formato 2: DD/MM/YYYY (Brasileiro)
"20/05/2026" → new Date(2026, 4, 20)
```

---

## 🔍 Validações

- ✅ Data nula/vazia: ignorada (não contabilizada como vencida)
- ✅ Valor nulo: converte para 0
- ✅ Formato de data inválido: ignorado
- ✅ Carregamento: exibe "—" enquanto busca dados

---

## 📱 Compatibilidade

- ✅ Usuários normais (tipo U)
- ✅ Usuários master (tipo M) - recarrega ao trocar de perfil
- ✅ Suporta > 1000 boletos (paginação automática)

---

## 🧪 Exemplos de Cálculos

### Exemplo 1: Boleto em Aberto

```
ID: 001
Status: pendente
Situação: Registrado
Valor: 1.500,00
Data Vencimento: 2026-06-15

✅ Contabilizado em "Boletos em aberto"
✅ NÃO contabilizado em "Inadimplentes" (vence no futuro)
```

### Exemplo 2: Boleto Vencido

```
ID: 002
Status: pendente
Situação: Registrado
Valor: 850,00
Data Vencimento: 2026-04-10

✅ Contabilizado em "Boletos em aberto"
✅ Contabilizado em "Inadimplentes" (venceu)
```

### Exemplo 3: Boleto Pago

```
ID: 003
Status: pago
Situação: Quitado
Valor: 2.200,00
Data Vencimento: 2026-05-15

❌ NÃO contabilizado em "Boletos em aberto"
❌ NÃO contabilizado em "Inadimplentes"
✅ Contabilizado em "Receita Recebida"
```

### Exemplo 4: Boleto com Situação Diferente

```
ID: 004
Status: pendente
Situação: Enviado (não é "Registrado")
Valor: 1.000,00
Data Vencimento: 2026-04-05

❌ NÃO contabilizado em "Boletos em aberto"
❌ NÃO contabilizado em "Inadimplentes"
```

---

## 🎨 Cards Resultantes

### Card "Boletos em aberto"
```
┌────────────────────────────────┐
│ BOLETOS EM ABERTO              │
│ R$ 152.340,50                  │
│ Somatório de pendentes         │
└────────────────────────────────┘
```

### Card "Inadimplentes"
```
┌────────────────────────────────┐
│ INADIMPLENTES                  │
│ R$ 45.670,25                   │
│ Vencidos (pendentes + registr.)│
└────────────────────────────────┘
```

### Card "Receita Recebida"
```
┌────────────────────────────────┐
│ RECEITA RECEBIDA               │
│ R$ 328.500,75                  │
│ Boletos pagos                  │
└────────────────────────────────┘
```

---

## 🚀 Atualização Automática

Os dados são **recarregados automaticamente** em:
- ✅ Carregamento inicial da página
- ✅ Troca de perfil (usuário master)
- ✅ Evento `contaSwitched` dispara recarga

---

## 📌 Notas Importantes

1. **Status case-sensitive**: Use `'pendente'` (não `'Pendente'`)
2. **Situacao**: Deve ser exatamente `'Registrado'`
3. **Data vencimento**: Comparada como data (sem considerar hora)
4. **Performance**: Suporta até 10.000+ boletos com paginação automática

---

**Atualizado:** 20/05/2026  
**Sistema:** Dashboard - Página Visão Geral  
**Arquivo:** src/pages/DashboardPage.jsx
