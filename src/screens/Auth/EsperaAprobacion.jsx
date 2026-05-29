import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B', amberBg:  '#FFFBEB', amberBorder: '#FDE68A',
  gray900:  '#111827', gray700:  '#374151', gray500:  '#6B7280',
  gray300:  '#D1D5DB', gray100:  '#F3F4F6', gray50:   '#F9FAFB',
  white:    '#FFFFFF',
}

export default function EsperaAprobacion() {
  const navigate = useNavigate()
  const { profile, doctor, setDoctor } = useAuthStore()
  const [checking,  setChecking]  = useState(false)
  const [lastCheck, setLastCheck] = useState(null)
  const [countdown, setCountdown] = useState(30)

  const checkApproval = useCallback(async () => {
    if (!profile?.id || checking) return
    setChecking(true)

    // Intentar por id (schema.sql) y luego por profile_id (doctors_seed.sql)
    let d = null
    const { data: d1 } = await supabase
      .from('doctors')
      .select('id, aprobado, nombres, apellidos, especialidad, cmp')
      .eq('id', profile.id)
      .maybeSingle()
    d = d1
    if (!d) {
      const { data: d2 } = await supabase
        .from('doctors')
        .select('id, aprobado, nombres, apellidos, especialidad, cmp')
        .eq('profile_id', profile.id)
        .maybeSingle()
      d = d2
    }

    setDoctor(d ?? null)
    setLastCheck(new Date())
    setCountdown(30)
    setChecking(false)

    if (d?.aprobado === true) {
      navigate('/medico/panel', { replace: true })
    }
  }, [profile?.id, checking, navigate, setDoctor])

  // Verificación inicial + intervalo de 30s
  useEffect(() => {
    checkApproval()
    const timer = setInterval(checkApproval, 30_000)
    return () => clearInterval(timer)
  }, [profile?.id])

  // Cuenta regresiva visual
  useEffect(() => {
    if (checking) return
    const tick = setInterval(() => {
      setCountdown(c => (c <= 1 ? 30 : c - 1))
    }, 1_000)
    return () => clearInterval(tick)
  }, [checking])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const docInfo  = doctor ?? {}
  const isCPsP   = (docInfo.cmp ?? '').startsWith('CPsP')
  const femenino = (docInfo.nombres ?? '').trimEnd().endsWith('a')
  const titulo   = isCPsP ? 'Psic.' : femenino ? 'Dra.' : 'Dr.'
  const nombre   = [docInfo.nombres, docInfo.apellidos].filter(Boolean).join(' ')

  return (
    <div style={{
      minHeight: '100vh', background: C.gray50,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap');
        @keyframes ea-spin  { to { transform: rotate(360deg) } }
        @keyframes ea-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes ea-dot   { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
      `}</style>

      {/* Cabecera */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
          VIDA<span style={{ color: C.green400 }}>SALUD</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
          Portal de médicos
        </div>
      </div>

      {/* Contenido */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '36px 20px 40px', gap: 16, maxWidth: 440, margin: '0 auto', width: '100%',
      }}>

        {/* Ícono principal animado */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: C.amberBg, border: `2px solid ${C.amberBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, flexShrink: 0,
          animation: 'ea-pulse 3s ease infinite',
        }}>
          🕐
        </div>

        {/* Título */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 22, fontWeight: 900, color: C.gray900,
            margin: '0 0 8px', letterSpacing: -0.3, lineHeight: 1.25,
          }}>
            Tu solicitud está siendo revisada
          </h1>
          <p style={{ fontSize: 14, color: C.gray500, margin: 0, lineHeight: 1.6 }}>
            Estamos verificando tu número de colegiatura y datos de registro.
            Te avisaremos cuando tu cuenta sea activada.
          </p>
        </div>

        {/* Tiempo estimado */}
        <div style={{
          width: '100%',
          background: C.amberBg, border: `1.5px solid ${C.amberBorder}`,
          borderRadius: 14, padding: '14px 18px',
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⏱️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>
              Tiempo estimado de revisión
            </div>
            <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
              1 a 2 días hábiles
            </div>
          </div>
        </div>

        {/* Datos del médico registrado */}
        {nombre && (
          <div style={{
            width: '100%',
            background: C.white, border: `1.5px solid ${C.gray300}`,
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.gray500,
              letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase',
            }}>
              Datos registrados
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.white, fontSize: 17, fontWeight: 800,
              }}>
                {(docInfo.nombres?.[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>
                  {titulo} {nombre}
                </div>
                {docInfo.especialidad && (
                  <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                    {docInfo.especialidad}
                  </div>
                )}
                {docInfo.cmp && (
                  <div style={{
                    display: 'inline-block', marginTop: 4,
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    color: C.green700, background: C.green50,
                    padding: '2px 8px', borderRadius: 8,
                  }}>
                    {docInfo.cmp}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Indicador de verificación automática */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          {checking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: `2px solid ${C.green100}`, borderTopColor: C.green600,
                animation: 'ea-spin 0.7s linear infinite',
              }} />
              <span style={{ fontSize: 12, color: C.gray500 }}>Verificando estado…</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: C.green400,
                    animation: `ea-dot 1.4s ${i * 0.16}s infinite ease-in-out`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: C.gray500 }}>
                Próxima verificación en {countdown}s
                {lastCheck && (
                  <span style={{ opacity: 0.7 }}>
                    {' '}· Última: {lastCheck.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        {/* Verificar ahora */}
        <button
          onClick={checkApproval}
          disabled={checking}
          style={{
            width: '100%', padding: '14px 0',
            background: checking ? C.gray100 : C.green50,
            border: `1.5px solid ${checking ? C.gray300 : C.green200}`,
            color: checking ? C.gray500 : C.green700,
            borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: checking ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          {checking ? 'Verificando…' : '🔄 Verificar ahora'}
        </button>

        {/* Pasos de revisión */}
        <div style={{
          width: '100%',
          background: C.white, border: `1.5px solid ${C.gray300}`,
          borderRadius: 14, padding: '16px 18px',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.gray500,
            letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase',
          }}>
            Proceso de revisión
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { done: true,  icon: '✅', text: 'Solicitud recibida' },
              { done: false, icon: '🔍', text: 'Verificación de CMP / CPsP en el Colegio' },
              { done: false, icon: '📋', text: 'Revisión de datos y especialidad' },
              { done: false, icon: '🚀', text: 'Activación de cuenta médico' },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'center',
                opacity: step.done ? 1 : 0.5,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{step.icon}</span>
                <span style={{
                  fontSize: 12, fontWeight: step.done ? 700 : 500,
                  color: step.done ? C.gray900 : C.gray500,
                }}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cerrar sesión */}
        <button
          onClick={handleSignOut}
          style={{
            background: 'none', border: 'none',
            color: C.gray500, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            padding: '8px 0', textDecoration: 'underline',
            textDecorationStyle: 'dotted',
          }}
        >
          Cerrar sesión
        </button>

        {/* Nota de contacto */}
        <div style={{
          textAlign: 'center', fontSize: 11, color: C.gray500, lineHeight: 1.6,
        }}>
          ¿Tienes alguna consulta?<br />
          Escríbenos a <span style={{ color: C.green700, fontWeight: 700 }}>ayuda@vidasalud.pe</span>
        </div>

      </div>
    </div>
  )
}
