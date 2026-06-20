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
    const { patient_id, doctor_id, scheduled_at } = await req.json()
    console.log('[crear-cita-farmacia]', { patient_id, doctor_id, scheduled_at })

    if (!patient_id || !doctor_id || !scheduled_at) {
      return json({ ok: false, error: 'Faltan campos: patient_id, doctor_id, scheduled_at' }, 400)
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

    // Obtener farmacia del usuario autenticado y verificar que está aprobada
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

    // Verificar que el médico está activo y aprobado
    const { data: doctor, error: dErr } = await svc
      .from('doctors')
      .select('id, precio, activo, aprobado, nombres, apellidos')
      .eq('id', doctor_id)
      .single()
    if (dErr || !doctor)        return json({ ok: false, error: 'Médico no encontrado' }, 404)
    if (!doctor.aprobado)       return json({ ok: false, error: 'Médico no aprobado' }, 400)
    if (!doctor.activo)         return json({ ok: false, error: 'Médico no activo' }, 400)

    // Crear la cita (status pending: el paciente completa el pago desde su sesión)
    const { data: appt, error: aErr } = await svc
      .from('appointments')
      .insert({
        patient_id,
        doctor_id,
        scheduled_at,
        status:               'pending',
        precio_total:         doctor.precio ?? 0,
        duration_minutes:     20,
        farmacia_referente_id: farmacia.id,
      })
      .select('id')
      .single()

    if (aErr) {
      // Si farmacia_referente_id no existe aún en appointments, reintentar sin ella
      if (aErr.message?.includes('farmacia_referente_id')) {
        const { data: appt2, error: aErr2 } = await svc
          .from('appointments')
          .insert({
            patient_id,
            doctor_id,
            scheduled_at,
            status:           'pending',
            precio_total:     doctor.precio ?? 0,
            duration_minutes: 20,
          })
          .select('id')
          .single()
        if (aErr2) return json({ ok: false, error: aErr2.message }, 500)
        console.log('[crear-cita-farmacia] cita creada (sin farmacia_ref):', appt2.id)
        return json({ ok: true, appointment_id: appt2.id })
      }
      return json({ ok: false, error: aErr.message }, 500)
    }

    console.log('[crear-cita-farmacia] cita creada:', appt.id, '— farmacia:', farmacia.nombre)
    return json({ ok: true, appointment_id: appt.id })

  } catch (err) {
    console.error('[crear-cita-farmacia] error inesperado:', String(err))
    return json({ ok: false, error: String(err) }, 500)
  }
})
