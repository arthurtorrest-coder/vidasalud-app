-- ================================================================
-- VIDASALUD — Vinculación paciente-botica y comisiones
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Vincular pacientes con botica que los refirió
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS farmacia_referente_id UUID
    REFERENCES farmacias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_farmacia_ref
  ON profiles (farmacia_referente_id)
  WHERE farmacia_referente_id IS NOT NULL;

-- 2. Marcar si la comisión de una cita ya fue pagada a la botica
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS comision_pagada BOOLEAN NOT NULL DEFAULT false;

-- 3. Política RLS: la propia farmacia puede leer los profiles de sus pacientes referidos
CREATE POLICY "farmacia_lee_pacientes_referidos"
  ON profiles
  FOR SELECT
  USING (
    farmacia_referente_id IN (
      SELECT id FROM farmacias
      WHERE profile_id = auth.uid()
         OR email = auth.email()
    )
  );

COMMENT ON COLUMN profiles.farmacia_referente_id IS
  'Botica que registró/refirió a este paciente a VIDASALUD';
COMMENT ON COLUMN appointments.comision_pagada IS
  'true cuando la comisión de esta cita fue liquidada a la botica referente';
