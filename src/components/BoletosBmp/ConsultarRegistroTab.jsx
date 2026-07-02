import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda, formatData } from './shared'

export default function ConsultarRegistroTab() {
  const [codigoRegistroBoleto, setCodigoRegistroBoleto] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [registro, setRegistro] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setRegistro(null)

    if (!codigoRegistroBoleto && !codigoBarras) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto ou o código de barras.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-consultar-registro', {
        body: {
          codigoRegistroBoleto: codigoRegistroBoleto || undefined,
          codigoBarras: codigoBarras || undefined,
        },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o registro do boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        const raw = data?.raw || {}
        setRegistro(raw)
        if (!raw || Object.keys(raw).length === 0) {
          setFeedback({ ok: true, message: 'Nenhum registro encontrado.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const rows = registro
    ? [
        ['Código do registro', registro.codigo],
        ['Situação do boleto', registro.situacaoBoleto],
        ['Mensagem da situação', registro.msgSituacao],
        ['Data da situação', formatData(registro.dtSituacao)],
        ['Número do cedente', registro.numeroCedente],
        ['Carteira', registro.codCartTit],
        ['Data de inclusão', formatData(registro.dtInclusao)],
        ['Data de emissão', formatData(registro.dtEmsTit)],
        ['Data de vencimento', formatData(registro.dtVencTit)],
        ['Data limite p/ pagamento', formatData(registro.dtLimPgtoTit)],
        ['Valor do título', formatMoeda(registro.vlrTit)],
        ['Valor de abatimento', formatMoeda(registro.vlrAbattTit)],
        ['Número do documento', registro.numDocTit ?? registro.numeroDocumento],
        ['Nosso número', registro.identdNossoNum],
        ['Código de barras', registro.numCodBarras],
        ['Linha digitável', registro.numLinhaDigtvl],
        ['Bloqueio de pagamento', registro.indrBloqPgto],
        ['Tipo de pessoa (pagador)', registro.tpPessoaPagdr],
        ['Documento (pagador)', registro.cnpJ_CPFPagdr],
        ['Nome/Razão social (pagador)', registro.nom_RzSocPagdr],
        ['Nome fantasia (pagador)', registro.nomFantsPagdr],
        ['Logradouro (pagador)', registro.logradPagdr],
        ['Cidade (pagador)', registro.cidPagdr],
        ['UF (pagador)', registro.ufPagdr],
        ['CEP (pagador)', registro.cepPagdr],
      ]
    : []

  return (
    <div className="max-w-3xl">
      <Card title="Consultar registro de boleto" description="Informe o código de registro do boleto ou o código de barras.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Código de registro do boleto">
              <input className={inputCls} value={codigoRegistroBoleto} onChange={(e) => setCodigoRegistroBoleto(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Código de barras">
              <input className={inputCls} value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
        </form>

        {registro && rows.length > 0 && (
          <div className="mt-5 border border-[#2a2a2a] rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {rows.map(([label, value], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-[#0a0a0a]' : 'bg-[#111111]'}>
                    <td className="px-3 py-2 text-[#a3a3a3] w-1/3">{label}</td>
                    <td className="px-3 py-2 text-white break-all">{value === null || value === undefined || value === '' ? '—' : String(value)}</td>
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
