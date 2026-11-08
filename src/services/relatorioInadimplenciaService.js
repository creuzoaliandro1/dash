// Relatório de Inadimplência: títulos de OPEITE com STATUS = 'IN' (tipos DUP,
// CHE e PRO). Lê a réplica do Supabase, como o Relatório de Borderôs — os
// filtros por intervalo (gte/lte) não são traduzidos para o Firebird.

import { supabase } from '../lib/supabase'

export const TIPOS_INADIMPLENCIA = ['DUP', 'CHE', 'PRO']

const PAGE = 1000
const CHUNK = 200

const chunks = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const temValor = (v) => v !== '' && v != null

/**
 * Busca os títulos inadimplentes.
 * @param {object} f { codCedente, tipos: string[], dtVenciIni, dtVenciFim,
 *   vrFaceMin, vrFaceMax, dtEmissaoIni, dtEmissaoFim }
 * Vencimento considerado = DT_VENCI_NOVO (prorrogação) ou DT_VENCI.
 * Emissão = DT_LANCA (OPEITE não tem data de emissão própria).
 */
export async function getTitulosInadimplentes(f) {
  try {
    const tipos = f.tipos?.length ? f.tipos : TIPOS_INADIMPLENCIA

    const build = () => {
      let q = supabase
        .from('OPEITE')
        .select('COD_CEDENTE, COD_OPERACAO, NUM_LANCAMENTO, NUM_TITULO, DT_LANCA, TIPO_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO')
        .eq('STATUS', 'IN')
        .in('TIPO_TITULO', tipos)
      if (temValor(f.codCedente)) q = q.eq('COD_CEDENTE', Number(f.codCedente))
      if (temValor(f.vrFaceMin)) q = q.gte('VR_FACE', Number(f.vrFaceMin))
      if (temValor(f.vrFaceMax)) q = q.lte('VR_FACE', Number(f.vrFaceMax))
      if (f.dtEmissaoIni) q = q.gte('DT_LANCA', f.dtEmissaoIni)
      if (f.dtEmissaoFim) q = q.lte('DT_LANCA', f.dtEmissaoFim)
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

    // Vencimento efetivo (considera prorrogação) — filtrado aqui.
    const filtrados = titulos.filter((t) => {
      const v = t.DT_VENCI_NOVO || t.DT_VENCI || ''
      if (f.dtVenciIni && (!v || v < f.dtVenciIni)) return false
      if (f.dtVenciFim && (!v || v > f.dtVenciFim)) return false
      return true
    })

    const sacados = new Map()
    const codSacados = [...new Set(filtrados.map((t) => t.COD_SACADO).filter((v) => v != null))]
    for (const c of chunks(codSacados, CHUNK)) {
      const { data, error } = await supabase
        .from('SACADO')
        .select('COD_SACADO, NOME_CORRENTISTA, CIC')
        .in('COD_SACADO', c)
      if (error) throw error
      ;(data || []).forEach((s) => sacados.set(s.COD_SACADO, s))
    }

    const cedentes = new Map()
    const codCedentes = [...new Set(filtrados.map((t) => t.COD_CEDENTE).filter((v) => v != null))]
    for (const c of chunks(codCedentes, CHUNK)) {
      const { data, error } = await supabase
        .from('CEDENTE')
        .select('COD_CEDENTE, RAZAO_SOCIAL, NOME_FANTASIA')
        .in('COD_CEDENTE', c)
      if (error) throw error
      ;(data || []).forEach((ce) => cedentes.set(ce.COD_CEDENTE, ce))
    }

    const rows = filtrados.map((t) => {
      const s = sacados.get(t.COD_SACADO)
      const ce = cedentes.get(t.COD_CEDENTE)
      return {
        ...t,
        KEY: `${t.COD_CEDENTE}~${t.COD_OPERACAO}~${t.NUM_LANCAMENTO}`,
        VENCIMENTO: t.DT_VENCI_NOVO || t.DT_VENCI,
        PRORROGADO: !!t.DT_VENCI_NOVO,
        NOME_SACADO: s?.NOME_CORRENTISTA || '',
        CIC_SACADO: s?.CIC || '',
        NOME_CEDENTE: ce?.RAZAO_SOCIAL || ce?.NOME_FANTASIA || '',
        VR_FACE: parseFloat(t.VR_FACE) || 0,
      }
    })
    return { data: rows, error: null }
  } catch (error) {
    console.error('[relatorioInadimplencia] erro:', error)
    return { data: [], error }
  }
}

// Somatório por cedente (usado quando o filtro de cedente é "Todos").
export function totaisPorCedente(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!m.has(r.COD_CEDENTE)) {
      m.set(r.COD_CEDENTE, { COD_CEDENTE: r.COD_CEDENTE, NOME_CEDENTE: r.NOME_CEDENTE, qtd: 0, total: 0 })
    }
    const g = m.get(r.COD_CEDENTE)
    g.qtd += 1
    g.total += r.VR_FACE
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}
