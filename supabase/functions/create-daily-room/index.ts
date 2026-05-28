// @ts-nocheck — archivo Deno, ignorar errores del TS server de Node/VS Code
// Supabase Edge Function — crea una sala Daily.co para una cita
// Secreto requerido: DAILY_API_KEY  (nunca usar VITE_, eso expone la clave en el browser)
// Desplegar: supabase functions deploy create-daily-room
// Secreto:   supabase secrets set DAILY_API_KEY=tu_clave_aqui

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DAILY_API_KEY   = Deno.env.get('DAILY_API_KEY') ?? ''
const DAILY_BASE_URL  = 'https://api.daily.co/v1'
const ROOM_EXPIRY_SEC = 60 * 60 * 2   // 2 horas

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

// Nombre de sala: vida-{12 hex del UUID} — solo alfanuméricos y guiones
function roomNameFromId(appointmentId: string) {
  return 'vida-' + appointmentId.replace(/-/g, '').slice(0, 12).toLowerCase()
}

async function getRoomByName(name: string) {
  const res = await fetch(`${DAILY_BASE_URL}/rooms/${name}`, {
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  })
  return res.ok ? (await res.json()) : null
}

async function createRoom(name: string, expiresAt: number) {
  const res = await fetch(`${DAILY_BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      privacy: 'public',          // URL como credencial; RLS de Supabase protege el acceso al URL
      properties: {
        exp:                  expiresAt,
        eject_at_room_exp:    true,
        max_participants:     2,
        enable_chat:          false,
        enable_screenshare:   false,
        enable_knocking:      false,
      },
    }),
  })
  return { ok: res.ok, data: await res.json() }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    console.error('[create-daily-room] No Authorization header')
    return json({ error: 'No autorizado' }, 401)
  }

  if (!DAILY_API_KEY) {
    console.error('[create-daily-room] DAILY_API_KEY not set')
    return json({ error: 'DAILY_API_KEY no configurado en los secretos' }, 500)
  }

  let appointmentId: string
  try {
    const body = await req.json()
    appointmentId = body.appointmentId
    if (!appointmentId) throw new Error('appointmentId requerido')
  } catch (e) {
    console.error('[create-daily-room] Bad request:', (e as Error).message)
    return json({ error: (e as Error).message }, 400)
  }

  console.log('[create-daily-room] appointmentId:', appointmentId)

  // Service role bypasses RLS — necesario porque doctors.id ≠ auth.uid()
  // en el esquema con doctors_seed.sql (doctors.id es UUID aleatorio, profile_id = auth.uid())
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('id, doctor_id, video_url')
    .eq('id', appointmentId)
    .single()

  console.log('[create-daily-room] appointment query — data:', appt, '| error:', apptErr)

  if (apptErr || !appt) return json({ error: 'Cita no encontrada' }, 404)

  // No reutilizar video_url cacheado: la sala puede haber expirado.
  // Siempre intentar crear; si ya existe en Daily.co la obtenemos por nombre.
  const roomName  = roomNameFromId(appointmentId)
  const expiresAt = Math.floor(Date.now() / 1000) + ROOM_EXPIRY_SEC
  console.log('[create-daily-room] creating room:', roomName, '| expires:', new Date(expiresAt * 1000).toISOString())

  const { ok, data: room } = await createRoom(roomName, expiresAt)
  console.log('[create-daily-room] createRoom ok:', ok, '| response:', room)

  let roomUrl: string
  if (ok) {
    roomUrl = room.url
  } else if (room?.error === 'invalid-request-error') {
    // La sala ya existía en Daily.co — obtenerla por nombre
    console.log('[create-daily-room] room already exists, fetching existing…')
    const existing = await getRoomByName(roomName)
    console.log('[create-daily-room] existing room:', existing)
    if (!existing?.url) return json({ error: 'No se pudo obtener la sala existente' }, 500)
    roomUrl = existing.url
  } else {
    console.error('[create-daily-room] Daily.co error:', room)
    return json({ error: room?.info ?? 'Error al crear la sala en Daily.co' }, 502)
  }

  // UPDATE appointments usando service role — bypasea el RLS del frontend
  const { error: updateErr } = await supabase
    .from('appointments')
    .update({ status: 'active', video_url: roomUrl })
    .eq('id', appointmentId)

  if (updateErr) {
    console.error('[create-daily-room] appointments update error:', updateErr.message)
    // No abortar: devolver la URL igual para que el médico pueda unirse
  } else {
    console.log('[create-daily-room] appointment updated to active')
  }

  return json({ url: roomUrl, roomName })
})
