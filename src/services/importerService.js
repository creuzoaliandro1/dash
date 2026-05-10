import { supabase } from '../lib/supabase'

/**
 * Mapeia colunas do relatório BMP para as colunas esperadas da tabela capt_boletos
 */
const mapBMPColumnsToDatabase = (row) => {
  return {
    numero_documento: row['Seu número'] || row['Número do documento'] || '',
    sacado_nome: row['Nome do pagador'] || '',
    sacado_cic: String(row['Documento federal do pagador'] || '').replace(/\D/g, ''),
    data_emissao: formatDate(row['Data de emissão']),
    data_vencimento: formatDate(row['Data de vencimento']),
    valor: parseFloat(String(row['Valor do título'] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')),
    nosso_numero: String(row['Nosso número'] || '').trim(),
    status: mapStatus(row['Status do boleto']),
    situacao: row['Status do boleto'] || 'Registrado',
    sacado_endereco: row['Logradouro do pagador'] || '',
    sacado_bairro: row['Bairro do pagador'] || '',
    sacado_cidade: row['Cidade do pagador'] || '',
    sacado_uf: String(row['UF do pagador'] || '').substring(0, 2).toUpperCase(),
    sacado_cep: String(row['CEP do pagador'] || '').replace(/\D/g, ''),
    sacado_telefone: row['Telefone do pagador'] || '',
    sacado_email: row['Email do pagador'] || '',
  }
}

/**
 * Converte formato de data DD/MM/YYYY para YYYY-MM-DD
 */
const formatDate = (dateStr) => {
  if (!dateStr || dateStr === '- - -') return new Date().toISOString().split('T')[0]

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/')
    return `${year}-${month}-${day}`
  }

  return new Date().toISOString().split('T')[0]
}

/**
 * Mapeia status do banco para status da aplicação
 */
const mapStatus = (bmpStatus) => {
  const statusMap = {
    'A Vencer': 'pendente',
    'Vencido': 'atrasado',
    'Pago': 'pago',
    'Cancelado': 'cancelado',
    'Devolvido': 'cancelado',
  }
  return statusMap[bmpStatus] || 'pendente'
}

/**
 * Processa arquivo Excel de importação de boletos
 * Pode ser relatório do BMP ou outro formato
 */
export const processExcelImport = async (fileData) => {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileData)

    const worksheet = workbook.getWorksheet(1)
    const rows = worksheet.getSheetValues()

    // Primeira linha contém headers
    const headers = rows[1]
    const importedRecords = []
    const errors = []

    // Processar cada linha a partir da segunda
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0]) continue // Pular linhas vazias

      try {
        // Mapear valores para objetos
        const record = {}
        headers.forEach((header, index) => {
          record[header] = row[index]
        })

        // Converter para formato de banco de dados
        const mappedData = mapBMPColumnsToDatabase(record)

        // Validar campos obrigatórios
        if (!mappedData.sacado_nome || !mappedData.valor) {
          errors.push({
            line: i + 1,
            error: 'Dados incompletos: faltam nome do pagador ou valor'
          })
          continue
        }

        importedRecords.push(mappedData)
      } catch (err) {
        errors.push({
          line: i + 1,
          error: err.message
        })
      }
    }

    return {
      success: true,
      records: importedRecords,
      errors,
      summary: {
        total: importedRecords.length + errors.length,
        imported: importedRecords.length,
        errors: errors.length
      }
    }
  } catch (err) {
    console.error('Erro ao processar arquivo Excel:', err)
    return {
      success: false,
      error: err.message,
      records: [],
      errors: []
    }
  }
}

/**
 * Importa boletos para o banco de dados
 */
export const importBoletos = async (contaId, boletos) => {
  try {
    const dataToInsert = boletos.map(boleto => ({
      conta_id: contaId,
      ...boleto
    }))

    const { data, error } = await supabase
      .from('capt_boletos')
      .insert(dataToInsert)
      .select()

    if (error) {
      console.error('Erro ao importar boletos:', error)
      throw error
    }

    return {
      success: true,
      imported: data.length,
      data
    }
  } catch (err) {
    console.error('Erro na importação:', err)
    return {
      success: false,
      error: err.message,
      imported: 0
    }
  }
}

/**
 * Valida dados de boleto antes de importar
 */
export const validateBoleto = (boleto) => {
  const errors = []

  if (!boleto.sacado_nome) errors.push('Nome do pagador é obrigatório')
  if (!boleto.valor || boleto.valor <= 0) errors.push('Valor deve ser maior que zero')
  if (!boleto.data_vencimento) errors.push('Data de vencimento é obrigatória')

  return {
    isValid: errors.length === 0,
    errors
  }
}
