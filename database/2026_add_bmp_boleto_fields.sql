-- Migration: alinhar capt_boletos ao padrão BMP "Registrar Boleto"
-- Ref: https://bmpdocs.moneyp.com.br/baas/referencias-de-api/boletos/55-registrar-boleto
-- Aplicada em: projeto ContaCapt (nkqiurrgrylrwvreybzh) em 2026-06-29.
-- Mantém a coluna 'juros' (juros diário auto-calculado) intacta; valor BMP em 'juros_valor'.
-- Reutiliza as colunas existentes 'multa' e 'desconto' como o VALOR (vlr) do item BMP.

ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS data_limite_pagamento DATE;            -- dtLimPgto
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS especie_titulo SMALLINT DEFAULT 2;       -- codEspTit (2 = DM)
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS numero_carteira SMALLINT DEFAULT 1;      -- numeroCarteira
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS valor_abatimento NUMERIC(15,2) DEFAULT 0;-- vlrAbatimento
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS tipo_registro SMALLINT DEFAULT 1;        -- tipoRegistro

ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS sacado_tipo_pessoa SMALLINT;             -- pagador.tipoPessoa (1 PF, 2 PJ)
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS sacado_numero TEXT;                       -- pagador.numero
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS sacado_complemento TEXT;                  -- pagador.complemento

ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS avalista_tipo SMALLINT;                   -- sacadorAvalista.tipo

-- Juros BMP (ItemCalculavelBoleto: data, codigo, vlr) — separado do juros diário existente
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS juros_codigo TEXT;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS juros_data DATE;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS juros_valor NUMERIC(15,2) DEFAULT 0;

-- Multa BMP (vlr reutiliza coluna 'multa')
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS multa_codigo TEXT;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS multa_data DATE;

-- Desconto principal BMP (vlr reutiliza coluna 'desconto')
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto_codigo TEXT;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto_data DATE;

-- Descontos adicionais (array descontos[] do BMP — faixas 2 e 3)
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto2_codigo TEXT;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto2_data DATE;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto2_valor NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto3_codigo TEXT;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto3_data DATE;
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS desconto3_valor NUMERIC(15,2) DEFAULT 0;

-- Campos retornados pelo BMP no registro do boleto (resposta de /api/Boleto/Registrar)
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS linha_digitavel TEXT;     -- numLinhaDigtvl
ALTER TABLE public.capt_boletos ADD COLUMN IF NOT EXISTS bmp_codigo_boleto UUID;   -- codigoBoleto
