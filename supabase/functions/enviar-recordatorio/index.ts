// @ts-nocheck — archivo Deno; el TS server de VS Code no reconoce el runtime de Deno.
// Los errores de módulo y de 'Deno' son falsos positivos. Instala la extensión
// "Deno" de denoland en VS Code para análisis correcto de Edge Functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Llamada server-to-server a enviar-whatsapp (usa el service_role como JWT
// porque enviar-whatsapp corre con verificación de JWT activada por defecto)
async function enviarWhatsapp(to: string, template_name: string, parameters: string[]) {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enviar-whatsapp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ to, template_name, parameters }),
    })
    const data = await res.json()
    if (!data?.ok) console.warn('[enviar-recordatorio] whatsapp falló:', data?.error)
    return data?.ok === true
  } catch (err) {
    console.warn('[enviar-recordatorio] whatsapp excepción:', String(err))
    return false
  }
}

Deno.serve(async (req) => {
  console.log('[enviar-recordatorio] invocada —', req.method, new Date().toISOString())

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    // Configurar VAPID dentro del handler para que los logs muestren si faltan las claves
    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidPublic || !vapidPrivate) {
      console.error('[enviar-recordatorio] Faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY')
      return new Response(
        JSON.stringify({ ok: false, error: 'VAPID keys no configuradas' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    webpush.setVapidDetails('mailto:soporte@vidasalud.pe', vapidPublic, vapidPrivate)

    const now  = new Date()
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    console.log('[enviar-recordatorio] buscando citas entre', now.toISOString(), 'y', in2h.toISOString())

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        patient:profiles!appointments_patient_id_fkey(full_name, phone, push_token),
        doctor:doctors(nombres, apellidos)
      `)
      .eq('status', 'paid')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in2h.toISOString())

    if (error) {
      console.error('[enviar-recordatorio] error al consultar citas:', error.message)
      throw error
    }

    console.log('[enviar-recordatorio] citas encontradas:', appointments?.length ?? 0)

    let sent = 0
    let sentWhatsapp = 0
    type Appt = {
      id: string
      scheduled_at: string
      patient: { full_name?: string; phone?: string; push_token?: string } | null
      doctor: { nombres?: string; apellidos?: string } | null
    }

    const results = await Promise.allSettled(
      (appointments as Appt[] ?? []).map(async (appt) => {
        const patient   = appt.patient as { full_name?: string; phone?: string; push_token?: string } | null
        const doc       = appt.doctor as { nombres?: string; apellidos?: string } | null
        const docName   = [doc?.nombres, doc?.apellidos].filter(Boolean).join(' ') || 'tu médico'

        if (patient?.push_token) {
          const subscription = JSON.parse(patient.push_token)
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: '⏰ Recordatorio VIDASALUD',
              body:  `Tu consulta con Dr. ${docName} es en 1 hora. ¡Prepárate!`,
              url:   '/citas',
              tag:   `reminder-${appt.id}`,
            }),
          )
          console.log('[enviar-recordatorio] push enviado — cita', appt.id)
          sent++
        } else {
          console.log('[enviar-recordatorio] cita', appt.id, '— paciente sin push_token, omitido')
        }

        if (patient?.phone) {
          const ok = await enviarWhatsapp(patient.phone, 'recordatorio_cita', [
            patient.full_name || 'Paciente',
            docName,
          ])
          if (ok) { sentWhatsapp++; console.log('[enviar-recordatorio] whatsapp enviado — cita', appt.id) }
        } else {
          console.log('[enviar-recordatorio] cita', appt.id, '— paciente sin teléfono, whatsapp omitido')
        }
      }),
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) console.warn('[enviar-recordatorio] fallos al enviar:', failed)

    return new Response(
      JSON.stringify({ ok: true, sent, sentWhatsapp, failed }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[enviar-recordatorio] error general:', message)
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
