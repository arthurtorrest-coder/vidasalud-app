-- Chat entre médico y paciente — VIDASALUD
-- Ejecutar en: Supabase Dashboard > SQL Editor

-- ── Tabla ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mensajes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  sender_id      UUID        NOT NULL REFERENCES profiles(id),
  sender_role    TEXT        NOT NULL CHECK (sender_role IN ('patient', 'doctor', 'admin')),
  contenido      TEXT        NOT NULL CHECK (length(trim(contenido)) > 0),
  leido          BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- Función auxiliar: verifica que el usuario sea paciente o médico de la cita
-- Soporta doctors.id = auth.uid() Y doctors.profile_id = auth.uid()
CREATE OR REPLACE FUNCTION is_chat_participant(appt_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id = appt_id
      AND (
        a.patient_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM doctors d
          WHERE d.id = a.doctor_id
            AND (d.id = auth.uid() OR d.profile_id = auth.uid())
        )
      )
  )
$$;

-- SELECT: paciente o médico de esa cita
CREATE POLICY "chat_participants_can_read" ON mensajes
  FOR SELECT TO authenticated
  USING (is_chat_participant(appointment_id));

-- INSERT: solo el participante puede enviar, y sender_id debe ser su propio uid
CREATE POLICY "chat_participants_can_insert" ON mensajes
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_participant(appointment_id)
  );

-- UPDATE: solo el receptor puede marcar como leído (leido = true, y no es su propio mensaje)
CREATE POLICY "recipient_can_mark_read" ON mensajes
  FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND is_chat_participant(appointment_id)
  )
  WITH CHECK (leido = true);

-- ── Realtime ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;

-- ── Índices ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mensajes_appointment ON mensajes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_sender      ON mensajes(sender_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_created     ON mensajes(appointment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mensajes_unread      ON mensajes(appointment_id, leido) WHERE leido = false;
