-- Script de Configuração de RLS Storage para bucket 'titulos'
-- Copie e cole isso no Supabase Dashboard → SQL Editor → Execute

-- ============================================================
-- 1. Garantir que RLS está ativado na tabela storage.objects
-- ============================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Remover políticas antigas (se existirem)
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated upload titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update titulos" ON storage.objects;

-- ============================================================
-- 3. Criar novas políticas para bucket 'titulos'
-- ============================================================

-- Política 1: Permitir INSERT (upload) para usuários autenticados
CREATE POLICY "Allow authenticated upload titulos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Política 2: Permitir SELECT (leitura) para usuários autenticados
CREATE POLICY "Allow authenticated read titulos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Política 3: Permitir DELETE (exclusão) para usuários autenticados
CREATE POLICY "Allow authenticated delete titulos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Política 4: Permitir UPDATE para usuários autenticados
CREATE POLICY "Allow authenticated update titulos"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- ============================================================
-- ✅ Pronto! Agora execute este script:
-- ============================================================
-- 1. Vá para https://app.supabase.com/project/nkqiurrgrylrwvreybzh/sql/new
-- 2. Cole este script
-- 3. Clique em "Execute"
-- ============================================================
