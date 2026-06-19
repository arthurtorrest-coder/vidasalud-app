import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B', amberBg:  '#FFFBEB', amberBorder: '#FDE68A', amberText: '#92400E',
  gray900:  '#111827', gray700:  '#374151', gray500:  '#6B7280',
  gray300:  '#D1D5DB', gray200:  '#E5E7EB', gray100:  '#F3F4F6', gray50: '#F9FAFB',
  white:    '#FFFFFF',
}

const STEPS = [
  { status: 'done',    icon: '✅', label: 'Solicitud recibida',           sublabel: 'Registro completado exitosamente' },
  { status: 'done',    icon: '✅', label: 'Datos recibidos',              sublabel: 'Documentación enviada al equipo' },
  { status: 'active',  icon: '🔍', label: 'Verificando código DIGEMID',   sublabel: 'Validando registro ante DIGEMID/DIRIS' },
  { status: 'pending', icon: '🚀', label: 'Activación de cuenta',         sublabel: 'Acceso completo al directorio VIDASALUD' },
]

const TIPS = [
  { icon: '📸', text: 'Prepara el logo de tu botica (PNG o JPG)' },
  { icon: '📋', text: 'Ten a mano tu código DIGEMID para consultas' },
  { icon: '📦', text: 'Piensa qué productos destacar en tu perfil' },
]

