-- La política "doctors_select_activos" solo devuelve filas con activo=true.
-- Un médico recién registrado tiene activo=false, por lo que no puede leer
-- su propio registro — useAuth no puede detectar aprobado=false y no redirige.
-- Esta política adicional permite al médico leer SIEMPRE su propia fila.

CREATE POLICY "doctors_select_self"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
