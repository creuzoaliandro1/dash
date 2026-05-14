import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

/**
 * Verificar se código de barras já existe em capt_boletos
 * Usa limit(1) em vez de single() para evitar erros com URLs muito longas
 */
export const verificarCodigoBarrasExistente = async (codigoBarras) => {
  try {
    if (!codigoBarras || codigoBarras.trim() === '') {
      return false
    }

    const { data, error } = await supabase
      .from('capt_boletos')
      .select('id', { count: 'exact', head: true })
      .eq('codigo_barras', codigoBarras)
      .limit(1)

    if (error) {
      // Se erro for de URL muito longa (406), fazer fallback com substring
      if (error.status === 406) {
        console.warn('[boletoImportService] Código de barras muito longo, verificando com substring')
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('capt_boletos')
          .select('id', { count: 'exact', head: true })
          .ilike('codigo_barras', `%${codigoBarras.slice(-20)}%`)
          .limit(1)

        return !fallbackError && fallbackData && fallbackData.length > 0
      }
      throw error
    }

    return data && data.length > 0
  } catch (err) {
    console.error('[boletoImportService] Erro ao verificar código de barras:', err)
    // Em caso de erro, retorna false para não bloquear a importação
    return false
  }
}

/**
 * Gerar PDF com relatório de erros de importação
 * @param {Array} erros - Array com objetos de erro
 * @returns {Blob} PDF blob
 *
 * Cada erro deve ter:
 * {
 *   linha: número,
 *   numero_documento: string,
 *   sacado_nome: string,
 *   codigo_barras: string,
 *   motivo: 'duplicado' | 'conta_nao_encontrada',
 *   valor: number
 * }
 */
export const gerarRelatorioPDFErros = (erros, dataImportacao = new Date()) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  // Configurar fontes
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Relatório de Importação - Boletos Não Inseridos', margin, 20)

  // Data e hora
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  const dataFormatada = dataImportacao.toLocaleString('pt-BR')
  doc.text(`Data/Hora: ${dataFormatada}`, margin, 30)

  // Resumo
  const errosDuplicados = erros.filter(e => e.motivo === 'duplicado').length
  const errosContaNaoEncontrada = erros.filter(e => e.motivo === 'conta_nao_encontrada').length

  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text('Resumo:', margin, 40)

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Total de registros não inseridos: ${erros.length}`, margin + 5, 48)
  doc.text(`  • Código de barras duplicado: ${errosDuplicados}`, margin + 5, 55)
  doc.text(`  • Conta não encontrada: ${errosContaNaoEncontrada}`, margin + 5, 62)

  // Tabela de erros
  const tabelaErros = erros.map(e => [
    e.linha || '—',
    e.numero_documento || '—',
    (e.sacado_nome || '—').substring(0, 25), // Limitar tamanho
    (e.codigo_barras || '—').substring(0, 20),
    e.valor ? `R$ ${e.valor.toFixed(2)}` : '—',
    e.motivo === 'duplicado' ? 'Duplicado' : 'Conta não encontrada'
  ])

  doc.autoTable({
    head: [['Linha', 'Documento', 'Sacado', 'Código de Barras', 'Valor', 'Motivo']],
    body: tabelaErros,
    startY: 70,
    margin: margin,
    headStyles: {
      fillColor: [100, 100, 100],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
      halign: 'left',
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 22 },
      2: { cellWidth: 35 },
      3: { cellWidth: 38 },
      4: { cellWidth: 20 },
      5: { cellWidth: 40 }
    },
    didDrawPage: (data) => {
      // Rodapé
      const pageCount = doc.getNumberOfPages()
      const pageSize = doc.internal.pageSize
      const pageHeight = pageSize.getHeight()
      const pageWidth = pageSize.getWidth()

      doc.setFontSize(8)
      doc.setTextColor(128)
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
    }
  })

  return doc.output('blob')
}

/**
 * Fazer download do PDF
 */
export const downloadPDFRelatorio = (blob, nomeArquivo = 'relatorio_importacao.pdf') => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
