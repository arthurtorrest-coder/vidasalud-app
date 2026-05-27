// @ts-nocheck — archivo Deno, ignorar errores del TS server de Node/VS Code
// Supabase Edge Function — recepcionista IA de VIDASALUD
// Secreto requerido: ANTHROPIC_API_KEY
// Desplegar: supabase functions deploy triage-ai

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL = 'claude-haiku-4-5-20251001'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildSystemPrompt(patientName: string): string {
  const nombre = patientName ? `El nombre del paciente es ${patientName}.` : ''
  return `Eres la recepcionista virtual de VIDASALUD, plataforma de telemedicina peruana registrada en RENIPRESS. Tu misión es realizar una anamnesis inicial breve y empática para preparar la consulta del paciente con el médico. ${nombre}

CONTEXTO CRÍTICO DE VIDASALUD:
- Actualmente VIDASALUD cuenta SOLO con médicos de Medicina General
- NO tenemos especialistas disponibles (cardiólogos, dermatólogos, psicólogos, etc.)
- Toda consulta finaliza recomendando Medicina General, sin excepción
- Nunca sugieras derivar a un especialista

FLUJO DE ANAMNESIS GUIADO (sigue este orden exacto, una pregunta por turno):
PASO 1 — SÍNTOMA PRINCIPAL: Pregunta qué le pasa y desde cuándo (una sola pregunta que cubra ambos)
PASO 2 — INTENSIDAD: Pide que valore del 1 al 10 qué tan molesto o intenso es el síntoma
PASO 3 — SÍNTOMAS ADICIONALES: Pregunta si tiene otros síntomas como fiebre, náuseas, mareos, cansancio, etc.
PASO 4 — ANTECEDENTES: Pregunta si tiene condiciones médicas previas o toma algún medicamento actualmente
PASO 5 — RESUMEN: Tras completar los 4 pasos anteriores, genera el resumen estructurado y devuelve done:true

REGLAS DE CONVERSACIÓN:
- Siempre en español, tono empático y profesional
- Máximo 2-3 oraciones en el campo "message"
- Una sola pregunta por mensaje, nunca varias a la vez
- NUNCA hagas diagnósticos — tu rol es solo recopilar información para el médico
- Lenguaje sencillo, sin tecnicismos médicos innecesarios
- Si el paciente da respuestas cortas, acepta la información y avanza al siguiente paso

EMERGENCIAS — si el paciente menciona CUALQUIERA de los siguientes síntomas, establece emergency:true de inmediato y detén el flujo:
• Dolor de pecho, presión torácica, o dolor que irradia al brazo o mandíbula
• Dificultad severa para respirar o sensación de ahogo intenso
• Pérdida de consciencia, desmayo o convulsiones
• Hemorragia severa que no se detiene
• Cara caída, brazo débil repentino, habla incoherente de inicio súbito (signos de ACV)
• Hinchazón de garganta, dificultad para tragar (anafilaxia)
• Dolor abdominal severo de inicio súbito
• Fiebre mayor a 40 °C con rigidez de nuca
• Trauma grave: accidente, caída de altura, herida de arma
• Pensamientos activos de hacerse daño o suicidio

FORMATO DE RESPUESTA — JSON válido sin bloques de código ni markdown:
{"message":"texto empático","specialty":null,"emergency":false,"done":false,"summary":null}

CUANDO HAYAS COMPLETADO EL PASO 4 (antecedentes), devuelve exactamente este formato:
{
  "message": "Gracias${patientName ? `, ${patientName}` : ''}. Ya tengo toda la información para tu médico. Te muestro el resumen de tu consulta:",
  "specialty": "Medicina general",
  "emergency": false,
  "done": true,
  "summary": "Motivo: [síntoma principal] desde hace [tiempo] · Intensidad: [X]/10 · Síntomas adicionales: [lista o ninguno referido] · Antecedentes: [condiciones o medicamentos, o sin antecedentes relevantes]"
}`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (!ANTHROPIC_API_KEY) {
    console.error('[triage-ai] ANTHROPIC_API_KEY no configurado')
    return json({ error: 'ANTHROPIC_API_KEY no configurado en los secretos' }, 500)
  }

  let messages: { role: string; content: string }[]
  let patientName = ''
  try {
    const body = await req.json()
    messages    = body.messages
    patientName = body.patientName ?? ''
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages requerido')
  } catch (e) {
    console.error('[triage-ai] Bad request:', (e as Error).message)
    return json({ error: (e as Error).message }, 400)
  }

  console.log('[triage-ai] Processing', messages.length, 'messages | patient:', patientName || '(anónimo)')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':          ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
      'Content-Type':       'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 1024,
      system:     buildSystemPrompt(patientName),
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[triage-ai] Anthropic error:', err)
    return json({ error: 'Error al llamar a la IA. Intenta de nuevo.' }, 502)
  }

  const data = await res.json()
  const text = (data.content?.[0]?.text ?? '').trim()
  console.log('[triage-ai] Raw AI response:', text)

  type Parsed = {
    message: string
    specialty: string | null
    emergency: boolean
    done: boolean
    summary: string | null
  }

  let parsed: Parsed
  try {
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(clean)
    if (!parsed.message) throw new Error('missing message field')
    // Asegurar campos presentes
    parsed.done     = parsed.done     ?? false
    parsed.summary  = parsed.summary  ?? null
    parsed.emergency = parsed.emergency ?? false
    parsed.specialty = parsed.specialty ?? null
  } catch (e) {
    console.error('[triage-ai] JSON parse error:', e, '| raw:', text)
    parsed = {
      message:   text || 'Lo siento, hubo un problema procesando tu consulta. Por favor intenta de nuevo.',
      specialty: null,
      emergency: false,
      done:      false,
      summary:   null,
    }
  }

  console.log('[triage-ai] Returning:', parsed)
  return json(parsed)
})
