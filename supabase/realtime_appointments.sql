-- Habilitar Realtime y filtros por columna en appointments
-- Ejecutar en: Supabase Dashboard > SQL Editor

-- 1. Agregar la tabla a la publicación de Realtime (si no está ya)
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- 2. REPLICA IDENTITY FULL es necesario para que los filtros de UPDATE
--    funcionen sobre columnas que NO son la primary key (como patient_id).
--    Sin esto, Supabase Realtime recibe el evento pero no puede aplicar
--    el filtro `patient_id=eq.{uuid}` y descarta el mensaje.
ALTER TABLE appointments REPLICA IDENTITY FULL;

-- Verificar que quedó configurado:
-- SELECT relreplident FROM pg_class WHERE relname = 'appointments';
-- Resultado esperado: 'f'  (FULL)
