/**
 * IMPORTAÇÃO DE BOLETOS CNAB400
 * Arquivo: Funções TypeScript Prontas para Implementação
 * Data: 11/05/2026
 * Status: Pronto para integração
 */

import { Pool, QueryResult } from 'pg'; // ou seu driver de BD

interface BoletoCSV {
  [key: string]: any;
}

interface ContaBanco {
  id: string;
  conta: string;
  usuario_id: string;
}

interface BoletoExistente {
  id: string;
  valor_pagamento: number;
  data_pagamento: string | null;
  status: string;
}

interface UsuarioLogado {
  id: string;
  perfil: 'master' | 'normal';
}

interface ResultadoProcessamento {
  status: 'sucesso' | 'erro' | 'sem-mudanca';
  message: string;
  id?: string;
  boleto?: any;
}

/**
 * 1. EXTRAIR NÚMERO DA CONTA DA LINHA DIGITÁVEL
 * Posição 24-30 (1-indexed) = substring(23, 30) em 0-indexed
 *
 * Exemplo:
 * Input:  "27490001019000000005083095388001315380000178900"
 * Output: "0953880"
 */
function extrairNumeroConta(linhaDigitavel: string): string {
  if (!linhaDigitavel || linhaDigitavel.length < 30) {
    throw new Error('Linha digitável inválida ou muito curta');
  }
  // Posição 24-30 (1-indexed) = índice 23-30 (0-indexed)
  return linhaDigitavel.substring(23, 30);
}

/**
 * 2. VALIDAR PERMISSÃO DO PERFIL
 * Master: pode importar para qualquer conta
 * Normal: apenas para contas do próprio usuário
 */
async function validarPermissao(
  perfilLogado: 'master' | 'normal',
  usuarioLogadoId: string,
  contaEncontrada: ContaBanco
): Promise<boolean> {
  // Master tem acesso a tudo
  if (perfilLogado === 'master') {
    return true;
  }

  // Normal: verificar se a conta pertence ao usuário logado
  return contaEncontrada.usuario_id === usuarioLogadoId;
}

/**
 * 3. DETECTAR MUDANÇAS
 * Compara apenas os campos: valor_pagamento, data_pagamento, status
 */
function houveMudanca(
  registroExistente: BoletoExistente,
  novosDados: { valor_pagamento: number; data_pagamento: string | null; status: string }
): boolean {
  return (
    registroExistente.valor_pagamento !== novosDados.valor_pagamento ||
    registroExistente.data_pagamento !== novosDados.data_pagamento ||
    registroExistente.status !== novosDados.status
  );
}

/**
 * 4. NORMALIZAR DATA DO ARQUIVO PARA ISO
 * Converte "14/08/2026" para "2026-08-14"
 */
