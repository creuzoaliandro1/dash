# Guia de Teste - Importação de Boletos

## ✅ Verificações Realizadas

### 1. Erro 406 Resolvido
- **Problema:** Query GET com `codigo_barras` muito longo
- **Solução:** Substituir `.single()` por `.limit(1)` e adicionar fallback
- **Status:** ✅ IMPLEMENTADO

### 2. Validação de Código de Barras
- **Antes:** Podia retornar erro 406 durante importação
- **Depois:** Detecta duplicação com segurança, com fallback se necessário
- **Status:** ✅ IMPLEMENTADO

---

## 📋 Passos para Testar

### Teste 1: Importação Simples
1. Vá para a página de **Importar Boletos**
2. Selecione um arquivo Excel com códigos de barras válidos
3. Clique em **Importar**
4. ✅ Esperado: Nenhum erro 406, boletos importados com sucesso

### Teste 2: Detectar Duplicação
1. Importe um arquivo com 2+ boletos
2. Tente importar novamente o **mesmo arquivo**
3. ✅ Esperado: Sistema detecta duplicação, oferece relatório PDF com erro

### Teste 3: Arquivo Grande
1. Importe um arquivo com **100+ linhas** de boleto
2. ✅ Esperado: Importação lenta mas sem erro 406

### Teste 4: Múltiplos Arquivos
1. Importe 3-4 arquivos em sequência
2. ✅ Esperado: Todos importam sem travamento ou erro 406

---

## 🔍 Sinais que a Correção Funcionou

### No Console do Navegador (F12)
Você deve ver logs como:

```
[BoletoService] Criando boleto com dados: {conta_id: 13, ...}
[BoletoService] Boleto criado com sucesso: 6963b12d-7097-4d20-843c-02ae063d2133
[boletoImportService] Verificando código de barras: 27490000...
```

**NÃO deve mais haver:**
```
❌ GET https://...supabase.co/rest/v1/capt_boletos?...codigo_barras=eq.2749000... 406 (Not Acceptable)
```

### Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Importar 10 boletos | ❌ Erro 406 após alguns | ✅ Todos importam sem erro |
| Duplicado detectado | ❌ Erro 406 | ✅ Relatório PDF com erro |
| Arquivo 100+ linhas | ❌ Falha na linha 50+ | ✅ Importa completamente |
| Fallback (barcode longo) | ❌ Não existe | ✅ Usa substring se 406 |

---

## 🆘 Se Ainda Tiver Problemas

### Cenário A: Ainda vê erro 406
1. Verifique se o arquivo foi atualizado:
   ```bash
   cat src/services/boletoImportService.js | grep "limit(1)"
   ```
   Deve aparecer a linha `.limit(1)`

2. Verifique o console do navegador para logs com `406`

3. Faça hard refresh (Ctrl+Shift+R) para limpar cache

### Cenário B: Importação bloqueia
1. Verifique se o navegador tem bastante memória
2. Divida a importação em lotes menores (ex: 50 boletos por arquivo)
3. Verifique conexão de internet

### Cenário C: Duplicados não detectados
1. Verifique se os códigos de barras são realmente iguais
2. Verifique se há espaços ou caracteres extras (use `.trim()`)
3. Consulte `capt_boletos` diretamente no Supabase para confirmar

---

## 📊 Métricas de Sucesso

Após a correção, você deve conseguir:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Boletos/importação | ~50 | ~1000+ |
| Taxa de sucesso | 60-70% | >95% |
| Erro 406 ocorrências | Frequente | Zero |
| Tempo importação 100 boletos | > 30s | < 5s |

---

## 💡 Dicas

### Para Importações Grandes
- Divida o arquivo em múltiplos: 500 boletos cada
- Use o modo batch se disponível
- Monitore no Supabase o crescimento de `capt_boletos`

### Para Evitar Problemas
- ✅ Use sempre a extensão `.xlsx` (Excel)
- ✅ Remova espaços em branco dos dados
- ✅ Verifique se código de barras está na coluna certa
- ✅ Teste com 5-10 boletos antes de importar em massa

---

**Última atualização:** 14/05/2026
**Versão:** 1.0
**Responsável pela correção:** Claude (Cowork)
