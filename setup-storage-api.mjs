#!/usr/bin/env node

/**
 * Configure RLS policies via Supabase Management API
 */

// Você precisa gerar um access token em:
// https://app.supabase.com/account/tokens
// Copie o token Personal Access Token

const MANAGEMENT_API_URL = 'https://api.supabase.com/v1';
const PROJECT_REF = 'nkqiurrgrylrwvreybzh';

// IMPORTANTE: Você precisa fornecer seu Personal Access Token
// Gere em: https://app.supabase.com/account/tokens
const PERSONAL_ACCESS_TOKEN = 'seu_token_aqui';

async function setupViaDashboard() {
  console.log('🔐 Configurando RLS via Interface Gráfica do Supabase...\n');

  console.log('📋 INSTRUÇÕES (Clique no link abaixo):\n');
  console.log('1️⃣  Abra este link:');
  console.log(`    https://app.supabase.com/project/${PROJECT_REF}/storage/buckets/titulos\n`);

  console.log('2️⃣  Vá para a aba "Policies" no topo\n');

  console.log('3️⃣  Clique em "New Policy" e configure:\n');

  const policies = [
    {
      name: 'Allow authenticated upload',
      operation: 'INSERT',
      check: `(bucket_id = 'titulos') AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')`
    },
    {
      name: 'Allow authenticated read',
      operation: 'SELECT',
      check: `(bucket_id = 'titulos') AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')`
    },
    {
      name: 'Allow authenticated delete',
      operation: 'DELETE',
      check: `(bucket_id = 'titulos') AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')`
    },
    {
      name: 'Allow authenticated update',
      operation: 'UPDATE',
      check: `(bucket_id = 'titulos') AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')`
    }
  ];

  let policyNum = 1;
  for (const policy of policies) {
    console.log(`📌 Política ${policyNum}:`);
    console.log(`   Nome: ${policy.name}`);
    console.log(`   Operação: ${policy.operation}`);
    console.log(`   Verificação (WITH CHECK/USING):`);
    console.log(`   ${policy.check}\n`);
    policyNum++;
  }

  console.log('4️⃣  Depois de criar as 4 políticas, clique em "Save"\n');
  console.log('5️⃣  ✅ Pronto! Teste a importação novamente.\n');
}

// Executar
setupViaDashboard();
