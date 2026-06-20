-- ================================================================
-- VIDASALUD — Citas creadas por farmacia
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Idempotente: seguro de ejecutar varias veces.
-- ================================================================

-- 1. Columna para rastrear qué farmacia agendó ESTA cita específica
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS farmacia_referente_id UUID
    REFERENCES farmacias(id) ON DELETE SET NULL;

-- 2. Columna precio_total si no existe aún
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS precio_total NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_appointments_farmacia_ref
  ON public.appointments (farmacia_referente_id)
  WHERE farmacia_referente_id IS NOT NULL;

-- 3. RLS: la farmacia puede insertar citas para sus pacientes referidos
CREATE POLICY IF NOT EXISTS "farmacia_inserta_citas"
  ON public.appointments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM farmacias f
      JOIN profiles p ON p.farmacia_referente_id = f.id
      WHERE f.profile_id = auth.uid()
        AND p.id = appointments.patient_id
        AND f.aprobado = true
    )
  );

COMMENT ON COLUMN appointments.farmacia_referente_id IS
  'Farmacia que agendó esta cita en nombre del paciente. NULL si el paciente la agendó directamente.';
