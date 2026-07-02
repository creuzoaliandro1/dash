import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda, formatData } from './shared'

export default function ConsultarRegistradosTab() {
  const [documentoFederal, setDocumentoFederal] = useState('')
  const [contaBanco, setContaBanco] = useState('')
  const [contaAgencia, setContaAgencia] = useState('')
  const [contaPgto, setContaPgto] = useState('')
  const [carteiraInicial, setCarteiraInicial] = useState('')
  const [carteiraFinal, setCarteiraFinal] = useState('')
  const [dtRegistroInicial, setDtRegistroInicial] = useState('')
  const [dtRegistroFinal, setDtRegistroFinal] = useState('')
  const [dtVenctoInicial, setDtVenctoInicial] = useState('')
  const [dtVenctoFinal, setDtVenctoFinal] = useState('')
  const [situacaoBoleto, setSituacaoBoleto] = useState('')
  const [page, setPage] = useState('')
  const [pageSize, setPageSize] = useState('')

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [boletos, setBoletos] = useState(null)

  const toIso = (d) => (d ? `${d}T00:00:00` : undefined)
  const toNum = (v) => (v === '' || v == null ? undefined : Number(v))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setBoletos(null)

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-consultar-registrados', {
        body: {
          documentoFederal: documentoFederal || undefined,
          contaBanco: contaBanco || undefined,
          contaAgencia: contaAgencia || undefined,
          contaPgto: contaPgto || undefined,
          carteiraInicial: toNum(carteiraInicial),
          carteiraFinal: toNum(carteiraFinal),
          dtRegistroInicial: toIso(dtRegistroInicial),
          dtRegistroFinal: toIso(dtRegistroFinal),
          dtVenctoInicial: toIso(dtVenctoInicial),
          dtVenctoFinal: toIso(dtVenctoFinal),
          situacaoBoleto: situacaoBoleto || undefined,
          page: toNum(page),
          pageSize: toNum(pageSize),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar boletos registrados.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        const cedentes = Array.isArray(data?.cedentes) ? data.cedentes : []
        const flat = []
        for (const cedenteEntry of cedentes) {
          const lista = Array.isArray(cedenteEntry?.boletosRegistrados) ? cedenteEntry.boletosRegistrados : []
          for (const b of lista) {
            flat.push({ ...b, __cedente: cedenteEntry?.cedente, __carteira: cedenteEntry?.carteira })
          }
        }
        setBoletos(flat)
        if (flat.length === 0) {
          setFeedback({ ok: true, message: 'Nenhum boleto registrado encontrado com os filtros informados.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl">
      <Card title="Consultar boletos registrados" description="Filtre por documento do pagador (ou conta), carteira, datas de registro/vencimento e situação.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Documento federal (pagador)">
              <input className={inputCls} value={documentoFederal} onChange={(e) => setDocumentoFederal(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Banco (conta)">
              <input className={inputCls} value={contaBanco} onChange={(e) => setContaBanco(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Agência (conta)">
              <input className={inputCls} value={contaAgencia} onChange={(e) => setContaAgencia(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Conta pagamento">
              <input className={inputCls} value={contaPgto} onChange={(e) => setContaPgto(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Carteira inicial">
              <input type="number" className={inputCls} value={carteiraInicial} onChange={(e) => setCarteiraInicial(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Carteira final">
              <input type="number" className={inputCls} value={carteiraFinal} onChange={(e) => setCarteiraFinal(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Situação do boleto">
              <input className={inputCls} value={situacaoBoleto} onChange={(e) => setSituacaoBoleto(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data de registro (inicial)">
              <input type="date" className={inputCls} value={dtRegistroInicial} onChange={(e) => setDtRegistroInicial(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data de registro (final)">
              <input type="date" className={inputCls} value={dtRegistroFinal} onChange={(e) => setDtRegistroFinal(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data de vencimento (inicial)">
              <input type="date" className={inputCls} value={dtVenctoInicial} onChange={(e) => setDtVenctoInicial(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data de vencimento (final)">
              <input type="date" className={inputCls} value={dtVenctoFinal} onChange={(e) => setDtVenctoFinal(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Página">
              <input type="number" className={inputCls} value={page} onChange={(e) => setPage(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Itens por página">
              <input type="number" className={inputCls} value={pageSize} onChange={(e) => setPageSize(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
        </form>

        {boletos && boletos.length > 0 && (
          <div className="mt-5 overflow-x-auto border border-[#2a2a2a] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Cedente</th>
                  <th className="text-left px-3 py-2">Carteira</th>
                  <th className="text-left px-3 py-2">Pagador</th>
                  <th className="text-left px-3 py-2">Documento</th>
                  <th className="text-left px-3 py-2">Vencimento</th>
                  <th className="text-left px-3 py-2">Valor</th>
                  <th className="text-left px-3 py-2">Situação</th>
                  <th className="text-left px-3 py-2">Código de barras</th>
                </tr>
              </thead>
              <tbody>
                {boletos.map((b, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                    <td className="px-3 py-2">{b.__cedente ?? '—'}</td>
                    <td className="px-3 py-2">{b.__carteira ?? '—'}</td>
                    <td className="px-3 py-2">{b.nom_RzSocPagdr ?? '—'}</td>
                    <td className="px-3 py-2">{b.numeroDocumento ?? '—'}</td>
                    <td className="px-3 py-2">{formatData(b.dtVencimento)}</td>
                    <td className="px-3 py-2">{formatMoeda(b.vlrBoleto)}</td>
                    <td className="px-3 py-2">{b.situacao ?? '—'}</td>
                    <td className="px-3 py-2 break-all">{b.codigoBarras ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
