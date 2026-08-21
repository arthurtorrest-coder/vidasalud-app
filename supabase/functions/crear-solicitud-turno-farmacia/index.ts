// @ts-nocheck — Deno runtime; ignorar errores del TS server de VS Code
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { patient_id } = await req.json()
    console.log('[crear-solicitud-turno-farmacia]', { patient_id })

    if (!patient_id) {
      return json({ ok: false, error: 'Falta patient_id' }, 400)
    }

    // Verificar que quien llama es una farmacia aprobada
    const authHeader = req.headers.get('Authorization') ?? ''
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return json({ ok: false, error: 'No autenticado' }, 401)

    // Cliente con service_role para operaciones privilegiadas
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: farmacia, error: fErr } = await svc
      .from('farmacias')
      .select('id, aprobado, nombre')
      .eq('profile_id', user.id)
      .single()
    if (fErr || !farmacia) return json({ ok: false, error: 'Farmacia no encontrada' }, 404)
    if (!farmacia.aprobado)  return json({ ok: false, error: 'Farmacia no aprobada' }, 403)

    // Verificar que el paciente pertenece a esta farmacia
    const { data: patient, error: pErr } = await svc
      .from('profiles')
      .select('id, farmacia_referente_id, full_name')
      .eq('id', patient_id)
      .single()
    if (pErr || !patient) return json({ ok: false, error: 'Paciente no encontrado' }, 404)
    if (patient.farmacia_referente_id !== farmacia.id) {
      return json({ ok: false, error: 'El paciente no está referido a esta farmacia' }, 403)
    }

    // Si ya existe una solicitud pendiente vigente, devolverla en vez de duplicar
    const { data: existente } = await svc
      .from('solicitudes_turno')
      .select('id, status, created_at, expires_at, appointment_id, patient_id')
      .eq('patient_id', patient_id)
      .eq('status', 'pendiente')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existente) {
      return json({ ok: true, solicitud: existente, existente: true })
    }

    const { data: solicitud, error: sErr } = await svc
      .from('solicitudes_turno')
      .insert({ patient_id })
      .select('id, status, created_at, expires_at, appointment_id, patient_id')
      .single()
    if (sErr) return json({ ok: false, error: sErr.message }, 500)

    console.log('[crear-solicitud-turno-farmacia] creada:', solicitud.id, '— farmacia:', farmacia.nombre)
    return json({ ok: true, solicitud, existente: false })

  } catch (err) {
    console.error('[crear-solicitud-turno-farmacia] error inesperado:', String(err))
    return json({ ok: false, error: String(err) }, 500)
  }
})
