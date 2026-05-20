# Dashboard - Filtros Confirmados (20/05/2026)

## ✅ Implementação Validada

Todos os 4 cards da página **Visão Geral** estão operando com os filtros corretos.

---

## 📊 Resumo dos Filtros por Card

### **Card 1: BOLETOS EM ABERTO**

```
┌─────────────────────────────────────────────────────┐
│ Critério:                                           │
│ ├─ capt_boletos.status = 'pendente'                │
│ └─ capt_boletos.situacao = 'Registrado'            │
│                                                     │
│ Cálculo: SUM(capt_boletos.valor)                   │
│                                                     │
│ Resultado no Card:                                  │
│ ├─ Valor: R$ XXXX,XX (somatório)                  │
│ └─ Subtítulo: "Somatório de pendentes"            │
└─────────────────────────────────────────────────────┘
```

---

### **Card 2: INADIMPLENTES (VENCIDOS)**

```
┌──────────────────────────────────────────────────────┐
│ Critério:                                            │
│ ├─ capt_boletos.status = 'pendente'                │
│ ├─ capt_boletos.situacao = 'Registrado'            │
│ └─ capt_boletos.data_vencimento < DATA DE HOJE    │
│                                                      │
│ Cálculo: SUM(capt_boletos.valor) WHERE vencidos    │
│                                                      │
│ Resultado no Card:                                   │
│ ├─ Valor: R$ XXXX,XX (somatório dos vencidos)     │
│ └─ Subtítulo: "Vencidos (pendentes + registrados)" │
└──────────────────────────────────────────────────────┘
```

---

### **Card 3: RECEITA RECEBIDA**

```
┌─────────────────────────────────────────────────────┐
│ Critério:                                           │
│ └─ capt_boletos.status = 'pago'                    │
│                                                     │
│ Cálculo: SUM(capt_boletos.valor)                   │
│                                                     │
│ Resultado no Card:                                  │
│ ├─ Valor: R$ XXXX,XX (somatório)                  │
│ └─ Subtítulo: "Boletos pagos"                     │
└─────────────────────────────────────────────────────┘
```

---

### **Card 4: CLIENTES ATIVOS**

```
┌─────────────────────────────────────────────────────┐
│ Critério:                                           │
│ ├─ capt_boletos.status = 'pendente'                │
│ └─ capt_boletos.situacao = 'Registrado'            │
│                                                     │
│ Cálculo: COUNT(DISTINCT capt_boletos.sacado_cic)  │
│          (contar CICs únicos - sem duplicação)    │
│                                                     │
│ Resultado no Card:                                  │
│ ├─ Valor: NN (quantidade de clientes únicos)      │
│ └─ Subtítulo: "Clientes com boletos em aberto"    │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Processamento

```
┌──────────────────────────────────────────────────┐
│ 1. BUSCAR TODOS OS BOLETOS DA CONTA             │
│    getBoletos(activeId)                        │
└──────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────────────┐
│ 2. FILTRAR BOLETOS PENDENTES + REGISTRADOS                │
│    status = 'pendente' AND situacao = 'Registrado'        │
│    → armazena em: boletosAbertos                          │
└────────────────────────────────────────────────────────────┘
                      ↓
        ┌─────────────────────┬─────────────────────┐
        ↓                     ↓                     ↓
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ CARD 1:          │ │ CARD 3:          │ │ CARD 4:          │
│ BOLETOS EM      │ │ RECEITA RECEBIDA│ │ CLIENTES ATIVOS │
│ ABERTO          │ │                  │ │                  │
│                  │ │ Filtra:          │ │ Extrai:          │
│ SUM valores      │ │ status='pago'   │ │ DISTINCT CIC     │
│ dos abertos      │ │                  │ │ dos abertos      │
│                  │ │ SUM valores      │ │                  │
│ R$ XXXX,XX       │ │ pagos            │ │ CONTAGEM: NN     │
└──────────────────┘ │                  │ └──────────────────┘
                     │ R$ XXXX,XX       │
                     └──────────────────┘
                             ↑
                      ┌──────────────┐
                      │ CARD 2:      │
                      │ INADIMPLENTES│
                      │              │
                      │ Filtra:      │
                      │ boletosAbertos
                      │ + vencidos   │
                      │              │
                      │ SUM valores  │
                      │ dos vencidos │
                      │              │
                      │ R$ XXXX,XX   │
                      └──────────────┘
