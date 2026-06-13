import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  'mailto:soporte@vidasalud.pe',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async () => {
  try {
    const now  = new Date()
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        patient:profiles!appointments_patient_id_fkey(push_token),
        doctor:doctors(nombres, apellidos)
      `)
      .eq('status', 'paid')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in2h.toISOString())

    if (error) throw error

    let sent = 0
    const results = await Promise.allSettled(
      (appointments ?? []).map(async (appt) => {
        const token = (appt.patient as { push_token?: string } | null)?.push_token
        if (!token) return

        const subscription = JSON.parse(token)
        const doc     = appt.doctor as { nombres?: string; apellidos?: string } | null
        const docName = [doc?.nombres, doc?.apellidos].filter(Boolean).join(' ') || 'tu médico'

        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: '⏰ Recordatorio VIDASALUD',
            body:  `Tu consulta con Dr. ${docName} es en 1 hora. ¡Prepárate!`,
            url:   '/citas',
            tag:   `reminder-${appt.id}`,
          }),
        )
        sent++
      }),
    )

    const failed = results.filter((r) => r.status === 'rejected').length

    return new Response(
      JSON.stringify({ ok: true, sent, failed }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
