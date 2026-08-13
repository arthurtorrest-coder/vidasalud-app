-- =========================================================
-- REPLICA IDENTITY FULL en appointments
-- Necesario para que los filtros de Supabase Realtime
-- (doctor_id=eq.X) funcionen correctamente en eventos UPDATE.
-- Sin esto, el WAL solo incluye la PK y el filtro no coincide.
-- Corre este script en el SQL Editor de Supabase.
-- =========================================================
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