```

---

## 📋 Exemplo Completo com Dados

### Dados de Entrada:

```
Boleto 001: status=pendente, situacao=Registrado, valor=1.500,00, venc=2026-06-15, cic=123.456.789-00
Boleto 002: status=pendente, situacao=Registrado, valor=850,00,   venc=2026-04-10, cic=987.654.321-11
Boleto 003: status=pendente, situacao=Registrado, valor=2.000,00, venc=2026-03-01, cic=123.456.789-00
Boleto 004: status=pendente, situacao=Enviado,    valor=500,00,   venc=2026-05-20, cic=111.222.333-44
Boleto 005: status=pago,     situacao=Quitado,    valor=3.200,00, venc=2026-05-15, cic=555.666.777-88

Data de Hoje: 2026-05-20
```

### Processamento:

```
ETAPA 1: Filtrar pendentes + Registrados
├─ Boleto 001: ✅ (pendente + Registrado)
├─ Boleto 002: ✅ (pendente + Registrado)
├─ Boleto 003: ✅ (pendente + Registrado)
├─ Boleto 004: ❌ (situacao=Enviado, não Registrado)
└─ Boleto 005: ❌ (status=pago, não pendente)

boletosAbertos = [001, 002, 003]
```

### Resultado dos Cards:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARD 1: BOLETOS EM ABERTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critério: status='pendente' AND situacao='Registrado'
Boletos: 001, 002, 003
Cálculo: 1.500,00 + 850,00 + 2.000,00
Resultado: R$ 4.350,00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARD 2: INADIMPLENTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critério: acima + data_vencimento < 2026-05-20
Verificação de datas:
├─ Boleto 001: venc=2026-06-15, NÃO vencido ❌
├─ Boleto 002: venc=2026-04-10, VENCIDO ✅
└─ Boleto 003: venc=2026-03-01, VENCIDO ✅

Boletos vencidos: 002, 003
Cálculo: 850,00 + 2.000,00
Resultado: R$ 2.850,00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARD 3: RECEITA RECEBIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critério: status='pago'
Boletos: 005
Cálculo: 3.200,00
Resultado: R$ 3.200,00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARD 4: CLIENTES ATIVOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critério: status='pendente' AND situacao='Registrado'
Boletos: 001, 002, 003
CICs extraídos:
├─ Boleto 001: 123.456.789-00
├─ Boleto 002: 987.654.321-11
└─ Boleto 003: 123.456.789-00 (duplicado)

CICs únicos: [123.456.789-00, 987.654.321-11]
Resultado: 2 clientes
```

### Resumo Visual:

```
┌─────────────────────────────────────────────────────┐
│              PÁGINA VISÃO GERAL                      │
├────────────┬────────────┬────────────┬─────────────┤
│ BOLETOS    │ RECEITA    │ INADIMPL.  │ CLIENTES    │
│ EM ABERTO  │ RECEBIDA   │            │ ATIVOS      │
├────────────┼────────────┼────────────┼─────────────┤
│ R$ 4.350   │ R$ 3.200   │ R$ 2.850   │ 2           │
│            │            │            │             │
│ 4 boletos  │ 1 pago     │ 2 vencidos │ 2 clientes  │
└────────────┴────────────┴────────────┴─────────────┘
```

---

## ✅ Validações Implementadas

- ✅ Dados carregados do perfil selecionado (activeContaId)
- ✅ Suporta formatos de data: YYYY-MM-DD e DD/MM/YYYY
- ✅ Ignora CICs vazios ou nulos
- ✅ Ignora boletos sem data de vencimento (não contabiliza como vencidos)
- ✅ Recarrega automaticamente ao trocar de perfil (usuário master)
- ✅ Exibe "—" durante carregamento

---

## 🎯 Critérios Finais Confirmados

| Item | Valor |
|------|-------|
| **Boletos em Aberto** | status='pendente' AND situacao='Registrado' |
| **Inadimplentes** | Acima + vencimento < hoje |
| **Receita Recebida** | status='pago' |
| **Clientes Ativos** | COUNT(DISTINCT CIC) dos em aberto |

---

**Implementação testada e validada em 20/05/2026** ✅
