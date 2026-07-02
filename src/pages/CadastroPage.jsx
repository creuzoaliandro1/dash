import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// supabase.functions.invoke() só expõe uma mensagem genérica ("Edge Function
// returned a non-2xx status code") em `error.message` — o corpo JSON real
// (com a mensagem específica que a função devolveu) fica em `error.context`
// (a Response bruta).
const extractInvokeError = async (error, fallback) => {
  if (!error) return null
  try {
    if (error.context && typeof error.context.json === 'function') {
      const body = await error.context.clone().json()
      if (body?.error) return body.error
    }
  } catch {
    // corpo não era JSON — ignora e usa o fallback
  }
  return error.message || fallback
}

// Colunas da tabela CONTAS exibidas/editáveis aqui (exclui id, pass — legado sem uso —,
// updated_at e must_change_password, que são geridos internamente pelo app).
const COLUMNS = [
  { key: 'nome_correntista', label: 'Nome', type: 'text', width: 220 },
  { key: 'email', label: 'E-mail', type: 'text', width: 210 },
  { key: 'cic', label: 'CIC', type: 'text', width: 140 },
  { key: 'tipo', label: 'Tipo', type: 'select', options: ['C', 'M'], width: 70 },
  { key: 'agencia', label: 'Agência', type: 'text', width: 90 },
  { key: 'conta', label: 'Conta', type: 'text', width: 100 },
  { key: 'cedente', label: 'Cedente', type: 'text', width: 100 },
  { key: 'cod_cedente', label: 'Cód. Cedente', type: 'number', width: 110 },
  { key: 'nnumero', label: 'Nosso Núm.', type: 'number', width: 110 },
  { key: 'nnumero_dv', label: 'DV', type: 'text', width: 55 },
  { key: 'cnab400', label: 'CNAB400', type: 'text', width: 90 },
  { key: 'registro', label: 'Registro', type: 'number', width: 90 },
  { key: 'data_abertura', label: 'Abertura', type: 'date', width: 120 },
  { key: 'telefone', label: 'Telefone', type: 'text', width: 120 },
  { key: 'contato', label: 'Contato', type: 'text', width: 130 },
  { key: 'endereco', label: 'Endereço', type: 'text', width: 190 },
  { key: 'bairro', label: 'Bairro', type: 'text', width: 120 },
  { key: 'cidade', label: 'Cidade', type: 'text', width: 130 },
  { key: 'uf', label: 'UF', type: 'text', width: 55 },
  { key: 'cep', label: 'CEP', type: 'text', width: 100 },
  { key: 'boleto', label: 'Boleto', type: 'text', width: 100 },
  { key: 'juros', label: 'Juros %', type: 'number', width: 85 },
  { key: 'logo_url', label: 'Logo URL', type: 'text', width: 170 },
]

const NUMERIC_KEYS = new Set(['cod_cedente', 'nnumero', 'registro'])

// Converte o valor de um <input> para o tipo correto antes de salvar no Supabase.
const parseValueForColumn = (key, rawValue) => {
  if (rawValue === '') return null
  if (NUMERIC_KEYS.has(key)) {
    const n = parseInt(rawValue, 10)
    return Number.isNaN(n) ? null : n
  }
  if (key === 'juros') {
    const n = parseFloat(String(rawValue).replace(',', '.'))
    return Number.isNaN(n) ? null : n
  }
  return rawValue
}

