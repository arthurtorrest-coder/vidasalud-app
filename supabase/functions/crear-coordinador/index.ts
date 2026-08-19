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
      throw new Error('Solo un administrador puede crear coordinadores')
    }

    // ── Datos del coordinador ──────────────────────────────────────
    const { nombres, apellidos, email, zona_principal } = await req.json()
    console.log('[crear-coordinador]', { nombres, apellidos, zona_principal })

    if (!nombres || !apellidos || !email) {
      throw new Error('Faltan campos obligatorios: nombres, apellidos, email')
    }

    const tempPass = `VS${Math.random().toString(36).slice(-6).toUpperCase()}!`

    // Crear usuario auth (auto-confirmado, sin email de verificación)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:         email.trim(),
      password:      tempPass,
      email_confirm: true,
      user_metadata: { role: 'coordinador' },
    })
    if (authErr) throw new Error(authErr.message)

    // Crear/actualizar profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id:        authData.user.id,
      full_name: `${nombres.trim()} ${apellidos.trim()}`,
      role:      'coordinador',
    }, { onConflict: 'id' })
    if (profileErr) throw new Error(profileErr.message)

    // Crear registro de coordinador
    const { data: coordinador, error: coordErr } = await supabase
      .from('coordinadores')
      .insert({
        profile_id:     authData.user.id,
        nombres:        nombres.trim(),
        apellidos:      apellidos.trim(),
        zona_principal: zona_principal?.trim() || null,
        activo:         true,
      })
      .select()
      .single()
    if (coordErr) throw new Error(coordErr.message)

    return new Response(
      JSON.stringify({ ok: true, coordinador, email: email.trim(), temp_password: tempPass }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[crear-coordinador] error:', String(err))
    return new Response(
      JSON.stringify({ ok: false, error: err.message ?? String(err) }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
