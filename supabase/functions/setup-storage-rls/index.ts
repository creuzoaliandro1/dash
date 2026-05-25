import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function executeSQL(sql: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ sql }),
  })

  return response
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔐 Configurando RLS Policies para Storage...')

    const sqlScript = `
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Allow authenticated upload titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete titulos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update titulos" ON storage.objects;

-- Create new policies for 'titulos' bucket
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
`

    // Execute each statement
    const statements = sqlScript.split(';').filter(s => s.trim().length > 0)

    for (const statement of statements) {
      console.log(`Executando: ${statement.substring(0, 50)}...`)
      await executeSQL(statement + ';')
    }

    console.log('✅ RLS Policies configuradas com sucesso!')

    return new Response(
      JSON.stringify({
        success: true,
        message: '✅ RLS Policies configuradas com sucesso para bucket "titulos"',
        policies: [
          'Allow authenticated upload titulos',
          'Allow authenticated read titulos',
          'Allow authenticated delete titulos',
          'Allow authenticated update titulos'
        ]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        hint: 'Execute manualmente o SQL em: Supabase Dashboard → SQL Editor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