export default function CadastroPage() {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Célula em edição: { id, key } — enquanto ativa, mostra um <input> no lugar do texto.
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  // Feedback visual por célula: 'saving' | 'saved' | 'error'
  const [cellStatus, setCellStatus] = useState({})

  // Modal "Nova conta"
  const [showNewModal, setShowNewModal] = useState(false)
  const [newNome, setNewNome] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [newFeedback, setNewFeedback] = useState(null)

  const inputRef = useRef(null)
  // Guarda síncrona contra clique duplo (setCreating é assíncrono).
  const creatingRef = useRef(false)

  const loadContas = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('CONTAS')
      .select('*')
      .order('nome_correntista', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setContas(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadContas()
  }, [])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current.select) inputRef.current.select()
    }
  }, [editingCell])

  const markStatus = (id, key, status) => {
    const cellKey = `${id}:${key}`
    setCellStatus((prev) => ({ ...prev, [cellKey]: status }))
    if (status === 'saved') {
      setTimeout(() => {
        setCellStatus((prev) => {
          const next = { ...prev }
          if (next[cellKey] === 'saved') delete next[cellKey]
          return next
        })
      }, 1500)
    }
  }

  const handleCellClick = (conta, col) => {
    if (editingCell && editingCell.id === conta.id && editingCell.key === col.key) return
    setEditingCell({ id: conta.id, key: col.key })
    const current = conta[col.key]
    setEditValue(current === null || current === undefined ? '' : String(current))
  }

  const handleCellSave = async () => {
    if (!editingCell) return
    const { id, key } = editingCell
    const conta = contas.find((c) => c.id === id)
    const previous = conta ? conta[key] : null
    const previousStr = previous === null || previous === undefined ? '' : String(previous)

    setEditingCell(null)

    // Nada mudou — não faz round-trip ao banco.
    if (editValue === previousStr) return

    const value = parseValueForColumn(key, editValue)

    // Atualização otimista na UI.
    setContas((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)))
    markStatus(id, key, 'saving')

    const { error: err } = await supabase.from('CONTAS').update({ [key]: value }).eq('id', id)

    if (err) {
      markStatus(id, key, 'error')
      // Reverte o valor otimista em caso de erro.
      setContas((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: previous } : c)))
      console.error('[CadastroPage] erro ao salvar', key, err)
    } else {
      markStatus(id, key, 'saved')
    }
  }

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur() // dispara handleCellSave via onBlur
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const handleDelete = async (conta) => {
    const nome = conta.nome_correntista || conta.email || `#${conta.id}`
    if (!window.confirm(`Excluir a conta "${nome}"? Isso remove o cadastro em CONTAS, mas NÃO remove o login já criado no Supabase Auth (use a tela Acessos/Supabase para isso, se necessário).`)) {
      return
    }
    const { error: err } = await supabase.from('CONTAS').delete().eq('id', conta.id)
    if (err) {
      alert('Erro ao excluir: ' + err.message)
    } else {
      setContas((prev) => prev.filter((c) => c.id !== conta.id))
    }
  }

  const handleCreateConta = async (e) => {
    e.preventDefault()
    setNewFeedback(null)

    if (!newNome.trim()) {
      setNewFeedback({ ok: false, message: 'Informe o nome do correntista.' })
      return
    }
    if (!newEmail.trim()) {
      setNewFeedback({ ok: false, message: 'Informe o e-mail — ele é usado para criar o login.' })
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true

    setCreating(true)
    try {
      // 1) Cria o registro em CONTAS (agencia/conta são NOT NULL na tabela — ficam
      //    em branco e são preenchidos depois pela edição inline).
      const { data: inserted, error: insertErr } = await supabase
        .from('CONTAS')
        .insert({
          nome_correntista: newNome.trim(),
          email: newEmail.trim(),
          tipo: 'C',
          agencia: '',
          conta: '',
        })
        .select('id')
        .single()

      if (insertErr) {
        setNewFeedback({ ok: false, message: 'Erro ao criar a conta: ' + insertErr.message })
        return
      }

      // 2) Cria o login no Supabase Auth com a senha padrão 123456 (mesma função
      //    usada na tela Acessos — autorizada automaticamente porque quem chama
      //    já está logado como Master, sem precisar digitar nenhuma chave).
      const { data: authData, error: authErr } = await supabase.functions.invoke('admin-set-password', {
        body: { email: newEmail.trim(), password: '123456' },
      })

      if (authErr || authData?.error) {
        const motivo = authErr ? await extractInvokeError(authErr, 'erro desconhecido') : authData.error
        setNewFeedback({
          ok: false,
          message: `Conta criada em CONTAS, mas o login não pôde ser criado (${motivo}). Complete pela tela Acessos.`,
        })
      } else {
        // 3) Marca a conta para forçar troca de senha no primeiro login.
        await supabase.from('CONTAS').update({ must_change_password: true }).eq('id', inserted.id)
        setNewFeedback({ ok: true, message: `Conta e login criados (senha padrão 123456) para ${newEmail.trim()}.` })
      }

      await loadContas()
      setNewNome('')
      setNewEmail('')
    } catch (err) {
      setNewFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  const renderCell = (conta, col) => {
    const isEditing = editingCell && editingCell.id === conta.id && editingCell.key === col.key
    const status = cellStatus[`${conta.id}:${col.key}`]
    const value = conta[col.key]

    if (isEditing) {
      if (col.type === 'select') {
        return (
          <select
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellSave}
            onKeyDown={handleCellKeyDown}
            className="w-full px-1.5 py-1 bg-[#111111] border border-white rounded text-[#e5e5e5] text-xs outline-none"
          >
            <option value="">—</option>
            {col.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      }
      return (
        <input
          ref={inputRef}
          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellSave}
          onKeyDown={handleCellKeyDown}
          className="w-full px-1.5 py-1 bg-[#111111] border border-white rounded text-[#e5e5e5] text-xs outline-none"
        />
      )
    }

    return (
      <div
        onClick={() => handleCellClick(conta, col)}
        className={`px-1.5 py-1 rounded cursor-text truncate text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-[#d4d4d4] transition min-h-[22px] ${
          status === 'error' ? 'ring-1 ring-red-800' : ''
        }`}
        title="Clique para editar"
      >
        {value === null || value === undefined || value === '' ? '—' : String(value)}
        {status === 'saving' && <span className="ml-1 text-[9px] text-[#666666]">salvando…</span>}
        {status === 'saved' && <span className="ml-1 text-[9px] text-emerald-500">✓</span>}
        {status === 'error' && <span className="ml-1 text-[9px] text-red-400">erro</span>}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white mb-1">Cadastro</h1>
          <p className="text-xs text-[#a3a3a3]">
            Todos os campos da tabela CONTAS. Clique numa célula para editar — salva automaticamente ao sair do campo.
          </p>
        </div>
        <button
          onClick={() => { setShowNewModal(true); setNewFeedback(null) }}
          className="px-3 py-2 bg-white text-black text-sm font-medium rounded-md hover:opacity-90 transition flex-shrink-0"
        >
          + Nova conta
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[#666666] text-sm">Carregando contas…</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-[#a3a3a3] text-sm px-6 text-center">Erro ao carregar: {error}</div>
        ) : contas.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#666666] text-sm">Nenhuma conta cadastrada ainda.</div>
        ) : (
          <table className="text-xs border-collapse w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#141414]">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{ minWidth: col.width }}
                    className="text-left font-semibold text-[#666666] uppercase tracking-wider px-2 py-2 border-b border-[#2a2a2a] whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="text-center font-semibold text-[#666666] uppercase tracking-wider px-2 py-2 border-b border-[#2a2a2a] whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={conta.id} className="border-b border-[#1a1a1a] hover:bg-[#0f0f0f]">
                  {COLUMNS.map((col) => (
                    <td key={col.key} style={{ minWidth: col.width }} className="px-2 py-0.5">
                      {renderCell(conta, col)}
                    </td>
                  ))}
                  <td className="px-2 py-0.5 text-center">
                    <button
                      onClick={() => handleDelete(conta)}
                      className="text-[#666666] hover:text-red-400 transition p-1"
                      title="Excluir conta"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Nova conta */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg max-w-md w-full p-6">
            <h2 className="text-white text-sm font-semibold mb-1">Nova conta</h2>
            <p className="text-xs text-[#a3a3a3] mb-4">
              Cria o registro em CONTAS e já provisiona o login (Supabase Auth) com a senha padrão{' '}
              <span className="text-white">123456</span>. Os demais campos ficam disponíveis para edição na tabela
              depois de criada.
            </p>

            <form onSubmit={handleCreateConta} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Nome do correntista</label>
                <input
                  type="text"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm"
                  disabled={creating}
                />
              </div>
              {newFeedback && (
                <div
                  className={`p-3 rounded-md text-xs border ${
                    newFeedback.ok
                      ? 'bg-emerald-900/20 border-emerald-800 text-emerald-200'
                      : 'bg-red-900/20 border-red-800 text-red-200'
                  }`}
                >
                  {newFeedback.message}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-3 py-2 bg-[#111111] border border-[#2a2a2a] text-white text-sm rounded-md hover:border-white transition"
                  disabled={creating}
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
                >
                  {creating ? 'Criando...' : 'Criar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
