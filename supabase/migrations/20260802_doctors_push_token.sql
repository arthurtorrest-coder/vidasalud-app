-- =========================================================
-- Agregar columna push_token a la tabla doctors
-- Almacena la suscripción Web Push del médico (JSON)
-- Formato: { endpoint, keys: { p256dh, auth } }
-- =========================================================

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS push_token JSONB;

-- Solo el propio médico puede leer/escribir su push_token
-- (la columna ya queda cubierta por las políticas RLS existentes
-- de la tabla doctors — no se necesita política adicional)
