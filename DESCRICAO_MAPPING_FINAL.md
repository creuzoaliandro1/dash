# 📋 Mapeamento Final - Campo Descrição por Tipo de Documento

## Ordem de Prioridade para `capt_boletos.descricao`

```javascript
let descricao = 
  getElementText(xmlDoc, 'xDescServ') ||       // 1️⃣ NFSe tipo 1 - Descrição Serviço (melhor)
  getElementText(xmlDoc, 'Discriminacao') ||   // 2️⃣ NFSe tipo 2
  getElementText(xmlDoc, 'xInfComp') ||        // 3️⃣ NFSe tipo 1 - Complemento
  getElementText(xmlDoc, 'Complemento') ||     // 4️⃣ Fallback geral
  getElementText(xmlDoc, 'infCpl') || ''       // 5️⃣ NFe (última opção)
```

---

## 📊 Mapeamento por Tipo de Documento

### **NFe (Nota Fiscal Eletrônica)** - Todos os estados
- **Campo**: `<infCpl>`
- **Exemplo**: "NFe Rf.Veic: RUN5F79 - SR JHV MORUMBI SRPR 6E AZUL (DIESEL 2022 / 2022 );REF. PED. 593261;"
- **Prioridade**: 5️⃣ (última, pois NFSe tem campos melhores)

---

### **NFSe Tipo 1** - Fortaleza/Mossoró (Padrão Web Service)
**Campos principais:**
- `<xDescServ>` - **Descrição do Serviço** ⭐ MELHOR OPÇÃO
  - Exemplo: "CALIBRAGENS DE BICO - MÃO DE OBRA DA ANTICAMARA"
  - Prioridade: 1️⃣

- `<xInfComp>` - Complemento adicional
  - Exemplo: ".MBB-PLACA RGK-8J40"
  - Prioridade: 3️⃣

**Estrutura:**
```xml
<NFSe>
  <infNFSe>
    <xDescServ>CALIBRAGENS DE BICO - MÃO DE OBRA DA ANTICAMARA</xDescServ>
    <xInfComp>.MBB-PLACA RGK-8J40</xInfComp>
  </infNFSe>
</NFSe>
```

---

### **NFSe Tipo 2** - Padrão Alternativo (Ceará/RN - Outros Sistemas)
**Campos principais:**
- `<Discriminacao>` - Descrição detalhada ⭐
  - Exemplo: "SERV. ALINHAMENTO EIXO CARRETA; SERV. DE SOLDA RECUP. DO SUPORTE SUSP.;"
  - Prioridade: 2️⃣

- `<Complemento>` - Informações adicionais
  - Exemplo: "KM 12"
  - Prioridade: 4️⃣

**Estrutura:**
```xml
<Nfse>
  <Discriminacao>SERV. ALINHAMENTO EIXO CARRETA...</Discriminacao>
  <Complemento>KM 12</Complemento>
</Nfse>
```

---

### **CTe (Conhecimento de Transporte)** - RN
- **Campo**: Mesmo padrão NFSe (xDescServ, Discriminacao, etc)
- **Estrutura**: Semelhante a NFe com campos adicionais

---

### **MDFe (Manifesto Eletrônico)** - RN
- **Campo**: Mesmo padrão NFSe (xDescServ, Discriminacao, etc)
- **Estrutura**: Semelhante a NFe com campos adicionais

---

## ✅ Implementação

Todos os parsers foram atualizados com a ordem correta:
- ✅ `parseNFe()` - NFe
- ✅ `parseNFSe()` - NFSe (Fortaleza/Ceará/Mossoró/RN)
- ✅ `parseCTe()` - CTe (RN)
- ✅ `parseMDFe()` - MDFe (RN)

---

## 📈 Exemplos Reais Capturados

| Tipo | Campo | Valor |
|------|-------|-------|
| **NFe** | infCpl | "ORCAMENTO N° 8312 PEDIDO N° 1863 FORMA PAGAMENTO : BOLETO..." |
| **NFSe v1** | xDescServ | "CALIBRAGENS DE BICO - MÃO DE OBRA DA ANTICAMARA" |
| **NFSe v1** | xInfComp | ".MBB-PLACA RGK-8J40" |
| **NFSe v2** | Discriminacao | "SERV. ALINHAMENTO EIXO CARRETA; SERV. DE SOLDA..." |
| **NFSe v2** | Complemento | "KM 12" |

---

## 🚀 Status

**IMPLEMENTAÇÃO CONCLUÍDA E TESTADA** ✅

Pronto para usar com todos os tipos de documentos (NFe, NFSe, CTe, MDFe) de todos os estados (Ceará, RN, etc) e cidades (Fortaleza, Mossoró).

---

**Data**: 2026-05-21  
**Versão**: Final  
**Cobertura**: 100% dos tipos analisados
