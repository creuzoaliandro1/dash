-- ============================================================
-- IMPORTAÇÃO DE BOLETOS CNAB400
-- Arquivo: QUERIES SQL PRONTAS PARA IMPLEMENTAÇÃO
-- Data: 11/05/2026
-- Status: Pronto para uso
-- ============================================================

-- 1. VALIDAR CORRESPONDÊNCIA DE CONTA
-- Encontra a conta no banco usando os 7 dígitos extraídos
SELECT id, conta, usuario_id
FROM contas
WHERE LEFT(conta, 7) = ?
LIMIT 1;
-- Parâmetro: numero_conta_arquivo (ex: '0953880')


-- 2. BUSCAR BOLETO EXISTENTE
-- Verifica se o código de barras já foi importado
SELECT id, valor_pagamento, data_pagamento, status
FROM capt_boletos
WHERE codigo_barras = ?
LIMIT 1;
-- Parâmetro: codigo_barras (linha digitável completa, ex: '27490001019000000005083095388001315380000178900')


-- 3. INSERIR NOVO BOLETO
-- Executar quando o boleto não existe na tabela
INSERT INTO capt_boletos (
  codigo_barras,
  numero_conta_id,
  usuario_id,
  valor_pagamento,
  data_pagamento,
  status,
  criado_em
) VALUES (?, ?, ?, ?, ?, ?, NOW());
-- Parâmetros (nesta ordem):
-- 1. codigo_barras (linha digitável)
-- 2. numero_conta_id (FK → contas.id)
-- 3. usuario_id (FK → usuarios.id do usuário logado)
-- 4. valor_pagamento (DECIMAL)
-- 5. data_pagamento (DATE ou NULL)
-- 6. status (VARCHAR)


-- 4. ATUALIZAR BOLETO EXISTENTE (SE HOUVER MUDANÇAS)
-- Executar quando houver mudança em: valor_pagamento, data_pagamento ou status
UPDATE capt_boletos
SET
  valor_pagamento = ?,
  data_pagamento = ?,
  status = ?,
  atualizado_em = NOW()
WHERE id = ? AND codigo_barras = ?;
-- Parâmetros (nesta ordem):
-- 1. novo_valor_pagamento
-- 2. nova_data_pagamento
-- 3. novo_status
-- 4. boleto_id (id da tabela capt_boletos)
-- 5. codigo_barras (para validação)


-- 5. LISTAGEM DE CONTAS COMPATÍVEIS (para Master)
-- Retorna todas as contas que combinam com o número extraído
SELECT id, conta, usuario_id
FROM contas
WHERE LEFT(conta, 7) = ?
ORDER BY conta;
-- Parâmetro: numero_conta_arquivo (7 dígitos)


-- 6. CRIAR TABELA capt_boletos (se não existir)
CREATE TABLE IF NOT EXISTS capt_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_barras VARCHAR(50) NOT NULL UNIQUE,
  numero_conta_id UUID NOT NULL REFERENCES contas(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  valor_pagamento DECIMAL(15, 2) DEFAULT 0,
  data_pagamento DATE,
  status VARCHAR(50) DEFAULT 'pendente',
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),

  -- Índices para melhor performance
  CONSTRAINT idx_codigo_barras UNIQUE(codigo_barras),
  CONSTRAINT fk_numero_conta FOREIGN KEY(numero_conta_id) REFERENCES contas(id),
  CONSTRAINT fk_usuario FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_capt_boletos_codigo_barras ON capt_boletos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_capt_boletos_numero_conta ON capt_boletos(numero_conta_id);
CREATE INDEX IF NOT EXISTS idx_capt_boletos_usuario ON capt_boletos(usuario_id);


-- 7. QUERY DE TESTE - VERIFICAR DADOS IMPORTADOS
-- Usar após a importação para validar
SELECT
  COUNT(*) as total_boletos,
  COUNT(DISTINCT numero_conta_id) as contas_unicas,
  SUM(valor_pagamento) as valor_total,
  MIN(criado_em) as primeira_importacao,
  MAX(criado_em) as ultima_importacao
FROM capt_boletos
WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 1 DAY);
-- Retorna estatísticas dos últimos boletos importados


-- 8. LIMPAR DADOS (cuidado: irá deletar todos os boletos!)
-- DELETE FROM capt_boletos;
-- NÃO EXECUTE ESTE COMANDO A MENOS QUE TENHA CERTEZA!
