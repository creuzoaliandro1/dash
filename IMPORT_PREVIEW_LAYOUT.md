# Layout Atualizado - Visualizar Dados para Importação

## 🎯 Mudanças Realizadas

### 1. Formatação de Valor em Padrão Brasileiro
- **Antes**: `R$ 5457.87` ou `R$ 5457,87` (sem formatação consistente)
- **Depois**: `R$ 55.457,87` (padrão brasileiro com ponto separador de milhares e vírgula decimal)

**Função Adicionada:**
```javascript
function formatarValorBrasileiro(valor) {
  if (!valor && valor !== 0) return '—'
  const num = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d.-]/g, '').replace(',', '.')) : valor
  if (isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
```

### 2. Reorganização da Linha 1 - Sacado e Avalista
**Antes**: 
```
Linha 1: Nome | CPF/CNPJ | Telefone | Email
Linha 2: Avalista Nome | Avalista CPF/CNPJ (separados)
Linha 3: Endereço | Bairro | Cidade | UF | CEP
```

**Depois**:
```
Linha 1: Nome | CPF/CNPJ | Telefone | Email | Avalista | Avalista CIC
Linha 2: Endereço | Bairro | Cidade | UF | CEP
Linha 3: (outros campos)
```

## 📐 Layout Detalhado

### Linha 1: Dados do Sacado + Avalista
```
┌─────────────────────────────────────────────────────────┐
│ Nome (flex-1)         CPF/CNPJ (w-36)  Telefone (w-28) │
│ Email (w-48)          Avalista (flex-1)  Avalista CIC  │
└─────────────────────────────────────────────────────────┘
```

- **Nome**: Campo flexível que cresce conforme necessário
- **CPF/CNPJ**: Largura fixa (w-36)
- **Telefone**: Largura fixa (w-28)
- **Email**: Largura fixa (w-48)
- **Avalista (Nome)**: Campo flexível ao lado do Email
- **Avalista CIC**: Largura fixa (w-36)

### Linha 2: Endereço Completo
```
┌──────────────────────────────────────────────────────┐
│ Endereço (flex-1)  Bairro (w-32)  Cidade (w-40)    │
│ UF (w-12)  CEP (w-20)                               │
└──────────────────────────────────────────────────────┘
```

### Linha 3: Dados Financeiros
```
┌───────────────────────────────────────────────────────┐
│ Documento (w-32)  Emissão (w-28)  Vencimento (w-28)  │
│ Valor (flex 0.5)  Descricao (flex-1)                │
└───────────────────────────────────────────────────────┘
```

## ✨ Benefícios

1. **Melhor Visualização**: Avalista agora está visível junto com Sacado
2. **Formatação Consistente**: Valores sempre em padrão brasileiro
3. **Economia de Espaço**: Elimina linha vazia desnecessária
4. **Leitura Natural**: Dados relacionados (Sacado/Avalista) na mesma linha

## 🔄 Funcionalidades Mantidas

- ✅ Edição inline de todos os campos
- ✅ Checkbox de seleção
- ✅ Expansão para linhas adicionais (parcelamentos)
- ✅ Validações antes de importação
- ✅ Download de relatório de erros em PDF

## 📊 Exemplo Visual

**Antes:**
```
Nome:              EMPRESA XYZ
CPF/CNPJ:          12.345.678/0001-90
Telefone:          (11) 1234-5678
Email:             empresa@example.com

Avalista - Nome:   AVALISTA LTDA
Avalista - CPF:    98.765.432/0001-10

Endereço:          RUA PRINCIPAL, 123
...
```

**Depois:**
```
Nome:  EMPRESA XYZ | CPF: 12.345.678/0001-90 | Tel: (11) 1234-5678 | Email: empresa@example.com | Avalista: AVALISTA LTDA | CIC: 98.765.432/0001-10

Endereço: RUA PRINCIPAL, 123 | Bairro: CENTRO | Cidade: SÃO PAULO | UF: SP | CEP: 01310-100

...
```

## 🧪 Testes

- [ ] Selecionar arquivo para importar
- [ ] Verificar que avalista está na mesma linha do sacado
- [ ] Verificar que valor está formatado em padrão brasileiro (55.457,87)
- [ ] Editar campo de avalista inline
- [ ] Verificar funcionamento com múltiplas linhas
- [ ] Confirmar importação com novos dados

## 📁 Arquivos Modificados

- `src/components/Boletos/ImportPreview.jsx`
  - Adicionada função `formatarValorBrasileiro()`
  - Reorganizado layout da Linha 1
  - Atualizada formatação do VALOR

---

**Status**: ✅ PRONTO PARA DEPLOY
