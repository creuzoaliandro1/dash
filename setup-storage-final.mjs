#!/usr/bin/env node

/**
 * Configure RLS policies para bucket 'titulos' com validação de tipos
 */

console.log('🔐 Configuração de RLS Storage - Bucket "titulos"\n');

console.log('📋 Via Interface Gráfica do Supabase:\n');
console.log('🔗 https://app.supabase.com/project/nkqiurrgrylrwvreybzh/storage/buckets/titulos\n');

const policies = [
  {
    name: 'Allow authenticated upload',
    operation: 'INSERT',
    check: `bucket_id = 'titulos' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role') AND storage."extension"(name) IN ('pdf', 'xlsx', 'xls', 'xml')`
  },
  {
    name: 'Allow authenticated read',
    operation: 'SELECT',
    check: `bucket_id = 'titulos' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')`
  },
  {
    name: 'Allow authenticated delete',
    operation: 'DELETE',
    check: `bucket_id = 'titulos' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')`
  },
  {
    name: 'Allow authenticated update',
    operation: 'UPDATE',
    check: `bucket_id = 'titulos' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role') AND storage."extension"(name) IN ('pdf', 'xlsx', 'xls', 'xml')`
  }
];

console.log('📝 Configure as 4 Políticas abaixo:\n');

let policyNum = 1;
for (const policy of policies) {
  console.log(`━━━ POLÍTICA ${policyNum} ━━━`);
  console.log(`Nome:       ${policy.name}`);
  console.log(`Operação:   ${policy.operation}`);
  console.log(`Verificação:\n${policy.check}\n`);
  policyNum++;
}

console.log('\n✅ PASSOS:');
console.log('1. Acesse o link acima');
console.log('2. Abra a aba "Policies"');
console.log('3. Clique "New Policy" para cada política acima');
console.log('4. Cole o "Nome" e "Verificação"');
console.log('5. Selecione a "Operação"');
console.log('6. Clique "Save"');
console.log('7. Repita para todas as 4 políticas');
console.log('8. Teste a importação! 🎉\n');

console.log('📌 Notas:');
console.log('• As políticas validam tipos de arquivo (PDF, Excel, XML)');
console.log('• Apenas usuários autenticados podem fazer upload/delete');
console.log('• O sistema agora é seguro e funcional!');
