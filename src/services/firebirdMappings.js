// Mapeamento entre o modelo atual (Supabase) e o Firebird.
//
// ⚠️ A CONFERIR contra `GET /api/firebird/_tables` no ambiente onde a API é
// alcançável. Os nomes de coluna abaixo espelham as tabelas equivalentes do
// Supabase; a chave primária real e o formato do `_id` (valores da PK unidos
// por "~") do Firebird PRECISAM ser confirmados antes de ligar a flag.
//
// Endpoints (proxy): id = valores da PK na ordem, separados por "~".
//   ex. OPEITE (COD_CEDENTE, COD_OPERACAO, NUM_LANCAMENTO) => "6~1~20781"

// Tabela "_WEB" do Supabase -> tabela equivalente no Firebird (sem underscore).
export const WEB_SUPABASE_TO_FIREBIRD = {
  OPECAB_WEB: 'OPECABWEB',
  OPEITE_WEB: 'OPEITEWEB',
  SACADO_WEB: 'SACADOWEB',
}

// Chaves primárias CONFIRMADAS via GET /_tables (2026-09).
export const PK = {
  CEDENTE: ['COD_CEDENTE'],
  SACADO: ['COD_SACADO'],
  OPECAB: ['COD_CEDENTE', 'COD_OPERACAO'],
  OPEITE: ['COD_CEDENTE', 'COD_OPERACAO', 'NUM_LANCAMENTO'],
  OPECABWEB: ['COD_CEDENTE', 'COD_BORDERO'],
  OPEITEWEB: ['COD_CEDENTE', 'COD_BORDERO', 'COD_TITULO'],
  SACADOWEB: ['CIC_SACADO'],
}

// Monta o :id (PK unida por "~") a partir de um objeto de valores.
export function montarId(tabela, valores) {
  const cols = PK[tabela]
  if (!cols) throw new Error(`PK não mapeada para ${tabela}`)
  return cols.map((c) => valores[c]).join('~')
}

// Colunas enviadas ao criar um cabeçalho de operação no Firebird (OPECABWEB).
// Espelha o que hoje é inserido em OPECAB_WEB no Supabase.
export function payloadOpecabWeb({ codCedente, codOperacao, codBordero, dtRecepcao, hrRecepcao }) {
  return {
    COD_CEDENTE: codCedente,
    COD_BORDERO: codBordero,
    COD_OPERACAO: codOperacao,
    DT_RECEPCAO: dtRecepcao,
    HR_RECEPCAO: hrRecepcao,
    STATUS: 'R',
  }
}

// Colunas de um título no Firebird (OPEITEWEB). Espelha OPEITE_WEB do Supabase.
export function payloadOpeiteWeb(r) {
  return {
    COD_CEDENTE: r.COD_CEDENTE,
    COD_BORDERO: r.COD_BORDERO,
    COD_TITULO: r.COD_TITULO,
    TIPO: r.TIPO,
    DT_BORDERO: r.DT_BORDERO,
    VR_FACE: r.VR_FACE,
    DT_VENCIMENTO: r.DT_VENCIMENTO,
    NUMERO: r.NUMERO,
    NOME_EMITENTE: r.NOME_EMITENTE,
    CIC_EMITENTE: r.CIC_EMITENTE,
    NOSSO_NUMERO: r.NOSSO_NUMERO,
    NOME_AVALISTA: r.NOME_AVALISTA,
    CIC_AVALISTA: r.CIC_AVALISTA,
    STATUS: r.STATUS ?? 'R',
  }
}

// Colunas de sacado no Firebird (SACADOWEB). Espelha SACADO_WEB do Supabase.
export function payloadSacadoWeb(b) {
  return {
    CIC_SACADO: b.CIC_SACADO,
    NOME_SACADO: b.NOME_SACADO,
    CEP: b.CEP,
    NOME_LOGRADOURO: b.NOME_LOGRADOURO,
    BAIRRO: b.BAIRRO,
    LOCALIDADE: b.LOCALIDADE,
    UF: b.UF,
  }
}
