-- ============================================================
-- Criar tabela capt_boletos_anexos
-- Para armazenar metadados dos arquivos anexados
-- ============================================================

CREATE TABLE IF NOT EXISTS public.capt_boletos_anexos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  boleto_id UUID NOT NULL REFERENCES public.capt_boletos(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho_bytes BIGINT,
  caminho_storage TEXT NOT NULL,
  data_upload TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_capt_boletos_anexos_boleto_id
  ON public.capt_boletos_anexos(boleto_id);

CREATE INDEX IF NOT EXISTS idx_capt_boletos_anexos_data_upload
  ON public.capt_boletos_anexos(data_upload);

-- Habilitar RLS
ALTER TABLE public.capt_boletos_anexos ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Users can view their anexos"
  ON public.capt_boletos_anexos FOR SELECT
  USING (true);

CREATE POLICY "Users can insert anexos"
  ON public.capt_boletos_anexos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete anexos"
  ON public.capt_boletos_anexos FOR DELETE
  USING (true);

-- ============================================================
-- ✅ Tabela criada com sucesso!
-- ============================================================
