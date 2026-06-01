-- ==========================================
-- CAPT - Database Migrations
-- ==========================================

-- Criar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABELA: boletos
-- ==========================================
CREATE TABLE IF NOT EXISTS boletos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Informações básicas
  descricao VARCHAR(255) NOT NULL,
  cliente VARCHAR(255) NOT NULL,
  email_cliente VARCHAR(255),

  -- Valores
  valor DECIMAL(12, 2) NOT NULL,
  juros DECIMAL(12, 2) DEFAULT 0,
  multa DECIMAL(12, 2) DEFAULT 0,
  desconto DECIMAL(12, 2) DEFAULT 0,

  -- Status e datas
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  vencimento DATE NOT NULL,
  data_pagamento DATE,

  -- Dados do boleto
  nosso_numero VARCHAR(20),
  numero_sequencial VARCHAR(20),
  codigo_barras VARCHAR(48),
  linha_digitavel VARCHAR(47),

  -- Metadados
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Índices
  CREATE INDEX idx_boletos_user_id ON boletos(user_id),
  CREATE INDEX idx_boletos_status ON boletos(status),
  CREATE INDEX idx_boletos_vencimento ON boletos(vencimento)
);

-- ==========================================
-- TABELA: pagamentos
-- ==========================================
CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boleto_id UUID NOT NULL REFERENCES boletos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Informações de pagamento
  data_pagamento DATE NOT NULL,
  valor_pago DECIMAL(12, 2) NOT NULL,
  tipo_pagamento VARCHAR(20) CHECK (tipo_pagamento IN ('pix', 'ted', 'doc', 'cartao')),

  -- Comprovante
  comprovante_url VARCHAR(500),
  numero_transacao VARCHAR(100),

  -- Metadados
  created_at TIMESTAMP DEFAULT NOW(),

  CREATE INDEX idx_pagamentos_boleto_id ON pagamentos(boleto_id),
  CREATE INDEX idx_pagamentos_user_id ON pagamentos(user_id)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS
ALTER TABLE boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

-- Boletos: Usuários veem apenas seus próprios boletos
CREATE POLICY "users_can_view_own_boletos" ON boletos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_boletos" ON boletos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_boletos" ON boletos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_boletos" ON boletos
  FOR DELETE USING (auth.uid() = user_id);

-- Pagamentos: Usuários veem apenas seus próprios pagamentos
CREATE POLICY "users_can_view_own_pagamentos" ON pagamentos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_pagamentos" ON pagamentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_view_boleto_pagamentos" ON pagamentos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM boletos WHERE id = pagamentos.boleto_id AND user_id = auth.uid()
    )
  );

-- ==========================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_boletos_updated_at
  BEFORE UPDATE ON boletos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- MOCK DATA (para testes)
-- ==========================================
-- Descomentar e ajustar com o user_id real após criar usuário

-- INSERT INTO boletos (user_id, descricao, cliente, valor, status, vencimento, codigo_barras)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000', -- Substituir com user_id real
--   'Fatura #001',
--   'Empresa A',
--   1250.00,
--   'pago',
--   '2024-04-15',
--   '12345.67890 12345.678901 12345.678901 1 12345678901234'
-- );
