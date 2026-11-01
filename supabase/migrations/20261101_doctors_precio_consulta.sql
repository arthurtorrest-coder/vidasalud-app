-- =========================================================
-- Agregar columna precio_consulta a la tabla doctors
-- Tarifa individual (precio total al paciente) que el admin
-- puede fijar por médico. Si es NULL, se usa el precio de la
-- especialidad (especialidades_precios) y, en su defecto,
-- PRECIO_ATENCION_INMEDIATA — ver src/lib/finanzas.js
-- =========================================================

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS precio_consulta NUMERIC;

-- La columna ya queda cubierta por las políticas RLS existentes
-- de la tabla doctors — no se necesita política adicional.
