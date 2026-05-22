-- VIDASALUD: schema completo, idempotente
-- Ejecutar en Supabase Dashboard > SQL Editor

-- Funcion auxiliar updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabla profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'patient'
                          CHECK (role IN ('patient', 'doctor', 'admin')),
  full_name   TEXT        NOT NULL DEFAULT '',
  phone       TEXT,
  dni         TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Funcion para crear perfil automaticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'patient'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill para usuarios auth ya existentes
INSERT INTO public.profiles (id, full_name, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  'patient'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Tabla appointments
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

-- Restriccion unica doctor+horario, idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_doctor_slot_unique'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_doctor_slot_unique
      UNIQUE (doctor_id, scheduled_at);
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_patient" ON public.appointments;
CREATE POLICY "appointments_select_patient"
  ON public.appointments FOR SELECT
  USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "appointments_select_doctor" ON public.appointments;
CREATE POLICY "appointments_select_doctor"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors
      WHERE id = appointments.doctor_id
        AND id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appointments_insert_patient" ON public.appointments;
CREATE POLICY "appointments_insert_patient"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "appointments_update_status" ON public.appointments;
CREATE POLICY "appointments_update_status"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

-- Funcion get_booked_slots con SECURITY DEFINER
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
  WHERE doctor_id  = p_doctor_id
    AND (scheduled_at AT TIME ZONE 'America/Lima')::DATE = p_date
    AND status      IN ('pending', 'paid', 'active');
$$;
