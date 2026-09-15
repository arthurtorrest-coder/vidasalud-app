// @ts-nocheck — archivo Deno; el TS server de VS Code no reconoce el runtime de Deno.
// Supabase Edge Function — consulta cuántos participantes hay ahora mismo en la
// sala Daily.co de una cita, para que PanelMedico sepa si el paciente ya se unió.
// Secreto requerido: DAILY_API_KEY (el mismo que usa create-daily-room)
// Deploy: supabase functions deploy daily-room-presence

const DAILY_API_KEY  = Deno.env.get('DAILY_API_KEY') ?? ''
const DAILY_BASE_URL = 'https://api.daily.co/v1'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Debe coincidir exactamente con roomNameFromId() de create-daily-room/index.ts
function roomNameFromId(appointmentId) {
  return 'vida-' + appointmentId.replace(/-/g, '').slice(0, 12).toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ ok: false, error: 'No autorizado' }, 401)
  }
  if (!DAILY_API_KEY) {
    console.error('[daily-room-presence] DAILY_API_KEY no configurado')
    return json({ ok: false, error: 'DAILY_API_KEY no configurado en los secretos' }, 500)
  }

  try {
    const { appointmentId } = await req.json()
    if (!appointmentId) return json({ ok: false, error: 'appointmentId requerido' }, 400)

    const roomName = roomNameFromId(appointmentId)

    // GET /v1/presence devuelve TODAS las salas activas del dominio agrupadas
    // por nombre — Daily no permite filtrar por sala en este endpoint, así que
    // pedimos todo y filtramos acá. Daily recomienda no consultarlo más de
    // 1 vez cada 15s.
    const res = await fetch(`${DAILY_BASE_URL}/presence`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[daily-room-presence] Daily API error:', res.status, body)
      return json({ ok: false, error: `Daily API respondió ${res.status}` }, 502)
    }

    const data = await res.json()
    const participantes = data?.[roomName] ?? []

    return json({ ok: true, roomName, count: participantes.length })
  } catch (err) {
    console.error('[daily-room-presence] error inesperado:', String(err))
    return json({ ok: false, error: String(err) }, 500)
  }
})
