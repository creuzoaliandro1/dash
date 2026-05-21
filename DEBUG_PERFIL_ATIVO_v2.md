# 🔍 Debug - Seletor de Perfil Ativo (v2 - Melhorado)

## ✅ Melhorias Implementadas

Para diagnosticar melhor por que o combobox não está aparecendo, adicionamos logs mais detalhados:

### 1. **Melhor logging no boletoService.js**
- `getAllContas()` agora loga:
  - Total de contas retornadas
  - Campos da primeira conta
  - Exemplo de uma conta completa

### 2. **Logs expandidos em BoletosPage.jsx**
- useEffect de carregamento de contas agora loga:
  - `[BoletosPage] useEffect getAllContas - userType: (valor)`
  - `[BoletosPage] Chamando getAllContas()...`
  - **Se Master**: processa dados
  - **Se NÃO Master**: `Usuário NÃO é Master, pulando getAllContas()`
  
- Render agora loga a cada atualização:
  - `userType`: valor atual (deve ser 'M')
  - `allContasLength`: número de contas carregadas
  - `shouldShow`: true/false (se combobox deve aparecer)
  - `allContasSample`: exemplo de 2 primeiras contas

### 3. **Correção de Query**
- `getAllContas()` agora seleciona também `cedente` e `cic`
- Anteriormente estava faltando `cedente`, que é usado no combobox

## 🧪 Verificação Passo a Passo

### Passo 1: Abrir Console do Navegador
```
F12 → aba "Console"
```

### Passo 2: Fazer um REFRESH da página (F5)
Para forçar o useEffect a rodar novamente.

### Passo 3: Verificar os logs em ordem

**Esperado:**
```
[BoletosPage] Debug - userType: M user: {...}
[BoletosPage] useEffect getAllContas - userType: M
[BoletosPage] Usuário é Master, chamando getAllContas()...
[getAllContas] Resultado da query:
  Total de contas: X
  Primeira conta - campos: [...]
  Exemplo: {...}
[BoletosPage] ✅ Contas carregadas com sucesso! Total: X
[BoletosPage] PRIMEIRA CONTA - TODOS OS CAMPOS: {...}
[BoletosPage] Resumo das 3 primeiras contas: [...]
[BoletosPage] Chamando setAllContas com X contas
[BoletosPage] render - Perfil Ativo visibility check: {
  userType: "M",
  allContasLength: X,
  shouldShow: true,
  allContasSample: [...]
}
```

## ❌ Diagnóstico por Sintomas

### Cenário 1: `userType` não é 'M'
**Log que aparece:**
```
[BoletosPage] Debug - userType: U user: {...}
[BoletosPage] Usuário NÃO é Master, pulando getAllContas()
```

**Solução:**
1. Verifique a tabela CONTAS no banco - a coluna `tipo` do seu usuário deve ser 'M'
2. Execute no banco: `SELECT id, tipo FROM CONTAS WHERE id = 'seu-id'`
3. Se não for 'M', atualize com: `UPDATE CONTAS SET tipo = 'M' WHERE id = 'seu-id'`

### Cenário 2: `getAllContas()` retorna vazio
**Log que aparece:**
```
[getAllContas] Resultado da query:
  Total de contas: 0
[BoletosPage] ⚠️ getAllContas retornou vazio ou undefined
[BoletosPage] render - Perfil Ativo visibility check: {
  userType: "M",
  allContasLength: 0,
  shouldShow: false
}
```

**Solução:**
1. Verifique se há dados na tabela CONTAS: `SELECT COUNT(*) FROM CONTAS`
2. Se estiver vazia, insira dados de teste:
```sql
INSERT INTO CONTAS (nome_correntista, cedente, conta, cic, tipo) 
VALUES ('TESTE', '000001', '123456', '12.345.678/0001-90', 'M')
```

### Cenário 3: `getAllContas()` retorna erro
**Log que aparece:**
```
[getAllContas] Erro ao buscar contas: {...}
[BoletosPage] ❌ Erro ao carregar contas: {...}
```

**Solução:**
Verifique a mensagem de erro exata no console. Pode ser:
- Permissão insuficiente (RLS policy)
- Nome de coluna incorreto (se `cedente` não existe)
- Problema de conexão Supabase

### Cenário 4: Combobox não renderiza apesar de logs corretos
**Log que aparece:**
```
[BoletosPage] render - Perfil Ativo visibility check: {
  userType: "M",
  allContasLength: 5,
  shouldShow: true
}
```
**Mas o combobox não aparece na tela**

**Solução:**
1. Inspecione o elemento com DevTools:
   - Clique no ícone de seletor (canto superior esquerdo do DevTools)
   - Clique onde o combobox deveria estar
   - Verifique se o `<div>` com `flex flex-col gap-1 ml-6` está lá mas invisível
2. Se estiver invisível, pode ser CSS (overflow, z-index, display)

## 🔧 Checklist de Depuração

- [ ] Refresh da página com F5
- [ ] Abrir console (F12)
- [ ] Ver logs começando com `[BoletosPage] Debug - userType:`
- [ ] Ver `[BoletosPage] render - Perfil Ativo visibility check:` com shouldShow: true
- [ ] Se shouldShow: false, investigar qual condição falhou (userType ou allContasLength)
- [ ] Se shouldShow: true mas combobox não aparecer, verificar DOM/CSS

## 📋 Copiar Logs Completos

Para facilitar debugging, copie os logs assim:
1. Clique com botão direito no primeiro log da sessão
2. Selecione "Save as..." ou "Copy"
3. Cole em um arquivo de texto
4. Compartilhe conosco

## 🔗 Campos Agora Inclusos

A query de `getAllContas()` agora retorna:
- ✅ `id`
- ✅ `nome_correntista`
- ✅ `conta`
- ✅ `cedente` ← NOVO
- ✅ `cnpj`
- ✅ `cpf_cnpj`
- ✅ `documento`
- ✅ `cic` ← NOVO

---

**Status**: 🚀 Versão melhorada com logs detalhados - pronta para investigação
