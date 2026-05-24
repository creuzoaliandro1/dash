# 📋 Layout Padrão - Visualização de Importação

**Data**: 2026-05-24  
**Objetivo**: Padronizar a visualização dos dados para importação de boletos  
**Arquivo**: `ImportPreview.jsx`

---

## Estrutura Desejada

Cada correntista/sacado deve exibir seus dados em **exatamente 2 linhas**:

### PRIMEIRA LINHA: Dados do Correntista
```
Nome | CPF/CNPJ | Telefone | Email | Endereço | Bairro | CEP | Cidade | UF | Avalista | Avalista CIC
```

### SEGUNDA LINHA: Dados de Cada Parcela
```
Emissão | Título | Vencimento | Valor | Descrição | Sacado | +
```

---

## Exemplo Visual

```
TRANSPORTES PESADOS MINAS S.A. | 17215039001796 | — | — | ROD CE 422 KM12, S/N | TABULEIRO | 62670000 | SAO GONCALO... | CE | CREUZO ALIANDRO OLIVEIRA SANTOS | 97719943368

24/05/26 | 11198 | 30/05/26 | 4.625,89 | RUN5F79 SR JHV MORUMBI SRPR... | TRANSPORTES PESADOS MINAS S.A. | +

RODO PRIME | 10417203000131 | — | — | RUA JOAQUIM CASTRO MEIRELES... | NOSSA SENHORA DE FATIMA | 62900145 | RUSSAS | CE | CREUZO ALIANDRO OLIVEIRA SANTOS | 97719943368

24/05/26 | 11190 | 01/06/26 | 741,09 | FLN0544 TODAS CARRETA CARRETA... | RODO PRIME | +
```

---

## Regras de Formatação

### Primeira Linha (Correntista):
- ✅ **Todos** os campos do correntista em uma única linha
- ✅ Campos separados com bom espaçamento visual
- ✅ Cada campo editável ao clicar
- ✅ Altura única e compacta

### Segunda Linha (Parcela):
- ✅ Para **cada parcela**, uma linha separada
- ✅ Checkbox para seleção
- ✅ Campos: Emissão | Título | Vencimento | Valor | Descrição | Sacado
- ✅ Botão **+** apenas na **primeira parcela** (recordIdx === 0)
- ✅ Valores em formato brasileiro (dd/mm/yy, 1.234,56)

### Entre Correntistas:
- ✅ Espaçamento claro (border/divider)
- ✅ Cada correntista em um bloco visual separado
- ✅ Sem mistura de dados de diferentes clientes

---

## Largura dos Campos

| Campo | Largura | Exemplo |
|-------|---------|---------|
| Nome | flex 2 | TRANSPORTES PESADOS MINAS S.A. |
| CPF/CNPJ | 150px | 17215039001796 |
| Telefone | 100px | (85) 98765-4321 |
| Email | 200px | contact@empresa.com |
| Endereço | flex 1.5 | ROD CE 422 KM12, S/N |
| Bairro | 150px | TABULEIRO |
| CEP | 100px | 62670000 |
| Cidade | 150px | SAO GONCALO DO AM... |
| UF | 50px | CE |
| Avalista | flex 1.5 | CREUZO ALIANDRO O. SANTOS |
| Avalista CIC | 150px | 97719943368 |

---

## Segunda Linha - Largura dos Campos

| Campo | Largura | Exemplo |
|-------|---------|---------|
| Emissão | 80px | 24/05/26 |
| Título | 80px | 11198 |
| Vencimento | 80px | 30/05/26 |
| Valor | 100px | 4.625,89 |
| Descrição | flex 2 | RUN5F79 SR JHV MORUMBI... |
| Sacado | flex 1 | TRANSPORTES PESADOS... |
| Botão + | 50px | + |

---

## Comportamentos

### Edição Inline
- Clique em qualquer campo para editar
- Suporte para Enter (salva) e Escape (cancela)
- Input com background diferenciado

### Seleção de Parcelas
- Checkbox no início de cada linha de parcela
- Checkbox "Selecionar todos" no footer
- Contador visual de selecionados

### Botão "+"
- Aparece apenas em **recordIdx === 0** (primeira parcela)
- Abre modal de parcelas
- Permite adicionar/editar múltiplas parcelas

### Expansão/Colapso
- Clique na primeira linha (correntista) expande/colapa parcelas
- Seta visual indicando estado

---

## Formato de Data/Valores

- **Data**: `dd/mm/yy` (24/05/26, não 24/05/2026)
- **Valor**: `1.234,56` (brasileiro, com ponto e vírgula)
- **Telefone**: `(85) 98765-4321` ou vazio `—`
- **CEP**: `62670000` (sem formatação)
- **Vazio**: `—` (não deixar campos em branco)

---

## Exemplo de Estrutura HTML

```html
<!-- PRIMEIRO CORRENTISTA -->
<div class="border border-[#1f1f1f] rounded-lg">
  <!-- PRIMEIRA LINHA: Dados do Correntista -->
  <div class="bg-[#0f0f0f] px-4 py-2 flex gap-3">
    <div class="flex-1">Nome: TRANSPORTES...</div>
    <div class="w-36">CPF/CNPJ: 17215039001796</div>
    <div class="w-24">Telefone: —</div>
    <div class="w-48">Email: —</div>
    <!-- ... mais campos -->
  </div>

  <!-- SEGUNDA LINHA: Parcela 1 -->
  <div class="border-t border-[#1f1f1f]">
    <div class="flex items-center gap-3 px-4 py-2">
      <input type="checkbox" /> <!-- Seleção -->
      <div class="w-20">Emissão: 24/05/26</div>
      <div class="w-20">Título: 11198</div>
      <div class="w-20">Vencimento: 30/05/26</div>
      <div class="w-24">Valor: 4.625,89</div>
      <div class="flex-1">Descrição: RUN5F79...</div>
      <div class="flex-1">Sacado: TRANSPORTES...</div>
      <button>+</button> <!-- Botão de parcelas -->
    </div>
  </div>

  <!-- SE HOUVER PARCELA 2 -->
  <div class="border-t border-[#1f1f1f]">
    <div class="flex items-center gap-3 px-4 py-2">
      <input type="checkbox" /> <!-- Seleção -->
      <div class="w-20">Emissão: 24/05/26</div>
      <div class="w-20">Título: 11198-2</div>
      <!-- ... resto dos campos -->
    </div>
  </div>
</div>

<!-- PRÓXIMO CORRENTISTA (mesma estrutura) -->
<div class="border border-[#1f1f1f] rounded-lg">
  <!-- ... -->
</div>
```

---

## Implementação

**Arquivo**: `C:\Projetos\Capt\src\components\Boletos\ImportPreview.jsx`

**Seções a reformatcar**:
1. Primeira linha (correntista) - linhas ~273-481
2. Segunda linha (parcelas) - linhas ~483-685

**Mudanças principais**:
- [ ] Reorganizar flex layout para grid estruturado
- [ ] Adicionar quebras de linha explícitas entre correntista e parcelas
- [ ] Padronizar larguras dos campos
- [ ] Melhorar espaçamento visual
- [ ] Garantir que botão "+" apareça apenas em recordIdx === 0

---

## Status

⏳ **Pendente**: Refatoração do componente ImportPreview.jsx
