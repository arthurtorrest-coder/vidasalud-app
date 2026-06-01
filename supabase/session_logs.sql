-- Tabla de registro de sesiones de teleconsulta
-- Cumplimiento Ley 30421 — Ley de Receta Médica Electrónica
-- Ejecutar en: Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS session_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID        REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id         UUID        REFERENCES doctors(id),
  patient_id        UUID        REFERENCES profiles(id),
  inicio_sesion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fin_sesion        TIMESTAMPTZ,
  duracion_minutos  INTEGER,
  ip_medico         TEXT,
  ip_paciente       TEXT,
  estado            TEXT        NOT NULL DEFAULT 'iniciada'
                                CHECK (estado IN ('iniciada', 'completada', 'interrumpida')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;

-- La Edge Function usa service role y no necesita política
-- Los médicos autenticados pueden actualizar sus propias sesiones
CREATE POLICY "doctor_update_own_session" ON session_logs
  FOR UPDATE
  TO authenticated
  USING (
    doctor_id = auth.uid()
    OR doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  );

-- Usuarios autenticados (admin) pueden leer todas las sesiones
CREATE POLICY "authenticated_select_sessions" ON session_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_session_logs_appointment ON session_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_doctor      ON session_logs(doctor_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_inicio      ON session_logs(inicio_sesion DESC);
