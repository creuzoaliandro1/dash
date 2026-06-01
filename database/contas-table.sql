-- ==========================================
-- TABELA: CONTAS (Autenticação customizada)
-- ==========================================

CREATE TABLE IF NOT EXISTS CONTAS (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cic VARCHAR(50) UNIQUE NOT NULL,
  pass VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índice para CIC (login)
CREATE INDEX IF NOT EXISTS idx_contas_cic ON CONTAS(cic);

-- ==========================================
-- TABELA: boletos (ajustada para CONTAS)
-- ==========================================

-- Se precisar, altere a tabela boletos para referenciar CONTAS ao invés de auth.users:
-- ALTER TABLE boletos DROP CONSTRAINT boletos_user_id_fkey;
-- ALTER TABLE boletos ADD CONSTRAINT boletos_user_id_fkey FOREIGN KEY (user_id) REFERENCES CONTAS(id) ON DELETE CASCADE;

-- ==========================================
-- ROW LEVEL SECURITY (RLS) para CONTAS
-- ==========================================

ALTER TABLE CONTAS ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas sua própria conta (se necessário)
-- CREATE POLICY "users_can_view_own_conta" ON CONTAS
--   FOR SELECT USING (id = auth.uid());

-- ==========================================
-- MOCK DATA (para testes)
-- ==========================================

-- Descomente para inserir usuários de teste:
/*
INSERT INTO CONTAS (cic, pass, name, email) VALUES
  ('111111111', '123456', 'João Silva', 'joao@example.com'),
  ('222222222', '123456', 'Maria Santos', 'maria@example.com'),
  ('333333333', '123456', 'Pedro Costa', 'pedro@example.com')
ON CONFLICT (cic) DO NOTHING;
*/

-- ==========================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ==========================================

CREATE OR REPLACE FUNCTION update_contas_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS update_contas_updated_at ON CONTAS;
CREATE TRIGGER update_contas_updated_at
  BEFORE UPDATE ON CONTAS
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_updated_at_column();
