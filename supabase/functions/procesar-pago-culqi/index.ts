// @ts-nocheck — archivo Deno; el TS server de VS Code no reconoce el runtime de Deno.
// Procesa un cargo REAL con Culqi a partir del token que devuelve el
// Checkout v4 en el frontend (src/pages/Payment/index.jsx).
// CULQI_SECRET_KEY nunca debe exponerse al navegador — solo vive acá.
// Deploy: supabase functions deploy procesar-pago-culqi
// Secreto: supabase secrets set CULQI_SECRET_KEY=sk_live_...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CULQI_SECRET_KEY = Deno.env.get('CULQI_SECRET_KEY') ?? ''
const CULQI_CHARGES_URL = 'https://api.culqi.com/v2/charges'

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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function esGeneralista(especialidad) {
  return (especialidad ?? '').toLowerCase().includes('general')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ ok: false, error: 'Method Not Allowed' }, 405)

  if (!CULQI_SECRET_KEY) {
    console.error('[procesar-pago-culqi] CULQI_SECRET_KEY no configurado')
    return json({ ok: false, error: 'Pasarela de pagos no configurada en el servidor' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ ok: false, error: 'No autorizado' }, 401)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const { token, appointmentId, email } = body
  if (!token || !appointmentId || !email) {
    return json({ ok: false, error: 'Faltan campos obligatorios: token, appointmentId, email' }, 400)
  }

  console.log('[procesar-pago-culqi] solicitud —', { appointmentId, email })

  // 1. Cargar la cita + médico para calcular el precio de forma autoritativa
  //    en el servidor. Nunca confiar en un monto enviado desde el cliente.
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('id, status, patient_id, precio_total, doctor:doctors(especialidad, precio)')
    .eq('id', appointmentId)
    .single()

  if (apptErr || !appt) {
    console.error('[procesar-pago-culqi] cita no encontrada:', apptErr?.message)
    return json({ ok: false, error: 'Cita no encontrada' }, 404)
  }

  if (appt.status === 'paid') {
    console.log('[procesar-pago-culqi] la cita ya estaba pagada:', appointmentId)
    return json({ ok: true, already_paid: true })
  }

  // Si la cita ya tiene un precio_total fijado (ej. reservada desde farmacia
  // o turno de guardia), usarlo tal cual. Si no, calcularlo igual que
  // precioTotalPaciente() en src/lib/finanzas.js.
  let montoTotal = Number(appt.precio_total)
  if (!montoTotal) {
    const { data: cfg } = await supabase
      .from('configuracion_precios')
      .select('tarifa_general, margen_total')
      .eq('id', 1)
      .maybeSingle()
    const tarifaGeneral = Number(cfg?.tarifa_general ?? 15)
    const margenTotal   = Number(cfg?.margen_total   ?? 15)
    const esGeneral     = esGeneralista(appt.doctor?.especialidad)
    const pagoMedico    = esGeneral ? tarifaGeneral : (Number(appt.doctor?.precio) || 0)
    montoTotal = pagoMedico + margenTotal
  }

  if (!(montoTotal > 0)) {
    console.error('[procesar-pago-culqi] monto inválido calculado:', montoTotal)
    return json({ ok: false, error: 'No se pudo calcular el monto de la cita' }, 500)
  }

  const amountCentimos = Math.round(montoTotal * 100)

  // 2. Crear el cargo real en Culqi
  console.log('[procesar-pago-culqi] creando cargo —', { appointmentId, amountCentimos })
  let culqiRes, data
  try {
    culqiRes = await fetch(CULQI_CHARGES_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CULQI_SECRET_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:        amountCentimos,
        currency_code: 'PEN',
        email,
        source_id:     token,
        description:   'Consulta médica VIDASALUD',
        metadata:      { appointment_id: appointmentId },
      }),
    })
    data = await culqiRes.json()
  } catch (err) {
    console.error('[procesar-pago-culqi] excepción llamando a Culqi:', String(err))
    return json({ ok: false, error: 'No se pudo contactar la pasarela de pagos' }, 502)
  }

  if (!culqiRes.ok || data?.object === 'error') {
    console.error('[procesar-pago-culqi] Culqi rechazó el cargo:', JSON.stringify(data))
    return json({
      ok: false,
      error: data?.user_message || data?.merchant_message || 'El pago fue rechazado por el banco',
    }, 402)
  }

  console.log('[procesar-pago-culqi] cargo exitoso — charge id:', data.id)

  // 3. Marcar la cita como pagada, guardando el monto real cobrado y el id
  //    del cargo de Culqi para reconciliación/soporte.
  const { error: updateErr } = await supabase
    .from('appointments')
    .update({
      status:          'paid',
      precio_total:    montoTotal,
      culqi_charge_id: data.id,
    })
    .eq('id', appointmentId)

  if (updateErr) {
    // El cargo YA se hizo en Culqi y no se puede deshacer desde acá —
    // se reporta con el charge_id para que soporte reconcilie manualmente.
    console.error('[procesar-pago-culqi] cargo exitoso pero UPDATE falló:', updateErr.message)
    return json({
      ok: false,
      error: 'El pago se procesó pero no se pudo actualizar la cita. Contacta a soporte con el código: ' + data.id,
      charge_id: data.id,
    }, 500)
  }

  return json({ ok: true, charge_id: data.id, amount: montoTotal })
})
