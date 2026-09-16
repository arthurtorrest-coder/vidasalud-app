-- Precio por especialidad, editable desde el panel admin (AdminPrecios.jsx).
-- precio_total es una columna generada: precio_medico + margen fijo de la
-- clínica (S/. 15) — a diferencia de configuracion_precios.margen_total
-- (que es el margen general de Medicina General y puede variar), acá el
-- margen por especialidad se definió como fijo según lo solicitado.

CREATE TABLE IF NOT EXISTS public.especialidades_precios (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  especialidad  TEXT        NOT NULL UNIQUE,
  precio_medico NUMERIC     NOT NULL CHECK (precio_medico >= 0),
  precio_total  NUMERIC     GENERATED ALWAYS AS (precio_medico + 15) STORED,
  activo        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.especialidades_precios (especialidad, precio_medico) VALUES
  ('Medicina General',     15),
  ('Pediatría',            30),
  ('Psicología',           35),
  ('Ginecología',          40),
  ('Medicina Interna',     35),
  ('Nutrición',            30),
  ('Dermatología',         40),
  ('Medicina Ocupacional', 45)
ON CONFLICT (especialidad) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_updated_at_especialidades_precios()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_especialidades_precios_updated_at ON public.especialidades_precios;
CREATE TRIGGER trg_especialidades_precios_updated_at
  BEFORE UPDATE ON public.especialidades_precios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_especialidades_precios();

ALTER TABLE public.especialidades_precios ENABLE ROW LEVEL SECURITY;

-- Lectura pública: Landing/Especialidades pueden mostrar precios sin sesión.
DROP POLICY IF EXISTS "especialidades_precios_select_public" ON public.especialidades_precios;
CREATE POLICY "especialidades_precios_select_public" ON public.especialidades_precios
  FOR SELECT
  USING (true);

-- Escritura: solo admins.
DROP POLICY IF EXISTS "especialidades_precios_admin_update" ON public.especialidades_precios;
CREATE POLICY "especialidades_precios_admin_update" ON public.especialidades_precios
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- NOTA: habilitar "Realtime" para esta tabla desde el dashboard de Supabase
-- (Database → Replication) para que suscribirEspecialidadesPrecios() en
-- src/lib/finanzas.js reciba los cambios en vivo.
