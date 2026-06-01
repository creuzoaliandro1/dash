/**
 * SERVIÇO: Importação de Boletos CNAB400
 * Funções de processamento e validação
 * Data: 11/05/2026
 */

/**
 * 1. EXTRAIR NÚMERO DA CONTA DA LINHA DIGITÁVEL
 * Posição 24-30 (1-indexed) = substring(23, 30) em 0-indexed
 * EXTRAI 7 DÍGITOS (não 6!)
 *
 * Exemplo:
 * Input:  "27490001019000000005083095388001315380000178900"
 * Output: "0953880" (7 dígitos)
 */
export function extrairNumeroConta(linhaDigitavel) {
  if (!linhaDigitavel || linhaDigitavel.length < 31) {
    throw new Error('Linha digitável inválida ou muito curta');
  }
  // Posição 24-30 (1-indexed) = índice 23-30 (0-indexed)
  // substring(23, 30) extrai 7 caracteres: índices [23,24,25,26,27,28,29]
  const numeroConta = linhaDigitavel.substring(23, 30);
  console.log(`[DEBUG] Extraído numero da conta: "${numeroConta}" (${numeroConta.length} dígitos)`);
  return numeroConta;
}

/**
 * 2. NORMALIZAR DATA DO ARQUIVO PARA ISO
 * Converte "14/08/2026" para "2026-08-14"
 */
export function normalizarData(dataBrasileira) {
  if (!dataBrasileira || dataBrasileira === '- - -' || !String(dataBrasileira).trim()) {
    return null;
  }
  const partes = String(dataBrasileira).split('/');
  if (partes.length !== 3) {
    return null;
  }
  const [dia, mes, ano] = partes;
  // Completar ano com 20 se for 2 dígitos
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * 3. NORMALIZAR VALOR MONETÁRIO PARA DECIMAL
 * Converte "500,00" ou "1.234,56" para números
 */
export function normalizarValor(valor) {
  if (typeof valor === 'number') {
    return valor;
  }
  if (!valor) return 0;

  // Se for string com separador brasileiro
  let stringValor = String(valor).trim();

  // Remove espaços
  stringValor = stringValor.replace(/\s+/g, '');

  // Trata formato brasileiro (1.234,56)
  if (stringValor.includes('.') && stringValor.includes(',')) {
    stringValor = stringValor.replace(/\./g, '').replace(',', '.');
  } else if (stringValor.includes(',')) {
    // Se tem só vírgula (500,00)
    stringValor = stringValor.replace(',', '.');
  }

  const numValor = parseFloat(stringValor);
  return isNaN(numValor) ? 0 : numValor;
}

/**
 * 4. VALIDAR CORRESPONDÊNCIA DE CONTA
 * Busca a conta no banco usando os 7 dígitos extraídos
 * Adaptado para estrutura real: CONTAS tem BIGINT id, não UUID, e não tem usuario_id
 */
export async function validarConta(supabase, numeroConta) {
  const { data, error } = await supabase
    .from('"CONTAS"')
    .select('"id", "conta", "nome_correntista", "email", "cedente"')
    .filter('"conta"', 'ilike', `${numeroConta}%`)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found, que é ok
    throw error;
  }

  return data;
}

/**
 * 5. DETECTAR MUDANÇAS
 * Compara apenas os campos monitorados
 */
export function houveMudanca(bolBuscado, novosDados) {
  if (!bolBuscado) return false;

  return (
    bolBuscado.valor_pagamento !== novosDados.valor_pagamento ||
    bolBuscado.data_pagamento !== novosDados.data_pagamento ||
    bolBuscado.status !== novosDados.status
  );
}

/**
 * 6. BUSCAR BOLETO EXISTENTE
 */
