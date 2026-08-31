-- =========================================================
-- VIDASALUD — Link público de descarga de receta (sin login)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =========================================================

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT gen_random_uuid();

-- Backfill: el DEFAULT solo aplica a filas nuevas
UPDATE public.prescriptions
  SET access_token = gen_random_uuid()
  WHERE access_token IS NULL;

ALTER TABLE public.prescriptions
  ALTER COLUMN access_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_access_token
  ON public.prescriptions (access_token);

-- NOTA DE SEGURIDAD: a propósito NO se agrega ninguna política RLS pública
-- de SELECT sobre esta tabla. Una política como
--   USING (access_token IS NOT NULL)
-- no restringe nada por el token que el cliente envía en su query — solo
-- controla qué FILAS son visibles. Con esa política, cualquiera podría
-- hacer `select('*')` sin filtro y descargar la tabla completa de recetas.
--
-- El acceso público real pasa por la Edge Function receta-publica (service_role),
-- que busca una sola fila por access_token exacto y solo devuelve los campos
-- necesarios para mostrar la receta — nunca permite listar ni enumerar.
