-- Completa o endereço do pagador em capt_registrado e capt_boletos a partir de
-- outras fontes, casando por CPF/CNPJ (só dígitos). Só preenche campos VAZIOS
-- (nunca sobrescreve). Fontes, em ordem de preferência: capt_registrado (outros
-- títulos do mesmo pagador), backups de capt_registrado (23/09 e 28/09),
-- capt_boletos, REMESSAS, SACADO. Por título escolhe UMA fonte: primeiro a de
-- mesmo CEP, depois a de maior prioridade, depois a que tem número.
-- RET_CONTACAPT* não entram: o retorno CNAB400 não traz endereço do pagador.
-- Reexecutável (a importação do relatório BMP recria capt_registrado e chama
-- esta função no final — importContaRegistradoFile).
-- Aplicada no Supabase em 2026-10-15 (migration "preencher_endereco_pagador").
-- Antes da 1ª execução, os valores originais foram salvos em
-- backup_endereco_pagador_20261015.
CREATE OR REPLACE FUNCTION public.preencher_endereco_pagador()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_reg integer; v_bol integer;
begin
  create temp table _end_cand on commit drop as
  select * from (
    select 1 prio, regexp_replace(coalesce(cnpj_cpf_pagdr,''),'\D','','g') cic, regexp_replace(coalesce(cep_pagdr,''),'\D','','g') cep,
           nullif(trim(lograd_pagdr),'') lograd, nullif(trim(numero_endereco_pagdr),'') num, nullif(trim(complemento_endereco_pagdr),'') compl,
           null::text bairro, nullif(trim(cid_pagdr),'') cid, nullif(trim(uf_pagdr),'') uf
      from capt_registrado
    union all
    select 2, regexp_replace(coalesce(cnpj_cpf_pagdr,''),'\D','','g'), regexp_replace(coalesce(cep_pagdr,''),'\D','','g'),
           nullif(trim(lograd_pagdr),''), nullif(trim(numero_endereco_pagdr),''), nullif(trim(complemento_endereco_pagdr),''),
           null, nullif(trim(cid_pagdr),''), nullif(trim(uf_pagdr),'')
      from capt_registrado_backup_20260928
    union all
    select 2, regexp_replace(coalesce(cnpj_cpf_pagdr,''),'\D','','g'), regexp_replace(coalesce(cep_pagdr,''),'\D','','g'),
           nullif(trim(lograd_pagdr),''), nullif(trim(numero_endereco_pagdr),''), nullif(trim(complemento_endereco_pagdr),''),
           null, nullif(trim(cid_pagdr),''), nullif(trim(uf_pagdr),'')
      from capt_registrado_backup_20260923
    union all
    select 3, regexp_replace(coalesce(sacado_cic,''),'\D','','g'), regexp_replace(coalesce(sacado_cep,''),'\D','','g'),
           nullif(trim(sacado_endereco),''), nullif(trim(sacado_numero),''), nullif(trim(sacado_complemento),''),
           nullif(trim(sacado_bairro),''), nullif(trim(sacado_cidade),''), nullif(trim(sacado_uf),'')
      from capt_boletos
    union all
    select 4, regexp_replace(coalesce("SACADO_CIC"::text,''),'\D','','g'), regexp_replace(coalesce("SACADO_CEP"::text,''),'\D','','g'),
           nullif(trim("SACADO_ENDERECO"::text),''), null, null,
           nullif(trim("SACADO_BAIRRO"::text),''), nullif(trim("SACADO_CIDADE"::text),''), nullif(trim("SACADO_UF"::text),'')
      from "REMESSAS"
    union all
    select 5, regexp_replace(coalesce("CIC",''),'\D','','g'), regexp_replace(coalesce("CEP",''),'\D','','g'),
           nullif(trim("ENDERECO"),''), null, null,
           nullif(trim("BAIRRO"),''), nullif(trim("CIDADE"),''), nullif(trim("UF"),'')
      from "SACADO"
  ) c
  where cic <> '' and lograd is not null and cid is not null and uf is not null and cep <> '';

  -- capt_registrado
  with alvo as (
    select id, regexp_replace(coalesce(cnpj_cpf_pagdr,''),'\D','','g') cic, regexp_replace(coalesce(cep_pagdr,''),'\D','','g') cep
      from capt_registrado
     where coalesce(trim(cep_pagdr),'') = '' or coalesce(trim(lograd_pagdr),'') = ''
        or coalesce(trim(cid_pagdr),'') = '' or coalesce(trim(uf_pagdr),'') = ''
  ),
  esc as (
    select distinct on (a.id) a.id, g.*
      from alvo a join _end_cand g on g.cic = a.cic
     order by a.id, (g.cep = a.cep) desc, g.prio, (g.num is not null) desc
  )
  update capt_registrado r set
    cep_pagdr                  = coalesce(nullif(trim(r.cep_pagdr),''), e.cep),
    lograd_pagdr               = coalesce(nullif(trim(r.lograd_pagdr),''), e.lograd),
    numero_endereco_pagdr      = coalesce(nullif(trim(r.numero_endereco_pagdr),''), e.num),
    complemento_endereco_pagdr = coalesce(nullif(trim(r.complemento_endereco_pagdr),''), e.compl),
    cid_pagdr                  = coalesce(nullif(trim(r.cid_pagdr),''), e.cid),
    uf_pagdr                   = coalesce(nullif(trim(r.uf_pagdr),''), e.uf)
  from esc e where r.id = e.id;
  get diagnostics v_reg = row_count;

  -- capt_boletos
  with alvo as (
    select id, regexp_replace(coalesce(sacado_cic,''),'\D','','g') cic, regexp_replace(coalesce(sacado_cep,''),'\D','','g') cep
      from capt_boletos
     where coalesce(trim(sacado_cep),'') = '' or coalesce(trim(sacado_endereco),'') = ''
        or coalesce(trim(sacado_cidade),'') = '' or coalesce(trim(sacado_uf),'') = ''
  ),
  esc as (
    select distinct on (a.id) a.id, g.*
      from alvo a join _end_cand g on g.cic = a.cic
     order by a.id, (g.cep = a.cep) desc, g.prio, (g.num is not null) desc
  )
  update capt_boletos b set
    sacado_cep         = coalesce(nullif(trim(b.sacado_cep),''), e.cep),
    sacado_endereco    = coalesce(nullif(trim(b.sacado_endereco),''), e.lograd),
    sacado_numero      = coalesce(nullif(trim(b.sacado_numero),''), e.num),
    sacado_complemento = coalesce(nullif(trim(b.sacado_complemento),''), e.compl),
    sacado_bairro      = coalesce(nullif(trim(b.sacado_bairro),''), e.bairro),
    sacado_cidade      = coalesce(nullif(trim(b.sacado_cidade),''), e.cid),
    sacado_uf          = coalesce(nullif(trim(b.sacado_uf),''), e.uf)
  from esc e where b.id = e.id;
  get diagnostics v_bol = row_count;

  return json_build_object('capt_registrado', v_reg, 'capt_boletos', v_bol);
end $function$;
