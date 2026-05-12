#!/bin/bash

# ============================================================
# TESTES PARA ENDPOINTS DE IMPORTAÇÃO CNAB400
# Data: 11/05/2026
# Como usar: bash TESTE_ENDPOINTS.sh
# ============================================================

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuração
API_URL="http://localhost:3001"
USER_ID="550e8400-e29b-41d4-a716-446655440000"
PERFIL="master"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    TESTES PARA IMPORTAÇÃO CNAB400${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"

# TEST 1: Health Check
echo -e "${BLUE}[TEST 1]${NC} Health Check"
curl -s $API_URL/health | jq . || echo "FALHOU"
echo ""

# TEST 2: Importar um boleto individual
echo -e "${BLUE}[TEST 2]${NC} Importar Boleto Individual"
curl -s -X POST $API_URL/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -H "X-Perfil: $PERFIL" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor pago": "500,00",
    "Data de pagamento": "14/08/2026",
    "Status de negociação": "aberto",
    "Status do boleto": "aberto"
  }' | jq . || echo "FALHOU"
echo ""

# TEST 3: Importar arquivo Excel
# (Requer arquivo existente)
ARQUIVO_PATH="../Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx"

if [ -f "$ARQUIVO_PATH" ]; then
  echo -e "${BLUE}[TEST 3]${NC} Importar Arquivo Excel"
  curl -s -X POST $API_URL/api/importar-boletos \
    -H "X-User-Id: $USER_ID" \
    -H "X-Perfil: $PERFIL" \
    -F "arquivo=@$ARQUIVO_PATH" | jq . || echo "FALHOU"
else
  echo -e "${RED}[TEST 3] PULADO${NC} - Arquivo não encontrado em $ARQUIVO_PATH"
fi
echo ""

# TEST 4: Listar boletos importados
echo -e "${BLUE}[TEST 4]${NC} Listar Boletos Importados"
curl -s "$API_URL/api/capt-boletos/$USER_ID?limit=5" | jq . || echo "FALHOU"
echo ""

# TEST 5: Ver estatísticas
echo -e "${BLUE}[TEST 5]${NC} Estatísticas dos Boletos"
curl -s "$API_URL/api/capt-boletos-stats/$USER_ID" | jq . || echo "FALHOU"
echo ""

# TEST 6: Ver histórico de importações
echo -e "${BLUE}[TEST 6]${NC} Histórico de Importações"
curl -s "$API_URL/api/capt-importacoes/$USER_ID" | jq . || echo "FALHOU"
echo ""

# TEST 7: Ver logs de uma importação (requer importacao_id)
echo -e "${BLUE}[TEST 7]${NC} Logs de Importação (requer ID)"
# Este teste pede para o usuário fornecer o ID
echo "Para testar, use:"
echo "curl $API_URL/api/capt-logs-importacao/{importacao_id} | jq ."
echo ""

echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Testes concluídos!${NC}\n"

# Instruções finais
echo "📌 PRÓXIMOS PASSOS:"
echo "  1. Certifique-se de que o servidor está rodando: npm run dev"
echo "  2. Verifique se as tabelas Supabase foram criadas"
echo "  3. Substitua o USER_ID por um UUID válido do seu banco"
echo "  4. Execute este script: bash TESTE_ENDPOINTS.sh"
echo ""
echo "💡 DICA: Use https://jqlang.github.io/jq/ para formatar JSON"
