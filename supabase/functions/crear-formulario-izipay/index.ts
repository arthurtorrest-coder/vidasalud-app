// @ts-nocheck — archivo Deno; el TS server de VS Code no reconoce el runtime de Deno.
// Crea el formToken de Izipay (Krypton V4) que el frontend usa para mostrar
// el formulario embebido de pago (tarjeta, Yape y Plin nativos de Izipay —
// Krypton muestra los métodos habilitados en el panel de Izipay dentro de
// un solo widget, no hace falta pedir cada uno por separado).
// IZIPAY_PASSWORD nunca debe exponerse al navegador — solo vive acá.
// Deploy: supabase functions deploy crear-formulario-izipay
// Secreto: supabase secrets set IZIPAY_PASSWORD=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Usuario de comercio de Izipay — no es secreto (viaja igual en cada request
// de Basic Auth), a diferencia de IZIPAY_PASSWORD. Si alguna vez se usa un
// usuario distinto para pruebas vs producción, mover esto a una env var.
const IZIPAY_USERNAME = '91054750'
const IZIPAY_PASSWORD = Deno.env.get('IZIPAY_PASSWORD') ?? ''
const IZIPAY_CREATE_PAYMENT_URL = 'https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment'

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

  if (!IZIPAY_PASSWORD) {
    console.error('[crear-formulario-izipay] IZIPAY_PASSWORD no configurado')
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

  const { appointmentId, email } = body
  if (!appointmentId || !email) {
    return json({ ok: false, error: 'Faltan campos obligatorios: appointmentId, email' }, 400)
  }

  console.log('[crear-formulario-izipay] solicitud —', { appointmentId, email })

  // 1. Cargar la cita + médico para calcular el precio de forma autoritativa
  //    en el servidor — igual criterio que procesar-pago-culqi. Nunca
  //    confiar en un monto enviado desde el cliente.
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('id, status, patient_id, precio_total, doctor:doctors(especialidad, precio)')
    .eq('id', appointmentId)
    .single()

  if (apptErr || !appt) {
    console.error('[crear-formulario-izipay] cita no encontrada:', apptErr?.message)
    return json({ ok: false, error: 'Cita no encontrada' }, 404)
  }

  if (appt.status === 'paid') {
    console.log('[crear-formulario-izipay] la cita ya estaba pagada:', appointmentId)
    return json({ ok: false, error: 'Esta cita ya fue pagada' }, 409)
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
    console.error('[crear-formulario-izipay] monto inválido calculado:', montoTotal)
    return json({ ok: false, error: 'No se pudo calcular el monto de la cita' }, 500)
  }

  const amountCentimos = Math.round(montoTotal * 100)

  // Datos del comprador — Izipay solo exige "email"; el resto es mejor
  // esfuerzo con lo que ya tenemos guardado en profiles.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', appt.patient_id)
    .maybeSingle()
  const nombreCompleto    = (profile?.full_name ?? '').trim()
  const [firstName, ...restoNombre] = nombreCompleto ? nombreCompleto.split(/\s+/) : ['']
  const lastName = restoNombre.join(' ')

  // 2. Crear el formToken en Izipay (Charge/CreatePayment)
  console.log('[crear-formulario-izipay] creando formToken —', { appointmentId, amountCentimos })
  let izipayRes, data
  try {
    izipayRes = await fetch(IZIPAY_CREATE_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${IZIPAY_USERNAME}:${IZIPAY_PASSWORD}`),
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   amountCentimos,
        currency: 'PEN',
        orderId:  appointmentId,
        customer: {
          email,
          billingDetails: {
            ...(firstName    ? { firstName }            : {}),
            ...(lastName     ? { lastName }              : {}),
            ...(profile?.phone ? { phoneNumber: profile.phone } : {}),
            country: 'PE',
          },
        },
      }),
    })
    data = await izipayRes.json()
  } catch (err) {
    console.error('[crear-formulario-izipay] excepción llamando a Izipay:', String(err))
    return json({ ok: false, error: 'No se pudo contactar la pasarela de pagos' }, 502)
  }

  if (!izipayRes.ok || data?.status !== 'SUCCESS') {
    console.error('[crear-formulario-izipay] Izipay rechazó la solicitud:', JSON.stringify(data))
    return json({
      ok: false,
      error: data?.answer?.errorMessage || 'No se pudo generar el formulario de pago',
    }, 502)
  }

  const formToken = data.answer?.formToken
  if (!formToken) {
    console.error('[crear-formulario-izipay] respuesta sin formToken:', JSON.stringify(data))
    return json({ ok: false, error: 'Respuesta inválida de la pasarela de pagos' }, 502)
  }

  // 3. Si la cita no tenía precio_total fijado, guardarlo ahora — así
  //    webhook-izipay puede validar que el monto que Izipay confirme haber
  //    cobrado coincide con el que se le pidió cobrar acá.
  if (!appt.precio_total) {
    await supabase.from('appointments').update({ precio_total: montoTotal }).eq('id', appointmentId)
  }

  console.log('[crear-formulario-izipay] formToken generado correctamente')
  return json({ ok: true, formToken })
})
