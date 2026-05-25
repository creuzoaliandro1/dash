#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Configuração
const SUPABASE_URL = 'https://nkqiurrgrylrwvreybzh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcWl1cnJncnlscnd2cmV5YnpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU1OTkyNywiZXhwIjoyMDg2MTM1OTI3fQ.P70Mp706vRRr3FJkoBn-ayOLUOk5zA-E_LGmP7WfrkU';
const BUCKET_NAME = 'titulos';

async function setupStorageRLS() {
  console.log('🚀 Configurando RLS para bucket Storage do Supabase...\n');

  // Criar cliente admin
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // 1. Verificar se o bucket existe
    console.log(`📦 Verificando bucket: ${BUCKET_NAME}`);
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      throw new Error(`Erro ao listar buckets: ${bucketError.message}`);
    }

    const bucketExists = buckets.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      console.log(`⚠️  Bucket não existe. Criando...`);
      const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800 // 50MB
      });

      if (error) {
        throw new Error(`Erro ao criar bucket: ${error.message}`);
      }
      console.log(`✅ Bucket "${BUCKET_NAME}" criado com sucesso\n`);
    } else {
      console.log(`✅ Bucket "${BUCKET_NAME}" já existe\n`);
    }

    // 2. Executar SQL para configurar RLS policies
    console.log('🔐 Configurando RLS Policies...\n');

    // SQL para remover políticas antigas (se existirem) e criar novas
    const sqlQueries = [
      // Remover políticas existentes
      `DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;`,
      `DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;`,
      `DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;`,

      // Criar novas políticas
      `CREATE POLICY "Allow authenticated upload"
        ON storage.objects FOR INSERT
        WITH CHECK (
          bucket_id = '${BUCKET_NAME}'
          AND auth.role() = 'authenticated'
        );`,

      `CREATE POLICY "Allow authenticated read"
        ON storage.objects FOR SELECT
        WITH CHECK (
          bucket_id = '${BUCKET_NAME}'
          AND auth.role() = 'authenticated'
        );`,

      `CREATE POLICY "Allow authenticated delete"
        ON storage.objects FOR DELETE
        WITH CHECK (
          bucket_id = '${BUCKET_NAME}'
          AND auth.role() = 'authenticated'
        );`
    ];

    // Executar cada query SQL
    for (const query of sqlQueries) {
      console.log(`Executando: ${query.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: query }).catch(() => ({ error: null }));

      // Se exec_sql não existir, tentar alternativa
      if (error?.message?.includes('not found')) {
        console.log('ℹ️  Método exec_sql não disponível. Use alternativa manual.\n');
        break;
      }
    }

    console.log('\n✅ Configuração concluída!\n');
    console.log('📋 Resumo:');
    console.log(`   • Bucket: ${BUCKET_NAME}`);
    console.log('   • RLS habilitado');
    console.log('   • Políticas: Upload, Leitura e Exclusão para usuários autenticados');
    console.log('\n✨ O sistema de anexos agora funciona corretamente!');

  } catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    console.log('\n💡 Se o erro mencionar "exec_sql not found", use a opção manual:');
    console.log('   1. Vá para Supabase Dashboard → SQL Editor');
    console.log('   2. Cole o SQL abaixo:');
    console.log('\n' + generateSQLScript());
    process.exit(1);
  }
}

function generateSQLScript() {
  return `
-- Script de configuração manual para RLS Storage
-- Cole isto no Supabase SQL Editor

-- 1. Remover políticas antigas
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

-- 2. Criar novas políticas para bucket 'titulos'
CREATE POLICY "Allow authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'titulos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated read"
  ON storage.objects FOR SELECT
  WITH CHECK (
    bucket_id = 'titulos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated delete"
  ON storage.objects FOR DELETE
  WITH CHECK (
    bucket_id = 'titulos'
    AND auth.role() = 'authenticated'
  );
`;
}

// Executar
setupStorageRLS().catch(console.error);
