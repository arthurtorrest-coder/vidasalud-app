-- ============================================================
-- VIDASALUD — Horarios semanales de médicos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.doctor_schedules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID        NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  dia_semana  SMALLINT    NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=dom … 6=sáb
  hora_inicio TIME        NOT NULL,
  hora_fin    TIME        NOT NULL,
  activo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_horas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_lookup
  ON public.doctor_schedules (doctor_id, dia_semana, activo);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede leer los horarios (necesario para Booking)
CREATE POLICY "schedules_select_all"
  ON public.doctor_schedules FOR SELECT
  TO authenticated
  USING (true);

-- Solo el médico dueño puede insertar sus bloques (soporta ambos schemas)
CREATE POLICY "schedules_insert_doctor"
  ON public.doctor_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_id
        AND (d.id = auth.uid() OR d.profile_id = auth.uid())
    )
  );

CREATE POLICY "schedules_update_doctor"
  ON public.doctor_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_id
        AND (d.id = auth.uid() OR d.profile_id = auth.uid())
    )
  );

CREATE POLICY "schedules_delete_doctor"
  ON public.doctor_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_id
        AND (d.id = auth.uid() OR d.profile_id = auth.uid())
    )
  );
