import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CadastroTab from '../components/ContaBmp/CadastroTab'
import SaldoTab from '../components/ContaBmp/SaldoTab'
import ExtratoTab from '../components/ContaBmp/ExtratoTab'
import ComprovantesTab from '../components/ContaBmp/ComprovantesTab'
import TarifasTab from '../components/ContaBmp/TarifasTab'
import MovimentacaoTab from '../components/ContaBmp/MovimentacaoTab'
import FavorecidosTab from '../components/ContaBmp/FavorecidosTab'
import EncerramentoTab from '../components/ContaBmp/EncerramentoTab'
import TransferenciasTab from '../components/ContaBmp/TransferenciasTab'
import PixTab from '../components/ContaBmp/PixTab'

// supabase.functions.invoke() só expõe uma mensagem genérica em error.message
// quando a function responde status != 2xx — o corpo JSON real (com a causa
// específica, incluindo o que o próprio BMP respondeu em `details`) fica em
// error.context. Devolve o body inteiro (não só uma string) pra podermos
// mostrar status + details, essenciais pra diagnosticar erro de OAuth.
const extractInvokeErrorBody = async (error, data) => {
  if (error) {
    try {
      if (error.context && typeof error.context.json === 'function') {
        const body = await error.context.clone().json()
        if (body && typeof body === 'object') return body
      }
    } catch {
      // corpo não era JSON — ignora
    }
    return { error: error.message || 'Falha ao conectar com o BMP.' }
  }
  if (data?.error) return data
  return null
}

function TestarConexao() {
  const [testing, setTesting] = useState(false)
  const [resultado, setResultado] = useState(null) // { ok, message, details }

  const handleTestar = async () => {
    setTesting(true)
    setResultado(null)
    try {
      // Usa um scope mínimo (api.ext) só para validar a conexão/autenticação — não usar mais
      // BMP_SCOPES (que ainda tem a lista completa de ~26 scopes) para isso, pois passa dos
      // 300 caracteres aceitos pelo BMP e sempre retorna invalid_scope.
      const { data, error } = await supabase.functions.invoke('bmp-auth', { body: { scope: 'api.ext' } })
      const erroBody = await extractInvokeErrorBody(error, data)
      if (erroBody) {
        setResultado({
          ok: false,
          message: erroBody.error || 'Falha ao conectar com o BMP.',
          status: erroBody.status,
          details: erroBody.details,
        })
      } else if (data?.access_token) {
        const origem = data.cached ? 'token em cache, ainda válido' : 'token novo emitido agora pelo BMP'
        setResultado({
          ok: true,
          message: `Conectado! Token obtido com sucesso (${origem}). Válido até ${new Date(data.expires_at).toLocaleString('pt-BR')}.`,
        })
      } else {
        setResultado({ ok: false, message: 'Resposta inesperada do bmp-auth (sem access_token e sem erro).' })
      }
    } catch (err) {
      setResultado({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Testar conexão com o BMP</h2>
        <p className="text-xs text-[#a3a3a3]">
          Tenta obter um Bearer token via <code>bmp-auth</code> (ambiente definido pelo secret{' '}
          <code>BMP_ENV</code>, padrão homologação). Requer os secrets <code>BMP_CLIENT_ID</code> e{' '}
          <code>BMP_PRIVATE_KEY</code> configurados.
        </p>
        {resultado && (
          <div
            className={`mt-3 p-3 rounded-md text-xs border ${
              resultado.ok
                ? 'bg-emerald-900/20 border-emerald-800 text-emerald-200'
                : 'bg-red-900/20 border-red-800 text-red-200'
            }`}
          >
            <div>{typeof resultado.message === 'string' ? resultado.message : JSON.stringify(resultado.message)}</div>
            {resultado.status != null && (
              <div className="mt-1 opacity-80">Status HTTP retornado pelo BMP: {resultado.status}</div>
            )}
            {resultado.details != null && (
              <pre className="mt-2 whitespace-pre-wrap break-words bg-black/30 p-2 rounded text-[11px]">
                {typeof resultado.details === 'string' ? resultado.details : JSON.stringify(resultado.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleTestar}
        disabled={testing}
        className="px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm whitespace-nowrap"
      >
        {testing ? 'Testando...' : 'Testar conexão'}
      </button>
    </div>
  )
}

const TABS = [
  ['cadastro', 'Cadastro'],
  ['saldo', 'Saldo'],
  ['extrato', 'Extrato'],
  ['comprovantes', 'Comprovantes'],
  ['tarifas', 'Tarifas'],
  ['movimentacao', 'Movimentação'],
  ['favorecidos', 'Favorecidos'],
  ['encerramento', 'Encerramento'],
  ['transferencias', 'Transferências'],
  ['pix', 'Pix'],
]

export default function ContaBmpPage() {
  const [tab, setTab] = useState('cadastro')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-white mb-1">Conta</h1>
        <p className="text-sm text-[#a3a3a3]">
          Ambiente da Conta BMP (Banking as a Service) — cadastro, saldo, extrato, comprovantes, tarifas,
          movimentação, favorecidos e encerramento.
        </p>
      </div>

      <TestarConexao />

      <div className="flex gap-1 mb-6 border-b border-[#1f1f1f] overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium transition rounded-t-md whitespace-nowrap ${
              tab === id ? 'bg-[#1a1a1a] text-white' : 'text-[#a3a3a3] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'cadastro' && <CadastroTab />}
        {tab === 'saldo' && <SaldoTab />}
        {tab === 'extrato' && <ExtratoTab />}
        {tab === 'comprovantes' && <ComprovantesTab />}
        {tab === 'tarifas' && <TarifasTab />}
        {tab === 'movimentacao' && <MovimentacaoTab />}
        {tab === 'favorecidos' && <FavorecidosTab />}
        {tab === 'encerramento' && <EncerramentoTab />}
        {tab === 'transferencias' && <TransferenciasTab />}
        {tab === 'pix' && <PixTab />}
      </div>
    </div>
  )
}
