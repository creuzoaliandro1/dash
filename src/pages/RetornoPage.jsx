import { useState, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../lib/supabase'

// ─── CNAB400 BMP — posições 1-indexed ────────────────────────────────────────
// Retorno Tipo 1 (registro de transação):
//   Pos 1        : Tipo = "1"
//   Pos 21       : Zero
//   Pos 22-24    : Carteira (3)
//   Pos 25-29    : Agência  (5)
//   Pos 30-36    : Conta corrente (7)
//   Pos 37       : DV conta (1)
//   Pos 38-52    : Controle participante / seu número (15)
//   Pos 53-62    : Complemento (10)
//   Pos 71-81    : Nosso número sem DV (11)
//   Pos 82       : DV nosso número (suprimido no retorno)
//   Pos 109-110  : Código de ocorrência (2)
//   Pos 111-116  : Data ocorrência DDMMAA (6)
//   Pos 117-126  : Número do documento (10)
//   Pos 127-146  : Nosso número banco (20)
//   Pos 147-152  : Data vencimento DDMMAA (6)
//   Pos 153-165  : Valor do título (13 = R$ com 2 decimais implícitos)
//   Pos 254-266  : Valor pago (13)
//   Pos 319-328  : Motivos das ocorrências (10 = 5×2)
//   Pos 395-400  : Sequencial (6)

const g = (line, s, e) => (line.substring(s - 1, e) || '').trim()
const gn = (line, s, e, dec = 0) => {
  const n = parseInt(line.substring(s - 1, e), 10) || 0
  return dec > 0 ? n / Math.pow(10, dec) : n
}

const parseTipo1 = (line, arquivoNome) => {
  const motivosRaw = g(line, 319, 328)
  const motivosList = []
  for (let i = 0; i < 5; i++) {
    const m = (motivosRaw.substring(i * 2, i * 2 + 2) || '').trim()
    if (m && m !== '00') motivosList.push(m)
  }

  // Nosso número: retorno suprime zeros à esquerda e DV
  const nossoNumRaw = g(line, 71, 82)               // 12 chars
  const nossoNumSemDV = g(line, 71, 81)              // 11 chars sem DV
  // Normaliza para chave de lookup no DB (sem zeros à esquerda)
  const nossoNumeroBD = nossoNumSemDV.replace(/^0+/, '') || nossoNumSemDV

  return {
    tipo: '1',
    carteira: g(line, 22, 24),
    agencia: g(line, 25, 29),
    conta: g(line, 30, 36),
    controleParticipante: g(line, 38, 52),
    nossoNumeroRaw: nossoNumRaw,
    nossoNumero: nossoNumSemDV,
    nossoNumeroBD,
    codigoOcorrencia: g(line, 109, 110),
    dataOcorrencia: g(line, 111, 116),
    numeroDocumento: g(line, 117, 126),
    nossoNumeroBanco: g(line, 127, 146),
    dataVencimento: g(line, 147, 152),
    valorTitulo: gn(line, 153, 165, 2),
    valorPago: gn(line, 254, 266, 2),
    motivosList,
    sequencial: g(line, 395, 400),
    arquivoNome,
  }
}

const parseHeader = (line) => ({
  tipo: '0',
  tipoArquivo: g(line, 2, 2),       // "2" = retorno
  nomeCedente: g(line, 47, 76),
  dataGravacao: g(line, 95, 100),
})

const parseCNAB400Retorno = (text, arquivoNome) => {
  const lines = text.split(/\r?\n/).filter(l => l.length >= 100)
  let header = null
  let trailer = null
  const registros = []

  for (const line of lines) {
    const tipo = line.charAt(0)
    if (tipo === '0') {
      header = parseHeader(line)
    } else if (tipo === '1') {
      registros.push(parseTipo1(line, arquivoNome))
    } else if (tipo === '9') {
      trailer = { tipo: '9' }
    }
  }

  return { header, trailer, registros }
}

// ─── Ocorrências BMP ───────────────────────────────────────────────────────────
const OCORRENCIAS = {
  '02': 'Entrada confirmada',
  '03': 'Entrada rejeitada',
  '06': 'Liquidação normal',
  '09': 'Baixado automaticamente',
  '10': 'Baixado pelo banco',
  '11': 'Em ser (pendente)',
  '12': 'Abatimento concedido',
  '13': 'Abatimento cancelado',
  '14': 'Protesto do título',
  '16': 'Protesto rejeitado',
  '17': 'Liquidação após baixa',
  '18': 'Acerto depositária',
  '21': 'Acerto controle participante',
  '22': 'Pagamento cancelado',
  '24': 'Rejeitado - CEP irregular',
  '27': 'Baixa rejeitada',
  '28': 'Débito tarifas/custas',
  '29': 'Ocorrências do pagador',
  '32': 'Instrução rejeitada',
  '40': 'Estorno de pagamento',
}

const MOTIVOS_02 = {
  '00': 'Aceita', '01': 'Código banco inválido', '04': 'Código movimento não permitido',
  '15': 'Características incompatíveis', '17': 'Vencimento anterior à emissão',
  '21': 'Espécie inválida', '24': 'Data emissão inválida', '45': 'Nome pagador inválido',
  '46': 'Tipo/nº inscrição inválido', '47': 'Endereço não informado',
  '48': 'CEP inválido', '53': 'CPF/CNPJ inválido', '54': 'Pagador não informado',
  '86': 'Seu número inválido',
}
const MOTIVOS_03 = {
  '02': 'Código registro inválido',
  '03': 'Código ocorrência inválido',
  '04': 'Ocorrência não permitida para a carteira',
  '05': 'Código ocorrência não numérico',
  '06': 'Dados cadastrais do beneficiário incompletos',
  '07': 'Agência/conta/DV inválido',
  '08': 'Nosso número inválido',
  '09': 'Nosso número duplicado',
  '10': 'Carteira inválida',
  '11': 'Cadastro rejeitado',
  '13': 'Identificação emissão do boleto inválida',
  '16': 'Data de vencimento inválida',
  '18': 'Vencimento fora do prazo de operação',
  '20': 'Valor do título inválido',
  '21': 'Espécie do título inválida',
  '22': 'Espécie não permitida para a carteira',
  '23': 'Tipo pagamento não contratado',
  '24': 'Data de emissão inválida',
  '27': 'Valor/taxa de juros mora inválido',
  '28': 'Código do desconto inválido',
  '29': 'Valor desconto maior/igual ao valor do título',
  '30': 'Boleto não pode ter mais de três descontos',
  '31': 'Código de desconto deve ser igual em todos os registros',
  '32': 'Não pode haver mais de uma ocorrência de desconto para o mesmo código',
  '34': 'Valor do abatimento maior/igual ao valor do título',
  '35': 'Código juros título inválido',
  '36': 'Código multa título inválido',
  '37': 'UF do pagador inválido',
  '38': 'UF do beneficiário inválido',
  '39': 'Datas de desconto não podem se repetir no grupo',
  '40': 'Data de desconto anterior à data de emissão',
  '44': 'Código da moeda inválido',
  '45': 'Nome do pagador não informado',
  '46': 'Tipo/nº inscrição do pagador inválidos',
  '47': 'Endereço do pagador não informado',
  '48': 'CEP inválido',
  '49': 'CEP sem praça de cobrança',
  '50': 'CEP irregular — banco correspondente',
  '51': 'Tipo sacador/avalista inválido',
  '52': 'Identificador do sacador/avalista inválido',
  '53': 'Nome/razão social do sacador/avalista não informado',
  '59': 'Valor/percentual da multa inválido',
  '61': 'Parceiro não autorizado para esta conta',
  '62': 'Operador sem permissão para registrar boleto nessa conta',
  '63': 'Entrada para título já cadastrado',
  '65': 'Limite excedido',
  '79': 'Data de juros de mora inválida',
  '80': 'Data do desconto inválida',
  '86': 'Seu número inválido',
  '87': 'Data de multa inválida',
  '88': 'Documento do beneficiário inválido',
  '89': 'Boleto de proposta/depósito deve ser isento de juros',
  '90': 'Boleto de proposta/depósito deve ser isento de multa',
  '91': 'Boleto híbrido exige chave PIX cadastrada na conta',
  '92': 'Boleto híbrido: vencimento deve ser maior que a data atual',
  '93': 'Boleto híbrido: expiração deve ser maior que o vencimento',
  '94': 'Boleto híbrido: desconto deve ser entre hoje e o vencimento',
  '95': 'Saldo insuficiente para registrar o boleto',
  '96': 'Código de juros % dias corridos não permitido para modelo 01',
  '97': 'Código de barras já utilizado',
  '98': 'Conteúdo do texto informativo do beneficiário inválido',
  '99': 'Erro genérico',
}
const MOTIVOS_GENERICO = {
  '00': 'Aceita', '10': 'Baixa comandada pelo cliente',
  '14': 'Título protestado', '15': 'Crédito indisponível',
  '16': 'Baixa por decurso prazo', '18': 'Pagamento parcial',
}

const getMotivoDesc = (ocorrencia, motivo) => {
  if (!motivo) return ''
  const t = ocorrencia === '02' ? MOTIVOS_02 : ocorrencia === '03' ? MOTIVOS_03 : MOTIVOS_GENERICO
  return t[motivo] || `Motivo ${motivo}`
}

const ocorrenciaBadge = (cod) => {
  if (cod === '02') return 'bg-green-900/40 text-green-400 border-green-800'
  if (['03', '24'].includes(cod)) return 'bg-red-900/40 text-red-400 border-red-800'
  if (['06', '17'].includes(cod)) return 'bg-blue-900/40 text-blue-400 border-blue-800'
  if (cod === '11') return 'bg-yellow-900/40 text-yellow-400 border-yellow-800'
  if (['09', '10'].includes(cod)) return 'bg-orange-900/40 text-orange-400 border-orange-800'
  return 'bg-[#1a1a1a] text-[#a3a3a3] border-[#2a2a2a]'
}

// ─── Formatadores ──────────────────────────────────────────────────────────────
const parseDDMMAA = (s) => {
  if (!s || s.length !== 6) return null
  const dd = s.slice(0, 2), mm = s.slice(2, 4), aa = s.slice(4, 6)
  if (dd === '000000'.slice(0, 2)) return null
  return `20${aa}-${mm}-${dd}`
}

const formatDataBR = (iso) => {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso
}

const formatValorBR = (v) =>
  (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

// ─── Consulta capt_boletos com matching hierárquico ───────────────────────────
// capt_boletos.nosso_numero é gravado SEM zeros à esquerda e SEM DV,
// formato idêntico ao nossoNumeroBD extraído do arquivo de retorno.
// Hierarquia: triple (nn+venc+valor) → dual (nn+valor) → single (nn)

const normNN = (n) => String(n || '').replace(/^0+/, '') || String(n)

const buscarBoletosDB = async (registros) => {
  const nossoNums = [...new Set(registros.map(r => r.nossoNumeroBD).filter(Boolean))]
  if (!nossoNums.length) return { mapaTriple: {}, mapaDual: {}, mapaSingle: {}, total: 0 }

  const { data, error } = await supabase
    .from('capt_boletos')
    .select('id, nosso_numero, data_vencimento, valor, sacado_nome, sacado_cic, numero_documento')
    .in('nosso_numero', nossoNums)

  if (error) console.warn('[RetornoPage] capt_boletos error:', error.message)
  console.log(`[RetornoPage] capt_boletos: ${nossoNums.length} nosso_numeros consultados → ${(data||[]).length} linha(s) retornadas`)
  if ((data||[]).length > 0) {
    console.log('[RetornoPage] amostra:', data.slice(0,3).map(r => `${r.nosso_numero} | ${r.sacado_nome}`))
  }

  const mapaTriple = {}
  const mapaDual   = {}
  const mapaSingle = {}

  for (const row of (data || [])) {
    const nn    = normNN(row.nosso_numero)
    const venc  = (row.data_vencimento || '').substring(0, 10)
    const cents = Math.round((parseFloat(row.valor) || 0) * 100)

    const kT = `${nn}_${venc}_${cents}`
    const kD = `${nn}_${cents}`
    const kS = nn

    if (!mapaTriple[kT]) mapaTriple[kT] = row
    if (!mapaDual[kD])   mapaDual[kD]   = row
    if (!mapaSingle[kS]) mapaSingle[kS] = row
  }

  return { mapaTriple, mapaDual, mapaSingle, total: (data || []).length }
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function RetornoPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  // Cada elemento: { nome, header, trailer, registros }
  const [arquivos, setArquivos] = useState([])
  const [boletosDB, setBoletosDB] = useState({ mapaTriple: {}, mapaDual: {}, mapaSingle: {}, total: 0 })
  const [dbDebug, setDbDebug] = useState('')   // info de debug do lookup
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroOcorrencia, setFiltroOcorrencia] = useState('todos')
  const [filtroArquivo, setFiltroArquivo] = useState('todos')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [openActionsMenu, setOpenActionsMenu] = useState(false)
  const [erros, setErros] = useState([])
  const fileInputRef = useRef(null)

  // Todos os registros de todos os arquivos em uma lista plana
  const todosRegistros = arquivos.flatMap(a => a.registros)

  const processarArquivos = async (files) => {
    const validos = files.filter(f => /\.(ret|rem|txt)$/i.test(f.name))
    if (!validos.length) {
      setErros(['Selecione arquivo(s) de retorno CNAB400 (.RET)'])
      return
    }

    setLoading(true)
    setErros([])

    const novosArquivos = []
    const errosLista = []

    for (const file of validos) {
      try {
        const text = await file.text()
        const { header, trailer, registros } = parseCNAB400Retorno(text, file.name)
        if (!header) throw new Error('Header não encontrado')
        if (!registros.length) throw new Error('Sem registros de transação')
        novosArquivos.push({ nome: file.name, header, trailer, registros })
      } catch (e) {
        errosLista.push(`${file.name}: ${e.message}`)
      }
    }

    if (errosLista.length) setErros(errosLista)

    // Acumula com arquivos já carregados, ignorando duplicatas pelo nome
    const nomeExistentes = new Set(arquivos.map(a => a.nome))
    const novosUnicos = novosArquivos.filter(a => !nomeExistentes.has(a.nome))
    const listaFinal = [...arquivos, ...novosUnicos]
    setArquivos(listaFinal)
    setSelectedRows(new Set())

    // Busca em capt_registrado para todos os registros acumulados
    const todosRegs = listaFinal.flatMap(a => a.registros)
    const mapa = await buscarBoletosDB(todosRegs)
    setBoletosDB(mapa)

    setLoading(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    processarArquivos(Array.from(e.dataTransfer.files))
  }

  const handleFileInput = (e) => {
    processarArquivos(Array.from(e.target.files))
    e.target.value = ''
  }

  const removerArquivo = (nome) => {
    const novo = arquivos.filter(a => a.nome !== nome)
    setArquivos(novo)
    setSelectedRows(new Set())
    if (filtroArquivo === nome) setFiltroArquivo('todos')
    // Recalcula mapa
    const regs = novo.flatMap(a => a.registros)
    buscarBoletosDB(regs).then(setBoletosDB)
  }

  // ─── Enriquece registro com dados de capt_registrado (match hierárquico) ──
  const enriquecer = (reg) => {
    const vencISO = parseDDMMAA(reg.dataVencimento)
    const cents   = Math.round(reg.valorTitulo * 100)
    const kT = `${reg.nossoNumeroBD}_${vencISO || ''}_${cents}`
    const kD = `${reg.nossoNumeroBD}_${cents}`
    const kS = reg.nossoNumeroBD
    const db = boletosDB.mapaTriple?.[kT]
            || boletosDB.mapaDual?.[kD]
            || boletosDB.mapaSingle?.[kS]
            || {}
    const motivosDesc = reg.motivosList.map(m => getMotivoDesc(reg.codigoOcorrencia, m)).filter(Boolean)
    return {
      ...reg,
      nomeExibir: db.sacado_nome || '—',
      sacadoCic: db.sacado_cic || '',
      numeroTitulo: db.numero_documento || reg.numeroDocumento || reg.controleParticipante || '—',
      valorExibir: reg.valorTitulo,
      vencimentoExibir: formatDataBR(vencISO),
      ocorrenciaDesc: OCORRENCIAS[reg.codigoOcorrencia] || `Código ${reg.codigoOcorrencia}`,
      dataOcorrenciaFmt: formatDataBR(parseDDMMAA(reg.dataOcorrencia)),
      motivosDesc,
      achouNoDB: !!db.id,
    }
  }

  const getLista = () => {
    let list = todosRegistros.map(enriquecer)
    if (filtroArquivo !== 'todos') list = list.filter(r => r.arquivoNome === filtroArquivo)
    if (filtroOcorrencia !== 'todos') list = list.filter(r => r.codigoOcorrencia === filtroOcorrencia)
    const term = searchTerm.trim().toLowerCase()
    if (term) list = list.filter(r =>
      r.nomeExibir.toLowerCase().includes(term) ||
      r.numeroTitulo.toLowerCase().includes(term) ||
      r.nossoNumeroBD.toString().includes(term) ||
      r.ocorrenciaDesc.toLowerCase().includes(term) ||
      r.arquivoNome.toLowerCase().includes(term)
    )
    return list
  }

  const toggleRow = (key) => {
    const next = new Set(selectedRows)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelectedRows(next)
  }

  const toggleAll = () => {
    const lista = getLista()
    if (selectedRows.size === lista.length && lista.length > 0) setSelectedRows(new Set())
    else setSelectedRows(new Set(lista.map(r => r.arquivoNome + r.sequencial)))
  }

  // ─── Contadores globais ──────────────────────────────────────────────────────
  const contadores = todosRegistros.reduce((acc, r) => {
    acc[r.codigoOcorrencia] = (acc[r.codigoOcorrencia] || 0) + 1
    return acc
  }, {})
  const ocorrenciasPresentes = Object.keys(contadores).sort()

  // ─── Exportar PDF ──────────────────────────────────────────────────────────
  const handleExportarPDF = () => {
    const lista = getLista()
    const paraExportar = selectedRows.size > 0
      ? lista.filter(r => selectedRows.has(r.arquivoNome + r.sequencial))
      : lista
    if (!paraExportar.length) { alert('Nenhum registro para exportar'); return }
    setOpenActionsMenu(false)

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    // Fundo branco explícito
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, 210, 297, 'F')

    const nomeArqs = [...new Set(paraExportar.map(r => r.arquivoNome))].join(', ')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('RETORNO CNAB 400 — BMP MONEYPLUS', 14, 13)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    doc.text(`Arquivo(s): ${nomeArqs.substring(0, 90)}`, 14, 19)
    doc.text(`Registros: ${paraExportar.length}`, 14, 24)

    // Largura útil retrato A4 = 210 − 14 (esq) − 10 (dir) = 186 mm
    // Colunas fixas: Nome(48) + Título(20) + NossoNº(20) + Vencto(16) + Valor(20) + Ocorr(30) + DtOcorr(16) = 170
    // Motivo: 186 − 170 = 16 … mas overflow:linebreak vai expandir a linha; sum deixar auto
    autoTable(doc, {
      startY: 28,
      margin: { left: 14, right: 10 },
      head: [['Nome / Sacado', 'Nº Título', 'Nosso Nº', 'Vencto.', 'Valor (R$)', 'Ocorrência', 'Dt. Ocorr.', 'Motivo']],
      body: paraExportar.map(r => [
        r.nomeExibir,
        r.numeroTitulo,
        r.nossoNumeroBD,
        r.vencimentoExibir,
        r.valorExibir > 0 ? formatValorBR(r.valorExibir) : '—',
        `${r.codigoOcorrencia} – ${r.ocorrenciaDesc}`,
        r.dataOcorrenciaFmt,
        r.motivosDesc.join('; ') || '—',   // texto completo, sem substring
      ]),
      styles: {
        fontSize: 6.5,
        cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 },
        overflow: 'linebreak',             // quebra de linha para Motivo aparecer completo
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 48 },             // Nome / Sacado
        1: { cellWidth: 20 },             // Nº Título
        2: { cellWidth: 20 },             // Nosso Nº
        3: { cellWidth: 16 },             // Vencto.
        4: { cellWidth: 20, halign: 'right' }, // Valor
        5: { cellWidth: 30 },             // Ocorrência
        6: { cellWidth: 16 },             // Dt. Ocorr.
        7: { cellWidth: 'auto' },         // Motivo — ocupa o restante e quebra linha se necessário
      },
      theme: 'grid',
    })

    const now = new Date()
    const stamp = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getFullYear()).slice(-2)}`
    doc.save(`retorno_${stamp}.pdf`)
  }

  const lista = getLista()
  const multiArquivo = arquivos.length > 1

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Retorno CNAB400</h1>
          <p className="text-sm text-[#666666] mt-1">Processamento de arquivos de retorno BMP MoneyPlus</p>
        </div>
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={handleDrop}
        className={`bg-[#0a0a0a] border-2 border-dashed rounded-lg px-6 py-4 transition ${
          isDragging ? 'border-white bg-[#111111]' : 'border-[#2a2a2a] hover:border-[#333333]'
        } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-[#666666] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-white font-semibold text-sm">Importar Arquivo(s) de Retorno</span>
            <span className="text-[#666666] text-xs ml-2 hidden sm:inline">
              Arraste um ou mais .RET (CNAB400 BMP) ou clique em Selecionar
            </span>
          </div>
          <label className="shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".ret,.rem,.txt,application/octet-stream"
              onChange={handleFileInput}
              disabled={loading}
              className="hidden"
            />
            <span className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition cursor-pointer inline-block whitespace-nowrap">
              {loading ? 'Processando...' : 'Selecionar arquivo(s)'}
            </span>
          </label>
        </div>

        {/* Lista de arquivos carregados */}
        {arquivos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {arquivos.map((a) => (
              <div key={a.nome} className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded px-2.5 py-1">
                <svg className="w-3 h-3 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-white text-xs">{a.nome}</span>
                <span className="text-[#555555] text-xs">({a.registros.length} reg.)</span>
                <button
                  onClick={() => removerArquivo(a.nome)}
                  className="text-[#555555] hover:text-white transition ml-1"
                  title="Remover"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {erros.length > 0 && (
          <div className="mt-2 flex flex-col gap-0.5">
            {erros.map((e, i) => (
              <span key={i} className="text-xs text-red-400 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                {e}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Resumo cards */}
      {arquivos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {arquivos.map((a) => (
            <div key={a.nome} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-2 flex flex-col min-w-0">
              <span className="text-[10px] text-[#666666] uppercase tracking-wider truncate max-w-[160px]" title={a.nome}>{a.nome}</span>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white text-xs font-medium">{a.registros.length} registros</span>
                {a.header?.dataGravacao && (
                  <span className="text-[#666666] text-xs">{formatDataBR(parseDDMMAA(a.header.dataGravacao))}</span>
                )}
              </div>
              {a.header?.nomeCedente && (
                <span className="text-[#555555] text-xs truncate max-w-[180px]">{a.header.nomeCedente}</span>
              )}
            </div>
          ))}
          {ocorrenciasPresentes.map(cod => (
            <div key={cod} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-2 flex flex-col">
              <span className="text-[10px] text-[#666666] uppercase tracking-wider whitespace-nowrap">{OCORRENCIAS[cod] || `Ocorr. ${cod}`}</span>
              <span className={`text-xs font-bold mt-0.5 ${
                cod === '02' ? 'text-green-400' :
                ['03','24'].includes(cod) ? 'text-red-400' :
                ['06','17'].includes(cod) ? 'text-blue-400' :
                cod === '11' ? 'text-yellow-400' : 'text-[#a3a3a3]'
              }`}>{contadores[cod]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      {todosRegistros.length > 0 && (
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <input
              type="text"
              placeholder="Buscar por nome, título, nosso número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white outline-none transition text-sm"
            />
            <svg className="absolute right-3 top-2.5 w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {multiArquivo && (
            <select
              value={filtroArquivo}
              onChange={(e) => setFiltroArquivo(e.target.value)}
              className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none"
            >
              <option value="todos">Todos os arquivos</option>
              {arquivos.map(a => <option key={a.nome} value={a.nome}>{a.nome}</option>)}
            </select>
          )}

          <select
            value={filtroOcorrencia}
            onChange={(e) => setFiltroOcorrencia(e.target.value)}
            className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none"
          >
            <option value="todos">Todas ocorrências</option>
            {ocorrenciasPresentes.map(cod => (
              <option key={cod} value={cod}>{cod} – {OCORRENCIAS[cod] || cod}</option>
            ))}
          </select>

          <div className="relative ml-auto">
            <button
              onClick={() => setOpenActionsMenu(!openActionsMenu)}
              className="px-4 py-2 text-sm font-medium rounded transition bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:bg-[#222222]"
            >
              Ações {selectedRows.size > 0 && `(${selectedRows.size})`}
            </button>
            {openActionsMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 min-w-52">
                <button
                  onClick={handleExportarPDF}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                >
                  📑 Exportar PDF {selectedRows.size > 0 ? `(${selectedRows.size} sel.)` : '(todos)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      {todosRegistros.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#111111] border-b border-[#2a2a2a] z-10">
              <tr>
                <th className="px-3 py-2 text-center w-8">
                  <input type="checkbox"
                    checked={lista.length > 0 && selectedRows.size === lista.length}
                    onChange={toggleAll}
                    className="w-4 h-4 cursor-pointer accent-white"
                  />
                </th>
                {multiArquivo && <th className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap">Arquivo</th>}
                <th className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white">Nome / Sacado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap">Nº Título</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap">Nosso Nº</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap">Vencimento</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white whitespace-nowrap">Valor (R$)</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap">Ocorrência</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap">Dt. Ocorr.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => {
                const key = r.arquivoNome + r.sequencial
                const sel = selectedRows.has(key)
                return (
                  <tr
                    key={key}
                    onClick={() => toggleRow(key)}
                    className={`border-b border-[#1a1a1a] hover:bg-[#111111] transition cursor-pointer ${sel ? 'bg-[#111111]' : ''}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={sel}
                        onChange={() => toggleRow(key)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer accent-white"
                      />
                    </td>
                    {multiArquivo && (
                      <td className="px-3 py-2 text-[#555555] text-xs truncate max-w-[100px]" title={r.arquivoNome}>
                        {r.arquivoNome.replace(/\.[^.]+$/, '')}
                      </td>
                    )}
                    <td className="px-3 py-2 text-[#555555] font-mono text-xs">{r.sequencial}</td>
                    <td className="px-3 py-2 max-w-xs truncate" title={r.nomeExibir}>
                      <span className={r.achouNoDB ? 'text-white' : 'text-[#555555] italic'}>{r.nomeExibir}</span>
                    </td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono text-xs whitespace-nowrap">{r.numeroTitulo}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono text-xs whitespace-nowrap">{r.nossoNumeroBD}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] text-xs whitespace-nowrap">{r.vencimentoExibir}</td>
                    <td className="px-3 py-2 text-white font-mono text-right text-xs whitespace-nowrap">
                      {r.valorExibir > 0 ? formatValorBR(r.valorExibir) : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${ocorrenciaBadge(r.codigoOcorrencia)}`}>
                        {r.codigoOcorrencia} {r.ocorrenciaDesc}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#a3a3a3] text-xs whitespace-nowrap">{r.dataOcorrenciaFmt}</td>
                    <td className="px-3 py-2 text-xs max-w-[200px]">
                      {r.motivosDesc.length > 0 ? (
                        <span className={['03','24','27','32'].includes(r.codigoOcorrencia) ? 'text-red-400' : 'text-[#a3a3a3]'}>
                          {r.motivosDesc.join(' · ')}
                        </span>
                      ) : <span className="text-[#333333]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Estado vazio */}
      {!loading && arquivos.length === 0 && !erros.length && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <svg className="w-12 h-12 text-[#2a2a2a] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-[#444444] text-sm">Nenhum arquivo carregado</p>
          <p className="text-[#333333] text-xs mt-1">Selecione um ou mais arquivos .RET do BMP para processar</p>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin mb-3 mx-auto">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <p className="text-[#666666] text-sm">Processando arquivo(s)...</p>
          </div>
        </div>
      )}

      {/* Footer */}
      {todosRegistros.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[#666666] px-1">
          <span>
            {lista.length} registro(s) exibido(s) de {todosRegistros.length} total
            {selectedRows.size > 0 && ` · ${selectedRows.size} selecionado(s)`}
          </span>
          <span>{arquivos.length} arquivo(s) · {boletosDB.total ?? 0} reg. encontrado(s) no DB</span>
        </div>
      )}
    </div>
  )
}
