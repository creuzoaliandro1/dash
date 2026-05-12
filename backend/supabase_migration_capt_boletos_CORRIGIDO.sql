-- ============================================================
-- MIGRATION: Criar tabelas CAPT_BOLETOS e CAPT_IMPORTACOES
-- Data: 11/05/2026
-- Adaptação: Estrutura real da tabela CONTAS (BIGINT id, sem usuario_id)
-- ============================================================

-- ============================================================
-- TABELA 1: CAPT_BOLETOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public."CAPT_BOLETOS" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo_barras" VARCHAR(50) NOT NULL UNIQUE,
  "numero_conta_id" BIGINT NOT NULL REFERENCES public."CONTAS"("id") ON DELETE CASCADE,

  -- Identificação
  "nosso_numero" VARCHAR(20),
  "seu_numero" VARCHAR(20),
  "numero_documento" VARCHAR(20),

  -- Pagador
  "pagador_nome" VARCHAR(255),
  "pagador_documento" VARCHAR(20),
  "pagador_email" VARCHAR(255),
  "pagador_telefone" VARCHAR(20),
  "pagador_cep" VARCHAR(10),
  "pagador_logradouro" VARCHAR(255),
  "pagador_numero" VARCHAR(10),
  "pagador_complemento" VARCHAR(255),
  "pagador_cidade" VARCHAR(100),
  "pagador_uf" VARCHAR(2),

  -- Valores e datas
  "valor_titulo" DECIMAL(15, 2) DEFAULT 0,
  "valor_pagamento" DECIMAL(15, 2) DEFAULT 0,
  "data_emissao" DATE,
  "data_vencimento" DATE,
  "data_limite_pagamento" DATE,
  "data_pagamento" DATE,

  -- Status
  "status" VARCHAR(50) DEFAULT 'pendente',
  "status_negociacao" VARCHAR(100),

  -- Juros e multas
  "valor_juros" DECIMAL(15, 2) DEFAULT 0,
  "valor_multa" DECIMAL(15, 2) DEFAULT 0,
  "valor_desconto" DECIMAL(15, 2) DEFAULT 0,

  -- Auditoria
  "criado_em" TIMESTAMP DEFAULT NOW(),
  "atualizado_em" TIMESTAMP DEFAULT NOW()
);

-- Índices para CAPT_BOLETOS
CREATE INDEX IF NOT EXISTS idx_capt_boletos_codigo_barras
  ON public."CAPT_BOLETOS" USING BTREE ("codigo_barras");

CREATE INDEX IF NOT EXISTS idx_capt_boletos_numero_conta
  ON public."CAPT_BOLETOS" USING BTREE ("numero_conta_id");

CREATE INDEX IF NOT EXISTS idx_capt_boletos_status
  ON public."CAPT_BOLETOS" USING BTREE ("status");

CREATE INDEX IF NOT EXISTS idx_capt_boletos_criado_em
  ON public."CAPT_BOLETOS" USING BTREE ("criado_em" DESC);

-- ============================================================
-- TABELA 2: CAPT_IMPORTACOES
-- ============================================================

CREATE TABLE IF NOT EXISTS public."CAPT_IMPORTACOES" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "arquivo_nome" VARCHAR(255),
  "total_registros" INT DEFAULT 0,
  "registros_inseridos" INT DEFAULT 0,
  "registros_atualizados" INT DEFAULT 0,
  "registros_erro" INT DEFAULT 0,
  "status" VARCHAR(50) DEFAULT 'processando',
  "criado_em" TIMESTAMP DEFAULT NOW(),
  "finalizado_em" TIMESTAMP
);

-- Índices para CAPT_IMPORTACOES
CREATE INDEX IF NOT EXISTS idx_capt_importacoes_status
  ON public."CAPT_IMPORTACOES" USING BTREE ("status");

CREATE INDEX IF NOT EXISTS idx_capt_importacoes_criado_em
  ON public."CAPT_IMPORTACOES" USING BTREE ("criado_em" DESC);

-- ============================================================
-- TABELA 3: CAPT_LOGS_PROCESSAMENTO
-- ============================================================

CREATE TABLE IF NOT EXISTS public."CAPT_LOGS_PROCESSAMENTO" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "importacao_id" UUID REFERENCES public."CAPT_IMPORTACOES"("id") ON DELETE CASCADE,
  "numero_linha" INT,
  "codigo_barras" VARCHAR(50),
  "tipo_operacao" VARCHAR(20),
  "mensagem" TEXT,
  "detalhes" JSONB,
  "criado_em" TIMESTAMP DEFAULT NOW()
);

-- Índices para CAPT_LOGS_PROCESSAMENTO
CREATE INDEX IF NOT EXISTS idx_capt_logs_importacao_id
  ON public."CAPT_LOGS_PROCESSAMENTO" USING BTREE ("importacao_id");

CREATE INDEX IF NOT EXISTS idx_capt_logs_tipo_operacao
  ON public."CAPT_LOGS_PROCESSAMENTO" USING BTREE ("tipo_operacao");

-- ============================================================
-- TRIGGER: Atualizar atualizado_em em CAPT_BOLETOS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_capt_boletos_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW."atualizado_em" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capt_boletos_atualizado_em ON public."CAPT_BOLETOS";

CREATE TRIGGER trigger_capt_boletos_atualizado_em
  BEFORE UPDATE ON public."CAPT_BOLETOS"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_capt_boletos_atualizado_em();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE public."CAPT_BOLETOS"
  IS 'Armazena boletos importados do arquivo CNAB400';

COMMENT ON TABLE public."CAPT_IMPORTACOES"
  IS 'Rastreia cada importação de arquivo';

COMMENT ON TABLE public."CAPT_LOGS_PROCESSAMENTO"
  IS 'Logs detalhados de cada boleto processado';

COMMENT ON COLUMN public."CAPT_BOLETOS"."codigo_barras"
  IS 'Linha digitável do boleto (identificador único)';

COMMENT ON COLUMN public."CAPT_BOLETOS"."numero_conta_id"
  IS 'FK para CONTAS.id (tipo BIGINT)';

COMMENT ON COLUMN public."CAPT_BOLETOS"."status"
  IS 'pendente, pago, atrasado, cancelado, etc';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
