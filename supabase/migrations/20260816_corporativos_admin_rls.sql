-- ================================================================
-- VIDASALUD — Soporte admin para gestión de empresas/minería
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de
-- 20260816_planes_corporativos.sql)
-- ================================================================

-- Email del trabajador, guardado al crearlo desde el panel admin
-- (profiles/auth.users no exponen el email por RLS al admin, así
-- que se guarda aquí para poder listarlo sin llamadas adicionales)
ALTER TABLE public.usuarios_corporativos
  ADD COLUMN IF NOT EXISTS email TEXT;

-- El admin necesita leer perfiles de cualquier usuario (nombre, DNI)
-- para mostrar la lista de trabajadores de una empresa/plan.
-- Sin esta política, el join profiles!profile_id devuelve null
-- para cualquier perfil que no sea el del propio admin.
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  );
