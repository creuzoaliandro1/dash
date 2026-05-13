# Debug: Conta Não Encontrada na Importação

## Problema
Ao importar boletos com userType Master, o sistema não encontra as contas no mapa mesmo que exista correspondência.

## Passos para Debugar

### 1. Abra o Console (F12)
- Pressione `F12` para abrir Developer Tools
- Clique em "Console"

### 2. Vá para página de Boletos
- Navegue para a página de Boletos

### 3. Procure pelos logs:

#### **LOG 1 - Contas Carregadas**
```
[BoletosPage] getAllContas retornou:
[BoletosPage] Primeiras 3 contas:
```

Procure por essas mensagens. Você verá algo como:
```
[
  { id: 123, cedente: "1124249", conta: "09538802", keys: [...] },
  { id: 124, cedente: "1234567", conta: "12345678", keys: [...] }
]
```

**COPIE E COMPARTILHE COMIGO:**
- O valor de `cedente`
- O valor de `conta`
- Todos os `keys` (campos) disponíveis

### 4. Importe um arquivo

### 5. Procure pelos logs de debug:

#### **LOG 2 - Mapa de Contas sendo criado**
```
[ImportPreview] Criando mapa de contas. allContas: [...]
[ImportPreview] Mapeando: <id> -> <contaFull> -> <codigo>
[ImportPreview] Mapa final: { ... }
```

#### **LOG 3 - Procurando Conta**
```
[ImportPreview] Procurando conta para: 0953880
[ImportPreview] Contas disponíveis: [...]
[ImportPreview] Conta não encontrada para código: 0953880
```

## O que você precisa fazer

1. **Abra o Console (F12)**
2. **Vá para Boletos**
3. **Copie os logs que aparecem** - especialmente o LOG 1
4. **Importe um arquivo** 
5. **Copie os logs do LOG 2 e LOG 3**
6. **Compartilhe comigo os 3 logs**

Isso vai me mostrar qual é a estrutura real dos dados e por que o mapa não está encontrando as contas.

## Responder com:
```
[LOG 1 - Contas carregadas]
(copie e cole aqui)

[LOG 2 - Mapa de contas]
(copie e cole aqui)

[LOG 3 - Procurando conta]
(copie e cole aqui)
```
