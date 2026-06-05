import { useState, useEffect, useMemo } from 'react'
import * as ctb from '../../services/contabilService'
import { formatDate, formatCurrency } from '../../utils/formatters'

const inputCls = 'px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-[#444] outline-none'
const thCls = 'px-3 py-2.5 font-semibold text-[#666666] uppercase tracking-wider text-xs'

const primeiroDiaMes = () => new Date().toISOString().slice(0, 8) + '01'
const hoje = () => new Date().toISOString().slice(0, 10)

// saldo de exibição: natureza devedora mostra D−C; credora mostra C−D
const saldoExibicao = (bruto, natureza) => natureza === 'credora' ? -Number(bruto) : Number(bruto)

export default function RelatoriosTab() {
  const [sub, setSub] = useState('balancete')
  const [de, setDe] = useState(primeiroDiaMes())
  const [ate, setAte] = useState(hoje())
  const [contas, setContas] = useState([])
  const [contaRazao, setContaRazao] = useState('')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => { ctb.getContas().then(setContas).catch(() => {}) }, [])

  const analiticas = useMemo(() => contas.filter(c => c.aceita_lancamento), [contas])

  const gerar = async () => {
    setErro(''); setCarregando(true); setDados(null)
    try {
      if (sub === 'balancete') setDados(await ctb.relBalancete(de, ate))
      else if (sub === 'razao') {
        if (!contaRazao) throw new Error('Selecione a conta do Razão')
        setDados(await ctb.relRazao(Number(contaRazao), de, ate))
      }
      else if (sub === 'diario') setDados(await ctb.relDiario(de, ate))
      else if (sub === 'dre') setDados(await ctb.relDre(de, ate))
      else if (sub === 'balanco') setDados(await ctb.relBalanco(ate))
    } catch (e) { setErro(ctb.mensagemErro(e)) } finally { setCarregando(false) }
  }

  useEffect(() => { setDados(null); setErro('') }, [sub])

  const exportar = () => {
    if (!dados) return
    let linhas = []
    if (sub === 'balancete') {
      linhas = dados.map(r => ({
        Código: r.codigo, Conta: r.nome, Natureza: r.natureza,
        'Saldo Anterior': saldoExibicao(r.saldo_anterior, r.natureza),
        Débitos: Number(r.debitos), Créditos: Number(r.creditos),
        'Saldo Final': saldoExibicao(r.saldo_final, r.natureza),
      }))
    } else if (sub === 'razao') {
      let saldo = Number(dados.saldo_anterior)
      linhas = (dados.movimentos || []).map(m => {
        saldo += m.tipo === 'D' ? Number(m.valor) : -Number(m.valor)
        return { Data: m.data, Lançamento: m.numero, Histórico: m.historico, Tipo: m.tipo, Valor: Number(m.valor), 'Saldo (D−C)': saldo }
      })
    } else if (sub === 'diario') {
      linhas = dados.flatMap(l => (l.ctb_lancamento_item || []).map(i => ({
        Número: l.numero, Competência: l.data_competencia, Histórico: l.historico,
        Conta: `${i.ctb_conta_contabil?.codigo} ${i.ctb_conta_contabil?.nome}`, Tipo: i.tipo, Valor: Number(i.valor),
      })))
    } else if (sub === 'dre') {
      linhas = dreLinhas.map(r => ({ Grupo: r.codigo, Descrição: r.descricao, Valor: r.exibicao }))
    } else if (sub === 'balanco') {
      linhas = (dados.grupos || []).map(g => ({ Lado: g.lado, Grupo: g.codigo, Descrição: g.descricao, Valor: Number(g.valor) }))
      linhas.push({ Lado: 'passivo', Grupo: '—', Descrição: 'Resultado do Período (não encerrado)', Valor: Number(dados.resultado_periodo) })
    }
    ctb.exportarXlsx(`contabil_${sub}_${ate}`, linhas)
  }

  // DRE com subtotais acumulados
  const dreLinhas = useMemo(() => {
    if (sub !== 'dre' || !Array.isArray(dados)) return []
    let acumulado = 0
    return dados.map(r => {
      const v = Number(r.valor)
      if (r.tipo_operacao === 'soma') acumulado += v
      else if (r.tipo_operacao === 'subtracao') acumulado -= v
      return { ...r, exibicao: r.tipo_operacao === 'subtotal' ? acumulado : v }
    })
  }, [sub, dados])

  // BP totais
  const bp = useMemo(() => {
    if (sub !== 'balanco' || !dados) return null
    const grupos = dados.grupos || []
    const ativo = grupos.filter(g => g.lado === 'ativo')
    const passivo = grupos.filter(g => g.lado === 'passivo')
    const totalAtivo = ativo.reduce((s, g) => s + Number(g.valor), 0)
    const resultado = Number(dados.resultado_periodo)
    const totalPassivo = passivo.reduce((s, g) => s + Number(g.valor), 0) + resultado
    return { ativo, passivo, totalAtivo, totalPassivo, resultado }
  }, [sub, dados])

  const SUBS = [
    ['balancete', 'Balancete'], ['razao', 'Razão'], ['diario', 'Diário'], ['dre', 'DRE'], ['balanco', 'Balanço'],
  ]

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-[#1f1f1f]">
        {SUBS.map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)}
            className={`px-3 py-2 text-xs font-medium transition border-b-2 -mb-px ${sub === id ? 'text-white border-white' : 'text-[#666666] border-transparent hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        {sub !== 'balanco' && (
          <div>
            <label className="text-xs text-[#666666] block mb-1">De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} className={inputCls} />
          </div>
        )}
        <div>
          <label className="text-xs text-[#666666] block mb-1">{sub === 'balanco' ? 'Posição em' : 'Até'}</label>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inputCls} />
        </div>
        {sub === 'razao' && (
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-[#666666] block mb-1">Conta</label>
            <select value={contaRazao} onChange={e => setContaRazao(e.target.value)} className={inputCls + ' w-full'}>
              <option value="">— selecione —</option>
              {analiticas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
            </select>
          </div>
        )}
        <button onClick={gerar} disabled={carregando}
          className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition disabled:opacity-50">
          {carregando ? 'Gerando...' : 'Gerar'}
        </button>
        {dados && (
          <button onClick={exportar}
            className="px-3 py-1.5 border border-[#2a2a2a] text-[#a3a3a3] rounded text-xs hover:text-white transition">
            Exportar XLSX
          </button>
        )}
      </div>

      {erro && <p className="text-xs text-red-400 mb-3">{erro}</p>}
      <p className="text-[10px] text-yellow-600 mb-3">Períodos não encerrados: valores sujeitos a alteração (RR-04).</p>

      {/* BALANCETE */}
      {sub === 'balancete' && Array.isArray(dados) && (
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[#1f1f1f]">
              <th className={thCls + ' text-left'}>Conta</th>
              <th className={thCls + ' text-right'}>Saldo Anterior</th>
              <th className={thCls + ' text-right'}>Débitos</th>
              <th className={thCls + ' text-right'}>Créditos</th>
              <th className={thCls + ' text-right'}>Saldo Final</th>
            </tr></thead>
            <tbody>
              {dados.map(r => (
                <tr key={r.conta_id} className="border-b border-[#141414] hover:bg-[#111111]">
                  <td className="px-3 py-2 text-[#a3a3a3]"><span className="text-[#666666] mr-2">{r.codigo}</span>{r.nome}</td>
                  <td className="px-3 py-2 text-right text-[#a3a3a3]">{formatCurrency(saldoExibicao(r.saldo_anterior, r.natureza))}</td>
                  <td className="px-3 py-2 text-right text-white">{formatCurrency(r.debitos)}</td>
                  <td className="px-3 py-2 text-right text-white">{formatCurrency(r.creditos)}</td>
                  <td className="px-3 py-2 text-right text-white font-medium">{formatCurrency(saldoExibicao(r.saldo_final, r.natureza))}</td>
                </tr>
              ))}
              <tr className="bg-[#111111] font-semibold">
                <td className="px-3 py-2 text-white">TOTAIS</td>
                <td className="px-3 py-2 text-right text-[#a3a3a3]">—</td>
                <td className="px-3 py-2 text-right text-white">{formatCurrency(dados.reduce((s, r) => s + Number(r.debitos), 0))}</td>
                <td className="px-3 py-2 text-right text-white">{formatCurrency(dados.reduce((s, r) => s + Number(r.creditos), 0))}</td>
                <td className="px-3 py-2 text-right">
                  {(() => {
                    const dif = dados.reduce((s, r) => s + Number(r.saldo_final), 0)
                    return <span className={Math.abs(dif) < 0.005 ? 'text-green-400' : 'text-red-400'}>
                      {Math.abs(dif) < 0.005 ? '✓ equilibrado' : `divergência ${formatCurrency(dif)}`}</span>
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* RAZÃO */}
      {sub === 'razao' && dados && !Array.isArray(dados) && (
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[#1f1f1f]">
              <th className={thCls + ' text-left'}>Data</th>
              <th className={thCls + ' text-left'}>Nº</th>
              <th className={thCls + ' text-left'}>Histórico</th>
              <th className={thCls + ' text-right'}>Débito</th>
              <th className={thCls + ' text-right'}>Crédito</th>
              <th className={thCls + ' text-right'}>Saldo (D−C)</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-[#141414] bg-[#0d0d0d]">
                <td colSpan="5" className="px-3 py-2 text-[#a3a3a3]">Saldo anterior</td>
                <td className="px-3 py-2 text-right text-white">{formatCurrency(dados.saldo_anterior)}</td>
              </tr>
              {(() => {
                let saldo = Number(dados.saldo_anterior)
                return (dados.movimentos || []).map((m, i) => {
                  saldo += m.tipo === 'D' ? Number(m.valor) : -Number(m.valor)
                  return (
                    <tr key={i} className="border-b border-[#141414] hover:bg-[#111111]">
                      <td className="px-3 py-2 text-[#a3a3a3]">{formatDate(m.data)}</td>
                      <td className="px-3 py-2 text-[#666666]">{m.numero}</td>
                      <td className="px-3 py-2 text-[#a3a3a3] max-w-[300px] truncate">{m.historico}</td>
                      <td className="px-3 py-2 text-right text-white">{m.tipo === 'D' ? formatCurrency(m.valor) : ''}</td>
                      <td className="px-3 py-2 text-right text-white">{m.tipo === 'C' ? formatCurrency(m.valor) : ''}</td>
                      <td className="px-3 py-2 text-right text-white">{formatCurrency(saldo)}</td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* DIÁRIO */}
      {sub === 'diario' && Array.isArray(dados) && (
        <div className="flex flex-col gap-3">
          {dados.map(l => (
            <div key={l.id} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-white font-medium">Nº {l.numero} — {formatDate(l.data_competencia)}</span>
                <span className="text-[#666666]">{l.origem_tipo}{l.status === 'estornado' ? ' · ESTORNADO' : ''}</span>
              </div>
              <p className="text-xs text-[#a3a3a3] mb-2">{l.historico}</p>
              <table className="w-full text-xs">
                <tbody>
                  {(l.ctb_lancamento_item || []).map(i => (
                    <tr key={i.id}>
                      <td className="py-0.5 text-[#666666] w-8">{i.tipo}</td>
                      <td className="py-0.5 text-[#a3a3a3]">{i.ctb_conta_contabil?.codigo} — {i.ctb_conta_contabil?.nome}</td>
                      <td className="py-0.5 text-right text-white">{formatCurrency(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {dados.length === 0 && <p className="text-xs text-[#666666] text-center py-6">Nenhum lançamento no período</p>}
        </div>
      )}

      {/* DRE */}
      {sub === 'dre' && dreLinhas.length > 0 && (
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden max-w-2xl">
          <table className="w-full text-xs">
            <tbody>
              {dreLinhas.map(r => (
                <tr key={r.grupo_id} className={`border-b border-[#141414] ${r.tipo_operacao === 'subtotal' ? 'bg-[#111111] font-semibold' : ''}`}>
                  <td className="px-4 py-2 text-[#a3a3a3]">{r.descricao}</td>
                  <td className={`px-4 py-2 text-right ${r.tipo_operacao === 'subtotal' ? (r.exibicao >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
                    {formatCurrency(r.exibicao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BALANÇO */}
      {sub === 'balanco' && bp && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden">
            <p className="px-4 py-2.5 text-xs font-semibold text-white border-b border-[#1f1f1f] uppercase tracking-wider">Ativo</p>
            <table className="w-full text-xs"><tbody>
              {bp.ativo.map(g => (
                <tr key={g.grupo_id} className="border-b border-[#141414]">
                  <td className="px-4 py-2 text-[#a3a3a3]">{g.descricao}</td>
                  <td className="px-4 py-2 text-right text-white">{formatCurrency(g.valor)}</td>
                </tr>
              ))}
              <tr className="bg-[#111111] font-semibold">
                <td className="px-4 py-2 text-white">TOTAL DO ATIVO</td>
                <td className="px-4 py-2 text-right text-white">{formatCurrency(bp.totalAtivo)}</td>
              </tr>
            </tbody></table>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden">
            <p className="px-4 py-2.5 text-xs font-semibold text-white border-b border-[#1f1f1f] uppercase tracking-wider">Passivo + PL</p>
            <table className="w-full text-xs"><tbody>
              {bp.passivo.map(g => (
                <tr key={g.grupo_id} className="border-b border-[#141414]">
                  <td className="px-4 py-2 text-[#a3a3a3]">{g.descricao}</td>
                  <td className="px-4 py-2 text-right text-white">{formatCurrency(g.valor)}</td>
                </tr>
              ))}
              <tr className="border-b border-[#141414]">
                <td className="px-4 py-2 text-[#a3a3a3] italic">Resultado do Período (não encerrado)</td>
                <td className="px-4 py-2 text-right text-white">{formatCurrency(bp.resultado)}</td>
              </tr>
              <tr className="bg-[#111111] font-semibold">
                <td className="px-4 py-2 text-white">TOTAL DO PASSIVO + PL</td>
                <td className="px-4 py-2 text-right text-white">{formatCurrency(bp.totalPassivo)}</td>
              </tr>
            </tbody></table>
          </div>
          <p className={`md:col-span-2 text-xs ${Math.abs(bp.totalAtivo - bp.totalPassivo) < 0.005 ? 'text-green-400' : 'text-red-400'}`}>
            {Math.abs(bp.totalAtivo - bp.totalPassivo) < 0.005
              ? '✓ Balanço equilibrado (Ativo = Passivo + PL)'
              : `✗ Divergência de ${formatCurrency(bp.totalAtivo - bp.totalPassivo)} — verifique mapeamentos de grupo (RR-03)`}
          </p>
        </div>
      )}

      {!dados && !erro && !carregando && (
        <p className="text-xs text-[#666666] text-center py-8">Defina o período e clique em Gerar</p>
      )}
    </div>
  )
}
