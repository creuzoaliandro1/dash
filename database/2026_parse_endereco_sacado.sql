-- ============================================================================
-- Parser de endereço do SACADO: separa NÚMERO e COMPLEMENTO de um endereço
-- digitado num campo só (SACADO.ENDERECO). Usado pela trigger de capt_boletos.
-- ============================================================================

-- Mascara (troca dígitos por '#') o subgrupo `grp` de todas as ocorrências de `pat` em `m`.
-- A string mascarada mantém o mesmo tamanho, então posições continuam valendo na original.
CREATE OR REPLACE FUNCTION public._end_mask(m text, pat text, grp int)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE p int; t text; guard int := 0;
BEGIN
  LOOP
    p := regexp_instr(m, pat, 1, 1, 0, '', grp);
    EXIT WHEN p = 0 OR guard > 50;
    t := regexp_substr(m, pat, 1, 1, '', grp);
    m := overlay(m placing regexp_replace(t, '\d', '#', 'g') from p for length(t));
    guard := guard + 1;
  END LOOP;
  RETURN m;
END $$;

-- Limpa um complemento: tira telefones/CEP, pontuação nas pontas, parênteses,
-- ordinal solto e espaços duplos. Complemento só com zeros vira NULL.
CREATE OR REPLACE FUNCTION public._end_limpa_comp(c text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN x ~ '^0+$' THEN NULL ELSE x END
  FROM (SELECT nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(c,''),
            '(\(\d{2}\)\s*|\m\d{2}-)\d{4,5}-?\d{4}\M|\m\d{4,5}-\d{4}\M|\m\d{8,}\M|\m\d{5}-\d{3}\M|\m(FONE|TEL|TELEFONE|CEL)\M\.?:?', ' ', 'g'),
        '[()]', ' ', 'g'),
      '\s+', ' ', 'g'),
    '^[\s,;:./\-ºª°]+|[\s,;:/\-]+$', '', 'g'),
  '') AS x) t
$$;

-- Regras, em ordem de prioridade:
--   1. Marcador explícito: N 79, Nº 440, N702, NR 230, NUM 5  -> esse é o número.
--   2. Primeiro número "livre" que vem ANTES de qualquer palavra de complemento
--      (AP, SALA, LOJA, QD, LT, BOX...) e antes de S/N.
--   3. Complemento antes do número com o número isolado no fim: 'AV X LJ 118, 500' -> 500.
--   4. KM da rodovia (ROD SANTOS DUMONT KM 18 -> 18), mesmo com S/N.
--   5. S/N.
-- Não são número de casa (mascarados antes): telefone, CEP, BR-116 / CE 085 / ROD 304,
-- 'RUA 28', 'AV 13 DE MAIO', '4 ANEL VIARIO', '2 ANDAR', '3 ETAPA', códigos colados
-- em letras (A13, QD14, LJ2) e o número curto do nome da via quando vem outro número
-- depois ('RUA LESTE 1, 500', 'AV DOM PEDRO 1, 2053').
-- Endereços no padrão de Brasília (QD/SQS/SHC/SEPS...) e sem letras (telefone) -> SN.
-- Zeros à esquerda são removidos quando o número tem 3+ dígitos (00601 -> 601; 02 fica 02).
CREATE OR REPLACE FUNCTION public.parse_endereco_sacado(endereco text, OUT numero text, OUT complemento text)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text; m text;
  uf constant text := '(AC|AL|AM|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)';
  kw_comp constant text := '(AP|APT|APTO|APRT|APART|APARTAMENTO|SALA|SL|SLS|SALAS|SALAO|LOJA|LJ|LJS|LOJAS|BLOCO|BL|BLC|QUADRA|QD|QDA|QDR|Q|LOTE|LT|LOTES|CASA|CS|BOX|BX|GALPAO|GALPÃO|GALP|GP|ANDAR|CONJ|CONJUNTO|CJ|TORRE|TR|SETOR|ETAPA|MODULO|MÓDULO|MOD|UNIDADE|UND|KIOSQUE|QUIOSQUE|PAVIMENTO|PAV|ARMAZEM|ARMAZÉM|DEPOSITO|DEPÓSITO|PREDIO|PRÉDIO|PISO|ED|EDF|EDIF|EDIFICIO|EDIFÍCIO|COND|CONDOMINIO|CONDOMÍNIO|CAIXA POSTAL|CX POSTAL|CXP|PORTAO|PORTÃO|TERREO|TÉRREO|FUNDOS|FDS|ANEXO|GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|FAZ|COMPL|COMP)';
  re_sn constant text := '(S\s*/\s*N[º°O]?|S\.\s*N\.?|SEM NUMERO|SEM NÚMERO|SEM NUM|SEM Nº|\mSN\M|\mS N\M)';
  pos_expl int; pos_num int; pos_comp int; pos_sn int;
  num_raw text; km text; num_fim int; pos_fim int;
