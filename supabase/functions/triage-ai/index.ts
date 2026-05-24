// @ts-nocheck — archivo Deno, ignorar errores del TS server de Node/VS Code
// Supabase Edge Function — triaje médico con IA
// Secreto requerido: ANTHROPIC_API_KEY
// Desplegar: supabase functions deploy triage-ai
// Secreto:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL = 'claude-sonnet-4-20250514'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Eres el asistente de triaje médico de VIDASALUD, plataforma de telemedicina peruana. Tu rol es ayudar al paciente a identificar qué especialidad médica necesita según sus síntomas.

REGLAS ESTRICTAS:
- Responde SIEMPRE en español, con empatía y brevedad (2-4 oraciones en "message")
- NUNCA hagas diagnósticos definitivos — solo orienta hacia la especialidad correcta
- Si la información es insuficiente, haz UNA pregunta de seguimiento concreta
- Usa lenguaje sencillo, sin tecnicismos innecesarios

EMERGENCIAS — si el paciente menciona CUALQUIERA de estos síntomas, establece emergency:true:
- Dolor de pecho, presión torácica o dolor que irradia al brazo
- Dificultad severa para respirar o sensación de ahogo
- Pérdida de consciencia, desmayo o convulsiones
- Hemorragia severa que no se detiene
- Cara caída, brazo débil repentino, habla incoherente súbita (signos de ACV)
- Hinchazón de garganta, dificultad para tragar (anafilaxia)
- Dolor abdominal severo de inicio súbito
- Fiebre mayor a 40°C con rigidez de nuca
- Trauma grave (accidente, caída de altura, herida de arma)
- Pensamientos activos de hacerse daño o suicidio

ESPECIALIDADES DISPONIBLES EN VIDASALUD:
General, Pediatría, Psicología, Nutrición, Cardiología, Odontología,
Ginecología, Dermatología, Endocrinología, Gastroenterología,
Traumatología, Neurología, Urología, Neumología, Oftalmología, Otorrinolaringología

Responde ÚNICAMENTE con JSON válido (sin markdown, sin bloques de código):
{"message":"texto empático para el paciente","specialty":"Nombre exacto de especialidad o null","emergency":false,"followUp":false}`

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
  try {
    const body = await req.json()
    messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages requerido')
  } catch (e) {
    console.error('[triage-ai] Bad request:', (e as Error).message)
    return json({ error: (e as Error).message }, 400)
  }

  console.log('[triage-ai] Processing', messages.length, 'messages')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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

  let parsed: { message: string; specialty: string | null; emergency: boolean; followUp: boolean }
  try {
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(clean)
    if (!parsed.message) throw new Error('missing message field')
  } catch (e) {
    console.error('[triage-ai] JSON parse error:', e, '| raw:', text)
    parsed = {
      message: text || 'Lo siento, hubo un problema procesando tu consulta. Por favor intenta de nuevo.',
      specialty: null,
      emergency: false,
      followUp: true,
    }
  }

  console.log('[triage-ai] Returning:', parsed)
  return json(parsed)
})
