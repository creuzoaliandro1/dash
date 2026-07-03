import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, DateInput, inputCls, extractError, formatMoeda, formatData } from './shared'
import { BoletoActionsMenu, BoletoActionModal } from './BoletoActionsModal'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

const chaveDaLinha = (b, i) => b.codigo ?? b.codigoRegistroBoleto ?? b.codigoBarras ?? String(i)

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
  const [selecionados, setSelecionados] = useState(new Set())
  const [modalAction, setModalAction] = useState(null)
  const [modalBoleto, setModalBoleto] = useState(null)
  const [cancelandoLote, setCancelandoLote] = useState(false)

  const toIso = (d) => (d ? `${d}T00:00:00` : undefined)
  const toNum = (v) => (v === '' || v == null ? undefined : Number(v))

  const toggleSelecionado = (chave) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  const toggleTodos = () => {
    if (!boletos) return
    setSelecionados((prev) =>
      prev.size === boletos.length ? new Set() : new Set(boletos.map((b, i) => chaveDaLinha(b, i)))
    )
  }

  const abrirAcao = (action, boleto) => {
    setModalAction(action)
    setModalBoleto(boleto)
  }

  const fecharModal = () => {
    setModalAction(null)
    setModalBoleto(null)
  }

  const cancelarSelecionados = async () => {
    if (!boletos || selecionados.size === 0) return
    const linhas = boletos.filter((b, i) => selecionados.has(chaveDaLinha(b, i)))
    const codigos = linhas.map((b) => b.codigo ?? b.codigoRegistroBoleto).filter(Boolean)
    const codigosBarras = linhas.map((b) => b.codigoBarras ?? b.numCodBarras).filter(Boolean)

    const confirmado = window.confirm(
      `Tem certeza que deseja cancelar o registro de ${linhas.length} boleto(s) selecionado(s)? Essa ação não pode ser desfeita.`
    )
    if (!confirmado) return

    setCancelandoLote(true)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-cancelar', {
        body: {
          listaCodigos: codigos.length ? codigos : undefined,
          listaCodigosBarras: codigos.length ? undefined : codigosBarras.length ? codigosBarras : undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao cancelar os boletos selecionados.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Solicitação de cancelamento em lote enviada.' })
        setSelecionados(new Set())
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setCancelandoLote(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setBoletos(null)
    setSelecionados(new Set())

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
    <div className="w-full">
      <Card title="Consultar boletos registrados" description="Filtre por documento do pagador (ou conta), carteira, datas de registro/vencimento e situação.">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
              <DateInput value={dtRegistroInicial} onChange={(e) => setDtRegistroInicial(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data de registro (final)">
              <DateInput value={dtRegistroFinal} onChange={(e) => setDtRegistroFinal(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data de vencimento (inicial)">
              <DateInput value={dtVenctoInicial} onChange={(e) => setDtVenctoInicial(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data de vencimento (final)">
              <DateInput value={dtVenctoFinal} onChange={(e) => setDtVenctoFinal(e.target.value)} disabled={loading} />
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
          <>
            {selecionados.size > 0 && (
              <div className="mt-2 flex items-center justify-between bg-[#111111] border border-[#2a2a2a] rounded-md px-3 py-2">
                <p className="text-xs text-[#a3a3a3]">{selecionados.size} boleto(s) selecionado(s)</p>
                <SecondaryButton type="button" onClick={cancelarSelecionados} disabled={cancelandoLote}>
                  {cancelandoLote ? 'Cancelando...' : 'Cancelar selecionados'}
                </SecondaryButton>
              </div>
            )}

            <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                    <th className="text-left px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={boletos.length > 0 && selecionados.size === boletos.length}
                        onChange={toggleTodos}
                      />
                    </th>
                    <th className="text-left px-3 py-2">Cedente</th>
                    <th className="text-left px-3 py-2">Carteira</th>
                    <th className="text-left px-3 py-2">Pagador</th>
                    <th className="text-left px-3 py-2">Documento</th>
                    <th className="text-left px-3 py-2">Vencimento</th>
                    <th className="text-left px-3 py-2">Valor</th>
                    <th className="text-left px-3 py-2">Situação</th>
                    <th className="text-left px-3 py-2">Código de barras</th>
                    <th className="text-right px-3 py-2 w-10">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {boletos.map((b, i) => {
                    const chave = chaveDaLinha(b, i)
                    return (
                      <tr key={chave} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selecionados.has(chave)} onChange={() => toggleSelecionado(chave)} />
                        </td>
                        <td className="px-3 py-2">{b.__cedente ?? '—'}</td>
                        <td className="px-3 py-2">{b.__carteira ?? '—'}</td>
                        <td className="px-3 py-2">{b.nom_RzSocPagdr ?? '—'}</td>
                        <td className="px-3 py-2">{b.numeroDocumento ?? '—'}</td>
                        <td className="px-3 py-2">{formatData(b.dtVencimento)}</td>
                        <td className="px-3 py-2">{formatMoeda(b.vlrBoleto)}</td>
                        <td className="px-3 py-2">{b.situacao ?? '—'}</td>
                        <td className="px-3 py-2 break-all">{b.codigoBarras ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <BoletoActionsMenu boleto={b} onSelect={(action) => abrirAcao(action, b)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <BoletoActionModal action={modalAction} boleto={modalBoleto} onClose={fecharModal} />
    </div>
  )
}
