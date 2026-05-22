-- ============================================================
-- VIDASALUD — Tabla doctors standalone + datos de prueba
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- IMPORTANTE: si ya ejecutaste el schema.sql original, este
-- script reemplazará la tabla doctors (DROP CASCADE elimina
-- los FK en appointments, prescriptions y reviews, pero no
-- las tablas en sí). Puedes ignorar los warnings de FK.
-- ============================================================

-- 1. Reemplazar tabla (por si existe la versión del schema.sql)
DROP TABLE IF EXISTS public.doctors CASCADE;

CREATE TABLE public.doctors (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres       TEXT         NOT NULL,
  apellidos     TEXT         NOT NULL,
  especialidad  TEXT         NOT NULL,
  cmp           TEXT         NOT NULL UNIQUE,
  precio        INTEGER      NOT NULL CHECK (precio > 0),  -- soles enteros
  rating        NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (rating BETWEEN 0 AND 5),
  total_reviews INTEGER      NOT NULL DEFAULT 0,
  foto_url      TEXT,
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Row Level Security — solo usuarios autenticados leen médicos activos
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors_select_activos"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (activo = true);

-- 3. Datos de prueba — los 4 médicos del MVP
INSERT INTO public.doctors (nombres, apellidos, especialidad, cmp, precio, rating, total_reviews, activo)
VALUES
  ('Valeria', 'Torres',  'Medicina general',  'CMP 48291', 35, 4.90, 127, true),
  ('Roberto', 'Muro',    'Pediatría',          'CMP 51034', 45, 4.80,  89, true),
  ('Laura',   'Pizarro', 'Psicología clínica', 'CPsP 9821', 50, 5.00,  64, true),
  ('Miguel',  'Quispe',  'Cardiología',        'CMP 39204', 70, 4.70, 201, true);
