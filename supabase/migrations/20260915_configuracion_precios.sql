-- Configuración de precios editable desde el panel admin (AdminPrecios.jsx).
-- Fila única (id=1) — src/lib/finanzas.js la lee al iniciar la app y se
-- suscribe a cambios en tiempo real (postgres_changes) para mantenerse
-- sincronizada sin necesidad de recargar/redesplegar.

CREATE TABLE IF NOT EXISTS public.configuracion_precios (
  id                   INT         PRIMARY KEY DEFAULT 1,
  tarifa_general       NUMERIC     NOT NULL DEFAULT 15,
  margen_total         NUMERIC     NOT NULL DEFAULT 15,
  comision_botica      NUMERIC     NOT NULL DEFAULT 4,
  comision_coordinador NUMERIC     NOT NULL DEFAULT 2,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT configuracion_precios_singleton CHECK (id = 1)
);

INSERT INTO public.configuracion_precios (id, tarifa_general, margen_total, comision_botica, comision_coordinador)
VALUES (1, 15, 15, 4, 2)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_updated_at_configuracion_precios()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_configuracion_precios_updated_at ON public.configuracion_precios;
CREATE TRIGGER trg_configuracion_precios_updated_at
  BEFORE UPDATE ON public.configuracion_precios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_configuracion_precios();

ALTER TABLE public.configuracion_precios ENABLE ROW LEVEL SECURITY;

-- Lectura pública: Landing y Especialidades muestran precios sin sesión iniciada.
DROP POLICY IF EXISTS "configuracion_precios_select_public" ON public.configuracion_precios;
CREATE POLICY "configuracion_precios_select_public" ON public.configuracion_precios
  FOR SELECT
  USING (true);

-- Escritura: solo admins (mismo patrón que coordinadores/planes_corporativos).
DROP POLICY IF EXISTS "configuracion_precios_admin_update" ON public.configuracion_precios;
CREATE POLICY "configuracion_precios_admin_update" ON public.configuracion_precios
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- NOTA: para que la suscripción realtime de finanzas.js reciba los UPDATE,
-- habilitar "Realtime" para esta tabla desde el dashboard de Supabase
-- (Database → Replication), igual que se hizo para appointments/solicitudes_turno.
