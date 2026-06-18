import { useNavigate } from 'react-router-dom'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green300: '#6EE7B7', green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  amber:    '#F59E0B',
  gray900:  '#111827', gray700:  '#374151', gray600:  '#4B5563',
  gray500:  '#6B7280', gray400:  '#9CA3AF', gray300:  '#D1D5DB',
  gray200:  '#E5E7EB', gray100:  '#F3F4F6', gray50:   '#F9FAFB', white: '#FFFFFF',
}

// ─── Datos ────────────────────────────────────────────────────

const BENEFICIOS = [
  {
    icon: '👨‍⚕️',
    title: 'Médicos certificados',
    desc: 'Todos con CMP o CPsP vigente, verificados por el Colegio Médico del Perú.',
  },
  {
    icon: '⚡',
    title: 'Atención inmediata',
    desc: 'Tiempo de espera promedio menor a 5 minutos. Sin colas, sin traslados.',
  },
  {
    icon: '📄',
    title: 'Receta electrónica válida',
    desc: 'Con validez legal en farmacias de todo el Perú bajo la Ley 30421.',
  },
  {
    icon: '💚',
    title: 'Paga con Yape o Plin',
    desc: 'Pagos seguros con Yape, Plin o tarjeta de débito/crédito en soles.',
  },
]

const ESPECIALIDADES = [
  { icon: '🩺', label: 'Medicina general',    price: 35 },
  { icon: '👶', label: 'Pediatría',           price: 45 },
  { icon: '🧠', label: 'Psicología',          price: 50 },
  { icon: '🥗', label: 'Nutrición',           price: 40 },
  { icon: '❤️', label: 'Cardiología',         price: 70 },
  { icon: '🦷', label: 'Odontología',         price: 60 },
  { icon: '🔬', label: 'Dermatología',        price: 65 },
  { icon: '🫁', label: 'Neumología',          price: 70 },
  { icon: '🧬', label: 'Endocrinología',      price: 75 },
  { icon: '🦴', label: 'Traumatología',       price: 70 },
  { icon: '👁️', label: 'Oftalmología',        price: 65 },
  { icon: '🧪', label: 'Medicina interna',    price: 60 },
]

const PASOS = [
  {
    num: '1',
    icon: '🔍',
    title: 'Elige tu médico',
    desc: 'Busca por especialidad o síntoma. Ve el perfil, rating y disponibilidad en tiempo real.',
  },
  {
    num: '2',
    icon: '💳',
    title: 'Pago seguro al instante',
    desc: 'Usa Yape, Plin o tarjeta. Tu cita queda confirmada en segundos.',
  },
  {
    num: '3',
    icon: '🎥',
    title: 'Consulta por video',
    desc: 'Conéctate desde tu celular. Recibe diagnóstico, receta y seguimiento.',
  },
]

const TESTIMONIOS = [
  {
    texto: 'Mi hijo tenía fiebre a las 11 pm y en 8 minutos ya estaba hablando con una pediatra. Increíble servicio.',
    nombre: 'Mariela C.',
    ciudad: 'Huaraz, Ancash',
    estrellas: 5,
  },
  {
    texto: 'Vivo en una zona rural y antes tardaba horas en llegar al hospital. Ahora consulto desde casa en minutos.',
    nombre: 'Jorge P.',
    ciudad: 'Chiquián, Ancash',
    estrellas: 5,
  },
  {
    texto: 'La receta electrónica fue aceptada sin problema en la farmacia. Todo muy profesional y rápido.',
    nombre: 'Lucía M.',
    ciudad: 'Lima',
    estrellas: 5,
  },
]

// ─── Sub-componentes ──────────────────────────────────────────

