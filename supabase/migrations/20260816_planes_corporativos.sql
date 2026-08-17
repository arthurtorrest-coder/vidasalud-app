-- ================================================================
-- VIDASALUD — Planes corporativos (Familia / Empresa / Minería)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- ============================================================
-- TABLA: planes_corporativos
-- Un plan contratado (familiar, empresarial o de minería)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.planes_corporativos (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                        TEXT         NOT NULL
                                            CHECK (tipo IN ('familia', 'empresa', 'mineria')),
  nombre                      TEXT         NOT NULL,
  ruc_empresa                 TEXT,
  consultas_por_usuario_mes   INTEGER      NOT NULL CHECK (consultas_por_usuario_mes > 0),
  max_usuarios                INTEGER      NOT NULL CHECK (max_usuarios > 0),
  precio_mensual              NUMERIC(10,2) NOT NULL CHECK (precio_mensual >= 0),
  estado                      TEXT         NOT NULL DEFAULT 'pendiente'
                                            CHECK (estado IN ('activo', 'inactivo', 'pendiente')),
  fecha_inicio                DATE,
  fecha_fin_contrato          DATE,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLA: usuarios_corporativos
-- Miembros que consumen un plan corporativo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios_corporativos (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                     UUID         NOT NULL REFERENCES public.planes_corporativos(id) ON DELETE CASCADE,
  profile_id                  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consultas_usadas_mes        INTEGER      NOT NULL DEFAULT 0,
  consultas_disponibles_mes   INTEGER      NOT NULL DEFAULT 0,
  rol                         TEXT         NOT NULL
                                            CHECK (rol IN ('titular', 'integrante', 'trabajador')),
  activo                      BOOLEAN      NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (plan_id, profile_id)
);

-- ── Índices ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_planes_corporativos_tipo
  ON public.planes_corporativos (tipo);

CREATE INDEX IF NOT EXISTS idx_planes_corporativos_estado
  ON public.planes_corporativos (estado);

CREATE INDEX IF NOT EXISTS idx_usuarios_corporativos_plan_id
  ON public.usuarios_corporativos (plan_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_corporativos_profile_id
  ON public.usuarios_corporativos (profile_id);

-- ============================================================
-- Agregar rol 'corporativo' al constraint de profiles
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'admin', 'farmacia', 'corporativo'));

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.planes_corporativos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_corporativos ENABLE ROW LEVEL SECURITY;

-- ── planes_corporativos ──────────────────────────────────────

-- Admin: acceso total
CREATE POLICY "planes_corporativos_admin_all"
  ON public.planes_corporativos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Miembros del plan pueden leer los datos de su propio plan
CREATE POLICY "planes_corporativos_member_read"
  ON public.planes_corporativos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios_corporativos uc
      WHERE uc.plan_id = planes_corporativos.id AND uc.profile_id = auth.uid()
    )
  );

-- Service role: acceso total (Edge Functions / backend)
CREATE POLICY "planes_corporativos_service_all"
  ON public.planes_corporativos FOR ALL
  USING (auth.role() = 'service_role');

-- ── usuarios_corporativos ────────────────────────────────────

-- Admin: acceso total
CREATE POLICY "usuarios_corporativos_admin_all"
  ON public.usuarios_corporativos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cada usuario puede leer su propia membresía
CREATE POLICY "usuarios_corporativos_self_read"
  ON public.usuarios_corporativos FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

-- El titular del plan puede gestionar (leer/agregar/editar) a los demás miembros
CREATE POLICY "usuarios_corporativos_titular_manage"
  ON public.usuarios_corporativos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios_corporativos titular
      WHERE titular.plan_id = usuarios_corporativos.plan_id
        AND titular.profile_id = auth.uid()
        AND titular.rol = 'titular'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios_corporativos titular
      WHERE titular.plan_id = usuarios_corporativos.plan_id
        AND titular.profile_id = auth.uid()
        AND titular.rol = 'titular'
    )
  );

-- Service role: acceso total (Edge Functions / backend)
CREATE POLICY "usuarios_corporativos_service_all"
  ON public.usuarios_corporativos FOR ALL
  USING (auth.role() = 'service_role');

-- ── Comentarios ───────────────────────────────────────────────
COMMENT ON TABLE  public.planes_corporativos IS
  'Planes corporativos VIDASALUD: familiar, empresarial o de minería.';
COMMENT ON TABLE  public.usuarios_corporativos IS
  'Miembros (titular/integrante/trabajador) que consumen consultas de un plan corporativo.';
COMMENT ON COLUMN public.usuarios_corporativos.consultas_disponibles_mes IS
  'Cupo de consultas del mes asignado a este miembro dentro del plan.';
