#!/usr/bin/env node

/**
 * Script para configurar RLS Storage no Supabase
 * Uso: node setup-storage.mjs
 */

const SUPABASE_URL = 'https://nkqiurrgrylrwvreybzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcWl1cnJncnlscnd2cmV5YnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NTk5MjcsImV4cCI6MjA4NjEzNTkyN30.JGlMPSr3T1d1k2Gj-JKJdJfKzVFpKvJ3pKqQQqXRy-0';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcWl1cnJncnlscnd2cmV5YnpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU1OTkyNywiZXhwIjoyMDg2MTM1OTI3fQ.P70Mp706vRRr3FJkoBn-ayOLUOk5zA-E_LGmP7WfrkU';

async function setupStorage() {
  console.log('🔐 Configurando RLS Storage no Supabase...\n');

  try {
    // Tentar chamar a Edge Function se ela estiver deployada
    console.log('📡 Tentando executar via Edge Function...');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/setup-storage-rls`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ Configuração realizada com sucesso!\n');
      console.log('📋 Políticas criadas:');
      result.policies?.forEach(policy => {
        console.log(`   • ${policy}`);
      });
      console.log('\n🎉 Seu bucket "titulos" está pronto para upload de anexos!');
      return;
    }
  } catch (error) {
    console.log('ℹ️  Edge Function não encontrada ou não deployada.\n');
  }

  // Fallback: Executar SQL diretamente
  console.log('📌 Usando método alternativo (SQL direto)...\n');

  const sqlScript = `
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated upload titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update titulos" ON storage.objects;

CREATE POLICY "Allow authenticated upload titulos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

CREATE POLICY "Allow authenticated read titulos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

CREATE POLICY "Allow authenticated delete titulos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

CREATE POLICY "Allow authenticated update titulos"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'titulos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );
`;

  try {
    // Tentar via RPC
    const rpcResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ sql: sqlScript }),
      }
    );

    if (rpcResponse.ok) {
      console.log('✅ Configuração realizada com sucesso!\n');
      console.log('📋 RLS Policies criadas para bucket "titulos"');
      console.log('\n🎉 Seu sistema de anexos está pronto!');
      return;
    }
  } catch (e) {
    // Continuar com instruções manuais
  }

  // Instruções manuais como último recurso
  console.log('\n📋 INSTRUÇÕES PARA CONFIGURAÇÃO MANUAL:');
  console.log('=====================================\n');
  console.log('1️⃣  Acesse o Supabase Dashboard:');
  console.log('    https://app.supabase.com/\n');
  console.log('2️⃣  Abra seu projeto (nkqiurrgrylrwvreybzh)\n');
  console.log('3️⃣  Vá para "SQL Editor" (menu esquerdo)\n');
  console.log('4️⃣  Clique em "New Query"\n');
  console.log('5️⃣  Cole o script abaixo:\n');
  console.log('---START SQL---');
  console.log(sqlScript);
  console.log('---END SQL---\n');
  console.log('6️⃣  Clique em "Execute"\n');
  console.log('7️⃣  ✅ Pronto! Teste a importação novamente.\n');
}

// Executar
setupStorage().catch(console.error);
