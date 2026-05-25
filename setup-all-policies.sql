-- ============================================================
-- Criar 4 Políticas RLS para bucket 'titulos' de uma vez
-- Cole este script inteiro no Supabase SQL Editor
-- ============================================================

-- Política 1: INSERT (Upload)
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  AND storage."extension"(name) IN ('pdf', 'xlsx', 'xls', 'xml')
);

-- Política 2: SELECT (Leitura)
CREATE POLICY "Allow authenticated read"
ON storage.objects FOR SELECT USING (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Política 3: DELETE (Exclusão)
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE USING (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Política 4: UPDATE (Atualização)
CREATE POLICY "Allow authenticated update"
ON storage.objects FOR UPDATE WITH CHECK (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  AND storage."extension"(name) IN ('pdf', 'xlsx', 'xls', 'xml')
);

-- ============================================================
-- ✅ Pronto! 4 Políticas criadas de uma vez
-- ============================================================
