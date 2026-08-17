import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green300: '#6EE7B7', green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  gray900:  '#111827', gray700:  '#374151', gray600:  '#4B5563',
  gray500:  '#6B7280', gray300:  '#D1D5DB', gray200:  '#E5E7EB',
  gray100:  '#F3F4F6', gray50:   '#F9FAFB', white: '#FFFFFF',
}

const PERSONAS_BASE = 3
const PRECIO_POR_CONSULTA = 10
const PRECIO_POR_PERSONA_ADICIONAL = 5
const OPCIONES_CONSULTAS = [3, 5, 10]

const BENEFICIOS = [
  { icon: '👨‍⚕️', text: 'Consultas médicas por video con doctores certificados' },
  { icon: '📄', text: 'Receta electrónica válida en farmacias de todo el Perú' },
  { icon: '👨‍👩‍👧‍👦', text: 'Todos los integrantes de tu familia bajo un solo plan' },
  { icon: '⚡', text: 'Atención inmediata, sin esperar turnos ni citas presenciales' },
]

export default function PlanFamilia() {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState(PERSONAS_BASE)
  const [consultas, setConsultas] = useState(OPCIONES_CONSULTAS[0])

  const precio = useMemo(() => {
    const personasAdicionales = Math.max(0, personas - PERSONAS_BASE)
    return PRECIO_POR_CONSULTA * consultas + PRECIO_POR_PERSONA_ADICIONAL * personasAdicionales
  }, [personas, consultas])

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: C.gray50,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input[type="range"] { -webkit-appearance: none; appearance: none; }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: ${C.green600}; cursor: pointer;
          box-shadow: 0 2px 8px rgba(5,150,105,0.5);
          border: 3px solid ${C.white};
        }
        input[type="range"]::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: ${C.green600}; cursor: pointer; border: 3px solid ${C.white};
          box-shadow: 0 2px 8px rgba(5,150,105,0.5);
        }
      `}</style>

      {/* ══════════ NAV ══════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,79,60,0.97)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56, boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}>
        <div
          onClick={() => navigate('/')}
          style={{ fontSize: 18, fontWeight: 900, color: C.white, letterSpacing: -0.5, cursor: 'pointer' }}
        >
          VIDA<span style={{ color: C.green400 }}>SALUD</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
            color: C.white, borderRadius: 9, padding: '7px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Iniciar sesión
        </button>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section style={{
        background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green700} 60%, ${C.green500} 100%)`,
        padding: '40px 24px 44px', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          color: C.green200, background: 'rgba(52,211,153,0.15)',
          border: '1px solid rgba(167,243,208,0.3)',
          padding: '4px 12px', borderRadius: 20, marginBottom: 16,
        }}>
          PLAN FAMILIA
        </div>
        <h1 style={{
          fontSize: 30, fontWeight: 900, color: C.white,
          lineHeight: 1.15, letterSpacing: -0.6, marginBottom: 10,
          maxWidth: 420, margin: '0 auto 10px',
        }}>
          Salud para toda tu familia, un solo plan
        </h1>
        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6,
          maxWidth: 380, margin: '0 auto',
        }}>
          Consultas médicas por video para ti y los tuyos, desde <strong style={{ color: C.white }}>S/. 30/mes</strong>.
        </p>
      </section>

      {/* ══════════ BENEFICIOS ══════════ */}
      <section style={{ padding: '32px 20px 8px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12, maxWidth: 480, margin: '0 auto',
        }}>
          {BENEFICIOS.map((b, i) => (
            <div key={i} style={{
              background: C.white, border: `1.5px solid ${C.green100}`,
              borderRadius: 14, padding: '14px 12px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ fontSize: 22 }}>{b.icon}</span>
              <span style={{ fontSize: 12, color: C.gray700, lineHeight: 1.4 }}>{b.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ CALCULADORA ══════════ */}
      <section style={{ padding: '28px 20px 20px' }}>
        <div style={{
          maxWidth: 480, margin: '0 auto',
          background: C.white, border: `1.5px solid ${C.gray200}`,
          borderRadius: 20, padding: '24px 22px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: C.gray900, marginBottom: 4 }}>
            Arma tu plan
          </h2>
          <p style={{ fontSize: 12, color: C.gray500, marginBottom: 22, lineHeight: 1.5 }}>
            Elige cuántas personas y cuántas consultas al mes necesitas. El precio se calcula al instante.
          </p>

          {/* Slider de personas */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.gray900 }}>
                👨‍👩‍👧‍👦 Personas cubiertas
              </label>
              <span style={{ fontSize: 20, fontWeight: 900, color: C.green700 }}>{personas}</span>
            </div>
            <input
              type="range" min={1} max={10} step={1} value={personas}
              onChange={e => setPersonas(Number(e.target.value))}
              style={{
                width: '100%', height: 6, borderRadius: 4,
                background: `linear-gradient(to right, ${C.green500} ${(personas - 1) / 9 * 100}%, ${C.gray200} ${(personas - 1) / 9 * 100}%)`,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.gray500, marginTop: 4 }}>
              <span>1 persona</span>
              <span>10 personas</span>
            </div>
            {personas > PERSONAS_BASE && (
              <div style={{ fontSize: 11, color: C.green700, marginTop: 6 }}>
                {personas - PERSONAS_BASE} persona{personas - PERSONAS_BASE > 1 ? 's' : ''} adicional{personas - PERSONAS_BASE > 1 ? 'es' : ''} · +S/. {(personas - PERSONAS_BASE) * PRECIO_POR_PERSONA_ADICIONAL}/mes
              </div>
            )}
          </div>

          {/* Selector de consultas */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.gray900, display: 'block', marginBottom: 10 }}>
              🩺 Consultas al mes
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {OPCIONES_CONSULTAS.map(n => (
                <button
                  key={n}
                  onClick={() => setConsultas(n)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
                    border: `1.5px solid ${consultas === n ? C.green600 : C.gray200}`,
                    background: consultas === n ? C.green50 : C.white,
                    color: consultas === n ? C.green700 : C.gray600,
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Precio calculado */}
          <div style={{
            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            borderRadius: 16, padding: '18px 20px', marginBottom: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                Precio mensual
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {personas} persona{personas > 1 ? 's' : ''} · {consultas} consultas/mes
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: C.white }}>
              S/. {precio}
            </div>
          </div>

          <button
            onClick={() => navigate('/registro')}
            style={{
              width: '100%', padding: '16px 24px', border: 'none',
              background: C.green600, color: C.white, borderRadius: 14,
              fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(5,150,105,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            ✨ Contratar ahora
          </button>
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: C.gray500 }}>
            Sin permanencia mínima · Cancela cuando quieras
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER simple ══════════ */}
      <footer style={{
        background: C.green900, padding: '24px 24px 20px', textAlign: 'center',
        fontSize: 11, color: 'rgba(255,255,255,0.5)',
      }}>
        © 2026 VIDASALUD · Plataforma de telemedicina en el Perú
      </footer>
    </div>
  )
}
