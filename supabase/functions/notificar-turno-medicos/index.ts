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

    // ── Buscar médicos de Medicina General ──────────────────────
    const supabase = createClient(supabaseUrl, serviceKey)

    // Nota: a propósito NO se filtra por activo=true — la atención inmediata
    // debe notificar a TODOS los médicos aprobados con push_token, estén o
    // no marcados como "disponibles" en su panel. El médico decide si toma
    // el turno o lo ignora; no queremos ocultarle el aviso solo porque
    // olvidó prender el switch (o se apagó solo al terminar su horario).
    const { data: doctors, error: dbError } = await supabase
      .from('doctors')
      .select('id, nombres')
      .eq('aprobado', true)
      .ilike('especialidad', '%general%')

    if (dbError) {
      console.error('[notificar-turno-medicos] DB error (doctors):', dbError.message)
      return json({ error: dbError.message }, 500)
    }

    if (!doctors?.length) {
      console.log('[notificar-turno-medicos] Sin médicos de Medicina General aprobados')
      return json({ sent: 0, failed: 0, reason: 'No hay médicos aprobados de Medicina General' })
    }

    // ── Buscar TODOS los tokens push de esos médicos (multi-dispositivo) ──
    const doctorIds = doctors.map((d: { id: string }) => d.id)
    const { data: tokens, error: tokensError } = await supabase
      .from('doctor_push_tokens')
      .select('id, doctor_id, push_token, device_info')
      .in('doctor_id', doctorIds)

    if (tokensError) {
      console.error('[notificar-turno-medicos] DB error (doctor_push_tokens):', tokensError.message)
      return json({ error: tokensError.message }, 500)
    }

    if (!tokens?.length) {
      console.log('[notificar-turno-medicos] Sin dispositivos con push_token registrados')
      return json({ sent: 0, failed: 0, reason: 'No hay médicos con suscripción push activa' })
    }

    console.log(`[notificar-turno-medicos] Enviando a ${tokens.length} dispositivos de ${doctors.length} médicos`)

    // ── Payload de la notificación ─────────────────────────────
    const payload = JSON.stringify({
      title: '🔔 Paciente esperando',
      body:  `${patient_name} necesita atención en Medicina General. Ingresa a VIDASALUD para tomar el turno.`,
      url:   '/medico/panel',
      tag:   'turno-guardia',
    })

    // ── Enviar a TODOS los dispositivos de cada médico ──────────
    const results = await Promise.allSettled(
      tokens.map(async (tok: { id: string; doctor_id: string; push_token: unknown; device_info: string | null }) => {
        let subscription
        try {
          subscription = typeof tok.push_token === 'string'
            ? JSON.parse(tok.push_token)
            : tok.push_token
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          throw new Error(`push_token malformado — token ${tok.id} (doctor ${tok.doctor_id}): ${msg}`)
        }

        try {
          const res = await webpush.sendNotification(subscription, payload)
          console.log(`[notificar-turno-medicos] OK doctor ${tok.doctor_id} (${tok.device_info ?? 'dispositivo'}) → status ${res.statusCode}`)
          return res
        } catch (sendErr: any) {
          // 404/410 = la suscripción ya no existe en el navegador (desinstalada,
          // permiso revocado, etc.) — se elimina para no reintentar en vano.
          const statusCode = sendErr?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            console.warn(`[notificar-turno-medicos] token ${tok.id} inválido (status ${statusCode}) — eliminando`)
            await supabase.from('doctor_push_tokens').delete().eq('id', tok.id)
          }
          throw sendErr
        }
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
