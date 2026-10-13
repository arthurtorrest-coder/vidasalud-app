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
// Secretos: supabase secrets set IZIPAY_HMAC_KEY=...
//           supabase secrets set IZIPAY_PASSWORD=...  (ya debería existir —
//           es el mismo secreto que usa crear-formulario-izipay)
//
// Izipay firma la notificación con una de dos claves, según cómo esté
// configurada la cuenta, e indica cuál usó en el campo kr-hash-key —
// AMBOS modos son HMAC-SHA-256(kr-answer, clave), solo cambia la clave:
//   - "sha256_hmac": HMAC-SHA-256(kr-answer, IZIPAY_HMAC_KEY)
//   - "password":    HMAC-SHA-256(kr-answer, IZIPAY_PASSWORD)  (modo legacy)
// (La primera versión de este archivo usaba SHA-256(password + kr-answer)
// para el modo "password" — eso devolvía 401 en producción; la documentación
// oficial de Izipay/Lyra confirma que también es HMAC, no concatenación.)
// En la práctica esta cuenta de Izipay está enviando "password" — se
// soportan ambos modos para no depender de que no cambie en el futuro.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const IZIPAY_HMAC_KEY = Deno.env.get('IZIPAY_HMAC_KEY') ?? ''
const IZIPAY_PASSWORD = Deno.env.get('IZIPAY_PASSWORD') ?? ''

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

  // Verificar la firma con la clave que Izipay dice haber usado
  // (kr-hash-key) — ver nota al inicio del archivo sobre los dos modos.
  let calculatedHash
  if (krHashKey === 'sha256_hmac') {
    if (!IZIPAY_HMAC_KEY) {
      console.error('[webhook-izipay] kr-hash-key=sha256_hmac pero IZIPAY_HMAC_KEY no está configurado')
      return new Response('Server misconfigured', { status: 500 })
    }
    calculatedHash = await hmacSha256Hex(String(krAnswer), IZIPAY_HMAC_KEY)
  } else if (krHashKey === 'password') {
    if (!IZIPAY_PASSWORD) {
      console.error('[webhook-izipay] kr-hash-key=password pero IZIPAY_PASSWORD no está configurado')
      return new Response('Server misconfigured', { status: 500 })
    }
    calculatedHash = await hmacSha256Hex(String(krAnswer), IZIPAY_PASSWORD)
  } else {
    console.error('[webhook-izipay] kr-hash-key inesperado:', krHashKey, '— se esperaba sha256_hmac o password')
    return new Response('Unauthorized', { status: 401 })
  }

  // Diagnóstico — queda liviano por si hay que depurar otra discrepancia de
  // firma más adelante (no loguea IZIPAY_PASSWORD ni IZIPAY_HMAC_KEY).
  console.log('[webhook-izipay][diag] kr-hash-key:', krHashKey)
  console.log('[webhook-izipay][diag] kr-hash recibido:   ', krHash)
  console.log('[webhook-izipay][diag] hash calculado:     ', calculatedHash)
  console.log('[webhook-izipay][diag] ¿coinciden?:', calculatedHash === krHash)

  if (calculatedHash !== krHash) {
    console.error('[webhook-izipay] firma inválida — posible notificación falsificada', { krHashKey })
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
