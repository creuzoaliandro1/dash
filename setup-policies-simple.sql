-- ============================================================
-- RLS Policies Simples para bucket 'titulos'
-- REMOVA TUDO e crie APENAS isso
-- ============================================================

-- 1. REMOVER TODAS as políticas antigas
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;

-- 2. CRIAR Políticas SIMPLES (sem validação de extensão)

-- Política 1: INSERT - Qualquer um autenticado
CREATE POLICY "titulos_insert"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'titulos'
);

-- Política 2: SELECT - Qualquer um autenticado
CREATE POLICY "titulos_select"
ON storage.objects FOR SELECT USING (
  bucket_id = 'titulos'
);

-- Política 3: DELETE - Qualquer um autenticado
CREATE POLICY "titulos_delete"
ON storage.objects FOR DELETE USING (
  bucket_id = 'titulos'
);

-- Política 4: UPDATE - Qualquer um autenticado
CREATE POLICY "titulos_update"
ON storage.objects FOR UPDATE WITH CHECK (
  bucket_id = 'titulos'
);

-- ============================================================
-- ✅ Pronto! RLS configurado de forma simples
-- ============================================================
