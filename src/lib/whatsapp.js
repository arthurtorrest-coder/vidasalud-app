import { supabase } from './supabase'

// Envía una notificación de WhatsApp vía la Edge Function enviar-whatsapp.
// Fire-and-forget: nunca lanza — si el paciente no tiene teléfono registrado
// o el envío falla, solo se loguea (no debe interrumpir el flujo principal).
export async function enviarWhatsapp({ to, template_name, parameters }) {
  if (!to) {
    console.log(`[whatsapp] "${template_name}" omitido — sin teléfono registrado`)
    return
  }
  try {
    const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
      body: { to, template_name, parameters },
    })
    if (error || !data?.ok) {
      console.warn(`[whatsapp] "${template_name}" falló:`, data?.error ?? error?.message)
    } else {
      console.log(`[whatsapp] "${template_name}" enviado — message_id:`, data.message_id)
    }
  } catch (err) {
    console.warn(`[whatsapp] "${template_name}" excepción:`, err)
  }
}

const SITE_URL = 'https://clinicavidasalud.com'

// Envía "receta_lista". Si el paciente vino referido por una botica
// (tieneBotica=true) y hay accessToken, incluye el link directo de
// descarga sin login (/receta/:accessToken) en vez del link genérico
// a /historial (que requiere sesión iniciada).
//
// IMPORTANTE: esto asume que la plantilla "receta_lista" aprobada en Meta
// tiene 2 variables — {{1}} nombre, {{2}} link — no solo 1. Si en Meta
// Business Manager la plantilla real solo tiene {{1}}, el envío fallará
// y hay que actualizar la plantilla aprobada (o quitar el 2º parámetro
// y ajustar TEMPLATES.receta_lista en enviar-whatsapp/index.ts a la vez).
export async function enviarRecetaListaWhatsapp({ to, nombrePaciente, accessToken, tieneBotica }) {
  const link = tieneBotica && accessToken
    ? `${SITE_URL}/receta/${accessToken}`
    : `${SITE_URL}/historial`

  return enviarWhatsapp({
    to,
    template_name: 'receta_lista',
    parameters: [nombrePaciente || 'Paciente', link],
  })
}