BEGIN
  s := upper(btrim(coalesce(endereco, '')));
  s := regexp_replace(s, '\s+', ' ', 'g');
  IF s = '' THEN RETURN; END IF;
  -- sem nenhuma letra = lixo (telefone digitado no campo endereço)
  IF s !~ '[A-ZÀ-Ü]' THEN numero := 'SN'; RETURN; END IF;
  -- padrão Brasília (quadra/setor, sem número de casa)
  IF s ~ '^(Q|QD|QDA|QUADRA|SQS|SQN|SQSW|SQNW|SEPS|SEPN|SHC|SHCS|SHCN|SHIS|SHIN|SCLN|SCLS|SCS|SCN|SMAS|SAAN|SIA|SOF|SGAN|SGAS|CLN|CLS|CRS|CRN|EQ|QI|QL|QE|QR|QS|QN|QNM|QNN|CNB|CNA|CNBA|ADE)\M' THEN
    numero := 'SN'; RETURN;
  END IF;
  -- 'N702' / 'NO702' -> separa o marcador do número para o passo de letras+dígitos
  s := regexp_replace(s, '\m(N|NO|NR|NRO|Nº|N°)[.\-:]?(\d)', '\1 \2', 'g');
  -- nome grudado no número: 'AV SANTOS DUMONT4130' -> 'AV SANTOS DUMONT 4130'
  -- (prefixos curtos como A13, QD14, LJ2, LESTE5 continuam grudados e são tratados abaixo)
  s := regexp_replace(s, '([A-ZÀ-Ü]{4,})(\d{2,})', '\1 \2', 'g');
  s := regexp_replace(s, '(S\s*/\s*N)([A-Z])', '\1 \2', 'g');   -- 'S/NKM 29' -> 'S/N KM 29'
  m := s;

  -- 1) Máscaras
  m := public._end_mask(m, '((\(\d{2}\)\s*|\m\d{2}-)\d{4,5}-?\d{4}\M)', 1);        -- tel c/ DDD
  m := public._end_mask(m, '(\d{4,5}-\d{4})', 1);                                    -- telefone
  m := public._end_mask(m, '(\m\d{8,}\M)', 1);                                       -- telefone
  m := public._end_mask(m, '(\m\d{5}-\d{3}\M)', 1);                                  -- CEP
  m := public._end_mask(m, '\mBR\s*[-.]?\s*(\d+)', 1);                               -- BR 116
  m := public._end_mask(m, '\m' || uf || '\s*-\s*(\d+)', 2);                         -- CE-085
  m := public._end_mask(m, '^(ROD|RODOVIA|RODO|RDV|RIDOVIA|RID|TRAMROD)\.?\s*(FEDERAL\s+|ESTADUAL\s+)?' || uf || '?\s*[-.]?\s*(\d+)', 4);  -- ROD CE 085 / ROD 304 / RODCE 230
  m := public._end_mask(m, '^' || uf || '\s*[-.]?\s*(\d+)', 2);                      -- 'CE 040 ...' no início
  IF s ~ '^(ROD|RODOVIA|RODO|RDV|EST|ESTRADA|TRAMROD|BR)\M' THEN
    m := public._end_mask(m, '\m' || uf || '\s*[-.]?\s*(\d{2,3})\M', 2);            -- 'ROD SENADOR X CE 065'
  END IF;
  km := regexp_substr(m, '\mKM\s*[.:\-]?\s*(\d+)', 1, 1, '', 1);
  m := public._end_mask(m, '\mKM\s*[.:\-]?\s*(\d+([.,]\d+)?)', 1);                     -- KM 18 / KM 8,2
  m := public._end_mask(m, '(^|[,\-]\s*)(RUA|R|AV|AVENIDA|AVEN|TRAVESSA|TV|TRAV|ALAMEDA|AL|PRACA|PRAÇA|PC|PÇA|VIELA|BECO|PASSAGEM|VIA|CAMINHO|LADEIRA|VILA|ESTRADA|ARSE|ARNE|ARSO|ARNO|ACSU|ACNO|ACSO|ACNE|ASR|ANR)\.?\s*[-:]?\s*(\d+)', 3);  -- RUA 28
  m := public._end_mask(m, '\m(ALAMEDA|ALAM)\.?\s*(\d+)', 2);
  m := public._end_mask(m, '(\d+)\s*[º°]?\s+DE\s+(JANEIRO|FEVEREIRO|MARCO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)', 1);
  m := public._end_mask(m, '(\m\d{1,2})\s*[º°ª]?\s*(ANDAR|ANDARES|PISO|ETAPA|ANEL|PAVIMENTO|PAV)\M', 1);  -- 2 ANDAR / 4 ANEL VIARIO
  m := public._end_mask(m, '\m[A-ZÀ-Ü]+[-]?(\d+)', 1);                                  -- A13, QD14, LJ2, LESTE5, C-5
  -- número curto no fim do nome da via seguido de outro número: 'RUA LESTE 1, 500'
  m := public._end_mask(m, '(\m(?!N\M|NO\M|NR\M|NRO\M|NUM\M)[A-ZÀ-Ü]+\s)(\d{1,2})(\s*,\s*|\s+|\s*-\s*)\d', 2);

  -- 2) Posições
  pos_expl := regexp_instr(m, '(^|[\s,.\-])(N|NO|NR|NRO|NUM|NUMERO|NÚMERO)\s*[.º°:\-]?\s*[º°]?\s*\d', 1, 1, 0, '', 0);
  pos_comp := regexp_instr(m, '\m' || kw_comp || '(\M\s*\.?\s*(\d|#|[A-Z]\M|[A-Z]{1,2}(\d|#))|(?=\d|#))');
  pos_sn   := regexp_instr(m, re_sn);

  IF pos_expl > 0 THEN
    pos_num := regexp_instr(m, '\d', pos_expl);
  ELSE
    pos_num := regexp_instr(m, '\d');
  END IF;

  -- número só com zeros não é número
  IF pos_num > 0 AND (regexp_match(substring(m from pos_num), '^\d+'))[1] ~ '^0+$' THEN
    pos_num := 0;
  END IF;

  -- número livre só vale se vier antes do complemento e do S/N
  IF pos_num > 0 AND pos_expl = 0 AND ((pos_comp > 0 AND pos_comp < pos_num) OR (pos_sn > 0 AND pos_sn < pos_num)) THEN
    pos_num := 0;
  END IF;

  -- 3) Complemento antes do número, número isolado no último trecho: 'AV X LJ 118, 500'
  IF pos_num = 0 AND pos_comp > 0 AND (pos_sn = 0 OR pos_sn > pos_comp) THEN
    pos_fim := regexp_instr(m, ',\s*\d+\s*$');
    IF pos_fim > pos_comp AND (regexp_match(substring(m from pos_fim), '(\d+)'))[1] !~ '^0+$' THEN
      num_raw := (regexp_match(substring(m from pos_fim), '(\d+)'))[1];
      numero := CASE WHEN length(num_raw) > 2 THEN ltrim(num_raw, '0') ELSE num_raw END;
      complemento := public._end_limpa_comp(substring(s from pos_comp for pos_fim - pos_comp));
      RETURN;
    END IF;
  END IF;

  -- 2) Número encontrado: complemento é o que vem depois
  IF pos_num > 0 THEN
    num_raw := (regexp_match(substring(m from pos_num), '^\d+'))[1];
    num_fim := pos_num + length(num_raw);
    numero := CASE WHEN length(num_raw) > 2 THEN ltrim(num_raw, '0') ELSE num_raw END;
    complemento := public._end_limpa_comp(substring(s from num_fim));
    RETURN;
  END IF;

  -- 4/5) Sem número de casa: KM > S/N
  IF km IS NOT NULL AND km !~ '^0+$' THEN
    numero := CASE WHEN length(km) > 2 THEN ltrim(km, '0') ELSE km END;
  ELSE
    km := NULL;
    numero := 'SN';
  END IF;
  IF pos_comp > 0 AND (pos_sn = 0 OR pos_comp < pos_sn) THEN
    complemento := substring(s from pos_comp);
  ELSIF pos_sn > 0 THEN
    complemento := regexp_replace(substring(s from pos_sn), '^' || re_sn, '');
  END IF;
  -- o KM que virou número não se repete no complemento
  IF km IS NOT NULL THEN
    complemento := regexp_replace(coalesce(complemento, ''), '^\s*[,\-]?\s*KM\s*[.:\-]?\s*\d+([.,]\d+)?', '');
  END IF;
  complemento := public._end_limpa_comp(complemento);
