-- Permite que un médico lea el perfil de los pacientes que tienen citas con él.
-- Necesario para que la pantalla HistoriaClinica muestre el nombre del paciente.
-- La política actual "profiles_select_own" solo permite auth.uid() = id,
-- bloqueando a los médicos cuando consultan con profile_id ≠ doctors.id.

CREATE POLICY "profiles_select_doctor_patient"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.doctors d ON d.id = a.doctor_id
      WHERE a.patient_id = profiles.id
        AND (d.id = auth.uid() OR d.profile_id = auth.uid())
    )
  );
