-- Guarda el id del cargo real de Culqi en cada cita pagada, para
-- reconciliación y soporte (ver supabase/functions/procesar-pago-culqi).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS culqi_charge_id TEXT;