END $$;

-- ============================================================================
-- Trigger: preenche capt_boletos.sacado_numero / sacado_complemento a partir de
-- sacado_endereco sempre que o número não vier informado. Na atualização, se o
-- endereço mudar e o número não for alterado junto, recalcula os dois.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_capt_boletos_endereco_numero()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF coalesce(btrim(NEW.sacado_endereco), '') = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.sacado_endereco IS DISTINCT FROM OLD.sacado_endereco
     AND NEW.sacado_numero IS NOT DISTINCT FROM OLD.sacado_numero THEN
    NEW.sacado_numero := NULL;
    IF NEW.sacado_complemento IS NOT DISTINCT FROM OLD.sacado_complemento THEN
      NEW.sacado_complemento := NULL;
    END IF;
  END IF;
  IF coalesce(btrim(NEW.sacado_numero), '') = '' THEN
    r := public.parse_endereco_sacado(NEW.sacado_endereco);
    NEW.sacado_numero := r.numero;
    IF coalesce(btrim(NEW.sacado_complemento), '') = '' THEN
      NEW.sacado_complemento := r.complemento;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS capt_boletos_endereco_numero ON public.capt_boletos;
CREATE TRIGGER capt_boletos_endereco_numero
  BEFORE INSERT OR UPDATE OF sacado_endereco, sacado_numero, sacado_complemento
  ON public.capt_boletos
  FOR EACH ROW EXECUTE FUNCTION public.trg_capt_boletos_endereco_numero();

-- Backfill dos boletos existentes sem número (a própria trigger calcula)
UPDATE public.capt_boletos
   SET sacado_numero = NULL
 WHERE coalesce(btrim(sacado_numero), '') = ''
   AND coalesce(btrim(sacado_endereco), '') <> '';

DROP SCHEMA IF EXISTS tmp_parser CASCADE;
