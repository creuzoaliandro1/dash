# Filtro de Datas na Página de Boletos

## ✅ Recurso Implementado

Adicionada funcionalidade de filtro por datas na página de Boletos, permitindo filtrar registros por:
- **Data de Emissão** (período entre data inicial e final)
- **Data de Vencimento** (período entre data inicial e final)

---

## 🎯 Como Usar

### 1. Abrir o Filtro de Datas
- Clique no botão **📅 Datas** na barra de filtros
- Um painel se abrirá logo abaixo

### 2. Selecionar o Tipo de Data
Escolha entre:
- **Data de Emissão** - filtra boletos por quando foram emitidos
- **Data de Vencimento** - filtra boletos por quando vencem

### 3. Definir o Período
- **De:** data inicial (inclusive)
- **Até:** data final (inclusive)

### 4. Limpar o Filtro
- Clique no botão **Limpar datas** para remover todos os filtros de data

---

## 🔧 Implementação Técnica

### Arquivo Modificado
`src/pages/BoletosPage.jsx`

### Estados Adicionados
```javascript
const [showDateFilters, setShowDateFilters] = useState(false)           // Exibir/ocultar painel
const [dataEmissaoInicio, setDataEmissaoInicio] = useState('')          // Data início emissão
const [dataEmissaoFim, setDataEmissaoFim] = useState('')                // Data fim emissão
const [dataVencimentoInicio, setDataVencimentoInicio] = useState('')     // Data início vencimento
const [dataVencimentoFim, setDataVencimentoFim] = useState('')           // Data fim vencimento
const [filterType, setFilterType] = useState('emissao')                  // Tipo de filtro ativo
```

### Função `getFilteredBoletos()` - Atualizada
Agora inclui lógica para filtrar por datas:
- Se `filterType === 'emissao'`: filtra por `data_emissao`
- Se `filterType === 'vencimento'`: filtra por `data_vencimento`
- Comparação usa formato YYYY-MM-DD para garantir precisão

### Nova Função
```javascript
handleClearDateFilters()  // Limpa todos os filtros de data
```

### UI Components
- **Botão de ativação** - 📅 Datas (azul quando ativo)
- **Painel expansível** - com radio buttons e campos de data
- **Inputs de data** - HTML5 `<input type="date">`

---

## 📋 Exemplos de Uso

### Exemplo 1: Boletos Emitidos em Maio/2026
1. Clique em **📅 Datas**
2. Selecione **Data de Emissão**
3. De: `2026-05-01`
4. Até: `2026-05-31`
5. ✅ Tabela mostra apenas boletos emitidos em maio

### Exemplo 2: Boletos Vencendo em Junho/2026
1. Clique em **📅 Datas**
2. Selecione **Data de Vencimento**
3. De: `2026-06-01`
4. Até: `2026-06-30`
5. ✅ Tabela mostra apenas boletos com vencimento em junho

### Exemplo 3: Combinando Filtros
- **Busca por texto** → "Cliente X"
- **Status** → "Pendente"
- **Data de Vencimento** → "2026-06-01 a 2026-06-30"
- ✅ Resultado: apenas boletos pendentes do "Cliente X" que vencem em junho

---

## 🎨 Características Visuais

| Aspecto | Detalhe |
|---------|---------|
| Padrão de design | Mantém consistência com restante da aplicação |
| Cores | Azul (#1a5490) quando ativo, cinza (#1a1a1a) quando inativo |
| Responsividade | Painel se adapta a diferentes tamanhos de tela |
| Acessibilidade | Radio buttons com labels clicáveis |

---

## ⚙️ Comportamento

### Ao Trocar de Filtro
- Ao mudar de **Data de Emissão** → **Data de Vencimento**: campos anteriores são automaticamente limpos
- Evita confusão ou filtros conflitantes

### Ao Limpar Datas
- Todos os 4 campos de data são zerados
- Botão **Limpar datas** está sempre visível no painel

### Compatibilidade com Outros Filtros
- ✅ Funciona com filtro de **Busca por texto**
- ✅ Funciona com filtro de **Status**
- ✅ Funciona com **Seleção de linhas** (ações)

---

## 📊 Dados Armazenados

Os boletos possuem dois campos de data:
- `data_emissao` - YYYY-MM-DD (quando o boleto foi criado)
- `data_vencimento` - YYYY-MM-DD (quando o boleto vence)

Ambos são comparados usando operadores >= (maior ou igual) e <= (menor ou igual).

---

## 🧪 Como Testar

### Teste 1: Filtrar por Emissão
1. Importe vários boletos de datas diferentes
2. Use o filtro de **Data de Emissão**
3. Verifique se apenas boletos do período aparecem

### Teste 2: Filtrar por Vencimento
1. Selecione **Data de Vencimento**
2. Escolha um mês específico
3. Verifique se apenas boletos vencendo naquele mês aparecem

### Teste 3: Combo Filters
1. Aplique busca + status + data
2. Verifique se todos os filtros funcionam juntos

### Teste 4: Limpar
1. Aplique vários filtros
2. Clique **Limpar datas**
3. Verifique se volta ao estado original

---

## 📝 Notas

- Filtro de datas não afeta a contagem de registros no lado do servidor
- Todas as operações são feitas em tempo real (sem recarregar)
- Datas em formato ISO (YYYY-MM-DD) para compatibilidade internacional
- O painel de datas pode ser aberto/fechado quantas vezes necessário

---

## 🚀 Próximas Melhorias Sugeridas

- [ ] Salvar últimos filtros usados no localStorage
- [ ] Presets rápidos (Hoje, Última semana, Último mês, etc.)
- [ ] Gráfico de distribuição por data
- [ ] Export filtrado para Excel/CSV

---

**Data de implementação:** 14/05/2026  
**Versão:** 1.0  
**Status:** ✅ Implementado e testado
