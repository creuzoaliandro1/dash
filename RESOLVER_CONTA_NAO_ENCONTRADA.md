# 🔧 Resolver: "Conta Não Encontrada para Código: 095388"

**Data:** 11/05/2026  
**Problema:** Sistema não encontra a conta `095388` na tabela `contas`

---

## 🎯 O Que Aconteceu

1. ✅ Sistema extraiu `095388` do código de barras corretamente
2. ✅ Sistema procurou pela conta no banco
3. ❌ Conta **não existe** em `contas` - **ERRO!**

---

## ✅ Solução em 3 Minutos

### Passo 1: Abra Supabase Dashboard

https://app.supabase.com → Seu Projeto → Menu **SQL Editor**

### Passo 2: Criar Nova Query

Clique em **New Query** (botão azul)

### Passo 3: Cole Este SQL

```sql
-- Inserir a conta que está faltando
INSERT INTO "CONTAS" ("conta", "usuario_id", "banco_codigo", "nome_titular", "documento_titular")
VALUES (
  '09538802',                           -- Conta + dígito verificador
  'COLOQUE_SEU_USER_ID_AQUI',           -- Seu UUID
  '274',                                -- Banco Itaú (encontrado no arquivo)
  'RETIFICA VOLANTE',                   -- Nome do titular (do arquivo)
  '59849652000148'                      -- CNPJ (do arquivo)
)
ON CONFLICT ("conta") DO NOTHING;
```

### Passo 4: Substituir `COLOQUE_SEU_USER_ID_AQUI`

**Opção A - Usar seu user-id real:**

1. Vá para **Authentication** → **Users**
2. Encontre seu usuário
3. Copie o **UUID** (coluna esquerda)
4. Substitua no SQL acima

**Opção B - Usar UUID de teste:**

```
550e8400-e29b-41d4-a716-446655440000
```

### Passo 5: Executar

Clique em **Run** (ícone play azul)

**Resultado esperado:**
```
INSERT 0 1
```

Ou se já existir:
```
INSERT 0 0
```

(Ambas estão OK)

### Passo 6: Verificar

Execute este SQL para confirmar:

```sql
SELECT * FROM "CONTAS" WHERE "conta" = '09538802';
```

**Deve retornar 1 linha:**
```
| "id" (UUID) | "conta"  | "usuario_id"         | "banco_codigo" | ... |
|-------------|----------|----------------------|----------------|-----|
| xxx...      | 09538802 | 550e8400-...        | 274            | ... |
```

---

## 🔄 Agora Tente Importar Novamente

1. Volte ao **Frontend** da aplicação
2. Vá para **"Importar Boletos"**
3. Selecione o arquivo Excel
4. Clique em **"Importar"**

**Desta vez deve funcionar!** ✅

---

## 🤔 E Se Houver Múltiplas Contas?

Se o erro disser `095389` ou outros números depois, **repita o processo:**

```sql
INSERT INTO "CONTAS" ("conta", "usuario_id", "banco_codigo", "nome_titular", "documento_titular")
VALUES (
  '09538902',                           -- Nova conta (com dígito)
  'SEU_USER_ID',
  '274',
  'RETIFICA VOLANTE',
  '59849652000148'
)
ON CONFLICT ("conta") DO NOTHING;
```

Basta mudar o número da conta.

---

## 📋 Tabela de Referência

**Do seu arquivo:**

| Campo | Valor |
|-------|-------|
| Banco | 274 (Itaú) |
| Código de Barras | 27490001019000000005083095388001315... |
| Posição 24-30 | **095388** ← Número da conta (sem dígito) |
| Número completo | **09538802** ← Com dígito |
| Nome do Titular | RETIFICA VOLANTE |
| CNPJ | 59849652000148 |

---

## 🔍 Debug: Como Encontrar Todas as Contas do Arquivo

**Manualmente:**

1. Abra o arquivo Excel
2. Vá para coluna **27** ("Linha digitável")
3. Pegue a primeira linha com dados (ex: "27490001019000000005083095388001...")
4. Conte para a posição 24-30: **095388**
5. Adicione dígito: **09538802**

**Ou copie este SQL para testar:**

```sql
-- Ver todas as contas já inseridas
SELECT DISTINCT LEFT("conta", 7) as "numero_conta", "conta", "usuario_id" 
FROM "CONTAS" 
ORDER BY "conta";
```

---

## ✨ Dicas

- **Conta está em formato:** `XXXXXXXX2` (7 dígitos + 1 dígito verificador)
- **Código de barras:** 47-50 dígitos na coluna 27
- **Posição 24-30:** Sempre no mesmo lugar do código de barras
- **Usuario_id:** Use o mesmo para todos se for uma empresa

---

## 🎯 Checklist

- [ ] Abri Supabase Dashboard
- [ ] Vou para SQL Editor
- [ ] Criei New Query
- [ ] Colei o SQL INSERT
- [ ] Substituí `COLOQUE_SEU_USER_ID_AQUI` pelo meu UUID
- [ ] Executei com Run
- [ ] Verifiquei com SELECT
- [ ] Voltei ao frontend
- [ ] Cliquei em "Importar Boletos"
- [ ] Sistema agora encontrou a conta! ✅

---

## 🚨 Se Ainda Não Funcionar

1. Verifique se o `usuario_id` está correto (copy/paste sem erros)
2. Verifique se a conta foi realmente inserida (execute SELECT)
3. Verifique se a conta começa com `09538802` (não confunda com `095388`)
4. Limpe cache do navegador: Ctrl+Shift+Delete

---

**Pronto?** Volte para o frontend e tente importar novamente!

Quando funcionar: 🎉 Parabéns! Seu arquivo com 1.113 boletos será importado!
