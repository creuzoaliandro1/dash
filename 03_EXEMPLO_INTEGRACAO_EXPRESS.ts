/**
 * EXEMPLO: Integração com Express.js
 * Como usar as funções de importação em uma API REST
 * Data: 11/05/2026
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import {
  processarBoleto,
  processarArquivoBoletos,
  type UsuarioLogado,
  type BoletoCSV,
} from './02_FUNCOES_TYPESCRIPT_IMPORTACAO';

// Configuração
const app = express();
const db = new Pool({
  user: 'seu_usuario',
  password: 'sua_senha',
  host: 'localhost',
  port: 5432,
  database: 'seu_banco',
});

const upload = multer({ storage: multer.memoryStorage() });

// ============================================================
// ENDPOINT: POST /api/importar-boletos
// Recebe arquivo Excel e importa todos os boletos
// ============================================================

app.post('/api/importar-boletos', upload.single('arquivo'), async (req: Request, res: Response) => {
  try {
    // 1. Validar arquivo
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo não fornecido' });
    }

    // 2. Verificar usuário logado (você pode pegar do token JWT, sessão, etc.)
    const usuarioLogado: UsuarioLogado = {
      id: req.user?.id || 'user-id-exemplo', // Adapte conforme sua autenticação
      perfil: req.user?.perfil || 'normal', // 'master' ou 'normal'
    };

    console.log(`Importação iniciada por ${usuarioLogado.perfil} (${usuarioLogado.id})`);

    // 3. Ler arquivo Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const primeiraAba = workbook.SheetNames[0];
    const planilha = workbook.Sheets[primeiraAba];
    const boletos: BoletoCSV[] = XLSX.utils.sheet_to_json(planilha);

    console.log(`Arquivo contém ${boletos.length} registros`);

    // 4. Validar se há registros
    if (boletos.length === 0) {
      return res.status(400).json({ erro: 'Arquivo vazio' });
    }

    // 5. Processar todos os boletos
    const resultado = await processarArquivoBoletos(boletos, usuarioLogado, db);

    // 6. Retornar resultado
    res.json({
      mensagem: 'Importação concluída',
      resumo: {
        total: resultado.total,
        inseridos: resultado.sucesso,
        nao_alterados: resultado.semMudanca,
        com_erro: resultado.erros,
        taxa_sucesso: `${((resultado.sucesso / resultado.total) * 100).toFixed(2)}%`,
      },
      detalhes:
        resultado.erros > 0
          ? resultado.detalhes.filter((r) => r.status === 'erro').slice(0, 10) // Primeiros 10 erros
          : [],
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    res.status(500).json({
      erro: 'Erro ao processar arquivo',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// ============================================================
// ENDPOINT: POST /api/importar-boleto-individual
// Importa apenas um boleto (útil para testes)
// ============================================================

app.post('/api/importar-boleto-individual', express.json(), async (req: Request, res: Response) => {
  try {
    const usuarioLogado: UsuarioLogado = {
      id: req.user?.id || 'user-id-exemplo',
      perfil: req.user?.perfil || 'normal',
    };

    const boleto: BoletoCSV = req.body;

    if (!boleto['Linha digitável']) {
      return res.status(400).json({ erro: 'Campo "Linha digitável" é obrigatório' });
    }

    const resultado = await processarBoleto(boleto, usuarioLogado, db);

    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      status: 'erro',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// ============================================================
// ENDPOINT: GET /api/boletos/estatisticas
// Retorna estatísticas dos boletos importados
// ============================================================

app.get('/api/boletos/estatisticas', async (req: Request, res: Response) => {
  try {
    const resultado = await db.query(`
      SELECT
        COUNT(*) as total_boletos,
        COUNT(DISTINCT numero_conta_id) as contas_unicas,
        SUM(valor_pagamento) as valor_total,
        COUNT(CASE WHEN status = 'pendente' THEN 1 END) as pendentes,
        COUNT(CASE WHEN status = 'pago' THEN 1 END) as pagos,
        MIN(criado_em) as primeira_importacao,
        MAX(criado_em) as ultima_importacao
      FROM capt_boletos
    `);

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// ============================================================
// ENDPOINT: GET /api/boletos/:codigo_barras
// Busca um boleto específico
// ============================================================

app.get('/api/boletos/:codigo_barras', async (req: Request, res: Response) => {
  try {
    const { codigo_barras } = req.params;

    const resultado = await db.query(
      `SELECT cb.*, c.conta, c.usuario_id
       FROM capt_boletos cb
       JOIN contas c ON cb.numero_conta_id = c.id
       WHERE cb.codigo_barras = ?`,
      [codigo_barras]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Boleto não encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// ============================================================
// MIDDLEWARE: Autenticação (exemplo básico)
// Adapte conforme sua estratégia de autenticação
// ============================================================

app.use((req: Request, res: Response, next: any) => {
  // Simulação: pegar usuário do header ou sessão
  const userHeader = req.headers['x-user-id'];
  const perfilHeader = req.headers['x-perfil'];

  if (userHeader && perfilHeader) {
    req.user = {
      id: String(userHeader),
      perfil: String(perfilHeader) as 'master' | 'normal',
    };
  }

  next();
});

// ============================================================
// Iniciar servidor
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
    ✓ Servidor iniciado na porta ${PORT}

    Endpoints disponíveis:
    - POST   /api/importar-boletos              (arquivo Excel)
    - POST   /api/importar-boleto-individual    (JSON)
    - GET    /api/boletos/estatisticas
    - GET    /api/boletos/:codigo_barras
  `);
});

// ============================================================
// Exemplo de como testar com curl:
// ============================================================

/*
// 1. Importar arquivo Excel inteiro
curl -X POST http://localhost:3000/api/importar-boletos \
  -H "X-User-Id: user-123" \
  -H "X-Perfil: master" \
  -F "arquivo=@Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx"

// 2. Importar um boleto individual
curl -X POST http://localhost:3000/api/importar-boleto-individual \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -H "X-Perfil: normal" \
  -d '{
    "Linha digitável": "27490001019000000005083095388001315380000178900",
    "Valor pago": "500,00",
    "Data de pagamento": "14/08/2026",
    "Status de negociação": "aberto"
  }'

// 3. Obter estatísticas
curl http://localhost:3000/api/boletos/estatisticas

// 4. Buscar boleto específico
curl http://localhost:3000/api/boletos/27490001019000000005083095388001315380000178900
*/
