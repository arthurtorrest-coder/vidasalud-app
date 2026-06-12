-- Onboarding para nuevos pacientes — VIDASALUD
-- Ejecutar en: Supabase Dashboard > SQL Editor

-- Agrega columna con DEFAULT true para que usuarios existentes
-- no vean el onboarding (solo los nuevos registros lo ven)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN NOT NULL DEFAULT true;

-- Los perfiles sin DNI o teléfono probablemente son de prueba —
-- los dejamos con true para no interrumpirles la experiencia actual.
-- Solo los nuevos registros (desde Register.jsx) recibirán false explícitamente.
