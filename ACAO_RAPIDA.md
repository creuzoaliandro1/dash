# ⚡ AÇÃO RÁPIDA - Resolver Importação Lenta

## 🎯 O que fazer AGORA em 5 minutos

### PASSO 1: Parar tudo (30 segundos)
```bash
# No terminal do backend, pressione:
CTRL + C

# No terminal do frontend, pressione:
CTRL + C
```

### PASSO 2: Atualizar código (30 segundos)
```bash
cd C:\Projetos\Capt
git pull origin main
```

Isso baixa as correções que fiz.

### PASSO 3: Reiniciar backend (10 segundos)
```bash
cd backend
npm run dev
```

**PROCURE NESTE LOG:**
```
🔄 Carregando cache de contas e boletos existentes...
✅ Cache: XX contas carregadas
✅ Cache: XX boletos existentes carregados
⏱️  Tempo de cache: X.XXs
```

Se vê isso ✅ = Backend está atualizado!

### PASSO 4: Reiniciar frontend (10 segundos)
Em outro terminal:
```bash
cd C:\Projetos\Capt
npm run dev
```

### PASSO 5: Testar (3 minutos)
1. Acesse http://localhost:5173/boletos
2. "Importar Arquivo"
3. Selecione arquivo com 1482 boletos
4. Clique "Importar"
5. **CRONÔMETRO:**
   - ✅ Se levar 30-50 segundos → FUNCIONANDO!
   - ❌ Se levar > 5 minutos → Problema ainda existe

---

## 📊 O que você DEVE ver

### Terminal do Backend (durante importação):
```
📊 Iniciando importação de 1482 boletos...
🔄 Carregando cache de contas e boletos existentes...
✅ Cache: 15 contas carregadas
✅ Cache: 3200 boletos existentes carregados
⏱️  Tempo de cache: 0.45s
⚡ Processando lote 1/15 (100 boletos)
⚡ Processando lote 2/15 (100 boletos)
... [mais lotes] ...
⏱️  Tempo de processamento: 2.15s
📝 Inserindo 1200 boletos em batch...
✅ 1200 boletos inseridos em 0.85s
🔄 Atualizando 282 boletos em batch...
✅ 282 boletos atualizados em 1.2s
✅ Importação concluída em 35.23s
```

**Tempo esperado:** 30-50 segundos total

---

## ❌ Se AINDA demorar muito:

### Opção A: Testar arquivo menor
```
1. Pegue apenas os primeiros 100 boletos
2. Salve como "teste-100.xlsx"
3. Importe
4. Deve levar ~5-8 segundos
```

Se isso funcionar rápido → arquivo é muito grande/pesado

### Opção B: Verificar contas no banco
No terminal:
```bash
# Quantas contas existem?
curl -s http://localhost:3001/api/capt-boletos-stats | grep total

# Deve retornar número como {"total": 3200, ...}
```

### Opção C: Verificar versão do código
```bash
grep -n "processarBoletoComCache" C:\Projetos\Capt\backend\services\boletoImportService.js
```

Deve retornar 5+ linhas. Se não retornar nada → código não atualizou!

**Solução:** 
```bash
cd C:\Projetos\Capt
git fetch origin
git reset --hard origin/main
npm install
```

---

## 📞 SE AINDA NÃO FUNCIONAR

Cole a saída do comando abaixo aqui para eu analisar:

```bash
# 1. Importe 10 boletos e veja o tempo
# 2. Cole aqui:

echo "=== LOGS ===" && \
cd C:\Projetos\Capt\backend && \
npm list | head -20
```

---

## ⚡ TL;DR (Muito longo; não li)

```bash
# 1. Parar tudo (CTRL+C nos 2 terminais)
# 2. git pull origin main
# 3. Reiniciar backend: cd backend && npm run dev
# 4. Reiniciar frontend: npm run dev
# 5. Testar importação

# Deve levar 30-50 segundos para 1482 boletos
```

**Pronto!** ✅

---

## Caso de teste rápido

Se quer validar que funciona SEM clicar na UI:

```bash
# Teste 1 boleto (deve levar < 100ms)
curl -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d '{"Linha digitável":"27490001019000000005083095388001315380000178900","Nosso número":"001","Seu número":"001","Número do documento":"DOC001","Nome do pagador":"TESTE","Documento federal do pagador":"12345678900","Email do pagador":"test@test.com","Telefone do pagador":"85988776655","CEP do pagador":"60000000","Logradouro do pagador":"RUA","Número do endereço do pagador":"123","Complemento do endereço do pagador":"","Cidade do pagador":"FORTALEZA","UF do pagador":"CE","Valor do título":"1000","Valor pago":"0","Data de emissão":"01/06/2026","Data de vencimento":"30/06/2026","Data limite de pagamento":"05/07/2026","Data de pagamento":"","Status do boleto":"pendente","Status de negociação":"","Valor de juros":"0","Valor de multa":"0","Valor de desconto (primeira faixa)":"0"}'

# Se voltar {"status":"sucesso"} em < 1s = OK!
# Se demorar > 5s = Banco está lento
```

---

## ✅ Checklist Rápido

- [ ] Backend reiniciado?
- [ ] Vê logs de "Cache:" no terminal?
- [ ] Frontend reiniciado?
- [ ] Arquivo importado em < 60s?
- [ ] Logs mostram "concluído em X.XXs"?

Se tudo ✅ = **PRONTO!**

---

**Status:** ✅ Código otimizado  
**Próxima ação:** Reiniciar e testar  
**Tempo esperado:** 5 minutos para resolver  
