-- ================================================================
-- VIDASALUD — Sistema de coordinadores de zona
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- ============================================================
-- TABLA: coordinadores
-- Persona que capta y da seguimiento a boticas de una zona
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coordinadores (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  nombres        TEXT        NOT NULL,
  apellidos      TEXT        NOT NULL,
  zona_principal TEXT,
  activo         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coordinadores_profile_id
  ON public.coordinadores (profile_id);

-- ============================================================
-- farmacias: cada botica puede pertenecer a un coordinador
-- ============================================================
ALTER TABLE public.farmacias
  ADD COLUMN IF NOT EXISTS coordinador_id UUID REFERENCES public.coordinadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_farmacias_coordinador_id
  ON public.farmacias (coordinador_id);

-- ============================================================
-- Agregar rol 'coordinador' al constraint de profiles
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'admin', 'farmacia', 'corporativo', 'coordinador'));

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.coordinadores ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "coordinadores_admin_all"
  ON public.coordinadores FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- El propio coordinador puede leer su registro (para su panel)
CREATE POLICY "coordinadores_self_read"
  ON public.coordinadores FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

-- Service role: acceso total (Edge Functions)
CREATE POLICY "coordinadores_service_all"
  ON public.coordinadores FOR ALL
  USING (auth.role() = 'service_role');

-- ── farmacias: coordinador lee sus propias boticas, admin lee todo ──
-- (no existía ninguna política que permitiera al admin leer TODAS las
-- boticas — solo las aprobadas/activas o las propias — por lo que
-- AdminBoticas/AdminBoticaDetalle no podían ver boticas pendientes)
DROP POLICY IF EXISTS "farmacias_admin_all" ON public.farmacias;
CREATE POLICY "farmacias_admin_all"
  ON public.farmacias FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "farmacias_coordinador_read" ON public.farmacias;
CREATE POLICY "farmacias_coordinador_read"
  ON public.farmacias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coordinadores c
      WHERE c.id = farmacias.coordinador_id AND c.profile_id = auth.uid()
    )
  );

-- ── Comentarios ───────────────────────────────────────────────
COMMENT ON TABLE  public.coordinadores IS
  'Coordinadores de zona: captan y dan seguimiento a boticas aliadas, ganan S/. 2 por consulta referida por sus boticas.';
COMMENT ON COLUMN public.farmacias.coordinador_id IS
  'Coordinador de zona responsable de esta botica (null si fue registrada sin coordinador).';
