-- =========================================================
-- Tabla: slots_reservados
-- Permite al médico bloquear manualmente slots de 15 minutos
-- dentro de su horario (ej. para trámites, almuerzo puntual, etc.)
-- sin necesidad de modificar doctor_schedules.
-- Corre este script en el SQL Editor de Supabase
-- =========================================================

CREATE TABLE IF NOT EXISTS public.slots_reservados (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id   UUID        NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  fecha       DATE        NOT NULL,
  hora_inicio TIME        NOT NULL,
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un médico no puede reservar dos veces el mismo slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_sr_doctor_fecha_hora
  ON public.slots_reservados (doctor_id, fecha, hora_inicio);

CREATE INDEX IF NOT EXISTS idx_sr_doctor_fecha ON public.slots_reservados(doctor_id, fecha);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.slots_reservados ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer los slots reservados de
-- cualquier médico — igual que ya ocurre con appointments.scheduled_at,
-- necesario para que Booking.jsx calcule qué horarios están disponibles.
CREATE POLICY "sr_select_authenticated" ON public.slots_reservados
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Médico: crear/eliminar únicamente sus propios slots
-- (doctors.id puede ser el propio auth.uid(), o el médico puede estar
-- enlazado vía doctors.profile_id — mismo patrón usado en otras tablas).
CREATE POLICY "sr_medico_insert" ON public.slots_reservados
  FOR INSERT WITH CHECK (
    doctor_id IN (
      SELECT id FROM public.doctors
      WHERE id = auth.uid() OR profile_id = auth.uid()
    )
  );

CREATE POLICY "sr_medico_delete" ON public.slots_reservados
  FOR DELETE USING (
    doctor_id IN (
      SELECT id FROM public.doctors
      WHERE id = auth.uid() OR profile_id = auth.uid()
    )
  );

-- Admin: acceso total
CREATE POLICY "sr_admin_all" ON public.slots_reservados
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
