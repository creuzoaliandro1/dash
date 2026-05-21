# 🔍 Debug - Seletor de Perfil Ativo

## Problema
O combobox "Perfil Ativo" não está aparecendo mesmo com usuário Master.

## ✅ Passos para Debugar

### 1. **Abra o Console do Navegador**
- Pressione `F12` ou `Ctrl+Shift+I`
- Vá para a aba "Console"

### 2. **Verifique os Logs**
Na página de Boletos, você deverá ver logs como:
```
[BoletosPage] Debug - userType: M user: {id: "...", tipo: "M", ...}
[BoletosPage] getAllContas retornou: [{...}, {...}, ...]
```

**Se NÃO aparecer:**
- userType pode estar vindo como 'U' em vez de 'M'
- getAllContas() pode estar retornando vazio ou erro

### 3. **Verifique o localStorage**
No console, execute:
```javascript
JSON.parse(localStorage.getItem('user'))
```

**Resultado esperado:**
```javascript
{
  id: "...",
  cic: "...",
  name: "...",
  email: "...",
  tipo: "M"   // ← DEVE SER "M" para Master
}
```

**Se tipo não for "M":**
- O usuário no banco de dados não tem `tipo = 'M'`
- Verifique a tabela CONTAS no banco

### 4. **Verifique se getAllContas retorna dados**
No console, busque pelo log:
```
[BoletosPage] getAllContas retornou: [...]
```

**Se não aparecer ou der erro:**
- Pode haver erro na chamada `getAllContas()`
- Verifique a função `getAllContas()` em `src/services/boletoService.js`

## 🔧 Soluções Possíveis

### Solução 1: Usuário não é Master
**Causa**: O campo `tipo` na tabela CONTAS é diferente de 'M'

**Ação**:
1. Verifique no banco de dados qual é o valor em CONTAS.tipo para seu usuário
2. Se for diferente, atualize o código para usar o valor correto:

```javascript
const userType = user.tipo || 'U'  // Mude 'M' para o valor correto
```

### Solução 2: getAllContas retorna vazio
**Causa**: Função pode estar filtrando ou retornando erro

**Ação**:
1. Abra `src/services/boletoService.js`
2. Procure a função `getAllContas()`
3. Verifique se está retornando dados

### Solução 3: Combobox renderiza mas não está visível
**Causa**: Pode estar posicionado fora da viewport

**Ação**:
1. Abra DevTools (F12)
2. Inspecione o elemento:
   - Clique no ícone de seletor (canto superior esquerdo)
   - Clique no combobox
   - Verifique se tem CSS correto

## 📋 Checklist de Validação

- [ ] Console mostra `userType: M`
- [ ] `localStorage.getItem('user').tipo` retorna "M"
- [ ] Console mostra `getAllContas retornou: [...]`
- [ ] Array de contas não está vazio
- [ ] Combobox aparece ao lado do título "Boletos"
- [ ] Consegue mudar de perfil no combobox

## 🆘 Se Ainda Não Aparecer

1. **Compartilhe os logs do console** (copie e cole o que aparece no console)
2. **Verifique no banco de dados** o valor de `CONTAS.tipo` para sua conta
3. **Verifique a função `getAllContas()`** em `src/services/boletoService.js`

## 📝 Informações Técnicas

**Condição para mostrar combobox:**
```javascript
{userType === 'M' && allContas.length > 0 && (
  // Renderiza combobox
)}
```

**Ambas as condições devem ser verdadeiras:**
1. ✅ `userType === 'M'` (usuário é Master)
2. ✅ `allContas.length > 0` (tem contas carregadas)

**Se uma falhar, combobox não aparece.**
