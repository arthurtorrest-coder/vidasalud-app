-- ================================================================
-- VIDASALUD — Farmacia puede leer citas de sus pacientes referidos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- La farmacia necesita leer la cita para mostrar el checkout de pago
-- cuando agenda una cita en nombre de un paciente.
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
