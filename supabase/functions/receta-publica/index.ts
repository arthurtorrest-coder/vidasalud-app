// @ts-nocheck — Deno runtime; ignorar errores del TS server de VS Code
// Lectura pública de una receta por access_token (sin login).
// Deploy: supabase functions deploy receta-publica --no-verify-jwt
//
// Seguridad: NO existe una política RLS pública sobre prescriptions (ver
// migración 20260831_prescriptions_access_token.sql). Esta función usa
// service_role y solo devuelve UNA fila que coincida EXACTAMENTE con el
// access_token recibido — nunca permite listar ni enumerar recetas.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ ok: false, error: 'Method Not Allowed' }, 405)

  try {
    const { access_token } = await req.json()
    console.log('[receta-publica] solicitud —', { access_token })

    if (!access_token || !UUID_RE.test(String(access_token))) {
      return json({ ok: false, error: 'Token inválido' }, 400)
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await svc
      .from('prescriptions')
      .select(`
        id, diagnosis, medicines, indications, pdf_url, verification_code, created_at,
        doctor:doctors(nombres, apellidos, especialidad, cmp),
        patient:profiles!patient_id(full_name)
      `)
      .eq('access_token', access_token)
      .maybeSingle()

    if (error) {
      console.error('[receta-publica] error DB:', error.message)
      return json({ ok: false, error: 'No se pudo cargar la receta' }, 500)
    }
    if (!data) {
      return json({ ok: false, error: 'Receta no encontrada' }, 404)
    }

    console.log('[receta-publica] receta encontrada:', data.id)
    return json({ ok: true, receta: data })

  } catch (err) {
    console.error('[receta-publica] error inesperado:', String(err))
    return json({ ok: false, error: String(err) }, 500)
  }
})
