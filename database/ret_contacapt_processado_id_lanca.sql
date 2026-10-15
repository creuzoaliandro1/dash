-- RET_CONTACAPT: colunas PROCESSADO e ID_LANCA (aplicada no Supabase em 2026-10-15
-- como migration "ret_contacapt_processado_id_lanca").

-- PROCESSADO: 'T' ou 'F'. Registros existentes = 'T'; novos entram como 'F'.
ALTER TABLE public."RET_CONTACAPT" ADD COLUMN "PROCESSADO" char(1);
UPDATE public."RET_CONTACAPT" SET "PROCESSADO" = 'T';
ALTER TABLE public."RET_CONTACAPT"
  ALTER COLUMN "PROCESSADO" SET DEFAULT 'F',
  ALTER COLUMN "PROCESSADO" SET NOT NULL,
  ADD CONSTRAINT ck_ret_contacapt_processado CHECK ("PROCESSADO" IN ('T', 'F'));

-- ID_LANCA: sequencial autoincremento. Existentes numerados na ordem de gravação.
ALTER TABLE public."RET_CONTACAPT" ADD COLUMN "ID_LANCA" bigint;
WITH ord AS (
  SELECT ctid, row_number() OVER (ORDER BY created_at, "RETORNO", ctid) AS n
  FROM public."RET_CONTACAPT"
)
UPDATE public."RET_CONTACAPT" r SET "ID_LANCA" = ord.n FROM ord WHERE r.ctid = ord.ctid;
ALTER TABLE public."RET_CONTACAPT" ALTER COLUMN "ID_LANCA" SET NOT NULL;
ALTER TABLE public."RET_CONTACAPT" ALTER COLUMN "ID_LANCA" ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(pg_get_serial_sequence('public."RET_CONTACAPT"', 'ID_LANCA'),
              (SELECT max("ID_LANCA") FROM public."RET_CONTACAPT"));
ALTER TABLE public."RET_CONTACAPT" ADD CONSTRAINT ux_ret_contacapt_id_lanca UNIQUE ("ID_LANCA");

-- Sem duplicidade de registro: hash_dedup já é único; passa a ser obrigatório
-- (NULL escaparia do índice único).
ALTER TABLE public."RET_CONTACAPT" ALTER COLUMN hash_dedup SET NOT NULL;

CREATE INDEX ix_ret_contacapt_processado ON public."RET_CONTACAPT" ("PROCESSADO") WHERE "PROCESSADO" = 'F';
