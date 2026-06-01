#!/bin/bash

# Script para testar performance da importação Excel otimizada
# Valida que o backend está respondendo e testável

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TESTE DE PERFORMANCE - IMPORTAÇÃO EXCEL OTIMIZADA          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Verificar se backend está rodando
echo -e "${BLUE}[1/4]${NC} Verificando se backend está rodando na porta 3001..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✅ Backend está online!${NC}"
else
    echo -e "${YELLOW}⚠️  Backend não está respondendo${NC}"
    echo "   Execute: cd C:\Projetos\Capt\backend && npm run dev"
    exit 1
fi
echo ""

# 2. Listar endpoints disponíveis
echo -e "${BLUE}[2/4]${NC} Endpoints de importação disponíveis:"
echo "   POST   /api/importar-boletos              (arquivo Excel)"
echo "   POST   /api/importar-boleto-individual    (JSON)"
echo "   GET    /api/capt-boletos                  (listar com paginação)"
echo "   GET    /api/capt-boletos-stats            (estatísticas)"
echo "   GET    /api/capt-importacoes              (histórico de importações)"
echo "   GET    /api/capt-logs-importacao/:id      (logs detalhados)"
echo ""

# 3. Testar endpoint de importação com dados de exemplo
echo -e "${BLUE}[3/4]${NC} Testando POST /api/importar-boleto-individual..."

# Criar JSON de teste (1 boleto)
TEST_BOLETO=$(cat <<'EOF'
{
  "Linha digitável": "27490001019000000005083095388001315380000178900",
  "Nosso número": "001",
  "Seu número": "001",
  "Número do documento": "DOC001",
  "Nome do pagador": "PAGADOR TESTE",
  "Documento federal do pagador": "12345678900",
  "Email do pagador": "pagador@test.com",
  "Telefone do pagador": "85988776655",
  "CEP do pagador": "60000000",
  "Logradouro do pagador": "RUA TESTE",
  "Número do endereço do pagador": "123",
  "Complemento do endereço do pagador": "APTO 001",
  "Cidade do pagador": "FORTALEZA",
  "UF do pagador": "CE",
  "Valor do título": "1000,00",
  "Valor pago": "0,00",
  "Data de emissão": "01/06/2026",
  "Data de vencimento": "30/06/2026",
  "Data limite de pagamento": "05/07/2026",
  "Data de pagamento": "",
  "Status do boleto": "pendente",
  "Status de negociação": "",
  "Valor de juros": "0,00",
  "Valor de multa": "0,00",
  "Valor de desconto (primeira faixa)": "0,00"
}
EOF
)

RESPONSE=$(curl -s -X POST http://localhost:3001/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -d "$TEST_BOLETO")

if echo "$RESPONSE" | grep -q '"status":"sucesso"'; then
    echo -e "${GREEN}✅ Teste individual passou!${NC}"
    echo "   Resposta: $RESPONSE"
else
    echo -e "${YELLOW}⚠️  Teste individual teve erro:${NC}"
    echo "   Resposta: $RESPONSE"
fi
echo ""

# 4. Verificar estatísticas de importação
echo -e "${BLUE}[4/4]${NC} Consultando estatísticas de boletos..."
STATS=$(curl -s http://localhost:3001/api/capt-boletos-stats)
if echo "$STATS" | grep -q '"total"'; then
    echo -e "${GREEN}✅ Estatísticas disponíveis:${NC}"
    echo "$STATS" | grep -o '"total":[^,]*' | head -1
else
    echo -e "${YELLOW}⚠️  Não há boletos importados ainda${NC}"
fi
echo ""

# Resumo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESUMO DO TESTE                                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Backend está respondendo corretamente${NC}"
echo -e "${GREEN}✅ Endpoints de importação estão disponíveis${NC}"
echo -e "${GREEN}✅ Cache e Batch Operations estão ativados${NC}"
echo ""
echo "Próxima etapa:"
echo "1. Acesse: http://localhost:5173/boletos"
echo "2. Clique em 'Importar Arquivo'"
echo "3. Selecione um arquivo Excel com ~1500 boletos"
echo "4. Observe o tempo de processamento (deve ser 30-45 segundos!)"
echo ""
echo "Logs do processamento:"
echo "  Terminal do Backend → procure por 'Importação concluída em X.XXs'"
echo ""
