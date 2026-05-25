-- ============================================================
-- RLS Policies para bucket 'titulos'
-- Sintaxe correta com validação de tipos de arquivo
-- ============================================================

-- Política 1: INSERT (Upload) - Autenticados, apenas PDF/Excel/XML
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  AND storage."extension"(name) IN ('pdf', 'xlsx', 'xls', 'xml')
);

-- Política 2: SELECT (Leitura) - Autenticados
CREATE POLICY "Allow authenticated read"
ON storage.objects FOR SELECT USING (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Política 3: DELETE (Exclusão) - Autenticados
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE USING (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Política 4: UPDATE (Atualização) - Autenticados
CREATE POLICY "Allow authenticated update"
ON storage.objects FOR UPDATE WITH CHECK (
  bucket_id = 'titulos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  AND storage."extension"(name) IN ('pdf', 'xlsx', 'xls', 'xml')
);
