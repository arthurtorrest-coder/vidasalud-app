-- VIDASALUD — Columnas extendidas para recetas electrónicas
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Agrega pdf_url y verification_code si todavía no existen en prescriptions.
-- También agrega la política de INSERT para que el médico pueda guardar recetas.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS pdf_url            TEXT,
  ADD COLUMN IF NOT EXISTS verification_code  TEXT;

-- Médico puede insertar recetas de sus propias citas
DROP POLICY IF EXISTS "prescriptions_insert_doctor" ON public.prescriptions;
CREATE POLICY "prescriptions_insert_doctor"
  ON public.prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id = appointment_id
        AND doctor_id = (
          SELECT id FROM public.doctors WHERE id = auth.uid()
          UNION
          SELECT id FROM public.doctors WHERE profile_id = auth.uid()
          LIMIT 1
        )
    )
  );
