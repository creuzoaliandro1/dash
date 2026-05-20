# Alterações na Página de Boletos - Adicionar Colunas

## Data: 20/05/2026

### Resumo das Alterações

Foram adicionadas **2 novas colunas** à tabela de boletos, posicionadas entre as colunas **STATUS** e **AÇÕES**:

1. **ANTECIPAÇÃO** - Exibe dados do campo `capt_boletos.status_efactor`
2. **REGISTRO** - Exibe dados do campo `capt_boletos.status_efator`

---

## Arquivos Alterados

### 1. **src/components/Boletos/BoletoTable.jsx**

#### Mudanças no Header (linhas 233-235):
```jsx
// ANTES:
<div style={{ flex: '0.5' }} className="text-center">Status</div>
<div style={{ flex: '0.5' }} className="text-center">Ações</div>

// DEPOIS:
<div style={{ flex: '0.5' }} className="text-center">Status</div>
<div style={{ flex: '1' }} className="text-center">Antecipação</div>
<div style={{ flex: '1' }} className="text-center">Registro</div>
<div style={{ flex: '0.5' }} className="text-center">Ações</div>
```

#### Mudanças nos Dados das Linhas (após linha 281):
```jsx
// NOVO:
<div style={{ flex: '1' }} className="text-center text-white">
  {boleto.status_efactor || '—'}
</div>
<div style={{ flex: '1' }} className="text-center text-white">
  {boleto.status_efator || '—'}
</div>
```

---

### 2. **backend/migration_add_efactor_fields.sql** (NOVO)

Criado arquivo de migration para adicionar os campos ao banco de dados:

```sql
ALTER TABLE public."CAPT_BOLETOS"
ADD COLUMN IF NOT EXISTS "status_efactor" VARCHAR(100);

ALTER TABLE public."CAPT_BOLETOS"
ADD COLUMN IF NOT EXISTS "status_efator" VARCHAR(100);
```

---

## Próximos Passos

### 1. **Executar a Migration no Supabase**
Execute o arquivo `backend/migration_add_efactor_fields.sql` no seu projeto Supabase:

```bash
# Via Supabase Dashboard:
1. Acesse SQL Editor
2. Cole o conteúdo de migration_add_efactor_fields.sql
3. Execute (Execute button ou Ctrl+Enter)
```

### 2. **Verificar o Código**
As alterações no BoletoTable.jsx já estão prontas. Quando os dados chegarem do banco com os novos campos, eles aparecerão automaticamente nas colunas.

### 3. **Populando os Dados**
Você pode popular os campos de formas:
- **Manualmente**: Via SQL update ou formulário de edição
- **Via importação**: Se os dados estiverem no arquivo CNAB400
- **Via API**: Se houver integração com Efactor/Efator

---

## Estrutura Visual da Tabela (Agora)

```
┌─────┬──────────┬─────────┬───────────┬──────────┬────────────┬──────────┬────────┬──────────┬──────────┬────────┐
│ ☑   │ Num Lç   │Emissão  │ Documento │  Valor   │ Vencimento │Sacado    │ CIC    │ Status   │Anticip.  │Registro│Ações │
└─────┴──────────┴─────────┴───────────┴──────────┴────────────┴──────────┴────────┴──────────┴──────────┴────────┘
│  ☑  │ 00001    │ 15/05   │123456789  │1.234,56  │   25/06    │João Silva│123.456 │  Pago    │  [—]     │ [—]    │  ⋮   │
│  ☐  │ 00002    │ 18/05   │987654321  │  789,00  │   30/06    │Maria Santos│789.123│Pendente │  [—]     │ [—]    │  ⋮   │
```

---

## Observações

- Os campos mostram "—" (travessão) quando não preenchidos
- As colunas têm a mesma altura que as outras
- O layout se adapta responsivamente
- Os dados podem ser ordenados mediante clique no header (quando implementado)

---

## Verificação Pós-Implementação

```javascript
// No console do navegador, verifique se os dados estão sendo carregados:
// A estrutura esperada é:
{
  id: 'uuid',
  numero_documento: '123456789',
  valor: '1234.56',
  status: 'pago',
  status_efactor: 'antecipado',      // ← NOVO
  status_efator: 'registrado',        // ← NOVO
  // ... outros campos
}
```

---

## Caso de Problema

Se os campos aparecerem como "—", verifique:

1. ✅ Migration foi executada no Supabase
2. ✅ Os novos registros têm dados preenchidos nesses campos
3. ✅ A página foi recarregada (F5)
4. ✅ O console não mostra erros (F12 → Console)
