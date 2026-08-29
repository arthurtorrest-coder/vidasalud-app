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
