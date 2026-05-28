import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// Converte data do Excel ("5/28/26 2:09" ou número serial) para YYYY-MM-DD
const parseDataLancamento = (raw) => {
  if (!raw && raw !== 0) return null

  // Número serial do Excel
  if (typeof raw === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const ms = epoch.getTime() + raw * 86400000
    const d = new Date(ms)
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    return null
  }

  const s = String(raw).trim()
  // ISO yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  // dd/mm/yyyy (com 4 dígitos no ano)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const day = m[1].padStart(2, '0')
    const mon = m[2].padStart(2, '0')
    return `${m[3]}-${mon}-${day}`
  }

  // m/d/yy ou m/d/yy hh:mm (formato BTG/Excel) — assume sempre 20xx
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})/)
  if (m) {
    const mon = m[1].padStart(2, '0')
    const day = m[2].padStart(2, '0')
    const year = `20${m[3].padStart(2, '0')}`
    return `${year}-${mon}-${day}`
  }

  return null
}

// Converte "R$ 1.234,56" / "1234.56" / número em decimal
const parseValor = (raw) => {
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/[^\d.,-]/g, '')
  if (!s) return 0
  if (s.includes(',')) {
    // Formato brasileiro: 1.234,56
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// Lê o XLSX e devolve um array de registros normalizados para a tabela EXTRATO.
// O arquivo tem cabeçalho mesclado na linha 1; usamos {header: 1} para pegar tudo bruto
// e mapeamos por POSIÇÃO da coluna (mais robusto que nome).
export const parseExtratoXLSX = async (file) => {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })

  // Localiza a linha de cabeçalho (contém "Data hora transação" e "Operação")
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const joined = rows[i].join('|').toLowerCase()
    if (joined.includes('data hora') && joined.includes('operação') || joined.includes('operacao')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    // Fallback: cabeçalho na linha 1 (índice 0)
    headerIdx = 0
  }

  // Posições das colunas (conforme o arquivo do BTG):
  // 0=Data hora, 1=Tipo evento, 2=Operação, 3=Nome, 4=CPF/CNPJ, 5=Agência, 6=Conta,
  // 7=Instituição, 8=Valor, 9=ID transação, 10=Origem, 11=Nº controle, 12=Observações
  const out = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const dataHora = r[0]
    if (!dataHora) continue

    const data = parseDataLancamento(dataHora)
    if (!data) continue

    out.push({
      DATA: data,
      TIPO: String(r[1] || '').trim(),
      OPERACAO: String(r[2] || '').trim(),
      NOME: String(r[3] || '').trim(),
      CIC: String(r[4] || '').trim(),
      AGENCIA: String(r[5] || '').trim(),
      CONTA: String(r[6] || '').trim(),
      INSTITUICAO: String(r[7] || '').trim(),
      VALOR: parseValor(r[8]),
      TRANSACAO: String(r[9] || '').trim(),
      ORIGEM: String(r[10] || '').trim(),
      CONTROLE: String(r[11] || '').trim(),
      OBSERVACAO: String(r[12] || '').trim(),
    })
  }
  return out
}

// Importa registros: descarta os que já existem (chave: TRANSACAO).
// Retorna { imported, skipped, errors }.
export const importExtrato = async (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) {
    return { data: { imported: 0, skipped: 0, errors: 0, total: 0 }, error: null }
  }

  try {
    // 1) Levanta TRANSACAO já existentes
    const ids = registros.map((r) => r.TRANSACAO).filter(Boolean)
    const existentes = new Set()
    const pageSize = 1000
    for (let i = 0; i < ids.length; i += pageSize) {
      const batch = ids.slice(i, i + pageSize)
      const { data, error } = await supabase
        .from('EXTRATO')
        .select('"TRANSACAO"')
        .in('TRANSACAO', batch)
      if (error) {
        console.warn('[Extrato] Aviso ao checar duplicados:', error.message)
        continue
      }
      data?.forEach((row) => existentes.add(row.TRANSACAO))
    }

    // 2) Filtra novos
    const novos = registros.filter((r) => r.TRANSACAO && !existentes.has(r.TRANSACAO))
    const skipped = registros.length - novos.length

    // 3) Insere em lotes
    let imported = 0
    let errors = 0
    const insertBatch = 500
    for (let i = 0; i < novos.length; i += insertBatch) {
      const batch = novos.slice(i, i + insertBatch)
      const { error } = await supabase.from('EXTRATO').insert(batch)
      if (error) {
        console.error('[Extrato] Erro ao inserir lote:', error.message)
        errors += batch.length
      } else {
        imported += batch.length
      }
    }

    return {
      data: { imported, skipped, errors, total: registros.length },
      error: null,
    }
  } catch (err) {
    console.error('[Extrato] Erro geral na importação:', err)
    return { data: null, error: err }
  }
}

// Carrega todos os lançamentos (paginação > 1000), ordenado por DATA desc.
export const getExtratos = async () => {
  try {
    let all = []
    const pageSize = 1000
    let from = 0
    while (true) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('EXTRATO')
        .select('*')
        .order('DATA', { ascending: false })
        .range(from, to)
      if (error) throw error
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return { data: all, error: null }
  } catch (err) {
    console.error('[Extrato] Erro ao carregar:', err)
    return { data: [], error: err }
  }
}
