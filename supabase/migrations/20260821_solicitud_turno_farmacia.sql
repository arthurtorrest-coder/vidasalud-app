-- =========================================================
-- VIDASALUD — La botica puede ver el estado de las solicitudes
-- de turno de guardia de los pacientes que ella refirió.
-- (La creación de la solicitud pasa por la Edge Function
--  crear-solicitud-turno-farmacia, que usa service_role — esta
--  política solo habilita la LECTURA desde PanelFarmacia.jsx)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =========================================================

DROP POLICY IF EXISTS "st_farmacia_select" ON public.solicitudes_turno;
CREATE POLICY "st_farmacia_select" ON public.solicitudes_turno
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles pat
      JOIN public.farmacias f ON f.id = pat.farmacia_referente_id
      WHERE pat.id = solicitudes_turno.patient_id
        AND f.profile_id = auth.uid()
    )
  );
