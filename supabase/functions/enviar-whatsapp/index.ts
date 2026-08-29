// @ts-nocheck — Deno runtime; ignorar errores del TS server de VS Code
// Envía mensajes de plantilla de WhatsApp vía Meta Cloud API
// Deploy: supabase functions deploy enviar-whatsapp
// Secretos requeridos: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GRAPH_VERSION = 'v18.0'
// Meta exige el código de idioma exacto con el que se aprobó la plantilla
// en Meta Business Manager — debe coincidir carácter por carácter.
const LANGUAGE_CODE = 'es_PE'

// ── Plantillas configuradas en Meta Business Manager ────────────
// (referencia local para validar el número de parámetros antes de
// llamar a la API — el contenido real vive del lado de Meta)
const TEMPLATES = {
  confirmacion_cita: {
    body: 'Tu cita con el Dr. {{1}} está confirmada para {{2}}. Ingresa a: clinicavidasalud.com',
    paramsCount: 2,
  },
  medico_disponible: {
    body: '¡{{1}}, hay un médico disponible ahora! Ingresa a pagar: clinicavidasalud.com',
    paramsCount: 1,
  },
  recordatorio_cita: {
    body: 'Hola {{1}}, tu consulta con el Dr. {{2}} es en 1 hora. Prepara tu celular.',
    paramsCount: 2,
  },
  receta_lista: {
    body: 'Hola {{1}}, tu receta electrónica está lista. Descárgala en: clinicavidasalud.com/historial',
    paramsCount: 1,
  },
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Normaliza a solo dígitos (Meta espera el número sin "+", ej: 51987654321)
function normalizarTelefono(to) {
  return String(to ?? '').replace(/\D/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ ok: false, error: 'Method Not Allowed' }, 405)

  try {
    const { to, template_name, parameters } = await req.json()
    console.log('[enviar-whatsapp]', { to, template_name, parameters })

    if (!to || !template_name) {
      return json({ ok: false, error: 'Faltan campos obligatorios: to, template_name' }, 400)
    }

    const template = TEMPLATES[template_name]
    if (!template) {
      return json({
        ok: false,
        error: `Plantilla desconocida: "${template_name}". Disponibles: ${Object.keys(TEMPLATES).join(', ')}`,
      }, 400)
    }

    const params = Array.isArray(parameters) ? parameters : []
    if (params.length !== template.paramsCount) {
      return json({
        ok: false,
        error: `La plantilla "${template_name}" espera ${template.paramsCount} parámetro(s), se recibieron ${params.length}`,
      }, 400)
    }

    const whatsappToken = Deno.env.get('WHATSAPP_TOKEN')
    const phoneId        = Deno.env.get('WHATSAPP_PHONE_ID')
    if (!whatsappToken || !phoneId) {
      console.error('[enviar-whatsapp] faltan variables de entorno WHATSAPP_TOKEN / WHATSAPP_PHONE_ID')
      return json({ ok: false, error: 'Configuración de WhatsApp incompleta en el servidor' }, 500)
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: normalizarTelefono(to),
      type: 'template',
      template: {
        name: template_name,
        language: { code: LANGUAGE_CODE },
        ...(params.length > 0 && {
          components: [{
            type: 'body',
            parameters: params.map(p => ({ type: 'text', text: String(p) })),
          }],
        }),
      },
    }

    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[enviar-whatsapp] error de Meta:', JSON.stringify(data))
      return json({ ok: false, error: data?.error?.message ?? `Meta API respondió ${res.status}`, meta: data }, 502)
    }

    console.log('[enviar-whatsapp] enviado —', { to, template_name, message_id: data?.messages?.[0]?.id })
    return json({ ok: true, message_id: data?.messages?.[0]?.id ?? null, data })

  } catch (err) {
    console.error('[enviar-whatsapp] error inesperado:', String(err))
    return json({ ok: false, error: String(err) }, 500)
  }
})
