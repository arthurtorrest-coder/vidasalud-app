-- ================================================================
-- VIDASALUD — Farmacia puede leer citas de sus pacientes referidos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. La farmacia puede LEER citas de sus pacientes referidos
--    (necesario para que Payment.jsx cargue la cita al abrir /farmacia/pago/:id)
CREATE POLICY IF NOT EXISTS "farmacia_lee_citas_pacientes_referidos"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   farmacias f
      JOIN   profiles  p ON p.farmacia_referente_id = f.id
      WHERE  f.profile_id = auth.uid()
        AND  p.id         = appointments.patient_id
        AND  f.aprobado   = true
    )
  );

-- 2. La farmacia puede ACTUALIZAR citas de sus pacientes referidos
--    (necesario para que handlePay() en Payment.jsx cambie status → 'paid')
--    Sin esta política el UPDATE devuelve 200 OK pero no modifica ninguna fila.
CREATE POLICY IF NOT EXISTS "farmacia_actualiza_citas_pacientes_referidos"
  ON public.appointments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   farmacias f
      JOIN   profiles  p ON p.farmacia_referente_id = f.id
      WHERE  f.profile_id = auth.uid()
        AND  p.id         = appointments.patient_id
        AND  f.aprobado   = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   farmacias f
      JOIN   profiles  p ON p.farmacia_referente_id = f.id
      WHERE  f.profile_id = auth.uid()
        AND  p.id         = appointments.patient_id
        AND  f.aprobado   = true
    )
  );
