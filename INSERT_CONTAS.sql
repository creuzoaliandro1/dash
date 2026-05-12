-- ============================================================
-- SCRIPT: Inserir contas para o arquivo de boletos CNAB400
-- Data: 11/05/2026
-- Como usar: Copie e cole no Supabase SQL Editor
-- ============================================================

-- IMPORTANTE: Substitua '550e8400-e29b-41d4-a716-446655440000' pelo seu user-id real!

-- 1. Primeiro, vamos inserir a conta PRINCIPAL que encontramos
INSERT INTO "CONTAS" ("conta", "usuario_id", "banco_codigo", "agencia", "nome_titular", "documento_titular")
VALUES (
  '09538802',                                    -- Conta (com dígito verificador)
  '550e8400-e29b-41d4-a716-446655440000',       -- USER_ID (MUDE ISTO!)
  '274',                                         -- Banco Itaú
  '3638',                                        -- Agência (se souber)
  'RETIFICA VOLANTE',                            -- Nome do titular
  '59849652000148'                               -- CNPJ/CPF
)
ON CONFLICT ("conta") DO NOTHING;

-- 2. Verificar se foi inserida
SELECT * FROM "CONTAS" WHERE "conta" = '09538802';

-- 3. (OPCIONAL) Se houver outras contas, insira assim:
-- INSERT INTO "CONTAS" ("conta", "usuario_id", "banco_codigo", "nome_titular", "documento_titular")
-- VALUES ('XXXXXXXX2', '550e8400-e29b-41d4-a716-446655440000', '274', '...', '...')
-- ON CONFLICT ("conta") DO NOTHING;

-- 4. Ver todas as contas
SELECT "id", "conta", "usuario_id", "created_at" FROM "CONTAS" LIMIT 10;
