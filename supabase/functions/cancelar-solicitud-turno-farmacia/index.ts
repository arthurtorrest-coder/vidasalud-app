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
    const { solicitud_id } = await req.json()
    console.log('[cancelar-solicitud-turno-farmacia]', { solicitud_id })

    if (!solicitud_id) {
      return json({ ok: false, error: 'Falta solicitud_id' }, 400)
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

    // Obtener la solicitud y verificar que el paciente pertenece a esta farmacia
    const { data: solicitud, error: sErr } = await svc
      .from('solicitudes_turno')
      .select('id, status, patient_id, profiles:patient_id(farmacia_referente_id)')
      .eq('id', solicitud_id)
      .single()
    if (sErr || !solicitud) return json({ ok: false, error: 'Solicitud no encontrada' }, 404)
    if (solicitud.profiles?.farmacia_referente_id !== farmacia.id) {
      return json({ ok: false, error: 'Esta solicitud no pertenece a un paciente de tu farmacia' }, 403)
    }
    if (solicitud.status !== 'pendiente') {
      return json({ ok: false, error: 'La solicitud ya no está pendiente' }, 409)
    }

    const { data: updated, error: uErr } = await svc
      .from('solicitudes_turno')
      .update({ status: 'expirada' })
      .eq('id', solicitud_id)
      .eq('status', 'pendiente')
      .select('id, status')
      .single()
    if (uErr) return json({ ok: false, error: uErr.message }, 500)

    console.log('[cancelar-solicitud-turno-farmacia] cancelada:', updated.id, '— farmacia:', farmacia.nombre)
    return json({ ok: true, solicitud: updated })

  } catch (err) {
    console.error('[cancelar-solicitud-turno-farmacia] error inesperado:', String(err))
    return json({ ok: false, error: String(err) }, 500)
  }
})
