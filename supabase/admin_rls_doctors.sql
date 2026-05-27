-- VIDASALUD — Políticas RLS para admin sobre la tabla doctors
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Problema: handleApproveTarifa (y otros UPDATE del admin sobre doctors)
-- fallaba silenciosamente porque no existía ninguna política UPDATE
-- que permita al admin modificar filas de médicos.
-- ─────────────────────────────────────────────────────────────────────

-- Admin puede actualizar cualquier médico
-- (aprobar tarifas, activar/desactivar, aprobar solicitudes de registro)
DROP POLICY IF EXISTS "doctors_update_admin" ON public.doctors;
CREATE POLICY "doctors_update_admin"
  ON public.doctors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin puede eliminar médicos (rechazar solicitudes de registro)
DROP POLICY IF EXISTS "doctors_delete_admin" ON public.doctors;
CREATE POLICY "doctors_delete_admin"
  ON public.doctors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin puede ver TODOS los médicos, incluyendo inactivos y pendientes
DROP POLICY IF EXISTS "doctors_select_admin" ON public.doctors;
CREATE POLICY "doctors_select_admin"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
