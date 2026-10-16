-- =========================================================
-- Tabla: solicitudes_soporte
-- Sistema de reclamos/reembolsos/reprogramaciones del paciente
-- (src/pages/Citas, src/screens/Paciente/MisReclamos.jsx,
-- src/screens/Admin/AdminSoporte.jsx)
-- Corre este script en el SQL Editor de Supabase
-- =========================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_soporte (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID        NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  appointment_id  UUID                 REFERENCES public.appointments(id) ON DELETE SET NULL,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('reembolso', 'reprogramacion', 'reclamo')),
  motivo          TEXT        NOT NULL,
  descripcion     TEXT,
  estado          TEXT        NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN ('pendiente', 'en_proceso', 'resuelto', 'rechazado')),
  respuesta_admin TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_patient     ON public.solicitudes_soporte(patient_id);
CREATE INDEX IF NOT EXISTS idx_ss_appointment ON public.solicitudes_soporte(appointment_id);
CREATE INDEX IF NOT EXISTS idx_ss_estado      ON public.solicitudes_soporte(estado);

-- ── updated_at automático ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at_solicitudes_soporte()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solicitudes_soporte_updated_at ON public.solicitudes_soporte;
CREATE TRIGGER trg_solicitudes_soporte_updated_at
  BEFORE UPDATE ON public.solicitudes_soporte
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_solicitudes_soporte();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.solicitudes_soporte ENABLE ROW LEVEL SECURITY;

-- Paciente: ver y crear únicamente sus propias solicitudes. No puede
-- editarlas después de creadas (estado/respuesta_admin son terreno del
-- admin) — si necesita corregir algo, crea un reclamo nuevo.
DROP POLICY IF EXISTS "ss_paciente_select" ON public.solicitudes_soporte;
CREATE POLICY "ss_paciente_select" ON public.solicitudes_soporte
  FOR SELECT USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "ss_paciente_insert" ON public.solicitudes_soporte;
CREATE POLICY "ss_paciente_insert" ON public.solicitudes_soporte
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Admin: acceso total (ver todas, marcar en_proceso/resuelto/rechazado,
-- escribir respuesta_admin).
DROP POLICY IF EXISTS "ss_admin_all" ON public.solicitudes_soporte;
CREATE POLICY "ss_admin_all" ON public.solicitudes_soporte
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Realtime ────────────────────────────────────────────────────────
-- Para que el badge de solicitudes pendientes en PanelAdmin se actualice
-- en vivo sin necesidad de refrescar la página.
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes_soporte;
