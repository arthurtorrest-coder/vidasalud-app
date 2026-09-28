-- =========================================================
-- Tabla: doctor_push_tokens
-- Soporta múltiples suscripciones push por médico (una por
-- dispositivo/navegador), reemplazando la columna única
-- doctors.push_token (ver 20260802_doctors_push_token.sql).
-- Corre este script en el SQL Editor de Supabase
-- =========================================================

CREATE TABLE IF NOT EXISTS public.doctor_push_tokens (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id   UUID        NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  push_token  JSONB       NOT NULL, -- { endpoint, keys: { p256dh, auth } }
  endpoint    TEXT        GENERATED ALWAYS AS (push_token ->> 'endpoint') STORED,
  device_info TEXT,                 -- ej: "Chrome/Desktop", "Safari/iPhone"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpt_doctor ON public.doctor_push_tokens(doctor_id);

-- Un mismo endpoint de suscripción no puede repetirse para el mismo médico
-- (columna generada `endpoint`, no expresión, para que el upsert con
-- onConflict del cliente de Supabase pueda apuntar a ella).
CREATE UNIQUE INDEX IF NOT EXISTS idx_dpt_doctor_endpoint
  ON public.doctor_push_tokens (doctor_id, endpoint);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.doctor_push_tokens ENABLE ROW LEVEL SECURITY;

-- Médico: gestionar únicamente sus propios tokens
-- (doctors.id puede ser el propio auth.uid(), o el médico puede estar
-- enlazado vía doctors.profile_id — mismo patrón usado en solicitudes_turno).
CREATE POLICY "dpt_medico_select" ON public.doctor_push_tokens
  FOR SELECT USING (
    doctor_id IN (
      SELECT id FROM public.doctors
      WHERE id = auth.uid() OR profile_id = auth.uid()
    )
  );

CREATE POLICY "dpt_medico_insert" ON public.doctor_push_tokens
  FOR INSERT WITH CHECK (
    doctor_id IN (
      SELECT id FROM public.doctors
      WHERE id = auth.uid() OR profile_id = auth.uid()
    )
  );

CREATE POLICY "dpt_medico_update" ON public.doctor_push_tokens
  FOR UPDATE USING (
    doctor_id IN (
      SELECT id FROM public.doctors
      WHERE id = auth.uid() OR profile_id = auth.uid()
    )
  );

CREATE POLICY "dpt_medico_delete" ON public.doctor_push_tokens
  FOR DELETE USING (
    doctor_id IN (
      SELECT id FROM public.doctors
      WHERE id = auth.uid() OR profile_id = auth.uid()
    )
  );

-- Admin: acceso total
CREATE POLICY "dpt_admin_all" ON public.doctor_push_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Nota: supabase/functions/notificar-turno-medicos usa el service role key,
-- que ignora RLS — no necesita una política propia para leer todos los tokens.

-- ── Migrar suscripciones existentes ──────────────────────────────────
-- doctors.push_token queda en desuso (legacy) pero no se elimina la columna
-- para no romper nada que aún la lea; sus datos se copian una sola vez acá.
INSERT INTO public.doctor_push_tokens (doctor_id, push_token, device_info)
SELECT id, push_token, 'migrado desde doctors.push_token'
FROM public.doctors
WHERE push_token IS NOT NULL
ON CONFLICT (doctor_id, endpoint) DO NOTHING;
