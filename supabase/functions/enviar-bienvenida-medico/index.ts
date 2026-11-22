// @ts-nocheck — archivo Deno; el TS server de VS Code no reconoce el runtime de Deno.
// Los errores de módulo y de 'Deno' son falsos positivos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── HTML del correo de bienvenida ────────────────────────────────────────────
function htmlBienvenida(nombreMedico: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido/a a VIDASALUD</title>
  <style>
    body { margin:0; padding:0; background:#F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
    .wrap { max-width:600px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#064E3B,#047857); padding:36px 32px; text-align:center; }
    .header-emoji { font-size:40px; margin-bottom:10px; }
    .header h1 { color:#ffffff; font-size:24px; font-weight:900; margin:0 0 6px; }
    .header p { color:rgba(255,255,255,0.82); font-size:14px; margin:0; line-height:1.5; }
    .body { padding:28px 32px; }
    .saludo { font-size:16px; font-weight:700; color:#111827; margin-bottom:12px; }
    .intro { font-size:14px; color:#374151; line-height:1.65; margin-bottom:24px; }
    .step { display:flex; gap:14px; align-items:flex-start; margin-bottom:18px; }
    .step-num { width:30px; height:30px; background:linear-gradient(135deg,#065F46,#059669); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; flex-shrink:0; margin-top:2px; }
    .step-content strong { font-size:14px; color:#111827; display:block; margin-bottom:3px; }
    .step-content span { font-size:13px; color:#4B5563; line-height:1.55; }
    .divider { height:1px; background:#E5E7EB; margin:24px 0; }
    .finanzas { background:#F0FDF4; border:1px solid #BBF7D0; border-radius:10px; padding:16px 18px; margin-bottom:24px; }
    .finanzas h3 { font-size:13px; font-weight:800; color:#065F46; margin:0 0 10px; }
    .finanzas table { width:100%; border-collapse:collapse; font-size:13px; }
    .finanzas td { padding:5px 8px; color:#374151; }
    .finanzas td:last-child { font-weight:700; text-align:right; color:#065F46; }
    .finanzas tr:not(:last-child) td { border-bottom:1px solid #D1FAE5; }
    .cta { text-align:center; margin:24px 0; }
    .cta a { background:linear-gradient(135deg,#047857,#059669); color:#ffffff; text-decoration:none; font-size:15px; font-weight:800; padding:14px 32px; border-radius:10px; display:inline-block; }
    .footer { background:#F9FAFB; padding:20px 32px; text-align:center; border-top:1px solid #E5E7EB; }
    .footer p { font-size:12px; color:#6B7280; margin:4px 0; line-height:1.5; }
    .footer a { color:#059669; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="header-emoji">🩺</div>
      <h1>¡Bienvenido/a a VIDASALUD!</h1>
      <p>Tu cuenta ha sido verificada y activada. Ya puedes atender pacientes desde cualquier lugar del Perú.</p>
    </div>
    <div class="body">
      <p class="saludo">Hola, Dr./Dra. ${nombreMedico} 👋</p>
      <p class="intro">
        Tu registro ha sido revisado y aprobado por nuestro equipo. A continuación te indicamos los pasos que debes seguir para configurar tu cuenta correctamente y empezar a recibir consultas.
      </p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <strong>📸 Completa tu perfil médico</strong>
          <span>Sube una foto profesional, escribe una breve presentación (bio) y verifica que tu tarifa neta esté bien configurada.</span>
        </div>
      </div>

      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <strong>📅 Configura tu horario de atención semanal</strong>
          <span>Sin horario, los pacientes no pueden agendar citas contigo. Define los días y rangos de hora en que atiendes desde <strong>Panel Médico → Mi Horario</strong>.</span>
        </div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <strong>🔔 Activa las notificaciones push</strong>
          <span>Recibe alertas en tiempo real cuando un paciente confirme su pago o cuando haya un turno de guardia disponible. Actívalas desde tu celular para no perder ninguna oportunidad.</span>
        </div>
      </div>

      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <strong>🎥 Gestiona tus citas y videollamadas</strong>
          <span>Cuando un paciente pague, verás la cita en tu panel. A la hora acordada, inicia la videollamada con un clic. No necesitas apps adicionales.</span>
        </div>
      </div>

      <div class="step">
        <div class="step-num">5</div>
        <div class="step-content">
          <strong>💊 Emite recetas electrónicas</strong>
          <span>Al terminar cada consulta puedes emitir recetas electrónicas válidas bajo la Ley 30421. El paciente las recibe en su historial y puede presentarlas en cualquier farmacia.</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="finanzas">
        <h3>💰 Condiciones económicas</h3>
        <table>
          <tr>
            <td>Tu tarifa neta (lo que recibes)</td>
            <td>Lo que configuraste</td>
          </tr>
          <tr>
            <td>Comisión de la clínica</td>
            <td>S/. 15 por consulta</td>
          </tr>
          <tr>
            <td>Total que paga el paciente</td>
            <td>Tu tarifa + S/. 15</td>
          </tr>
          <tr>
            <td>Medicina General (recomendado)</td>
            <td>S/. 15 → Paciente paga S/. 30</td>
          </tr>
          <tr>
            <td>Frecuencia de pago a médicos</td>
            <td>Mensual</td>
          </tr>
        </table>
      </div>

      <div class="cta">
        <a href="https://clinicavidasalud.com/medico/panel">Ir a mi Panel Médico →</a>
      </div>

      <p style="font-size:13px;color:#6B7280;text-align:center;line-height:1.6">
        ¿Tienes dudas o problemas técnicos? Escríbenos por WhatsApp y nuestro equipo te ayudará.
      </p>
    </div>
    <div class="footer">
      <p><strong style="color:#065F46">Equipo VIDASALUD — Clínica Virtual de Telemedicina</strong></p>
      <p><a href="https://clinicavidasalud.com">clinicavidasalud.com</a> · Huaraz, Áncash, Perú</p>
    </div>
  </div>
</body>
</html>`
}

// ── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // El webhook de Supabase envía el registro nuevo en record
    const payload = await req.json()
    console.log('[bienvenida-medico] payload:', JSON.stringify(payload))

    const record    = payload.record    // fila nueva (doctors)
    const oldRecord = payload.old_record // fila anterior

    // Solo actuar cuando aprobado cambia de false/null → true
    if (!record?.aprobado || oldRecord?.aprobado === true) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const profileId = record.profile_id
    if (!profileId) throw new Error('profile_id vacío en doctors')

    // Obtener email del médico desde auth.users vía admin API
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profileId)
    if (userError || !userData?.user?.email) throw new Error(`No se pudo obtener email: ${userError?.message}`)

    const email       = userData.user.email
    const nombreMedico = `${record.nombres ?? ''} ${record.apellidos ?? ''}`.trim() || 'Médico'

    // Enviar correo con Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'VIDASALUD <noreply@clinicavidasalud.com>',
        to:      [email],
        subject: '🩺 ¡Bienvenido/a a VIDASALUD! Configura tu cuenta y empieza a atender',
        html:    htmlBienvenida(nombreMedico),
      }),
    })

    const resendData = await resendRes.json()
    console.log('[bienvenida-medico] Resend respuesta:', JSON.stringify(resendData))

    if (!resendRes.ok) throw new Error(`Resend error: ${resendData?.message ?? resendRes.status}`)

    return new Response(JSON.stringify({ ok: true, email, resend_id: resendData.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[bienvenida-medico] Error:', String(err))
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