function normalizarData(dataBrasileira: string | null): string | null {
  if (!dataBrasileira || dataBrasileira === '- - -' || dataBrasileira.trim() === '') {
    return null;
  }
  const partes = dataBrasileira.split('/');
  if (partes.length !== 3) {
    return null;
  }
  const [dia, mes, ano] = partes;
  // Completar ano com 20 se for 2 dígitos
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${mes}-${dia}`;
}

/**
 * 5. NORMALIZAR VALOR MONETÁRIO PARA DECIMAL
 * Converte "500,00" para 500.00
 */
function normalizarValor(valor: string | number): number {
  if (typeof valor === 'number') {
    return valor;
  }
  if (!valor) return 0;
  // Remove espaços e converte vírgula em ponto
  return parseFloat(String(valor).replace(/\s+/g, '').replace(',', '.'));
}

/**
 * 6. PROCESSAR UM BOLETO COMPLETO
 * Função principal que executa todo o fluxo de importação
 */
async function processarBoleto(
  boleto: BoletoCSV,
  usuarioLogado: UsuarioLogado,
  db: Pool
): Promise<ResultadoProcessamento> {
  try {
    // 1. Extrair número da conta
    const codigoBarras = boleto['Linha digitável']; // coluna 27
    if (!codigoBarras) {
      return {
        status: 'erro',
        message: 'Coluna "Linha digitável" não encontrada ou vazia',
      };
    }

    const numeroConta = extrairNumeroConta(codigoBarras);

    // 2. Buscar conta no banco
    const resultadoConta = await db.query(
      'SELECT id, conta, usuario_id FROM contas WHERE LEFT(conta, 7) = ? LIMIT 1',
      [numeroConta]
    );

    if (resultadoConta.rows.length === 0) {
      return {
        status: 'erro',
        message: `Conta ${numeroConta} não encontrada no banco de dados`,
      };
    }

    const contaEncontrada: ContaBanco = resultadoConta.rows[0];

    // 3. Validar permissão
    const temPermissao = await validarPermissao(
      usuarioLogado.perfil,
      usuarioLogado.id,
      contaEncontrada
    );

    if (!temPermissao) {
      return {
        status: 'erro',
        message: `Perfil "${usuarioLogado.perfil}" não tem permissão para esta conta`,
      };
    }

    // 4. Buscar boleto existente
    const resultadoBuscaBoleto = await db.query(
      'SELECT id, valor_pagamento, data_pagamento, status FROM capt_boletos WHERE codigo_barras = ? LIMIT 1',
      [codigoBarras]
    );

    // 5. Preparar dados do novo boleto
    const novosDados = {
      valor_pagamento: normalizarValor(boleto['Valor pago']),
      data_pagamento: normalizarData(boleto['Data de pagamento']),
      status: boleto['Status de negociação'] || 'pendente',
    };

    // 6. Inserir ou atualizar
    if (resultadoBuscaBoleto.rows.length === 0) {
      // INSERIR novo boleto
      const resultadoInsercao = await db.query(
        `INSERT INTO capt_boletos (
          codigo_barras, numero_conta_id, usuario_id,
          valor_pagamento, data_pagamento, status, criado_em
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          codigoBarras,
          contaEncontrada.id,
          usuarioLogado.id,
          novosDados.valor_pagamento,
          novosDados.data_pagamento,
          novosDados.status,
        ]
      );

      return {
        status: 'sucesso',
        message: 'Boleto inserido com sucesso',
        id: resultadoInsercao.rows[0]?.id,
      };
    } else {
      // BOLETO EXISTE - verificar se há mudanças
      const bolExistente: BoletoExistente = resultadoBuscaBoleto.rows[0];

      if (houveMudanca(bolExistente, novosDados)) {
        // ATUALIZAR boleto
        await db.query(
          `UPDATE capt_boletos SET
            valor_pagamento = ?,
            data_pagamento = ?,
            status = ?,
            atualizado_em = NOW()
          WHERE id = ?`,
          [
            novosDados.valor_pagamento,
            novosDados.data_pagamento,
            novosDados.status,
            bolExistente.id,
          ]
        );

        return {
          status: 'sucesso',
          message: 'Boleto atualizado com mudanças detectadas',
          id: bolExistente.id,
        };
      } else {
        // Sem mudanças
        return {
          status: 'sem-mudanca',
          message: 'Boleto já existe e não há mudanças',
          id: bolExistente.id,
        };
      }
    }
  } catch (error) {
    console.error('Erro ao processar boleto:', error);
    return {
      status: 'erro',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * 7. PROCESSAR ARQUIVO INTEIRO
 * Itera sobre todos os boletos e importa
 */
async function processarArquivoBoletos(
  boletos: BoletoCSV[],
  usuarioLogado: UsuarioLogado,
  db: Pool
): Promise<{
  total: number;
  sucesso: number;
  semMudanca: number;
  erros: number;
  detalhes: ResultadoProcessamento[];
}> {
  const resultados: ResultadoProcessamento[] = [];
  let sucesso = 0;
  let semMudanca = 0;
  let erros = 0;

  console.log(`Iniciando importação de ${boletos.length} boletos...`);

  for (let i = 0; i < boletos.length; i++) {
    const boleto = boletos[i];
    const resultado = await processarBoleto(boleto, usuarioLogado, db);

    resultados.push(resultado);

    if (resultado.status === 'sucesso') {
      sucesso++;
      if ((i + 1) % 100 === 0) {
        console.log(`✓ ${i + 1}/${boletos.length} boletos processados`);
      }
    } else if (resultado.status === 'sem-mudanca') {
      semMudanca++;
    } else {
      erros++;
      console.warn(`✗ Boleto ${i + 1}: ${resultado.message}`);
    }
  }

  return {
    total: boletos.length,
    sucesso,
    semMudanca,
    erros,
    detalhes: resultados,
  };
}

// ============================================================
// EXPORTS para usar em sua aplicação
// ============================================================

export {
  extrairNumeroConta,
  validarPermissao,
  houveMudanca,
  normalizarData,
  normalizarValor,
  processarBoleto,
  processarArquivoBoletos,
  type BoletoCSV,
  type ContaBanco,
  type BoletoExistente,
  type UsuarioLogado,
  type ResultadoProcessamento,
};
