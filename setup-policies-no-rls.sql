-- ============================================================
-- DESABILITAR RLS - Solução rápida
-- Se o RLS continua bloqueando, use isso
-- ============================================================

-- 1. REMOVER TODAS as políticas
DROP POLICY IF EXISTS "titulos_insert" ON storage.objects;
DROP POLICY IF EXISTS "titulos_select" ON storage.objects;
DROP POLICY IF EXISTS "titulos_delete" ON storage.objects;
DROP POLICY IF EXISTS "titulos_update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;

-- 2. DESABILITAR RLS na tabela storage.objects
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- ✅ RLS desabilitado - Sistema funciona sem restrições
-- ============================================================
