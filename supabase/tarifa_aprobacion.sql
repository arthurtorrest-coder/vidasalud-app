-- VIDASALUD — Columnas para aprobación de tarifas de médicos
-- Ejecutar en: Supabase Dashboard > SQL Editor

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS precio_propuesto            NUMERIC,
  ADD COLUMN IF NOT EXISTS precio_pendiente_aprobacion BOOLEAN NOT NULL DEFAULT false;
