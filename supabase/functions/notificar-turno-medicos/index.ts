// supabase/functions/notificar-turno-medicos/index.ts
// Envía Web Push a todos los médicos de Medicina General con push_token activo
// Deploy: supabase functions deploy notificar-turno-medicos

import webpush from 'npm:web-push@3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Variables de entorno ───────────────────────────────────
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidEmail   = Deno.env.get('VAPID_EMAIL') ?? 'mailto:soporte@vidasalud.pe'

    if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
      console.error('[notificar-turno-medicos] Faltan variables de entorno')
      return json({ error: 'Configuración incompleta en el servidor' }, 500)
    }

    // ── Cuerpo de la petición ──────────────────────────────────
    const { patient_id, patient_name } = await req.json()
    if (!patient_id || !patient_name) {
      return json({ error: 'patient_id y patient_name son requeridos' }, 400)
    }

    console.log('[notificar-turno-medicos] patient_id:', patient_id, '| patient_name:', patient_name)

    // ── Configurar VAPID ───────────────────────────────────────
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

    // ── Buscar médicos de Medicina General con push_token ──────
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: doctors, error: dbError } = await supabase
      .from('doctors')
      .select('id, nombres, push_token')
      .eq('activo', true)
      .eq('aprobado', true)
      .ilike('especialidad', '%general%')
      .not('push_token', 'is', null)

    if (dbError) {
      console.error('[notificar-turno-medicos] DB error:', dbError.message)
      return json({ error: dbError.message }, 500)
    }

    if (!doctors?.length) {
      console.log('[notificar-turno-medicos] Sin médicos con push_token activos')
      return json({ sent: 0, failed: 0, reason: 'No hay médicos con suscripción push activa' })
    }

    console.log(`[notificar-turno-medicos] Enviando a ${doctors.length} médicos`)

    // ── Payload de la notificación ─────────────────────────────
    const payload = JSON.stringify({
      title: '🔔 Paciente esperando',
      body:  `${patient_name} necesita atención en Medicina General. Ingresa a VIDASALUD para tomar el turno.`,
      url:   '/medico/panel',
      tag:   'turno-guardia',
    })

    // ── Enviar a cada médico ───────────────────────────────────
    const results = await Promise.allSettled(
      doctors.map(async (doc) => {
        let subscription
        try {
          subscription = typeof doc.push_token === 'string'
            ? JSON.parse(doc.push_token)
            : doc.push_token
        } catch (e) {
          throw new Error(`push_token malformado — doctor ${doc.id}: ${e.message}`)
        }

        const res = await webpush.sendNotification(subscription, payload)
        console.log(`[notificar-turno-medicos] OK doctor ${doc.id} → status ${res.statusCode}`)
        return res
      })
    )

    const sent   = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (failed > 0) {
      const reasons = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason?.message ?? String(r.reason))
      console.warn('[notificar-turno-medicos] Fallos:', reasons)
    }

    return json({ sent, failed })
  } catch (err) {
    console.error('[notificar-turno-medicos] Error inesperado:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
