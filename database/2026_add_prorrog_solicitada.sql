-- Remessa Prorrogação (Sincronizar): marca que a prorrogação do título já foi
-- solicitada ao banco (data/hora da remessa e novo vencimento pedido). O título
-- continua na lista "Registros com prorrogação" até o vencimento em
-- capt_registrado ser de fato atualizado.
ALTER TABLE public.capt_registrado ADD COLUMN IF NOT EXISTS prorrog_solicitada_em TIMESTAMPTZ;
ALTER TABLE public.capt_registrado ADD COLUMN IF NOT EXISTS prorrog_solicitada_venc DATE;
