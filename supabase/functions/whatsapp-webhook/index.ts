// @ts-nocheck — Deno runtime; ignorar errores del TS server de VS Code
// Webhook de WhatsApp Business API (Meta)
// Deploy: supabase functions deploy whatsapp-webhook --no-verify-jwt
// Configurar en Meta: URL de esta función + Verify Token = WHATSAPP_VERIFY_TOKEN (o 'vidasalud2026' por defecto)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? 'vidasalud2026'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)

  // ── GET: verificación del webhook ante Meta ──────────────────
  if (req.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    console.log('[whatsapp-webhook] verificación —', { mode, token, challenge })

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[whatsapp-webhook] verificación OK — devolviendo challenge')
      return new Response(challenge ?? '', { status: 200, headers: CORS })
    }

    console.warn('[whatsapp-webhook] verificación fallida — mode o token inválidos')
    return new Response('Forbidden', { status: 403, headers: CORS })
  }

  // ── POST: notificaciones de mensajes / delivery receipts ─────
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      console.log('[whatsapp-webhook] notificación recibida:', JSON.stringify(body))

      // TODO: procesar body.entry[].changes[].value (mensajes, statuses, etc.)
      // Por ahora solo se loguea — sin lógica de negocio todavía.

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('[whatsapp-webhook] error al procesar POST:', String(err))
      // Responder 200 igual: Meta reintenta agresivamente ante cualquier error
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
})
