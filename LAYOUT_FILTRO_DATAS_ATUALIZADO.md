# Layout Filtro de Datas - Atualizado

## ✅ Melhorias Realizadas

- ✅ Filtro de datas **sempre visível** (sem botão para expandir)
- ✅ Checkboxes e campos de data **na mesma linha**
- ✅ Ícone de **lupa** para indicar ação de filtro
- ✅ Layout mais compacto e organizado
- ✅ Melhor UX com todos os controles acessíveis

---

## 📐 Layout Visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│ [Buscar texto...                     ] [Todos status] ◉ Emissão ○ Venc...  │
│                                                                              │
│ [2026-05-01] [2026-05-31] 🔍 Limpar datas [Ações]                         │
│
│ Legenda:
│ - [Buscar...] = Campo de busca por texto (flex-1)
│ - [Todos status] = Select de status
│ - ◉ Emissão = Radio button selecionado
│ - ○ Vencimento = Radio button deseleccionado
│ - [2026-05-01] = Input de data inicial
│ - [2026-05-31] = Input de data final
│ - 🔍 = Botão com ícone de lupa (branco)
│ - Limpar datas = Botão para resetar datas
│ - [Ações] = Botão de ações
│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Componentes na Linha de Filtros

### 1. Campo de Busca (flex-1)
- **Placeholder:** "Buscar por documento, cliente, nosso número..."
- **Ícone:** Lupa à direita
- **Ocupa:** Espaço restante

### 2. Select de Status
- **Opções:** Todos os status, Pendente, Pago, Atrasado, Cancelado
- **Tamanho:** Fixo

### 3. Radio Buttons (Tipo de Data)
- **Opção 1:** Emissão (padrão)
- **Opção 2:** Vencimento
- **Comportamento:** Ao mudar, campos da opção anterior são zerados
- **Labels:** "Emissão" e "Vencimento" (bem pequenos)

### 4. Campos de Data (2)
- **Primeiro:** Data inicial (De)
- **Segundo:** Data final (Até)
- **Tipo:** HTML5 date input
- **Width:** 32 (w-32 tailwind)
- **Abre calendário** ao clicar

