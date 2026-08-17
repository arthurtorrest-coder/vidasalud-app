import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50:  '#ECFDF5',
  gray900:  '#111827', gray700:  '#374151', gray600:  '#4B5563',
  gray500:  '#6B7280', gray300:  '#D1D5DB', gray200:  '#E5E7EB',
  gray100:  '#F3F4F6', white: '#FFFFFF',
  red: '#EF4444', red50: '#FEF2F2',
  amber50: '#FFFBEB', amber200: '#FDE68A', amber700: '#B45309',
}

const PERSONAS_BASE = 3
const PRECIO_POR_CONSULTA = 10
const PRECIO_POR_PERSONA_ADICIONAL = 5

function inputStyle() {
  return {
    width: '100%', padding: '13px 16px',
    border: `1.5px solid ${C.gray300}`,
    borderRadius: 12, fontSize: 14, color: C.gray900,
    background: C.white, outline: 'none', fontFamily: 'inherit',
  }
}

export default function RegistroPlan() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, user } = useAuthStore()

  const personas  = location.state?.personas  ?? PERSONAS_BASE
  const consultas = location.state?.consultas ?? 3
  const precio    = location.state?.precio ??
    (PRECIO_POR_CONSULTA * consultas + PRECIO_POR_PERSONA_ADICIONAL * Math.max(0, personas - PERSONAS_BASE))

  const [form, setForm] = useState({
    nombre_completo: profile?.full_name ?? '',
    telefono:        profile?.phone ?? '',
    dni:             profile?.dni ?? '',
  })
  const [enviado, setEnviado] = useState(false)

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setEnviado(true)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: C.gray100 }}>
      <div style={{
        width: '100%', maxWidth: 480, minHeight: '100vh',
        background: C.white, display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 40px rgba(0,0,0,0.08)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green700} 100%)`,
          padding: '32px 24px 26px',
        }}>
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            color: C.green200, background: 'rgba(52,211,153,0.15)',
            border: '1px solid rgba(167,243,208,0.3)',
            padding: '4px 12px', borderRadius: 20, marginBottom: 14,
          }}>
            PLAN FAMILIA
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: -0.4 }}>
            Registro del titular
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {user ? 'Ya tienes sesión iniciada — solo falta confirmar tus datos.' : 'Completa tus datos para dejar tu plan listo.'}
          </div>
        </div>

        <div style={{ flex: 1, padding: '22px 24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Resumen del plan */}
          <div style={{
            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            borderRadius: 16, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 700, marginBottom: 10 }}>
              RESUMEN DE TU PLAN
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>👨‍👩‍👧‍👦 Personas cubiertas</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{personas}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>🩺 Consultas al mes</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{consultas}</span>
            </div>
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Precio mensual</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: C.white }}>S/. {precio}</span>
            </div>
          </div>

          {enviado ? (
            /* Mensaje de confirmación */
            <div style={{
              background: C.green50, border: `1.5px solid ${C.green200}`,
              borderRadius: 16, padding: '22px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.green800, marginBottom: 8 }}>
                ¡Tu plan está listo!
              </div>
              <div style={{ fontSize: 13, color: C.gray700, lineHeight: 1.6 }}>
                Cuando activemos los pagos podrás completar tu suscripción. Te avisaremos apenas esté disponible.
              </div>
            </div>
          ) : (
            <>
              {/* Formulario del titular */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>
                  Datos del titular
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 7 }}>
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre_completo}
                    onChange={e => handleChange('nombre_completo', e.target.value)}
                    placeholder="Ej: María Elena Quispe"
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 7 }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.telefono}
                    onChange={e => handleChange('telefono', e.target.value)}
                    placeholder="Ej: 987 654 321"
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 7 }}>
                    DNI
                  </label>
                  <input
                    type="text"
                    required
                    value={form.dni}
                    onChange={e => handleChange('dni', e.target.value)}
                    placeholder="Ej: 12345678"
                    style={inputStyle()}
                  />
                </div>

                {/* Aviso de pagos pendientes */}
                <div style={{
                  background: C.amber50, border: `1px solid ${C.amber200}`,
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 12, color: C.amber700, lineHeight: 1.6,
                }}>
                  💳 Los pagos para planes corporativos aún no están activos. Al confirmar tus datos, tu plan queda listo — cuando activemos los pagos podrás completar tu suscripción.
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%', padding: '15px 0', border: 'none',
                    background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                    color: C.white, borderRadius: 13,
                    fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                  }}
                >
                  Confirmar datos del titular
                </button>
              </form>
            </>
          )}

          <button
            onClick={() => navigate('/planes/familia')}
            style={{
              width: '100%', padding: '13px 0', border: `1.5px solid ${C.gray300}`,
              background: C.white, color: C.gray700, borderRadius: 13,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← Volver a los planes
          </button>
        </div>
      </div>
    </div>
  )
}
