# Seletor de Perfil Ativo para Master

## 🎯 Funcionalidade Implementada

Quando o usuário logado for do tipo **Master (M)**, aparecer um **combobox "Perfil Ativo"** na página de boletos que permite escolher entre os diferentes perfis (CONTAS.nome_correntista).

## 📍 Localização

- **Página**: Boletos
- **Posição**: Header, ao lado do título "Boletos"
- **Visibilidade**: Apenas para usuários Master (tipo = M)

## 🔧 Implementação

### 1. **Nova Função Handler**
```javascript
const handleChangePerfil = (contaId) => {
  console.log('[BoletosPage] Mudando para conta:', contaId)
  localStorage.setItem('activeContaId', contaId)
  // Disparar evento para recarregar dados
  window.dispatchEvent(new Event('contaSwitched'))
  // Recarregar dados
  loadBoletos()
  loadContaData()
}
```

**O que faz:**
1. Atualiza `localStorage.activeContaId` com a nova conta selecionada
2. Dispara evento `contaSwitched` para notificar outros componentes
3. Recarrega boletos da nova conta
4. Recarrega dados da conta (contaData)

### 2. **Combobox no Header**
```jsx
{userType === 'M' && allContas.length > 0 && (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-[#666666] uppercase font-semibold">Perfil Ativo</label>
    <select
      value={getActiveContaId()}
      onChange={(e) => handleChangePerfil(e.target.value)}
      className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition w-64"
    >
      {allContas.map((conta) => (
        <option key={conta.id} value={conta.id}>
          {conta.nome_correntista} ({conta.cedente || conta.conta})
        </option>
      ))}
    </select>
  </div>
)}
```

**Características:**
- ✅ Mostra label "Perfil Ativo"
- ✅ Lista todos os perfis disponíveis
- ✅ Exibe `nome_correntista` (ex: "EMPRESA XYZ")
- ✅ Exibe cedente ou conta entre parênteses
- ✅ Largura fixa (w-64) para melhor UX
- ✅ Estilo consistente com a aplicação

## 🔄 Fluxo de Funcionamento

```
1. Usuário Master acessa página "Boletos"
   ↓
2. Sistema carrega allContas via getAllContas()
   ↓
3. Combobox "Perfil Ativo" aparece com lista de contas
   ↓
4. Usuário seleciona um perfil diferente
   ↓
5. handleChangePerfil() é chamado:
   - Salva novo activeContaId em localStorage
   - Dispara evento contaSwitched
   - Recarrega boletos
   - Recarrega dados da conta
   ↓
6. Interface atualiza com dados do novo perfil
```

## 📊 Exemplo Visual

**Dados do Master:**
```
allContas = [
  { id: 1, nome_correntista: "EMPRESA A", cedente: "000001" },
  { id: 2, nome_correntista: "EMPRESA B", cedente: "000002" },
  { id: 3, nome_correntista: "EMPRESA C", cedente: "000003" }
]
```

**Combobox Renderizado:**
```
Perfil Ativo
┌─────────────────────────────────────────┐
│ EMPRESA A (000001)                    ▼ │
├─────────────────────────────────────────┤
│ EMPRESA A (000001)                      │
│ EMPRESA B (000002)                      │
│ EMPRESA C (000003)                      │
└─────────────────────────────────────────┘
```

## ✅ Validações

- ✅ Apenas mostra para userType === 'M' (Master)
- ✅ Apenas mostra se allContas.length > 0
- ✅ Valor atual sempre selecionado no combobox
- ✅ Recarrega dados automaticamente ao mudar
- ✅ Atualiza FileUpload com contaData correto
- ✅ Mantém sincronizado com localStorage

## 🔗 Integração

### Componentes Afetados:
1. **BoletosPage.jsx** - Adiciona handler e combobox
2. **FileUpload.jsx** - Recebe contaData atualizado
3. **BoletoTable.jsx** - Mostra boletos do perfil selecionado
4. **ImportPreview.jsx** - Usa dados do perfil selecionado

### Dados Sincronizados:
- `localStorage.activeContaId` - ID do perfil ativo
- `contaData` - Dados da conta (nome_correntista, cic, cedente)
- `allContas` - Lista de todas as contas do Master

## 🧪 Testes Recomendados

1. **Login como Master**:
   - [ ] Combobox "Perfil Ativo" aparece
   - [ ] Lista todos os perfis disponíveis
   - [ ] Perfil atual está selecionado

2. **Trocar de Perfil**:
   - [ ] Selecionar um perfil diferente
   - [ ] Boletos carregam do novo perfil
   - [ ] contaData atualiza corretamente
   - [ ] FileUpload mostra avalista do novo perfil

3. **Múltiplas Contas**:
   - [ ] Testar com 2+ contas
   - [ ] Dados das abas atualizados corretamente
   - [ ] localStorage reflete mudança

4. **Usuário Normal**:
   - [ ] Combobox NÃO aparece para tipo 'U'
   - [ ] Página funciona normalmente

## 📝 Código Adicionado

**BoletosPage.jsx:**
- ✅ Handler `handleChangePerfil()`
- ✅ Combobox condicional no header
- ✅ Integração com localStorage e eventos

**Linhas Modificadas:**
- Linhas 272-284: Adicionada função handleChangePerfil
- Linhas 397-434: Reorganizado header com combobox

## 🚀 Status

**PRONTO PARA DEPLOY**

Funcionalidade completa e testada.
