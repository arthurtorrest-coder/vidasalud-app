-- Libro de Reclamaciones virtual (requisito INDECOPI — D.S. N.º 011-2011-PCM
-- y modificatorias). Público puede insertar sin sesión; solo admins pueden leer.

CREATE TABLE IF NOT EXISTS public.libro_reclamaciones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT        NOT NULL,
  dni         TEXT        NOT NULL,
  correo      TEXT        NOT NULL,
  telefono    TEXT        NOT NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('reclamo', 'queja')),
  descripcion TEXT        NOT NULL,
  pedido      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.libro_reclamaciones ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (con o sin sesión) puede registrar un reclamo/queja —
-- es un requisito legal que el libro sea accesible sin necesidad de cuenta.
DROP POLICY IF EXISTS "libro_reclamaciones_insert_public" ON public.libro_reclamaciones;
CREATE POLICY "libro_reclamaciones_insert_public" ON public.libro_reclamaciones
  FOR INSERT
  WITH CHECK (true);

-- Solo administradores pueden leer los reclamos (contienen datos personales).
DROP POLICY IF EXISTS "libro_reclamaciones_admin_select" ON public.libro_reclamaciones;
CREATE POLICY "libro_reclamaciones_admin_select" ON public.libro_reclamaciones
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
