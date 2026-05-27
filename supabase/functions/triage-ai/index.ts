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

// tool_choice: forced → Claude SIEMPRE devuelve este tool, sin texto libre
const TRIAGE_TOOL = {
  name: 'triage_response',
  description: 'Respuesta estructurada del triaje. Debes llamar a esta herramienta en CADA turno, sin excepción.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Tu respuesta empática al paciente: la pregunta del paso actual o la confirmación final. Máximo 2-3 oraciones.',
      },
      step: {
        type: 'integer',
        description: 'Paso actual: 1=síntoma principal, 2=intensidad, 3=síntomas adicionales, 4=antecedentes. Usa 0 cuando done=true.',
      },
      done: {
        type: 'boolean',
        description: 'true SOLO cuando hayas completado los 4 pasos y el resumen esté listo. false en todos los pasos intermedios.',
      },
      emergency: {
        type: 'boolean',
        description: 'true si el paciente menciona síntomas de emergencia de la lista crítica. false en caso contrario.',
      },
      specialty: {
        type: ['string', 'null'],
        description: '"Medicina general" cuando done=true. null en pasos intermedios.',
      },
      summary: {
        type: ['string', 'null'],
        description: 'Resumen estructurado SOLO cuando done=true. Formato exacto: "Motivo: [síntoma] desde hace [tiempo] · Intensidad: [X]/10 · Síntomas adicionales: [lista o ninguno] · Antecedentes: [condiciones/medicamentos o sin antecedentes relevantes]". null en pasos intermedios.',
      },
    },
    required: ['message', 'step', 'done', 'emergency'],
  },
}

function buildSystemPrompt(patientName: string): string {
  const nombre = patientName ? `El nombre del paciente es ${patientName}.` : ''
  return `Eres la recepcionista virtual de VIDASALUD, plataforma de telemedicina peruana registrada en RENIPRESS. Tu misión es realizar una anamnesis inicial breve y empática para preparar la consulta del paciente con el médico. ${nombre}

CONTEXTO DE VIDASALUD:
- Solo contamos con médicos de Medicina General — no hay especialistas disponibles
- Toda consulta finaliza con specialty="Medicina general", sin excepción
- Nunca sugieras derivar a un especialista

FLUJO DE ANAMNESIS (sigue este orden exacto, una pregunta por turno):
PASO 1 (step=1) — Pregunta el síntoma principal y desde cuándo lo tiene
PASO 2 (step=2) — Pide que valore del 1 al 10 la intensidad del síntoma
PASO 3 (step=3) — Pregunta si tiene otros síntomas: fiebre, náuseas, mareos, cansancio, etc.
PASO 4 (step=4) — Pregunta si tiene condiciones médicas previas o toma algún medicamento
PASO 5 (step=0, done=true) — Genera el resumen y cierra el triaje

REGLAS:
- Tono empático y profesional, siempre en español
- Máximo 2-3 oraciones por respuesta
- Una sola pregunta por turno, nunca varias a la vez
- NUNCA hagas diagnósticos
- Si el paciente da respuestas cortas, acepta y avanza al siguiente paso

EMERGENCIAS — si el paciente menciona CUALQUIERA de estos síntomas, devuelve emergency=true y detén el flujo:
• Dolor de pecho, presión torácica o dolor que irradia al brazo/mandíbula
• Dificultad severa para respirar o sensación de ahogo intenso
• Pérdida de consciencia, desmayo o convulsiones
• Hemorragia severa que no se detiene
• Cara caída, brazo débil súbito, habla incoherente repentina (ACV)
• Hinchazón de garganta o dificultad para tragar (anafilaxia)
• Dolor abdominal severo de inicio súbito
• Fiebre mayor a 40 °C con rigidez de nuca
• Trauma grave: accidente, caída de altura, herida de arma
• Pensamientos activos de hacerse daño o suicidio`
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
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:       MODEL,
      max_tokens:  1024,
      system:      buildSystemPrompt(patientName),
      tools:       [TRIAGE_TOOL],
      tool_choice: { type: 'tool', name: 'triage_response' },
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[triage-ai] Anthropic error:', err)
    return json({ error: 'Error al llamar a la IA. Intenta de nuevo.' }, 502)
  }

  const data = await res.json()
  console.log('[triage-ai] stop_reason:', data.stop_reason)

  // Con tool_choice forzado, content[0] SIEMPRE es un bloque tool_use
  const toolBlock = (data.content ?? []).find((b: any) => b.type === 'tool_use' && b.name === 'triage_response')

  if (!toolBlock?.input?.message) {
    console.error('[triage-ai] tool_use block no encontrado:', JSON.stringify(data.content))
    return json({
      message:   'Lo siento, hubo un problema procesando tu consulta. Por favor intenta de nuevo.',
      step:      1,
      specialty: null,
      emergency: false,
      done:      false,
      summary:   null,
    })
  }

  const i = toolBlock.input
  const parsed = {
    message:   String(i.message),
    step:      typeof i.step === 'number' ? i.step : 1,
    done:      i.done      === true,
    emergency: i.emergency === true,
    specialty: i.done ? (i.specialty ?? 'Medicina general') : null,
    summary:   i.done ? (i.summary   ?? null)               : null,
  }

  console.log('[triage-ai] Returning:', parsed)
  return json(parsed)
})
