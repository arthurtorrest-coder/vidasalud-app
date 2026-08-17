// @ts-nocheck — Deno runtime; ignorar errores del TS server de VS Code
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // ── Solo admins pueden invocar esta función ──────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) throw new Error('No autenticado')

    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !user) throw new Error('No autenticado')

    const { data: callerProfile, error: callerErr } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (callerErr || callerProfile?.role !== 'admin') {
      throw new Error('Solo un administrador puede agregar trabajadores')
    }

    // ── Datos del trabajador ──────────────────────────────────────
    const { nombre, dni, email, plan_id, rol } = await req.json()
    console.log('[crear-trabajador-corporativo]', { nombre, dni, plan_id, rol })

    if (!nombre || !dni || !plan_id) {
      throw new Error('Faltan campos obligatorios: nombre, dni, plan_id')
    }

    const { data: plan, error: planErr } = await supabase
      .from('planes_corporativos')
      .select('id, tipo, consultas_por_usuario_mes, max_usuarios')
      .eq('id', plan_id)
      .single()
    if (planErr || !plan) throw new Error('El plan corporativo no existe')

    const { count: actuales } = await supabase
      .from('usuarios_corporativos')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan_id)
    if ((actuales ?? 0) >= plan.max_usuarios) {
      throw new Error(`El plan ya alcanzó su límite de ${plan.max_usuarios} usuarios`)
    }

    // Email: usar el proporcionado o generar uno con el DNI
    const userEmail = email?.trim() || `${dni}@corporativo.vidasalud.pe`
    // Contraseña temporal: cambiable por el trabajador en su primer ingreso
    const tempPass  = `VS${dni}!${Math.random().toString(36).slice(-4).toUpperCase()}`

    // Crear usuario auth (auto-confirmado, sin email de verificación)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:         userEmail,
      password:      tempPass,
      email_confirm: true,
      user_metadata: { role: 'corporativo' },
    })
    if (authErr) throw new Error(authErr.message)

    // Crear/actualizar profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id:        authData.user.id,
      full_name: nombre.trim(),
      dni:       dni.trim(),
      role:      'corporativo',
    }, { onConflict: 'id' })
    if (profileErr) throw new Error(profileErr.message)

    // Vincular al plan corporativo
    const { error: vinculoErr } = await supabase.from('usuarios_corporativos').insert({
      plan_id:                   plan_id,
      profile_id:                authData.user.id,
      rol:                       rol || 'trabajador',
      email:                     userEmail,
      consultas_usadas_mes:      0,
      consultas_disponibles_mes: plan.consultas_por_usuario_mes,
      activo:                    true,
    })
    if (vinculoErr) throw new Error(vinculoErr.message)

    return new Response(
      JSON.stringify({ ok: true, profile_id: authData.user.id, email: userEmail, temp_password: tempPass }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[crear-trabajador-corporativo] error:', String(err))
    return new Response(
      JSON.stringify({ ok: false, error: err.message ?? String(err) }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
