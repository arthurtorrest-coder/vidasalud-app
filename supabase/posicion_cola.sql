-- Sala de espera virtual: posición en cola y hora de referencia
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS posicion_cola   INTEGER,
  ADD COLUMN IF NOT EXISTS hora_referencial TIME;

-- Índice para consultas rápidas de la cola del médico
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_cola
  ON appointments (doctor_id, posicion_cola)
  WHERE status IN ('pending', 'paid', 'active');

COMMENT ON COLUMN appointments.posicion_cola    IS 'Número de orden en la cola del médico ese día (1 = primero)';
COMMENT ON COLUMN appointments.hora_referencial IS 'Hora del turno elegida por el paciente al reservar (HH:MM)';