export async function buscarBoletoExistente(supabase, codigoBarras) {
  const { data, error } = await supabase
    .from('"CAPT_BOLETOS"')
    .select('"id", "valor_pagamento", "data_pagamento", "status"')
    .eq('"codigo_barras"', codigoBarras)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

/**
 * 7. PROCESSAR UM BOLETO COMPLETO
 * Função principal que executa todo o fluxo
 */
export async function processarBoleto(boleto, usuarioLogado, supabase, perfil = 'normal') {
  try {
    // 1. Extrair número da conta
    const codigoBarras = boleto['Linha digitável'];
    if (!codigoBarras) {
      return {
        status: 'erro',
        message: 'Coluna "Linha digitável" não encontrada ou vazia',
        linha: boleto.__rowIndex || '?',
      };
    }

    const numeroConta = extrairNumeroConta(codigoBarras);

    // 2. Buscar conta no banco
    const contaEncontrada = await validarConta(supabase, numeroConta);
    if (!contaEncontrada) {
      return {
        status: 'erro',
        message: `Conta ${numeroConta} não encontrada no banco de dados`,
        codigo_barras: codigoBarras,
      };
    }

    // 3. Preparar dados do novo boleto
    const novosDados = {
      codigo_barras: codigoBarras,
      numero_conta_id: contaEncontrada.id,

      // Identificação
      nosso_numero: boleto['Nosso número'] || null,
      seu_numero: boleto['Seu número'] || null,
      numero_documento: boleto['Número do documento'] || null,

      // Pagador
      pagador_nome: boleto['Nome do pagador'] || null,
      pagador_documento: boleto['Documento federal do pagador'] || null,
      pagador_email: boleto['Email do pagador'] || null,
      pagador_telefone: boleto['Telefone do pagador'] || null,
      pagador_cep: boleto['CEP do pagador'] || null,
      pagador_logradouro: boleto['Logradouro do pagador'] || null,
      pagador_numero: boleto['Número do endereço do pagador'] || null,
      pagador_complemento: boleto['Complemento do endereço do pagador'] || null,
      pagador_cidade: boleto['Cidade do pagador'] || null,
      pagador_uf: boleto['UF do pagador'] || null,

      // Valores
      valor_titulo: normalizarValor(boleto['Valor do título']),
      valor_pagamento: normalizarValor(boleto['Valor pago']),
      data_emissao: normalizarData(boleto['Data de emissão']),
      data_vencimento: normalizarData(boleto['Data de vencimento']),
      data_limite_pagamento: normalizarData(boleto['Data limite de pagamento']),
      data_pagamento: normalizarData(boleto['Data de pagamento']),

      // Status
      status: boleto['Status do boleto'] || 'pendente',
      status_negociacao: boleto['Status de negociação'] || null,

      // Juros e multas
      valor_juros: normalizarValor(boleto['Valor de juros']),
      valor_multa: normalizarValor(boleto['Valor de multa']),
      valor_desconto: normalizarValor(boleto['Valor de desconto (primeira faixa)']),
    };

    // 5. Buscar boleto existente
    const bolBuscado = await buscarBoletoExistente(supabase, codigoBarras);

    if (!bolBuscado) {
      // INSERIR novo boleto
      const { data, error } = await supabase
        .from('"CAPT_BOLETOS"')
        .insert([novosDados])
        .select('"id"');

      if (error) throw error;

      return {
        status: 'sucesso',
        message: 'Boleto inserido com sucesso',
        id: data[0]?.id,
        operacao: 'INSERT',
      };
    } else {
      // BOLETO EXISTE - verificar se há mudanças
      const mudancasDetectadas = houveMudanca(bolBuscado, {
        valor_pagamento: novosDados.valor_pagamento,
        data_pagamento: novosDados.data_pagamento,
        status: novosDados.status,
      });

      if (mudancasDetectadas) {
        // ATUALIZAR boleto
        const { error } = await supabase
          .from('"CAPT_BOLETOS"')
          .update({
            valor_pagamento: novosDados.valor_pagamento,
            data_pagamento: novosDados.data_pagamento,
            status: novosDados.status,
          })
          .eq('"id"', bolBuscado.id);

        if (error) throw error;

        return {
          status: 'sucesso',
          message: 'Boleto atualizado com mudanças detectadas',
          id: bolBuscado.id,
          operacao: 'UPDATE',
        };
      } else {
        // Sem mudanças
        return {
          status: 'sem-mudanca',
          message: 'Boleto já existe e não há mudanças',
          id: bolBuscado.id,
          operacao: 'NOOP',
        };
      }
    }
  } catch (error) {
    console.error('Erro ao processar boleto:', error);
    return {
      status: 'erro',
      message: error.message || 'Erro desconhecido',
      detalhes: error,
    };
  }
}

/**
 * 8. PROCESSAR ARQUIVO INTEIRO
 * Itera sobre todos os boletos
 */
export async function processarArquivoBoletos(boletos, usuarioLogado, supabase, perfil = 'normal') {
  const resultados = [];
  let inseridos = 0;
  let atualizados = 0;
  let semMudanca = 0;
  let erros = 0;

  console.log(`📊 Iniciando importação de ${boletos.length} boletos...`);
  const inicio = Date.now();

  // Iniciar registro da importação
  const { data: importacao } = await supabase
    .from('"CAPT_IMPORTACOES"')
    .insert([{
      arquivo_nome: 'arquivo_importacao.xlsx',
      total_registros: boletos.length,
      status: 'processando',
    }])
    .select('"id"')
    .single();

  const importacaoId = importacao?.id;

  // ===== OTIMIZAÇÃO: Processar em lotes paralelos (50 por vez) =====
  const LOTE_SIZE = 50;
  const logsParaBatch = []; // Acumular logs para inserção em batch

  for (let loteIdx = 0; loteIdx < boletos.length; loteIdx += LOTE_SIZE) {
    const fim = Math.min(loteIdx + LOTE_SIZE, boletos.length);
    const lote = boletos.slice(loteIdx, fim);

    console.log(`⚡ Processando lote ${Math.floor(loteIdx / LOTE_SIZE) + 1}/${Math.ceil(boletos.length / LOTE_SIZE)} (${lote.length} boletos)`);

    // Processar boletos do lote em PARALELO
    const promessas = lote.map((boleto, idx) => {
      boleto.__rowIndex = loteIdx + idx + 2;
      return processarBoleto(boleto, usuarioLogado, supabase, perfil);
    });

    const resultadosLote = await Promise.all(promessas);

    // Processar resultados e acumular logs
    resultadosLote.forEach((resultado, idx) => {
      resultados.push(resultado);

      // Acumular log para inserção em batch (não inserir um por um!)
      if (importacaoId && resultado) {
        logsParaBatch.push({
          importacao_id: importacaoId,
          numero_linha: loteIdx + idx + 2,
          codigo_barras: lote[idx]['Linha digitável'] || 'desconhecido',
          tipo_operacao: resultado.operacao || (resultado.status === 'erro' ? 'ERRO' : 'NOOP'),
          mensagem: resultado.message,
          detalhes: {
            status: resultado.status,
            id: resultado.id,
          },
        });
      }

      // Contadores
      if (resultado.status === 'sucesso') {
        if (resultado.operacao === 'INSERT') inseridos++;
        else if (resultado.operacao === 'UPDATE') atualizados++;
      } else if (resultado.status === 'sem-mudanca') {
        semMudanca++;
      } else {
        erros++;
      }
    });

    // Inserir logs em BATCH a cada lote (em vez de um por um!)
    if (logsParaBatch.length > 0 && logsParaBatch.length % 100 === 0) {
      console.log(`  💾 Salvando ${logsParaBatch.length} logs...`);
      await supabase.from('"CAPT_LOGS_PROCESSAMENTO"').insert(logsParaBatch);
      logsParaBatch.length = 0; // Limpar array
    }
  }

  // Inserir logs restantes
  if (logsParaBatch.length > 0) {
    console.log(`  💾 Salvando ${logsParaBatch.length} logs finais...`);
    await supabase.from('"CAPT_LOGS_PROCESSAMENTO"').insert(logsParaBatch);
  }

  // Finalizar registro de importação
  if (importacaoId) {
    await supabase
      .from('"CAPT_IMPORTACOES"')
      .update({
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        status: erros === 0 ? 'sucesso' : (erros > boletos.length * 0.5 ? 'erro' : 'parcial'),
        finalizado_em: new Date().toISOString(),
      })
      .eq('"id"', importacaoId);
  }

  const duracao = ((Date.now() - inicio) / 1000).toFixed(2);
  console.log(`✅ Importação concluída em ${duracao}s`);

  return {
    total: boletos.length,
    inseridos,
    atualizados,
    semMudanca,
    erros,
    taxaSucesso: `${(((inseridos + atualizados) / boletos.length) * 100).toFixed(2)}%`,
    resultados,
    importacaoId,
    duracao: `${duracao}s`,
  };
}
