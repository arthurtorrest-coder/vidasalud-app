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
    const { nombre, dni, telefono, email, farmacia_id } = await req.json()
    console.log('[registrar-paciente-farmacia]', { nombre, dni, farmacia_id })

    if (!nombre || !dni || !telefono || !farmacia_id) {
      throw new Error('Faltan campos obligatorios: nombre, dni, telefono, farmacia_id')
    }

    // Email: usar el proporcionado o generar uno con el DNI
    const userEmail = email?.trim() || `${dni}@paciente.vidasalud.pe`
    // Contraseña temporal: cambiable por el paciente en su primer ingreso
    const tempPass  = `VS${dni}!${Math.random().toString(36).slice(-4).toUpperCase()}`

    // Crear usuario auth (auto-confirmado, sin email de verificación)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:         userEmail,
      password:      tempPass,
      email_confirm: true,
      user_metadata: { role: 'patient' },
    })
    if (authErr) throw new Error(authErr.message)

    // Crear/actualizar profile con farmacia_referente_id
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id:                    authData.user.id,
      full_name:             nombre.trim(),
      dni:                   dni.trim(),
      phone:                 telefono.trim(),
      role:                  'patient',
      farmacia_referente_id: farmacia_id,
    }, { onConflict: 'id' })
    if (profileErr) console.warn('[registrar-paciente-farmacia] profile upsert:', profileErr.message)

    return new Response(
      JSON.stringify({ ok: true, patient_id: authData.user.id, email: userEmail, temp_password: tempPass }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[registrar-paciente-farmacia] error:', String(err))
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