### 5. Botão Filtrar 🔍
- **Cor:** Branco (#ffffff) = destaca
- **Ícone:** Lupa (SVG)
- **Função:** Ativa filtro (já funciona automaticamente com onChange)
- **Tamanho:** Pequeno (px-3 py-2)

### 6. Botão Limpar Datas
- **Cor:** Cinza (#1a1a1a) com borda
- **Função:** Zera todos os 4 campos de data
- **Tamanho:** Pequeno

### 7. Botão Ações
- **Função:** Menu de ações (segunda via, etc)
- **Disabled:** Quando nenhuma linha está selecionada
- **Tamanho:** Normal

---

## 🔄 Fluxo de Uso

### Cenário 1: Filtrar por Data de Emissão

```
1. Painel já está visível (sem clicar em nada)
2. Selecione "Emissão" (já está selecionado)
3. Clique no primeiro campo de data e escolha: 2026-05-01
4. Clique no segundo campo e escolha: 2026-05-31
5. ✅ Tabela filtra automaticamente em tempo real
6. Opcionalmente clique no 🔍 para confirmar (ação visual)
```

### Cenário 2: Filtrar por Data de Vencimento

```
1. Clique no radio button "Vencimento"
2. Campos de emissão são zerados automaticamente
3. Clique no primeiro campo: 2026-06-01
4. Clique no segundo campo: 2026-06-30
5. ✅ Tabela filtra para vencimentos em junho
6. Clique 🔍 (opcional)
```

### Cenário 3: Combinar com Outros Filtros

```
1. Digite "Cliente A" na busca
2. Selecione "Pendente" em status
3. Selecione "Emissão" e escolha datas de maio
4. ✅ Resultado: apenas boletos pendentes de Cliente A emitidos em maio
```

---

## 🎯 Posicionamento Exato (Tailwind)

```jsx
<div className="flex gap-3 items-end">
  {/* 1. Busca (flex-1) */}
  <div className="flex-1 relative">...</div>
  
  {/* 2. Status */}
  <select className="...">...</select>
  
  {/* 3. Radio Buttons */}
  <div className="flex gap-2 items-center">
    <label>Emissão</label>
    <label>Vencimento</label>
  </div>
  
  {/* 4. Campos de Data */}
  <input type="date" className="w-32" />
  <input type="date" className="w-32" />
  
  {/* 5. Botão Lupa */}
  <button className="px-3 py-2 bg-white">🔍</button>
  
  {/* 6. Limpar */}
  <button className="...">Limpar datas</button>
  
  {/* 7. Ações */}
  <div className="relative">...</div>
</div>
```

**Alinhamento:** `items-end` → todos alinhados ao final (bottom)

---

## 💡 Características Especiais

### Auto-Filtro em Tempo Real
- ✅ Nenhum clique necessário
- ✅ Filtra conforme você digita/seleciona
- ✅ O botão 🔍 é apenas visual

### Campos Condicionais
- Se **Emissão** selecionado → mostra campos de emissão
- Se **Vencimento** selecionado → mostra campos de vencimento
- Ao trocar → campos anteriores são zerados

### Compatibilidade
- ✅ Funciona com busca de texto
- ✅ Funciona com filtro de status
- ✅ Funciona com seleção de linhas
- ✅ Todos os filtros trabalham juntos

---

## 🔧 Mudanças Técnicas

### Arquivo Modificado
`src/pages/BoletosPage.jsx`

### Remoções
- ❌ `showDateFilters` state (não é mais necessário)
- ❌ Botão "📅 Datas" para expandir
- ❌ Painel separado em `space-y-3`

### Alterações
- ✅ Filtros sempre visíveis
- ✅ Tudo em uma única linha `flex gap-3 items-end`
- ✅ Ícone de lupa no botão de filtro
- ✅ Campos de data mais compactos (`w-32`)
- ✅ Radio buttons lado a lado

### Mantido
- ✅ Lógica de filtro em `getFilteredBoletos()`
- ✅ Função `handleClearDateFilters()`
- ✅ Auto-limpeza ao trocar filtro
- ✅ Compatibilidade com outros filtros

---

## 🎨 Estilos

| Elemento | Cor | Fundo |
|----------|-----|-------|
| Busca | #666666 (placeholder) | #111111 |
| Select Status | #ffffff | #111111 |
| Radio Buttons | #ffffff | - |
| Inputs Data | #ffffff | #111111 |
| Botão Lupa | #000000 | #ffffff |
| Botão Limpar | #ffffff | #1a1a1a |
| Botão Ações | #ffffff | #1a1a1a |

---

## 📱 Responsividade

- **Desktop:** Tudo em uma linha
- **Tablet:** Pode quebrar em 2 linhas se necessário
- **Mobile:** Layout se adapta (flex wraps)

---

## ✨ Melhorias Visuais

✓ **Mais limpo:** Sem painel expansível
✓ **Mais direto:** Acesso imediato aos filtros
✓ **Mais intuitivo:** Checkbox radio e datas lado a lado
✓ **Mais visual:** Botão de lupa branco destaca
✓ **Mais compacto:** Tudo na mesma linha principal

---

## 🧪 Como Testar

1. **Hard refresh:** Ctrl+Shift+R
2. **Ir para página de Boletos**
3. **Verificar que:**
   - [ ] Filtros de data estão sempre visíveis
   - [ ] Radio buttons e datas estão na mesma linha
   - [ ] Botão 🔍 é branco e destaca
   - [ ] Filtro funciona ao selecionar datas
   - [ ] Botão "Limpar datas" reseta tudo
   - [ ] Funciona com busca e status
   - [ ] Responsivo em mobile

---

**Data:** 14/05/2026  
**Status:** ✅ Implementado
**Versão:** 2.0
