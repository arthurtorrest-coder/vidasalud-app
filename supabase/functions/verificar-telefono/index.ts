// @ts-nocheck
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function normalizarTelefono(tel) {
  let digits = String(tel ?? '').replace(/\D/g, '')
  if (digits.startsWith('9') && digits.length === 9) digits = '51' + digits
  return digits
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method Not Allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const waToken     = Deno.env.get('WHATSAPP_TOKEN')
  const waPhoneId   = Deno.env.get('WHATSAPP_PHONE_ID')

  if (!supabaseUrl || !serviceKey || !waToken || !waPhoneId) {
    return json({ ok: false, error: 'Variables de entorno incompletas' }, 500)
  }

  const sbHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    const body = await req.json()
    const { action, phone, code } = body

    if (action === 'send') {
      if (!phone) return json({ ok: false, error: 'Falta el campo phone' }, 400)
      const phoneNorm = normalizarTelefono(phone)
      if (phoneNorm.length < 11) return json({ ok: false, error: 'Numero de telefono invalido' }, 400)

      const otp = String(Math.floor(100000 + Math.random() * 900000))

      await fetch(`${supabaseUrl}/rest/v1/phone_verifications?phone=eq.${phoneNorm}&used=eq.false`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ used: true }),
      })

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/phone_verifications`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          phone: phoneNorm,
          code: otp,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
      })

      if (!insertRes.ok) {
        console.error('Error guardando OTP:', await insertRes.text())
        return json({ ok: false, error: 'Error interno al guardar codigo' }, 500)
      }

      const waPayload = {
        messaging_product: 'whatsapp',
        to: phoneNorm,
        type: 'template',
        template: {
          name: 'verificacion_otp',
          language: { code: 'es_PE' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }],
        },
      }

      const waRes = await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(waPayload),
      })

      const waData = await waRes.json()
      if (!waRes.ok) {
        console.error('Error WhatsApp:', JSON.stringify(waData))
        return json({ ok: false, error: waData?.error?.message ?? 'Error al enviar WhatsApp' }, 502)
      }

      console.log('[verificar-telefono] OTP enviado a', phoneNorm)
      return json({ ok: true, message: 'Codigo enviado por WhatsApp' })
    }

    if (action === 'verify') {
      if (!phone || !code) return json({ ok: false, error: 'Faltan campos phone y code' }, 400)
      const phoneNorm = normalizarTelefono(phone)

      const searchRes = await fetch(
        `${supabaseUrl}/rest/v1/phone_verifications?phone=eq.${phoneNorm}&code=eq.${code}&used=eq.false&expires_at=gt.${new Date().toISOString()}&order=created_at.desc&limit=1`,
        { headers: sbHeaders }
      )

      const rows = await searchRes.json()
      if (!Array.isArray(rows) || rows.length === 0) {
        return json({ ok: false, error: 'Codigo incorrecto o expirado' }, 400)
      }

      await fetch(`${supabaseUrl}/rest/v1/phone_verifications?id=eq.${rows[0].id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ used: true }),
      })

      console.log('[verificar-telefono] Telefono verificado:', phoneNorm)
      return json({ ok: true, message: 'Telefono verificado correctamente' })
    }

    return json({ ok: false, error: 'action debe ser send o verify' }, 400)

  } catch (err) {
    console.error('[verificar-telefono] error:', String(err))
    return json({ ok: false, error: String(err) }, 500)
  }
})