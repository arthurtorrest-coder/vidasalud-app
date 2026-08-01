-- =========================================================
-- Tabla: solicitudes_turno
-- Sistema de turno de guardia para Medicina General
-- Corre este script en el SQL Editor de Supabase
-- =========================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_turno (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id     UUID        NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  doctor_id      UUID                 REFERENCES public.doctors(id)      ON DELETE SET NULL,
  appointment_id UUID                 REFERENCES public.appointments(id) ON DELETE SET NULL,
  status         TEXT        NOT NULL DEFAULT 'pendiente'
                             CHECK (status IN ('pendiente', 'tomada', 'expirada', 'completada')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  notificado     BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_st_patient ON public.solicitudes_turno(patient_id);
CREATE INDEX IF NOT EXISTS idx_st_status  ON public.solicitudes_turno(status);
CREATE INDEX IF NOT EXISTS idx_st_expires ON public.solicitudes_turno(expires_at);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.solicitudes_turno ENABLE ROW LEVEL SECURITY;

-- Paciente: leer sus propias solicitudes
CREATE POLICY "st_paciente_select" ON public.solicitudes_turno
  FOR SELECT USING (auth.uid() = patient_id);

-- Paciente: crear sus propias solicitudes
CREATE POLICY "st_paciente_insert" ON public.solicitudes_turno
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Paciente: cancelar sus propias solicitudes (status → 'expirada')
CREATE POLICY "st_paciente_update" ON public.solicitudes_turno
  FOR UPDATE USING (auth.uid() = patient_id);

-- Médico: leer todas las pendientes (para tomar turno) y las que ya tomó
CREATE POLICY "st_medico_select" ON public.solicitudes_turno
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'doctor'
    )
    AND (
      status = 'pendiente'
      OR doctor_id IN (
        SELECT id FROM public.doctors
        WHERE id = auth.uid() OR profile_id = auth.uid()
      )
    )
  );

-- Médico: actualizar solicitudes (tomar turno)
CREATE POLICY "st_medico_update" ON public.solicitudes_turno
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'doctor'
    )
  );

-- Admin: acceso total
CREATE POLICY "st_admin_all" ON public.solicitudes_turno
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── Función de expiración automática (opcional, ejecutar como cron) ──
-- Puedes crear un cron job en Supabase con este query:
--   UPDATE public.solicitudes_turno
--   SET status = 'expirada'
--   WHERE status = 'pendiente' AND expires_at < NOW();