export default function EsperaAprobacionFarmacia() {
  const navigate = useNavigate()
  const { profile, farmacia, setFarmacia } = useAuthStore()

  const [checking,  setChecking]  = useState(false)
  const [lastCheck, setLastCheck] = useState(null)
  const [countdown, setCountdown] = useState(30)

  const checkApproval = useCallback(async () => {
    const email = profile?.email ?? (await supabase.auth.getUser()).data.user?.email
    if (!email || checking) return
    setChecking(true)

    const { data: f } = await supabase
      .from('farmacias')
      .select('id, nombre, codigo_digemid, ciudad, distrito, codigo_referido, aprobado')
      .eq('email', email)
      .maybeSingle()

    setFarmacia(f ?? null)
    setLastCheck(new Date())
    setCountdown(30)
    setChecking(false)

    if (f?.aprobado === true) {
      navigate('/farmacias', { replace: true })
    }
  }, [profile?.email, checking, navigate, setFarmacia])

  useEffect(() => {
    checkApproval()
    const timer = setInterval(checkApproval, 30_000)
    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (checking) return
    const tick = setInterval(() => setCountdown(c => (c <= 1 ? 30 : c - 1)), 1_000)
    return () => clearInterval(tick)
  }, [checking])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const f = farmacia ?? {}

  return (
    <div style={{
      minHeight: '100vh', background: C.gray50,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap');
        @keyframes ea-spin    { to { transform: rotate(360deg) } }
        @keyframes ea-glow    { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)} 50%{box-shadow:0 0 0 8px rgba(245,158,11,0.15)} }
        @keyframes ea-dot     { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
        @keyframes ea-slide   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
      `}</style>

      {/* Header */}
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
          Portal de boticas
        </div>
      </div>

      {/* Contenido */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '28px 20px 48px', gap: 14,
        maxWidth: 440, margin: '0 auto', width: '100%',
      }}>

        {/* Ícono */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: C.amberBg, border: `2px solid ${C.amberBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, animation: 'ea-glow 3s ease infinite',
        }}>
          💊
        </div>

        {/* Título */}
        <div style={{ textAlign: 'center', animation: 'ea-slide 0.4s ease both' }}>
          <h1 style={{ fontSize: 21, fontWeight: 900, color: C.gray900, margin: '0 0 6px', letterSpacing: -0.3 }}>
            Tu botica está siendo verificada
          </h1>
          <p style={{ fontSize: 13, color: C.gray500, margin: 0, lineHeight: 1.6 }}>
            Verificamos tu código DIGEMID y datos de registro.
            Te notificaremos cuando tu cuenta sea activada.
          </p>
        </div>

        {/* Datos de la botica */}
        {f.nombre && (
          <div style={{
            width: '100%',
            background: C.white, border: `1.5px solid ${C.gray200}`,
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', gap: 14, alignItems: 'center',
            animation: 'ea-slide 0.4s 0.05s ease both',
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              💊
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.gray900, lineHeight: 1.2 }}>
                {f.nombre}
              </div>
              {f.ciudad && (
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                  {f.ciudad}{f.distrito ? `, ${f.distrito}` : ''}
                </div>
              )}
              {f.codigo_digemid && (
                <span style={{
                  display: 'inline-block', marginTop: 5,
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                  color: C.green700, background: C.green50,
                  border: `1px solid ${C.green200}`,
                  padding: '2px 8px', borderRadius: 8,
                }}>
                  DIGEMID: {f.codigo_digemid}
                </span>
              )}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, color: C.amber,
              background: C.amberBg, border: `1px solid ${C.amberBorder}`,
              padding: '3px 8px', borderRadius: 8, flexShrink: 0,
            }}>
              En revisión
            </span>
          </div>
        )}

        {/* Pasos de verificación */}
        <div style={{
          width: '100%',
          background: C.white, border: `1.5px solid ${C.gray200}`,
          borderRadius: 16, padding: '16px 16px 12px',
          animation: 'ea-slide 0.4s 0.1s ease both',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: C.gray500,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14,
          }}>
            Progreso de verificación
          </div>

          {STEPS.map((step, i) => {
            const isDone    = step.status === 'done'
            const isActive  = step.status === 'active'
            const isPending = step.status === 'pending'
            const circleColor = isDone ? C.green500 : isActive ? C.amber : C.gray300
            const circleBg   = isDone ? C.green50  : isActive ? C.amberBg : C.gray100
            const lineColor  = isDone ? C.green200 : C.gray200

            return (
              <div key={i}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: circleBg, border: `2px solid ${circleColor}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isDone ? 15 : 14,
                      animation: isActive ? 'ea-glow 2s ease infinite' : 'none',
                    }}>
                      {isActive ? (
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%',
                          border: `2.5px solid ${C.amberBorder}`,
                          borderTopColor: C.amber,
                          animation: 'ea-spin 0.9s linear infinite',
                        }} />
                      ) : (
                        <span>{step.icon}</span>
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{
                        width: 2, height: 28, background: lineColor,
                        margin: '3px 0', borderRadius: 2, transition: 'background 0.5s',
                      }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 6, flex: 1 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: isActive ? 800 : isDone ? 700 : 500,
                      color: isPending ? C.gray500 : C.gray900, lineHeight: 1.3,
                    }}>
                      {step.label}
                      {isActive && (
                        <span style={{ display: 'inline-flex', gap: 2, marginLeft: 6, verticalAlign: 'middle' }}>
                          {[0, 1, 2].map(j => (
                            <span key={j} style={{
                              display: 'inline-block',
                              width: 4, height: 4, borderRadius: '50%',
                              background: C.amber,
                              animation: `ea-dot 1.4s ${j * 0.18}s infinite ease-in-out`,
                            }} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: isPending ? C.gray300 : C.gray500, marginTop: 2 }}>
                      {step.sublabel}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tiempo estimado */}
        <div style={{
          width: '100%',
          background: C.amberBg, border: `1.5px solid ${C.amberBorder}`,
          borderRadius: 14, padding: '12px 16px',
          display: 'flex', gap: 10, alignItems: 'center',
          animation: 'ea-slide 0.4s 0.15s ease both',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⏱️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.amberText }}>Tiempo estimado</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amberText, marginTop: 1 }}>1–2 días hábiles</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.amber, fontWeight: 600 }}>Lun – Vie</div>
            <div style={{ fontSize: 10, color: C.amber, fontWeight: 600, marginTop: 1 }}>9am – 6pm</div>
          </div>
        </div>

        {/* Mientras esperas */}
        <div style={{
          width: '100%',
          background: C.green50, border: `1.5px solid ${C.green200}`,
          borderRadius: 16, padding: '14px 16px',
          animation: 'ea-slide 0.4s 0.2s ease both',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: C.green700,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
          }}>
            Mientras esperas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TIPS.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: C.white, border: `1px solid ${C.green200}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {tip.icon}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.green800, lineHeight: 1.4 }}>
                  {tip.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Botón verificar estado */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, animation: 'ea-slide 0.4s 0.25s ease both' }}>
          <button
            onClick={checkApproval}
            disabled={checking}
            style={{
              width: '100%', padding: '13px 0',
              background: checking ? C.gray100 : `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
              border: 'none',
              color: checking ? C.gray500 : C.white,
              borderRadius: 12, fontSize: 14, fontWeight: 800,
              cursor: checking ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: checking ? 'none' : '0 4px 14px rgba(5,150,105,0.28)',
              transition: 'all 0.15s',
            }}
          >
            {checking ? (
              <>
                <div style={{
                  width: 15, height: 15, borderRadius: '50%',
                  border: `2px solid ${C.gray300}`, borderTopColor: C.gray500,
                  animation: 'ea-spin 0.7s linear infinite',
                }} />
                Verificando…
              </>
            ) : '🔄 Actualizar estado'}
          </button>

          {/* Auto-refresh */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {!checking && (
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%', background: C.green400,
                    animation: `ea-dot 1.4s ${i * 0.16}s infinite ease-in-out`,
                  }} />
                ))}
              </div>
            )}
            <span style={{ fontSize: 11, color: C.gray500 }}>
              {checking
                ? 'Verificando estado…'
                : `Verificación automática en ${countdown}s`}
              {lastCheck && !checking && (
                <span style={{ opacity: 0.6 }}>
                  {' '}· Última {lastCheck.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none', border: 'none',
              color: C.gray500, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', padding: '6px 0',
              textDecoration: 'underline', textDecorationStyle: 'dotted',
            }}
          >
            Cerrar sesión
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: C.gray500, lineHeight: 1.6 }}>
            ¿Tienes alguna consulta?{' '}
            <span style={{ color: C.green700, fontWeight: 700 }}>ayuda@vidasalud.pe</span>
          </div>
        </div>

      </div>
    </div>
  )
}
