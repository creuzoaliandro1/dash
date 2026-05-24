# 📋 Layout Novo - Importação com Contexto Completo

**Data**: 2026-05-24  
**Mudança**: Cada parcela agora mostra dados completos do correntista  
**Benefício**: Sem confusão entre parcelas de diferentes títulos

---

## Estrutura Nova (Com Múltiplas Parcelas)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         EXPRESSO TCM LTDA - PARCELA 1                         ║
├─────────────────────────────────────────────────────────────────────────────┤
│ LINHA 1: DADOS DO CORRENTISTA                                               │
│ Nome: EXPRESSO TCM LTDA | CPF: 01834475000146 | Tel: — | Email: —          │
│ End: AVENIDA FRANCISCO SA, 6100 | Bairro: BARRA DO CEARA | CEP: 60330878    │
│ Cidade: FORTALEZA | UF: CE | Avalista: CREUZO ALIANDRO O. | Av.CIC: 97719   │
├─────────────────────────────────────────────────────────────────────────────┤
│ LINHA 2: DADOS DA PARCELA 1                                                 │
│ [✓] Emissão: 24/05/26 | Título: 11208-1 | Venc: 07/06/26 | Valor: 852,42   │
│     Desc: PEW9C20 VW VW 24-250 VW... | Sacado: EXPRESSO TCM LTDA | [+]     │
╠═══════════════════════════════════════════════════════════════════════════════╣
║                         EXPRESSO TCM LTDA - PARCELA 2                         ║
├─────────────────────────────────────────────────────────────────────────────┤
│ LINHA 1: DADOS DO CORRENTISTA (REPETIDO)                                    │
│ Nome: EXPRESSO TCM LTDA | CPF: 01834475000146 | Tel: — | Email: —          │
│ End: AVENIDA FRANCISCO SA, 6100 | Bairro: BARRA DO CEARA | CEP: 60330878    │
│ Cidade: FORTALEZA | UF: CE | Avalista: CREUZO ALIANDRO O. | Av.CIC: 97719   │
├─────────────────────────────────────────────────────────────────────────────┤
│ LINHA 2: DADOS DA PARCELA 2                                                 │
│ [✓] Emissão: 24/05/26 | Título: 11208-2 | Venc: 27/06/26 | Valor: 852,43   │
│     Desc: PEW9C20 VW VW 24-250 VW... | Sacado: EXPRESSO TCM LTDA |          │
╠═══════════════════════════════════════════════════════════════════════════════╣
║                         EXPRESSO TCM LTDA - PARCELA 3                         ║
├─────────────────────────────────────────────────────────────────────────────┤
│ LINHA 1: DADOS DO CORRENTISTA (REPETIDO)                                    │
│ Nome: EXPRESSO TCM LTDA | CPF: 01834475000146 | Tel: — | Email: —          │
│ End: AVENIDA FRANCISCO SA, 6100 | Bairro: BARRA DO CEARA | CEP: 60330878    │
│ Cidade: FORTALEZA | UF: CE | Avalista: CREUZO ALIANDRO O. | Av.CIC: 97719   │
├─────────────────────────────────────────────────────────────────────────────┤
│ LINHA 2: DADOS DA PARCELA 3                                                 │
│ [✓] Emissão: 24/05/26 | Título: 11208-3 | Venc: 17/07/26 | Valor: 852,43   │
│     Desc: PEW9C20 VW VW 24-250 VW... | Sacado: EXPRESSO TCM LTDA |          │
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Benefícios da Nova Estrutura

✅ **Clareza**: Cada parcela mostra de quem é (não fica perdida)  
✅ **Consistência**: Mesmo padrão para parcela 1, 2, 3, etc.  
✅ **Contexto**: Não precisa olhar pra cima pra saber de quem é a parcela  
✅ **Divisão Visual**: Linhas pontilhadas/bordered separam parcelas  
✅ **Seleção Destacada**: Quando selecionada, fica com cor azul

---

## Mudanças no Código

### `ImportPreview.jsx` - Seção de Parcelas

**ANTES**: Parcelas eram listadas uma após a outra sem contexto
```jsx
{/* Parcels Section */}
{item._records.map((record, recordIdx) => (
  <div key={rowId}>
    {/* Apenas dados do boleto, sem dados do correntista */}
  </div>
))}
```

