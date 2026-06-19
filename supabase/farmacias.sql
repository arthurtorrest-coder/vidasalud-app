-- ================================================================
-- VIDASALUD — Tabla de boticas aliadas
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS farmacias (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre              TEXT         NOT NULL,
  logo_url            TEXT,
  codigo_digemid      TEXT         NOT NULL,
  ciudad              TEXT         NOT NULL,
  distrito            TEXT         NOT NULL,
  direccion           TEXT         NOT NULL,
  telefono            TEXT         NOT NULL,
  propietario_nombre  TEXT         NOT NULL,
  email               TEXT         NOT NULL UNIQUE,
  codigo_referido     TEXT         NOT NULL UNIQUE,
  aprobado            BOOLEAN      NOT NULL DEFAULT false,
  activo              BOOLEAN      NOT NULL DEFAULT false,
  comision_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Índices ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_farmacias_ciudad
  ON farmacias (lower(ciudad));

CREATE INDEX IF NOT EXISTS idx_farmacias_distrito
  ON farmacias (lower(distrito));

CREATE INDEX IF NOT EXISTS idx_farmacias_profile_id
  ON farmacias (profile_id);

CREATE INDEX IF NOT EXISTS idx_farmacias_aprobado
  ON farmacias (aprobado, activo);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE farmacias ENABLE ROW LEVEL SECURITY;

-- 1. Lectura pública: boticas aprobadas y activas (para el directorio)
CREATE POLICY "farmacias_public_read"
  ON farmacias
  FOR SELECT
  USING (aprobado = true AND activo = true);

-- 2. La propia farmacia puede leer su registro (aunque no esté aprobada)
--    Soporta lookup por email (para useAuth) y por profile_id
CREATE POLICY "farmacias_owner_read"
  ON farmacias
  FOR SELECT
  USING (
    auth.uid() = profile_id
    OR auth.email() = email
  );

-- 3. La propia farmacia puede actualizar sus datos (logo, teléfono, etc.)
CREATE POLICY "farmacias_owner_update"
  ON farmacias
  FOR UPDATE
  USING (
    auth.uid() = profile_id
    OR auth.email() = email
  )
  WITH CHECK (
    auth.uid() = profile_id
    OR auth.email() = email
  );

-- 4. Inserción libre autenticada (el registro ocurre antes de que profile_id
--    esté disponible; se completa con profile_id en el mismo request)
CREATE POLICY "farmacias_insert_authenticated"
  ON farmacias
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Service role: acceso total (admin y Edge Functions)
CREATE POLICY "farmacias_service_all"
  ON farmacias
  FOR ALL
  USING (auth.role() = 'service_role');

-- ── Comentarios ─────────────────────────────────────────────────
COMMENT ON TABLE  farmacias IS
  'Boticas aliadas del ecosistema VIDASALUD. Requieren aprobación del admin antes de aparecer en el directorio.';
COMMENT ON COLUMN farmacias.profile_id IS
  'auth.users.id del propietario. Permite RLS por UID además de por email.';
COMMENT ON COLUMN farmacias.codigo_referido IS
  'Código único BFARM-CIUDAD-XXXX para tracking de derivaciones de pacientes.';
COMMENT ON COLUMN farmacias.comision_porcentaje IS
  '% de comisión sobre ventas derivadas desde VIDASALUD.';
