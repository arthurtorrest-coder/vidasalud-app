-- Sistema de calificaciones de consultas — VIDASALUD
-- Ejecutar en: Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES profiles(id),
  doctor_id      UUID        NOT NULL REFERENCES doctors(id),
  rating         SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comentario     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appointment_id, patient_id)   -- un paciente solo puede calificar una vez por cita
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Pacientes pueden insertar su propia reseña
CREATE POLICY "patient_insert_review" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- Cualquier usuario autenticado puede leer reseñas
CREATE POLICY "authenticated_read_reviews" ON reviews
  FOR SELECT TO authenticated
  USING (true);

-- ── Trigger: actualiza rating y total_reviews en doctors automáticamente ──

CREATE OR REPLACE FUNCTION update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE doctors
  SET
    rating        = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM reviews
      WHERE doctor_id = NEW.doctor_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews
      WHERE doctor_id = NEW.doctor_id
    )
  WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_doctor_rating ON reviews;
CREATE TRIGGER trg_update_doctor_rating
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_doctor_rating();

-- Índices
CREATE INDEX IF NOT EXISTS idx_reviews_doctor      ON reviews(doctor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_patient     ON reviews(patient_id);
CREATE INDEX IF NOT EXISTS idx_reviews_appointment ON reviews(appointment_id);
