-- Preenche capt_registrado.num_lanca a partir da OPEITE (réplica do Firebird).
-- Boletos cancelados (situacao_boleto 'Cancelado', 'Cancelado pelo cedente',
-- 'Cancelado por data limite') são ignorados: não recebem lançamento nem contam
-- como duplicata da reemissão que os substituiu.
CREATE OR REPLACE FUNCTION public.sync_num_lanca_capt_registrado()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count integer; v_count2 integer;
begin
  -- Chave do título: valor + vencimento + CIC do pagador (só dígitos).
  -- Vencimento: aceita DT_VENCI (original) OU DT_VENCI_NOVO (renegociado / data de resgate
  -- em títulos CO), para qualquer STATUS.

  -- Passo 1: chave única dos dois lados (um título em capt_registrado, um lançamento na OPEITE).
  with base as (
    select cr.id, cr.num_lanca, cr.vlr_tit, cr.dt_venc_tit,
           regexp_replace(coalesce(cr.cnpj_cpf_pagdr, ''), '\D', '', 'g') as cic
    from capt_registrado cr
    where cr.vlr_tit is not null
      and cr.dt_venc_tit is not null
      and coalesce(cr.cnpj_cpf_pagdr, '') <> ''
      and coalesce(cr.situacao_boleto, '') not ilike 'cancelado%'
  ),
  dup_cr as (
    select vlr_tit, dt_venc_tit, cic
    from base
    group by vlr_tit, dt_venc_tit, cic
    having count(*) > 1
  ),
  unico as (
    select b.id, min(o."NUM_LANCAMENTO") as nl
    from base b
    join "OPEITE" o
      on o."VR_FACE" = b.vlr_tit
     and (o."DT_VENCI" = b.dt_venc_tit or o."DT_VENCI_NOVO" = b.dt_venc_tit)
    join "SACADO" s
      on s."COD_SACADO" = o."COD_SACADO"
     and regexp_replace(coalesce(s."CIC", ''), '\D', '', 'g') = b.cic
    where b.num_lanca is null
      and not exists (
        select 1 from dup_cr d
        where d.vlr_tit = b.vlr_tit and d.dt_venc_tit = b.dt_venc_tit and d.cic = b.cic
      )
    group by b.id
    having count(distinct o."NUM_LANCAMENTO") = 1
  )
  update capt_registrado cr
     set num_lanca = u.nl
    from unico u
   where cr.id = u.id
     and cr.num_lanca is null
     and not exists (select 1 from capt_registrado y where y.num_lanca = u.nl);
  get diagnostics v_count = row_count;

  -- Passo 2: duplicidade (chave repetida em capt_registrado ou mais de um lançamento na
  -- OPEITE). Desempata pelo número do documento x OPEITE.NUM_TITULO:
  --   classe 1 = dígitos iguais (ignora - / espaço e zeros à esquerda);
  --   classe 2 = variação de formato (parcela com/sem zero, parcela na frente: 1-189);
  --   classe 3 = só a base (um lado sem parcela).
  -- Vale a melhor classe; havendo mais de um lançamento nela, descarta STATUS 'DC'.
  -- Continua sem gravar quando: segue ambíguo, o documento não bate, dois ou mais boletos
  -- pendentes apontam o mesmo lançamento, ou o lançamento já está em outro boleto.
  with base as (
    select cr.id, cr.num_lanca, cr.vlr_tit, cr.dt_venc_tit, cr.num_doc_tit, cr.numero_documento,
           regexp_replace(coalesce(cr.cnpj_cpf_pagdr, ''), '\D', '', 'g') as cic
    from capt_registrado cr
    where cr.num_lanca is null
      and cr.vlr_tit is not null
      and cr.dt_venc_tit is not null
      and coalesce(cr.cnpj_cpf_pagdr, '') <> ''
      and coalesce(cr.situacao_boleto, '') not ilike 'cancelado%'
  ),
  cand as (
    select distinct b.id, o."NUM_LANCAMENTO" as nl, o."NUM_TITULO" as nt, trim(coalesce(o."STATUS", '')) as st
    from base b
    join "OPEITE" o
      on o."VR_FACE" = b.vlr_tit
     and (o."DT_VENCI" = b.dt_venc_tit or o."DT_VENCI_NOVO" = b.dt_venc_tit)
    join "SACADO" s
      on s."COD_SACADO" = o."COD_SACADO"
     and regexp_replace(coalesce(s."CIC", ''), '\D', '', 'g') = b.cic
  ),
  strs as (
    select distinct t from (
      select b.num_doc_tit as t from base b where exists (select 1 from cand c where c.id = b.id)
      union select b.numero_documento from base b where exists (select 1 from cand c where c.id = b.id)
      union select nt from cand
    ) x where t is not null
  ),
  tok as (
    select t, array(select x from unnest(regexp_split_to_array(t, '[^0-9]+')) x where x <> '') as arr
    from strs
  ),
  k as (
    select t, f as full,
      array_remove(array[
        f,
        case when n = 2 then ltrim(a, '0') || ltrim(b, '0') end,
        case when n = 2 then ltrim(a, '0') || lpad(ltrim(b, '0'), 2, '0') end,
        case when n = 2 then ltrim(b, '0') || ltrim(a, '0') end,
        case when n = 2 then ltrim(b, '0') || lpad(ltrim(a, '0'), 2, '0') end,
        case when n = 1 and length(f) >= 3 and substr(f, length(f) - 1, 1) = '0'
             then left(f, length(f) - 2) || right(f, 1) end,
        case when n = 1 and length(f) >= 2 then left(f, length(f) - 1) || '0' || right(f, 1) end
      ], null) as s,
      case when n >= 2
           then array_remove(array[ltrim(a, '0'), case when length(b) > length(a) then ltrim(b, '0') end], null)
           else array[]::text[] end as w
    from (
      select t, coalesce(array_length(arr, 1), 0) as n, arr[1] as a, arr[array_length(arr, 1)] as b,
             ltrim(array_to_string(arr, ''), '0') as f
      from tok
    ) z
  ),
  edges as (
    select p.id, c.nl, c.st,
      min(case when kc.full = ko.full then 1
               when kc.s && ko.s then 2
               when kc.full = any(ko.w) or ko.full = any(kc.w) then 3 end) as cls
    from base p
    join cand c on c.id = p.id
    join k ko on ko.t = c.nt and ko.full <> ''
    join k kc on kc.t in (p.num_doc_tit, p.numero_documento) and kc.full <> ''
    group by p.id, c.nl, c.st
  ),
  best as (select id, min(cls) as bc from edges where cls is not null group by id),
  pick as (
    select e.id, count(*) as n_all, count(*) filter (where e.st <> 'DC') as n_ndc,
           min(e.nl) filter (where e.st <> 'DC') as nl_ndc, min(e.nl) as nl_any
    from edges e join best b on b.id = e.id and e.cls = b.bc
    group by e.id
  ),
  res as (
    select id, case when n_all = 1 then nl_any when n_ndc = 1 then nl_ndc end as nl
    from pick
  ),
  ok as (
    select id, nl from (
      select r.id, r.nl, count(*) over (partition by r.nl) as n_mesmo from res r where r.nl is not null
    ) x
    where n_mesmo = 1
      and not exists (select 1 from capt_registrado y where y.num_lanca = x.nl)
  )
  update capt_registrado cr
     set num_lanca = ok.nl
    from ok
   where cr.id = ok.id
     and cr.num_lanca is null;
  get diagnostics v_count2 = row_count;

  return v_count + v_count2;
end $function$;
