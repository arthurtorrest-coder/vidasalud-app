-- Auditoría de seguridad VIDASALUD — ejecutar en Supabase Dashboard > SQL Editor
-- Verifica RLS, políticas activas y posibles gaps de seguridad

-- ============================================================
-- 1. Estado de RLS por tabla (rowsecurity = true/false)
-- ============================================================
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS habilitado' ELSE '❌ SIN RLS' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;

-- ============================================================
-- 2. Tablas con RLS habilitado pero SIN políticas (bloqueará TODO acceso)
-- ============================================================
SELECT
  t.tablename,
  '⚠️  RLS habilitado sin políticas — todo acceso bloqueado' AS advertencia
FROM pg_tables t
LEFT JOIN pg_policies p
  ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.tablename IS NULL
ORDER BY t.tablename;

-- ============================================================
-- 3. Tablas SIN RLS (cualquier usuario autenticado puede leer todo)
-- ============================================================
SELECT
  tablename,
  '🔴 Sin RLS — revisar si contiene datos sensibles' AS riesgo
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- ============================================================
-- 4. Todas las políticas RLS activas
-- ============================================================
SELECT
  tablename,
  policyname,
  cmd        AS operacion,
  permissive AS tipo,
  roles,
  qual       AS condicion_using,
  with_check AS condicion_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ============================================================
-- 5. Funciones con SECURITY DEFINER (ejecutan como owner — revisar)
-- ============================================================
SELECT
  proname AS funcion,
  prosecdef AS security_definer,
  '⚠️  Ejecuta como el owner de la función, no como el llamador' AS nota
FROM pg_proc
JOIN pg_namespace ns ON pg_proc.pronamespace = ns.oid
WHERE ns.nspname = 'public'
  AND prosecdef = true
ORDER BY proname;

-- ============================================================
-- 6. Resumen de tablas con datos PII / sensibles (checklist manual)
-- ============================================================
SELECT '=== CHECKLIST PII ===' AS seccion
UNION ALL SELECT 'profiles       → nombres, email, teléfono, DNI'
UNION ALL SELECT 'appointments   → historial médico, video_url'
UNION ALL SELECT 'prescriptions  → recetas (datos médicos sensibles)'
UNION ALL SELECT 'payments       → charge_id Culqi (NO almacenar CVV/PAN)'
UNION ALL SELECT 'session_logs   → IPs de médico/paciente'
UNION ALL SELECT 'reviews        → calificaciones paciente-médico'
UNION ALL SELECT '→ Verificar que TODAS tienen RLS y política SELECT restrictiva';