function Stars({ n }) {
  return (
    <span style={{ color: C.amber, letterSpacing: 1, fontSize: 14 }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

function SectionTitle({ eyebrow, title, subtitle, light }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 24px', marginBottom: 28 }}>
      {eyebrow && (
        <div style={{
          display: 'inline-block',
          fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          color: light ? C.green200 : C.green600,
          background: light ? 'rgba(52,211,153,0.15)' : C.green50,
          padding: '4px 12px', borderRadius: 20, marginBottom: 10,
        }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{
        fontSize: 22, fontWeight: 900, margin: '0 0 8px',
        color: light ? C.white : C.gray900,
        lineHeight: 1.25, letterSpacing: -0.3,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          fontSize: 14, color: light ? 'rgba(255,255,255,0.75)' : C.gray500,
          margin: 0, lineHeight: 1.55,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── Pantalla ─────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: C.white,
      overflowX: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes ld-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes ld-fade  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes ld-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.15)} }
        a { color: inherit; text-decoration: none; }
      `}</style>

      {/* ══════════ NAV ══════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,79,60,0.97)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56,
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
          VIDA<span style={{ color: C.green400 }}>SALUD</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
          <button
            onClick={() => navigate('/registro')}
            style={{
              background: C.green500, border: 'none',
              color: C.white, borderRadius: 9, padding: '7px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
            }}
          >
            Crear cuenta
          </button>
        </div>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section style={{
        background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green700} 60%, ${C.green500} 100%)`,
        padding: '52px 24px 56px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Círculos decorativos */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(52,211,153,0.12)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40,
          width: 150, height: 150, borderRadius: '50%',
          background: 'rgba(52,211,153,0.08)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto', animation: 'ld-fade 0.5s ease' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)',
            borderRadius: 20, padding: '5px 12px', marginBottom: 20,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: C.green400, display: 'inline-block',
              animation: 'ld-pulse 2s infinite',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.green300 ?? C.green200, letterSpacing: 0.5 }}>
              MÉDICOS DISPONIBLES AHORA
            </span>
          </div>

          {/* Logo + slogan */}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
            VIDASALUD · Telemedicina Perú
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 900, color: C.white,
            lineHeight: 1.1, letterSpacing: -0.8, marginBottom: 14,
          }}>
            Tu salud,<br />
            <span style={{ color: C.green400 }}>donde estés</span>
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 32,
          }}>
            Consulta médica por video con doctores certificados. Receta electrónica válida en todo el Perú. Desde <strong style={{ color: C.white }}>S/. 35</strong>.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => navigate('/registro')}
              style={{
                background: C.white, border: 'none',
                color: C.green800, borderRadius: 14,
                padding: '16px 24px', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <span>🩺</span> Iniciar consulta ahora
            </button>
            <button
              onClick={() => navigate('/registro')}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1.5px solid rgba(255,255,255,0.4)',
                color: C.white, borderRadius: 14,
                padding: '14px 24px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span>✨</span> Crear cuenta gratis
            </button>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: 10, marginTop: 32,
          }}>
            {[
              { n: '500+',    l: 'Médicos activos'  },
              { n: '< 5 min', l: 'Tiempo de espera' },
              { n: '24/7',    l: 'Disponibilidad'   },
            ].map(s => (
              <div key={s.l} style={{
                flex: 1, background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12, padding: '10px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: C.white }}>{s.n}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2, lineHeight: 1.3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ BENEFICIOS ══════════ */}
      <section style={{ padding: '52px 20px 48px', background: C.white }}>
        <SectionTitle
          eyebrow="¿POR QUÉ VIDASALUD?"
          title="La salud que mereces, al alcance de tu mano"
          subtitle="Consultas médicas reales, con doctores reales, desde donde estés en el Perú."
        />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14, maxWidth: 480, margin: '0 auto',
        }}>
          {BENEFICIOS.map((b, i) => (
            <div key={i} style={{
              background: C.green50,
              border: `1.5px solid ${C.green100}`,
              borderRadius: 16, padding: '18px 16px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <span style={{ fontSize: 28, animation: 'ld-float 3s ease infinite', animationDelay: `${i * 0.4}s` }}>
                {b.icon}
              </span>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.green800, lineHeight: 1.3 }}>
                {b.title}
              </div>
              <div style={{ fontSize: 12, color: C.gray600, lineHeight: 1.5 }}>
                {b.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ ESPECIALIDADES ══════════ */}
      <section style={{
        padding: '48px 20px',
        background: `linear-gradient(180deg, ${C.gray50} 0%, ${C.white} 100%)`,
      }}>
        <SectionTitle
          eyebrow="ESPECIALIDADES"
          title="Encuentra al especialista que necesitas"
          subtitle="Más de 16 especialidades disponibles, con médicos listos para atenderte."
        />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, maxWidth: 480, margin: '0 auto 24px',
        }}>
          {ESPECIALIDADES.map((e, i) => (
            <button
              key={i}
              onClick={() => navigate('/registro')}
              style={{
                background: C.white,
                border: `1.5px solid ${C.gray200}`,
                borderRadius: 14, padding: '14px 10px',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.green500; e.currentTarget.style.background = C.green50 }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.background = C.white }}
            >
              <span style={{ fontSize: 22 }}>{e.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.gray700, textAlign: 'center', lineHeight: 1.3 }}>
                {e.label}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: C.green700,
                background: C.green50, padding: '2px 7px', borderRadius: 10,
              }}>
                S/. {e.price}
              </span>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigate('/registro')}
            style={{
              background: 'none', border: `1.5px solid ${C.green600}`,
              color: C.green700, borderRadius: 12, padding: '11px 28px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Ver todos los especialistas →
          </button>
        </div>
      </section>

      {/* ══════════ CÓMO FUNCIONA ══════════ */}
      <section style={{
        padding: '52px 20px 56px',
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
      }}>
        <SectionTitle
          eyebrow="CÓMO FUNCIONA"
          title="Consulta médica en 3 pasos"
          subtitle="Sin esperas, sin desplazamientos. Tu salud en minutos."
          light
        />
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16,
          maxWidth: 480, margin: '0 auto',
        }}>
          {PASOS.map((p, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, alignItems: 'flex-start',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 16, padding: '18px 18px',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: C.green500,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.green300 ?? C.green200,
                  letterSpacing: 0.8, marginBottom: 4,
                }}>
                  PASO {p.num}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  {p.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ TESTIMONIOS ══════════ */}
      <section style={{ padding: '52px 20px 48px', background: C.white }}>
        <SectionTitle
          eyebrow="TESTIMONIOS"
          title="Lo que dicen nuestros pacientes"
          subtitle="Miles de peruanos ya cuidan su salud con VIDASALUD."
        />
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          maxWidth: 480, margin: '0 auto',
        }}>
          {TESTIMONIOS.map((t, i) => (
            <div key={i} style={{
              background: C.green50,
              border: `1.5px solid ${C.green100}`,
              borderRadius: 16, padding: '18px 18px',
            }}>
              <Stars n={t.estrellas} />
              <p style={{
                fontSize: 13, color: C.gray700, lineHeight: 1.6,
                margin: '10px 0 12px', fontStyle: 'italic',
              }}>
                "{t.texto}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.white, fontSize: 13, fontWeight: 800,
                }}>
                  {t.nombre[0]}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gray900 }}>{t.nombre}</div>
                  <div style={{ fontSize: 11, color: C.gray500 }}>{t.ciudad}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ ¿ERES MÉDICO? ══════════ */}
      <section style={{ padding: '52px 20px 48px', background: C.gray50 }}>
        <div style={{
          background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
          borderRadius: 24, padding: '36px 24px 32px',
          maxWidth: 480, margin: '0 auto',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Círculos decorativos */}
          <div style={{
            position: 'absolute', top: -50, right: -50,
            width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(52,211,153,0.1)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: -30,
            width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(52,211,153,0.07)', pointerEvents: 'none',
          }} />

          {/* Eyebrow */}
          <div style={{
            display: 'inline-block',
            fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            color: C.green200, background: 'rgba(52,211,153,0.15)',
            border: '1px solid rgba(167,243,208,0.3)',
            padding: '4px 12px', borderRadius: 20, marginBottom: 16,
          }}>
            PARA MÉDICOS
          </div>

          <h2 style={{
            fontSize: 26, fontWeight: 900, color: C.white,
            lineHeight: 1.2, marginBottom: 10, letterSpacing: -0.3,
          }}>
            Únete a nuestra<br />red de médicos
          </h2>
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6, marginBottom: 26,
          }}>
            Amplía tu práctica con telemedicina. Atiende pacientes en todo el Perú desde donde estés.
          </p>

          {/* 3 beneficios */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {[
              {
                icon: '🕒',
                title: 'Horario flexible',
                desc: 'Define cuándo y cuánto atender. Compatible con consultas presenciales.',
              },
              {
                icon: '💰',
                title: 'Pagos seguros',
                desc: 'Honorarios directos en soles. Los pacientes pagan antes de la cita.',
              },
              {
                icon: '✅',
                title: 'Pacientes verificados',
                desc: 'Cada paciente registra su DNI y confirma su identidad antes de consultar.',
              },
            ].map(b => (
              <div key={b.title} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14, padding: '14px 16px',
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 3 }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    {b.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botón */}
          <button
            onClick={() => navigate('/registro-medico')}
            style={{
              width: '100%', padding: '15px 24px',
              background: C.white, border: 'none',
              color: C.green800, borderRadius: 14,
              fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            👨‍⚕️ Registrarme como médico
          </button>

          <div style={{
            marginTop: 12, textAlign: 'center',
            fontSize: 11, color: 'rgba(255,255,255,0.45)',
          }}>
            Verificamos tu CMP o CPsP · Aprobación en 1-2 días hábiles
          </div>
        </div>
      </section>

      {/* ══════════ ¿TIENES UNA BOTICA? ══════════ */}
      <section style={{ padding: '48px 20px', background: C.white }}>
        <div style={{
          background: `linear-gradient(160deg, #064E3B, #065F46)`,
          borderRadius: 24, padding: '32px 22px',
          maxWidth: 480, margin: '0 auto',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 140, height: 140,
            borderRadius: '50%', background: 'rgba(52,211,153,0.08)', pointerEvents: 'none',
          }} />

          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            color: C.green200, background: 'rgba(52,211,153,0.15)',
            border: '1px solid rgba(167,243,208,0.3)',
            padding: '4px 12px', borderRadius: 20, marginBottom: 16,
          }}>
            PARA BOTICAS Y FARMACIAS
          </div>

          <h2 style={{
            fontSize: 24, fontWeight: 900, color: C.white,
            lineHeight: 1.2, marginBottom: 10, letterSpacing: -0.3,
          }}>
            💊 ¿Tienes una botica?
          </h2>
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.72)',
            lineHeight: 1.6, marginBottom: 22,
          }}>
            Únete a la red de boticas aliadas de VIDASALUD y recibe pacientes con recetas electrónicas válidas.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
            {[
              { icon: '📄', title: 'Recetas electrónicas', desc: 'Los pacientes llegan con receta válida bajo Ley 30421 lista para dispensar.' },
              { icon: '📍', title: 'Aparece en el mapa', desc: 'Saldrás listada en nuestra app para que los pacientes te encuentren.' },
              { icon: '💰', title: 'Aumenta tus ventas', desc: 'Red de más de 5,000 pacientes activos en todo el Perú.' },
            ].map(b => (
              <div key={b.title} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 2 }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    {b.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/registro-farmacia')}
            style={{
              width: '100%', padding: '15px 24px', border: 'none',
              background: C.white, color: C.green800, borderRadius: 14,
              fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            💊 Registrar mi botica
          </button>
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Aprobación en 1-2 días hábiles · DIGEMID requerido
          </div>
        </div>
      </section>

      {/* ══════════ CTA FINAL ══════════ */}
      <section style={{
        padding: '52px 24px',
        background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🩺</div>
        <h2 style={{
          fontSize: 24, fontWeight: 900, color: C.white,
          lineHeight: 1.2, marginBottom: 10, letterSpacing: -0.3,
        }}>
          ¿Listo para cuidar tu salud?
        </h2>
        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,0.8)',
          lineHeight: 1.6, marginBottom: 28, maxWidth: 300, margin: '0 auto 28px',
        }}>
          Regístrate gratis y accede a cientos de médicos certificados en todo el Perú.
        </p>
        <button
          onClick={() => navigate('/registro')}
          style={{
            background: C.white, border: 'none',
            color: C.green800, borderRadius: 14,
            padding: '16px 32px', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          ✨ Crear cuenta gratis
        </button>
        <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          Sin tarjeta requerida · Primera consulta desde S/. 20
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{
        background: C.green900,
        padding: '32px 24px 28px',
        color: 'rgba(255,255,255,0.6)',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {/* Logo */}
          <div style={{
            fontSize: 20, fontWeight: 900, color: C.white,
            letterSpacing: -0.5, marginBottom: 6,
          }}>
            VIDA<span style={{ color: C.green400 }}>SALUD</span>
          </div>
          <div style={{ fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
            Plataforma de telemedicina con sede en Huaraz, Ancash, Perú.
            Conectamos pacientes con médicos certificados a nivel nacional.
          </div>

          {/* Grid info */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '16px 20px', marginBottom: 24, fontSize: 12,
          }}>
            <div>
              <div style={{ color: C.green300 ?? C.green200, fontWeight: 700, marginBottom: 6 }}>
                Regulación
              </div>
              <div style={{ lineHeight: 1.8 }}>
                RENIPRESS registrado<br />
                Colegio Médico del Perú<br />
                CPsP · Colegio de Psicólogos<br />
                Ley 30421 — Receta electrónica
              </div>
            </div>
            <div>
              <div style={{ color: C.green300 ?? C.green200, fontWeight: 700, marginBottom: 6 }}>
                Contacto
              </div>
              <div style={{ lineHeight: 1.8 }}>
                Huaraz, Ancash, Perú<br />
                ayuda@vidasalud.pe<br />
                0800-SALUD (gratuito)<br />
                Lun–Sáb 8am–8pm
              </div>
            </div>
          </div>

          {/* Legal badges */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20,
          }}>
            {['🔒 Datos protegidos', '✅ RENIPRESS', '📋 Ley 30421', '🏥 CMP'].map(badge => (
              <span key={badge} style={{
                fontSize: 10, fontWeight: 600,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '4px 10px', borderRadius: 20, color: 'rgba(255,255,255,0.7)',
              }}>
                {badge}
              </span>
            ))}
          </div>

          {/* Copyright */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)',
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4,
          }}>
            <span>© 2026 VIDASALUD · Todos los derechos reservados</span>
            <span>Receta electrónica válida según Ley 30421</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
