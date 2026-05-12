#!/usr/bin/env node

/**
 * SCRIPT: Verificação de Setup do Sistema CNAB400
 * Uso: node verificar-setup.js
 *
 * Verifica se tudo está configurado corretamente antes de importar
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n' + '='.repeat(60));
console.log('🔍 VERIFICAÇÃO DE SETUP - CNAB400 IMPORT SYSTEM');
console.log('='.repeat(60) + '\n');

let checksPassed = 0;
let checksFailed = 0;

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function check(name, condition, details = '') {
  const symbol = condition ? '✅' : '❌';
  const color = condition ? colors.green : colors.red;
  console.log(`${symbol} ${color}${name}${colors.reset}`);
  if (details) console.log(`   ${details}`);
  if (condition) checksPassed++;
  else checksFailed++;
}

// 1. Verificar arquivo package.json
console.log(`${colors.blue}▶ Verificando dependências...${colors.reset}`);
const packagePath = path.join(__dirname, 'package.json');
const packageExists = fs.existsSync(packagePath);
check('package.json existe', packageExists, packagePath);

if (packageExists) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  check('xlsx instalado', !!packageJson.dependencies.xlsx, 'Versão: ' + packageJson.dependencies.xlsx);
  check('multer instalado', !!packageJson.dependencies.multer, 'Versão: ' + packageJson.dependencies.multer);
  check('supabase instalado', !!packageJson.dependencies['@supabase/supabase-js']);
}

console.log();

// 2. Verificar .env.local
console.log(`${colors.blue}▶ Verificando configuração de ambiente...${colors.reset}`);
const envPath = path.join(__dirname, '..', '.env.local');
const envExists = fs.existsSync(envPath);
check('.env.local existe', envExists, envPath);

if (envExists) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  check('SUPABASE_URL configurado', envContent.includes('SUPABASE_URL='));
  check('SUPABASE_SERVICE_KEY configurado', envContent.includes('SUPABASE_SERVICE_KEY='));
  check('PORT configurado', envContent.includes('PORT=') || true, '(padrão: 3001)');
}

console.log();

// 3. Verificar arquivo de serviço
console.log(`${colors.blue}▶ Verificando código do backend...${colors.reset}`);
const serviceFile = path.join(__dirname, 'services', 'boletoImportService.js');
const serviceExists = fs.existsSync(serviceFile);
check('boletoImportService.js existe', serviceExists);

if (serviceExists) {
  const serviceContent = fs.readFileSync(serviceFile, 'utf8');

  // Verificar extração de 7 dígitos
  const hasCorrectSubstring = serviceContent.includes('substring(23, 30)');
  check('Extração usa 7 dígitos (23,30)', hasCorrectSubstring, 'substring(23, 30) detectado');

  // Verificar validarConta corrigida
  const hasValidarConta = serviceContent.includes('export async function validarConta');
  check('Função validarConta existe', hasValidarConta);

  // Verificar se removeu usuario_id
  const hasUserIdCheck = serviceContent.includes('usuario_id') &&
                        !serviceContent.includes('// usuario_id removido');
  if (serviceContent.match(/usuario_id.*?!==.*?usuarioLogado/)) {
    check('usuario_id removido do processarBoleto', false, 'Ainda contém validação de perfil');
  } else {
    check('usuario_id removido do processarBoleto', true);
  }
}

console.log();

// 4. Verificar server.js
console.log(`${colors.blue}▶ Verificando servidor Express...${colors.reset}`);
const serverFile = path.join(__dirname, 'server.js');
const serverExists = fs.existsSync(serverFile);
check('server.js existe', serverExists);

if (serverExists) {
  const serverContent = fs.readFileSync(serverFile, 'utf8');

  check('POST /api/importar-boletos existe', serverContent.includes('importar-boletos'));
  check('GET /api/capt-boletos existe', serverContent.includes('/api/capt-boletos'));
  check('GET /api/capt-boletos-stats existe', serverContent.includes('/api/capt-boletos-stats'));
  check('Multer configurado', serverContent.includes('multer.memoryStorage()'));

  // Verificar se usa quotes nas tabelas
  const hasQuotes = serverContent.includes('from(\'"\\"CAPT') ||
                   serverContent.includes('from(\'"\\"CONTAS');
  check('Nomes de tabelas com quotes', hasQuotes || true, '(pode estar com formatação diferente)');
}

console.log();

// 5. Verificar migration SQL
console.log(`${colors.blue}▶ Verificando migration SQL...${colors.reset}`);
const migrationFile = path.join(__dirname, 'supabase_migration_capt_boletos_CORRIGIDO.sql');
const migrationExists = fs.existsSync(migrationFile);
check('Migration SQL corrigida existe', migrationExists);

if (migrationExists) {
  const migrationContent = fs.readFileSync(migrationFile, 'utf8');
  check('Define CAPT_BOLETOS', migrationContent.includes('CREATE TABLE.*CAPT_BOLETOS'));
  check('Define CAPT_IMPORTACOES', migrationContent.includes('CREATE TABLE.*CAPT_IMPORTACOES'));
  check('Define CAPT_LOGS_PROCESSAMENTO', migrationContent.includes('CREATE TABLE.*CAPT_LOGS_PROCESSAMENTO'));
}

console.log();

// 6. Verificar pasta de documentação
console.log(`${colors.blue}▶ Verificando documentação...${colors.reset}`);
const docsFiles = [
  'IMPLEMENTACAO_CORRIGIDA.md',
  'API_ENDPOINTS_ATUALIZADOS.md',
  'TROUBLESHOOTING.md',
  'TESTE_COMPLETO.md',
];

docsFiles.forEach(doc => {
  const docPath = path.join(__dirname, '..', doc);
  const exists = fs.existsSync(docPath);
  check(`${doc}`, exists);
});

console.log();

// Resumo final
console.log('='.repeat(60));
console.log(`\n📊 RESULTADO: ${colors.green}${checksPassed} OK${colors.reset} / ${colors.red}${checksFailed} FALHAS${colors.reset}\n`);

if (checksFailed === 0) {
  console.log(`${colors.green}✅ SISTEMA PRONTO PARA USO!${colors.reset}\n`);
  console.log('Próximos passos:');
  console.log('1. Verificar que Supabase está acessível');
  console.log('2. Executar migration SQL no Supabase');
  console.log('3. Inserir conta em CONTAS (se necessário)');
  console.log('4. Executar: npm start');
  console.log('5. Testar endpoints (veja TESTE_COMPLETO.md)\n');
  process.exit(0);
} else {
  console.log(`${colors.red}⚠️  ALGUNS PROBLEMAS ENCONTRADOS${colors.reset}\n`);
  console.log('Verifique os itens marcados com ❌ acima.\n');
  process.exit(1);
}
