// Relatório de Borderôs: títulos de OPEITE agrupados por borderô (COD_CEDENTE +
// COD_OPERACAO) e vencimento. Lê a réplica do Supabase — os filtros por
// intervalo (gte/lte) não são traduzidos para o Firebird pelo smartFrom.

import { supabase } from '../lib/supabase'

export const STATUS_RELATORIO = [
  { value: 'DO', label: 'DO' },
  { value: 'CO', label: 'CO' },
  { value: 'PR', label: 'PR' },
  { value: 'IN', label: 'IN' },
]

const PAGE = 1000
const CHUNK = 200

const chunks = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// Lista de cedentes para o combo do filtro.
export async function getCedentesRelatorio() {
  const { data, error } = await supabase
    .from('CEDENTE')
    .select('COD_CEDENTE, RAZAO_SOCIAL, NOME_FANTASIA')
    .order('COD_CEDENTE', { ascending: true })
  return { data: data || [], error }
}

/**
 * Busca os títulos do relatório.
 * @param {object} f filtros: { dtLancaIni, dtLancaFim, vrFaceMin, vrFaceMax,
 *   dtVenciIni, dtVenciFim, dtVenciNovoIni, dtVenciNovoFim, codOperacao,
 *   codCedente, status: string[] }
 * @returns {{ data: Array, error: any }}
 */
export async function getTitulosRelatorioBorderos(f) {
  try {
    const status = f.status?.length ? f.status : STATUS_RELATORIO.map((s) => s.value)

    const build = () => {
      let q = supabase
        .from('OPEITE')
        .select('COD_CEDENTE, COD_OPERACAO, NUM_LANCAMENTO, DT_LANCA, TIPO_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO')
        .in('STATUS', status)
      if (f.dtLancaIni) q = q.gte('DT_LANCA', f.dtLancaIni)
      if (f.dtLancaFim) q = q.lte('DT_LANCA', f.dtLancaFim)
      if (f.vrFaceMin !== '' && f.vrFaceMin != null) q = q.gte('VR_FACE', Number(f.vrFaceMin))
      if (f.vrFaceMax !== '' && f.vrFaceMax != null) q = q.lte('VR_FACE', Number(f.vrFaceMax))
      if (f.dtVenciIni) q = q.gte('DT_VENCI', f.dtVenciIni)
      if (f.dtVenciFim) q = q.lte('DT_VENCI', f.dtVenciFim)
      if (f.dtVenciNovoIni) q = q.gte('DT_VENCI_NOVO', f.dtVenciNovoIni)
      if (f.dtVenciNovoFim) q = q.lte('DT_VENCI_NOVO', f.dtVenciNovoFim)
      if (f.codOperacao !== '' && f.codOperacao != null) q = q.eq('COD_OPERACAO', Number(f.codOperacao))
      if (f.codCedente !== '' && f.codCedente != null) q = q.eq('COD_CEDENTE', Number(f.codCedente))
      // Ordem estável para a paginação
      return q
        .order('COD_CEDENTE', { ascending: true })
        .order('COD_OPERACAO', { ascending: true })
        .order('NUM_LANCAMENTO', { ascending: true })
    }

    const titulos = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build().range(from, from + PAGE - 1)
      if (error) throw error
      titulos.push(...(data || []))
      if (!data || data.length < PAGE) break
    }

    // Sacados (nome + CPF/CNPJ)
    const codSacados = [...new Set(titulos.map((t) => t.COD_SACADO).filter((v) => v != null))]
    const sacados = new Map()
    for (const c of chunks(codSacados, CHUNK)) {
      const { data, error } = await supabase
        .from('SACADO')
        .select('COD_SACADO, NOME_CORRENTISTA, CIC')
        .in('COD_SACADO', c)
      if (error) throw error
      ;(data || []).forEach((s) => sacados.set(s.COD_SACADO, s))
    }

    // Cedentes (nome no cabeçalho de cada borderô)
    const codCedentes = [...new Set(titulos.map((t) => t.COD_CEDENTE).filter((v) => v != null))]
    const cedentes = new Map()
    for (const c of chunks(codCedentes, CHUNK)) {
      const { data, error } = await supabase
        .from('CEDENTE')
        .select('COD_CEDENTE, RAZAO_SOCIAL, NOME_FANTASIA')
        .in('COD_CEDENTE', c)
      if (error) throw error
      ;(data || []).forEach((ce) => cedentes.set(ce.COD_CEDENTE, ce))
    }

    const rows = titulos.map((t) => {
      const s = sacados.get(t.COD_SACADO)
      const ce = cedentes.get(t.COD_CEDENTE)
      return {
        ...t,
        VENCIMENTO: t.DT_VENCI_NOVO || t.DT_VENCI,
        PRORROGADO: !!t.DT_VENCI_NOVO,
        NOME_CORRENTISTA: s?.NOME_CORRENTISTA || '',
        CIC: s?.CIC || '',
        NOME_CEDENTE: ce?.RAZAO_SOCIAL || ce?.NOME_FANTASIA || '',
      }
    })
    return { data: rows, error: null }
  } catch (error) {
    console.error('[relatorioBorderos] erro:', error)
    return { data: [], error }
  }
}
