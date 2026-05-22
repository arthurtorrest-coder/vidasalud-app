-- ============================================================
-- VIDASALUD — Tabla appointments + función get_booked_slots
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Idempotente: seguro de ejecutar varias veces.
-- ============================================================

-- 1. Función updated_at (no hace nada si ya existe)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabla appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID        NOT NULL REFERENCES public.profiles(id),
  doctor_id        UUID        NOT NULL REFERENCES public.doctors(id),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'paid', 'active', 'done', 'cancelled')),
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER     NOT NULL DEFAULT 20,
  chief_complaint  TEXT,
  notes_doctor     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evita doble reserva en el mismo horario con el mismo médico
ALTER TABLE public.appointments
  ADD CONSTRAINT IF NOT EXISTS appointments_doctor_slot_unique
  UNIQUE (doctor_id, scheduled_at);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_patient" ON public.appointments;
CREATE POLICY "appointments_select_patient"
  ON public.appointments FOR SELECT
  USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "appointments_select_doctor"  ON public.appointments;
CREATE POLICY "appointments_select_doctor"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors WHERE id = appointments.doctor_id AND id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appointments_insert_patient" ON public.appointments;
CREATE POLICY "appointments_insert_patient"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "appointments_update_status"  ON public.appointments;
CREATE POLICY "appointments_update_status"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

-- 4. Función get_booked_slots (SECURITY DEFINER para saltarse RLS y ver
--    todos los turnos ocupados, sin exponer datos del paciente)
CREATE OR REPLACE FUNCTION public.get_booked_slots(
  p_doctor_id UUID,
  p_date      DATE
)
RETURNS TABLE (slot_time TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TO_CHAR(
    scheduled_at AT TIME ZONE 'America/Lima',
    'HH24:MI'
  ) AS slot_time
  FROM public.appointments
  WHERE doctor_id      = p_doctor_id
    AND (scheduled_at AT TIME ZONE 'America/Lima')::DATE = p_date
    AND status         IN ('pending', 'paid', 'active');
$$;
