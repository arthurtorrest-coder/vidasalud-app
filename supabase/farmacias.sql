-- Boticas aliadas VIDASALUD
CREATE TABLE IF NOT EXISTS farmacias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT        NOT NULL,
  logo_url            TEXT,
  codigo_digemid      TEXT        NOT NULL,
  ciudad              TEXT        NOT NULL,
  distrito            TEXT        NOT NULL,
  direccion           TEXT        NOT NULL,
  telefono            TEXT        NOT NULL,
  propietario_nombre  TEXT        NOT NULL,
  email               TEXT        NOT NULL UNIQUE,
  codigo_referido     TEXT        NOT NULL UNIQUE,
  aprobado            BOOLEAN     NOT NULL DEFAULT false,
  activo              BOOLEAN     NOT NULL DEFAULT false,
  comision_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_farmacias_ciudad   ON farmacias (lower(ciudad));
CREATE INDEX IF NOT EXISTS idx_farmacias_distrito ON farmacias (lower(distrito));
CREATE INDEX IF NOT EXISTS idx_farmacias_aprobado ON farmacias (aprobado, activo);

-- RLS: solo el admin puede ver/aprobar todo; lectura pública para las aprobadas
ALTER TABLE farmacias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmacias_public_read"
  ON farmacias FOR SELECT
  USING (aprobado = true AND activo = true);

CREATE POLICY "farmacias_service_all"
  ON farmacias FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE  farmacias                       IS 'Boticas aliadas del ecosistema VIDASALUD';
COMMENT ON COLUMN farmacias.codigo_referido       IS 'Código único BFARM-CIUDAD-XXXX para tracking de derivaciones';
COMMENT ON COLUMN farmacias.comision_porcentaje   IS '% de comisión sobre ventas derivadas desde VIDASALUD';
