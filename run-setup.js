const https = require('https');

const SUPABASE_URL = 'https://nkqiurrgrylrwvreybzh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcWl1cnJncnlscnd2cmV5YnpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU1OTkyNywiZXhwIjoyMDg2MTM1OTI3fQ.P70Mp706vRRr3FJkoBn-ayOLUOk5zA-E_LGmP7WfrkU';

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

async function executeSQL() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sqlScript });

    const options = {
      hostname: 'nkqiurrgrylrwvreybzh.supabase.co',
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ RLS policies configuradas com sucesso!');
            resolve();
          } else {
            console.log(`Tentando alternativa SQL...`);
            resolve();
          }
        } catch (e) {
          resolve();
        }
      });
    });

    req.on('error', () => {
      console.log('ℹ️  Método automático não disponível. Instruções manuais abaixo.');
      resolve();
    });

    req.write(data);
    req.end();
  });
}

executeSQL().then(() => {
  console.log('\n📋 Instruções para Configuração Manual (se necessário):');
  console.log('=====================================');
  console.log('1. Vá para: https://app.supabase.com/');
  console.log('2. Acesse seu projeto (nkqiurrgrylrwvreybzh)');
  console.log('3. Clique em "SQL Editor" no menu esquerdo');
  console.log('4. Clique em "New Query"');
  console.log('5. Cole o conteúdo de setup-storage-rls.sql');
  console.log('6. Clique em "Execute"');
  console.log('7. Pronto! ✅');
});
