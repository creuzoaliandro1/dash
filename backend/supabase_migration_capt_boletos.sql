-- ============================================================
-- MIGRATION: Criar tabelas para importação de boletos CNAB400
-- Data: 11/05/2026
-- Database: Supabase PostgreSQL
-- ============================================================

-- 1. Tabela de contas (se não existir)
CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta VARCHAR(10) NOT NULL UNIQUE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banco_codigo VARCHAR(5),
  agencia VARCHAR(10),
  nome_titular VARCHAR(255),
  documento_titular VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tabela principal de boletos importados (CNAB400)
CREATE TABLE IF NOT EXISTS capt_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_barras VARCHAR(50) NOT NULL UNIQUE,
  numero_conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Campos de identificação do boleto
  nosso_numero VARCHAR(20),
  seu_numero VARCHAR(20),
  numero_documento VARCHAR(20),

  -- Informações do pagador
  pagador_nome VARCHAR(255),
  pagador_documento VARCHAR(20),
  pagador_email VARCHAR(255),
  pagador_telefone VARCHAR(20),
  pagador_cep VARCHAR(10),
  pagador_logradouro VARCHAR(255),
  pagador_numero VARCHAR(10),
  pagador_complemento VARCHAR(255),
  pagador_cidade VARCHAR(100),
  pagador_uf VARCHAR(2),

  -- Valores e datas
  valor_titulo DECIMAL(15, 2) DEFAULT 0,
  valor_pagamento DECIMAL(15, 2) DEFAULT 0,
  data_emissao DATE,
  data_vencimento DATE,
  data_limite_pagamento DATE,
  data_pagamento DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'pendente',
  status_negociacao VARCHAR(100),

  -- Juros e multas
  valor_juros DECIMAL(15, 2) DEFAULT 0,
  valor_multa DECIMAL(15, 2) DEFAULT 0,
  valor_desconto DECIMAL(15, 2) DEFAULT 0,

  -- Auditoria
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),

  -- Índices
  CONSTRAINT idx_codigo_barras UNIQUE(codigo_barras),
  CONSTRAINT fk_numero_conta FOREIGN KEY(numero_conta_id) REFERENCES contas(id),
  CONSTRAINT fk_usuario FOREIGN KEY(usuario_id) REFERENCES auth.users(id)
);

-- 3. Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_capt_boletos_codigo_barras ON capt_boletos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_capt_boletos_numero_conta ON capt_boletos(numero_conta_id);
CREATE INDEX IF NOT EXISTS idx_capt_boletos_usuario ON capt_boletos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_capt_boletos_status ON capt_boletos(status);
CREATE INDEX IF NOT EXISTS idx_capt_boletos_data_vencimento ON capt_boletos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_capt_boletos_criado_em ON capt_boletos(criado_em DESC);

-- 4. Tabela de auditoria de importações
CREATE TABLE IF NOT EXISTS capt_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arquivo_nome VARCHAR(255),
  total_registros INT DEFAULT 0,
  registros_inseridos INT DEFAULT 0,
  registros_atualizados INT DEFAULT 0,
  registros_erro INT DEFAULT 0,
  erros_detalhes JSONB,
  status VARCHAR(50) DEFAULT 'processando', -- processando, sucesso, erro, parcial
  criado_em TIMESTAMP DEFAULT NOW(),
  finalizado_em TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capt_importacoes_usuario ON capt_importacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_capt_importacoes_status ON capt_importacoes(status);
CREATE INDEX IF NOT EXISTS idx_capt_importacoes_criado_em ON capt_importacoes(criado_em DESC);

-- 5. Tabela de logs de processamento (para debugging)
CREATE TABLE IF NOT EXISTS capt_logs_processamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID REFERENCES capt_importacoes(id) ON DELETE CASCADE,
  numero_linha INT,
  codigo_barras VARCHAR(50),
  tipo_operacao VARCHAR(20), -- INSERT, UPDATE, ERRO
  mensagem TEXT,
  detalhes JSONB,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capt_logs_importacao ON capt_logs_processamento(importacao_id);
CREATE INDEX IF NOT EXISTS idx_capt_logs_criado_em ON capt_logs_processamento(criado_em DESC);

-- 6. RLS (Row Level Security) - Comentar se não usar autenticação
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE capt_boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE capt_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE capt_logs_processamento ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para contas
CREATE POLICY "Usuários podem ver suas próprias contas"
  ON contas FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuários podem criar contas"
  ON contas FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- 8. Políticas RLS para boletos
CREATE POLICY "Usuários podem ver seus próprios boletos"
  ON capt_boletos FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuários podem criar boletos"
  ON capt_boletos FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seus próprios boletos"
  ON capt_boletos FOR UPDATE
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- 9. Políticas RLS para importações
CREATE POLICY "Usuários podem ver suas próprias importações"
  ON capt_importacoes FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuários podem criar importações"
  ON capt_importacoes FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- 10. Function para atualizar atualizado_em
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Triggers para atualizar timestamp
CREATE TRIGGER trigger_capt_boletos_atualizado_em
  BEFORE UPDATE ON capt_boletos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_contas_atualizado_em
  BEFORE UPDATE ON contas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

-- ============================================================
-- Fim da migração
-- ============================================================
