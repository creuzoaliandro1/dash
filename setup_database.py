#!/usr/bin/env python3
"""
Script para executar as migrations no Supabase
Instale: pip install supabase-py
Execute: python setup_database.py
"""

import os
import sys
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Dependência ausente. Execute:")
    print("   pip install supabase-py python-dotenv")
    sys.exit(1)

# Carregar variáveis de ambiente
from dotenv import load_dotenv
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Variáveis SUPABASE_URL ou SUPABASE_SERVICE_KEY não encontradas em .env.local")
    sys.exit(1)

print(f"🔗 Conectando ao Supabase: {SUPABASE_URL}")

# Conectar ao Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Ler arquivo SQL
sql_file = Path('database/EXECUTE_AGORA.sql')
if not sql_file.exists():
    print(f"❌ Arquivo não encontrado: {sql_file}")
    sys.exit(1)

sql_content = sql_file.read_text()

# Dividir queries
queries = [q.strip() for q in sql_content.split(';') if q.strip() and not q.strip().startswith('--')]

print(f"📋 Total de queries: {len(queries)}")
print("=" * 60)

# Executar queries
success_count = 0
error_count = 0

for i, query in enumerate(queries, 1):
    # Limpar a query
    query = query.strip()
    if not query:
        continue

    # Mostrar query
    first_line = query.split('\n')[0][:50]
    print(f"\n[{i}/{len(queries)}] {first_line}...")

    try:
        # Executar via RPC (admin)
        response = supabase.rpc(
            'exec_sql',
            {'query': query}
        ).execute()

        print(f"     ✅ Sucesso")
        success_count += 1

    except Exception as e:
        print(f"     ⚠️  Erro: {str(e)[:80]}")
        error_count += 1

print("\n" + "=" * 60)
print(f"\n📊 Resultado:")
print(f"   ✅ Sucesso: {success_count}")
print(f"   ❌ Erros: {error_count}")

if error_count == 0:
    print("\n🎉 Todas as migrations foram executadas com sucesso!")
else:
    print(f"\n⚠️  {error_count} queries com erro. Verifique o Supabase.")

print("\n" + "=" * 60)
print("\n📝 Próximo passo:")
print("   1. Login na aplicação com: CIC=12345678901, Senha=123456")
print("   2. Clique em 'Boletos'")
print("   3. Clique em '+ Emitir boleto'")
print("   4. Preencha e clique em 'Emitir Boleto'")
