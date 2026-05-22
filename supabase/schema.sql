-- ============================================================
-- VIDASALUD — Schema de base de datos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: profiles
-- Extiende auth.users para pacientes y médicos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN ('patient', 'doctor')),
  full_name    TEXT        NOT NULL,
  phone        TEXT,
  avatar_url   TEXT,
  dni          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: doctors
-- Información profesional del médico
-- ============================================================
CREATE TABLE IF NOT EXISTS public.doctors (
  id                UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty         TEXT        NOT NULL,
  cmp_code          TEXT        NOT NULL UNIQUE, -- CMP para médicos, CPsP para psicólogos
  bio               TEXT,
  consultation_fee  INTEGER     NOT NULL CHECK (consultation_fee > 0), -- en céntimos (S/. 35 = 3500)
  available_now     BOOLEAN     NOT NULL DEFAULT FALSE,
  rating            NUMERIC(3,2)NOT NULL DEFAULT 0.00 CHECK (rating BETWEEN 0 AND 5),
  review_count      INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: appointments
-- Citas médicas programadas o inmediatas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID        NOT NULL REFERENCES public.profiles(id),
  doctor_id        UUID        NOT NULL REFERENCES public.doctors(id),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'paid', 'active', 'done', 'cancelled')),
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER     NOT NULL DEFAULT 20,
  chief_complaint  TEXT,       -- motivo de consulta
  notes_doctor     TEXT,       -- notas privadas del médico
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: payments
-- Registro de cobros via Culqi
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   UUID        NOT NULL REFERENCES public.appointments(id),
  culqi_charge_id  TEXT        UNIQUE,
  amount           INTEGER     NOT NULL CHECK (amount > 0), -- en céntimos
  currency         TEXT        NOT NULL DEFAULT 'PEN',
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: rooms
-- Salas de videollamada Daily.co vinculadas a citas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   UUID        NOT NULL UNIQUE REFERENCES public.appointments(id),
  room_name        TEXT        NOT NULL UNIQUE,
  patient_token    TEXT,
  doctor_token     TEXT,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: prescriptions
-- Recetas electrónicas — válidas bajo Ley 30421
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   UUID        NOT NULL REFERENCES public.appointments(id),
  doctor_id        UUID        NOT NULL REFERENCES public.doctors(id),
  patient_id       UUID        NOT NULL REFERENCES public.profiles(id),
  diagnosis        TEXT        NOT NULL,
  -- medicines: [{ name, dose, frequency, days, notes }]
  medicines        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  indications      TEXT,
  valid_until      DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: reviews
-- Calificaciones de citas completadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   UUID        NOT NULL UNIQUE REFERENCES public.appointments(id),
  patient_id       UUID        NOT NULL REFERENCES public.profiles(id),
  doctor_id        UUID        NOT NULL REFERENCES public.doctors(id),
  rating           INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FUNCIÓN: actualizar rating de médico al agregar reseña
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.doctors
  SET
    rating       = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM public.reviews WHERE doctor_id = NEW.doctor_id),
    review_count = (SELECT COUNT(*) FROM public.reviews WHERE doctor_id = NEW.doctor_id)
  WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_doctor_rating
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_doctor_rating();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews      ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuario ve y edita solo su propio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- doctors: cualquier usuario autenticado puede ver la lista
CREATE POLICY "doctors_select_all"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (true);

-- appointments: paciente ve sus citas, médico ve las suyas
CREATE POLICY "appointments_select_patient"
  ON public.appointments FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "appointments_select_doctor"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors
      WHERE id = appointments.doctor_id AND id = auth.uid()
    )
  );

CREATE POLICY "appointments_insert_patient"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- payments: solo el paciente dueño de la cita
CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id AND a.patient_id = auth.uid()
    )
  );

-- rooms: solo los participantes de la cita
CREATE POLICY "rooms_select_participant"
  ON public.rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = rooms.appointment_id
        AND (a.patient_id = auth.uid() OR a.doctor_id = auth.uid())
    )
  );

-- prescriptions: paciente ve las suyas, médico las que emitió
CREATE POLICY "prescriptions_select_patient"
  ON public.prescriptions FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "prescriptions_select_doctor"
  ON public.prescriptions FOR SELECT
  USING (auth.uid() = doctor_id);

-- reviews: cualquier usuario autenticado puede leer reseñas
CREATE POLICY "reviews_select_all"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reviews_insert_patient"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- ============================================================
-- FUNCIÓN: crear perfil automáticamente al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