**DEPOIS**: Cada parcela mostra dados completos do correntista
```jsx
{/* Parcels Section - Each parcel shows complete correntista info */}
{item._records.map((record, recordIdx) => (
  <div key={rowId}>
    {/* LINHA 1: Dados do Correntista (repetido) */}
    <div className="grid grid-cols-12 gap-2 ...">
      <Nome />, <CPF />, <Telefone />, <Email />,
      <Endereco />, <Bairro />, <CEP />, <Cidade />, <UF />,
      <Avalista />, <AvalidadorCIC />
    </div>
    
    {/* LINHA 2: Dados da Parcela */}
    <div className="flex items-center gap-3 ...">
      <Checkbox /> <Emissao /> <Titulo /> <Vencimento />
      <Valor /> <Descricao /> <Sacado /> <BotaoMais />
    </div>
  </div>
))}
```

---

## Espaçamento e Cores

### Primeira Linha (Correntista)
- **Background**: `bg-[#0a0a0a]` (bem escuro)
- **Borda inferior**: `border-b border-[#222222]`
- **Texto**: `text-[9px]` para labels, `text-xs` para valores
- **Altura**: `py-1.5` (compacto)

### Segunda Linha (Parcela)
- **Background**: `bg-[#0f0f0f]` (padrão) ou `bg-[#0a3a5c]` (selecionado/azul)
- **Borda inferior**: `border-b border-[#1a1a1a]`
- **Altura**: `py-2` (mais espaço)

### Entre Parcelas do MESMO Correntista
- **Separador**: `border-t-2 border-[#444444]` (linha grossa, cinza)
- **Primeiro**: Sem borda superior (isFirstParcel === true)
- **Próximos**: Com borda grossa visível

### Entre DIFERENTES Correntistas
- **Separador**: Borda grossa e clara
- **Espaçamento**: Cada novo correntista tem seu bloco visual

---

## Comparação Visual

### ANTES (Confuso)
```
EXPRESSO TCM LTDA | CPF | Tel | Email | ...

[ ] 24/05/26 | 11208-1 | 07/06/26 | 852,42 | Desc... | +

[ ] 24/05/26 | 11208-2 | 27/06/26 | 852,43 | Desc... |   ← Cadê os dados?
                                                            Qual correntista?
[ ] 24/05/26 | 11208-3 | 17/07/26 | 852,43 | Desc... |   ← Idem
```

### DEPOIS (Claro)
```
EXPRESSO TCM LTDA | CPF | Tel | Email | ... | Bairro | CEP | Cidade | UF
[ ] 24/05/26 | 11208-1 | 07/06/26 | 852,42 | Desc... | +
─────────────────────────────────────────────────────────────────────────
EXPRESSO TCM LTDA | CPF | Tel | Email | ... | Bairro | CEP | Cidade | UF
[ ] 24/05/26 | 11208-2 | 27/06/26 | 852,43 | Desc... |
─────────────────────────────────────────────────────────────────────────
EXPRESSO TCM LTDA | CPF | Tel | Email | ... | Bairro | CEP | Cidade | UF
[ ] 24/05/26 | 11208-3 | 17/07/26 | 852,43 | Desc... |
```

---

## Resultado na Tela

```
Revisão dos registros e selecione quais deseja importar

EXPRESSO TCM LTDA        01834475000146  —      —        ...  BARRA DO CEARA  60330878  FORTALEZA  CE

✓  24/05/2026  11208-1  07/06/2026  852,42  PEW9C20 VW...  EXPRESSO TCM LTDA  +

═══════════════════════════════════════════════════════════════════════════════════════════════

EXPRESSO TCM LTDA        01834475000146  —      —        ...  BARRA DO CEARA  60330878  FORTALEZA  CE

✓  24/05/2026  11208-2  27/06/2026  852,43  PEW9C20 VW...  EXPRESSO TCM LTDA

═══════════════════════════════════════════════════════════════════════════════════════════════

EXPRESSO TCM LTDA        01834475000146  —      —        ...  BARRA DO CEARA  60330878  FORTALEZA  CE

✓  24/05/2026  11208-3  17/07/2026  852,43  PEW9C20 VW...  EXPRESSO TCM LTDA
```

---

## Status

✅ **Implementado**: Alterações no ImportPreview.jsx  
✅ **Visual**: Divisores claros entre parcelas  
✅ **Contexto**: Cada parcela mostra dados do correntista  
✅ **Seleção**: Destacada com cor azul quando selecionada

**Próximo passo**: Testar com arquivo que tem múltiplas parcelas do mesmo correntista
