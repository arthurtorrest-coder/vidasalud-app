// @ts-nocheck — archivo Deno; el TS server de VS Code no reconoce el runtime de Deno.
// Recibe la notificación IPN (server-to-server) que Izipay envía cuando
// cambia el estado de un pago. Esta es la confirmación AUTORITATIVA del
// pago — nunca se marca una cita como pagada solo porque el navegador del
// paciente reportó éxito (puede cerrar la pestaña, perder conexión, etc).
//
// IMPORTANTE — este endpoint debe desplegarse con la verificación de JWT
// de Supabase DESACTIVADA (Izipay no envía ningún JWT de Supabase):
//   supabase functions deploy webhook-izipay --no-verify-jwt
// o, si se despliega desde el dashboard, apagar el toggle "Enforce JWT
// Verification" en la configuración de la función. Sin esto, el gateway de
// Supabase rechaza la notificación con 401 antes de que este código corra.
//
// Deploy: supabase functions deploy webhook-izipay --no-verify-jwt
// Secreto: supabase secrets set IZIPAY_HMAC_KEY=...
//   (la "Clave HMAC-SHA-256" del panel de Izipay — NO la contraseña de la
//   API usada en crear-formulario-izipay, son dos secretos distintos)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const IZIPAY_HMAC_KEY = Deno.env.get('IZIPAY_HMAC_KEY') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256Hex(message, key) {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return toHex(sig)
}

// Izipay reintenta la notificación si no recibe 200 — por eso, salvo que
// la firma sea inválida o el body esté malformado, siempre se responde 200
// aunque internamente no se haya podido actualizar nada (cita no
// encontrada, ya pagada, orderStatus distinto de PAID, etc). Reintentar
// esos casos no los resolvería.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!IZIPAY_HMAC_KEY) {
    console.error('[webhook-izipay] IZIPAY_HMAC_KEY no configurado')
    return new Response('Server misconfigured', { status: 500 })
  }

  // La notificación IPN llega como application/x-www-form-urlencoded con
  // los campos kr-answer, kr-hash, kr-hash-algorithm, kr-hash-key.
  let form
  try {
    form = await req.formData()
  } catch (err) {
    console.error('[webhook-izipay] no se pudo leer el body:', String(err))
    return new Response('Bad Request', { status: 400 })
  }

  const krAnswer  = form.get('kr-answer')
  const krHash    = form.get('kr-hash')
  const krHashKey = form.get('kr-hash-key')

  if (!krAnswer || !krHash) {
    console.error('[webhook-izipay] faltan kr-answer/kr-hash en la notificación')
    return new Response('Bad Request', { status: 400 })
  }

  // kr-hash-key indica con qué clave firmó Izipay: "sha256_hmac" (la que
  // configuramos acá) o "password". Si viene firmada con la otra clave no
  // podemos verificarla con el secreto que tenemos.
  if (krHashKey && krHashKey !== 'sha256_hmac') {
    console.error('[webhook-izipay] kr-hash-key inesperado:', krHashKey, '— se esperaba sha256_hmac')
    return new Response('Unauthorized', { status: 401 })
  }

  const calculatedHash = await hmacSha256Hex(String(krAnswer), IZIPAY_HMAC_KEY)
  if (calculatedHash !== krHash) {
    console.error('[webhook-izipay] firma inválida — posible notificación falsificada')
    return new Response('Unauthorized', { status: 401 })
  }

  let answer
  try {
    answer = JSON.parse(String(krAnswer))
  } catch (err) {
    console.error('[webhook-izipay] kr-answer no es JSON válido:', String(err))
    return new Response('Bad Request', { status: 400 })
  }

  const orderStatus    = answer?.orderStatus
  const appointmentId  = answer?.orderDetails?.orderId ?? answer?.orderId
  const amountCentimos = answer?.transactions?.[0]?.amount

  console.log('[webhook-izipay] notificación verificada —', { appointmentId, orderStatus, amountCentimos })

  if (!appointmentId) {
    console.error('[webhook-izipay] la notificación no trae orderId')
    return new Response('OK', { status: 200 })
  }

  if (orderStatus !== 'PAID') {
    console.log('[webhook-izipay] orderStatus no es PAID, no se actualiza la cita:', orderStatus)
    return new Response('OK', { status: 200 })
  }

  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('id, status, precio_total')
    .eq('id', appointmentId)
    .maybeSingle()

  if (apptErr || !appt) {
    console.error('[webhook-izipay] cita no encontrada:', appointmentId, apptErr?.message)
    return new Response('OK', { status: 200 })
  }

  if (appt.status === 'paid') {
    console.log('[webhook-izipay] la cita ya estaba marcada como pagada:', appointmentId)
    return new Response('OK', { status: 200 })
  }

  // Verificación de monto: lo que Izipay confirma haber cobrado debe
  // coincidir con el precio_total que crear-formulario-izipay fijó al
  // generar el formToken. Si no coincide, no se marca pagada — se deja
  // para revisión manual en vez de confiar ciegamente en la notificación.
  const montoEsperadoCentimos = Math.round(Number(appt.precio_total) * 100)
  if (amountCentimos != null && montoEsperadoCentimos && amountCentimos !== montoEsperadoCentimos) {
    console.error(
      '[webhook-izipay] MONTO NO COINCIDE — esperado:', montoEsperadoCentimos,
      'recibido:', amountCentimos, 'appointmentId:', appointmentId,
    )
    return new Response('OK', { status: 200 })
  }

  const { error: updateErr } = await supabase
    .from('appointments')
    .update({ status: 'paid' })
    .eq('id', appointmentId)

  if (updateErr) {
    console.error('[webhook-izipay] UPDATE falló:', updateErr.message, 'appointmentId:', appointmentId)
    return new Response('OK', { status: 200 })
  }

  console.log('[webhook-izipay] cita marcada como pagada:', appointmentId)
  return new Response('OK', { status: 200 })
})
