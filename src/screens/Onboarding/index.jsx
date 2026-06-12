import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50:  '#ECFDF5',
  amber: '#F59E0B', yape: '#6D28D9', plin: '#0EA5E9',
  gray900: '#111827', gray700: '#374151', gray600: '#4B5563',
  gray500: '#6B7280', gray400: '#9CA3AF', gray300: '#D1D5DB',
  gray200: '#E5E7EB', gray100: '#F3F4F6', white: '#FFFFFF',
  red: '#EF4444', red50: '#FEF2F2',
}

// ─── Ilustraciones SVG inline ────────────────────────────────

const IlluWelcome = () => (
  <svg viewBox="0 0 200 180" width="200" height="180" aria-hidden="true">
    {/* Fondo */}
    <circle cx="100" cy="95" r="78" fill={C.green50} />
    <circle cx="100" cy="95" r="60" fill={C.green100} />
    {/* Cruz médica */}
    <rect x="85" y="62" width="30" height="66" rx="8" fill={C.green600} />
    <rect x="62" y="85" width="76" height="30" rx="8" fill={C.green600} />
    {/* Brillo */}
    <circle cx="78" cy="72" r="6" fill="white" opacity="0.45" />
    {/* Estrella decorativa */}
    <circle cx="44" cy="52" r="5" fill={C.green400} opacity="0.7" />
    <circle cx="158" cy="48" r="7" fill={C.amber} opacity="0.6" />
    <circle cx="162" cy="138" r="5" fill={C.green500} opacity="0.5" />
    <circle cx="38" cy="132" r="4" fill={C.green400} opacity="0.6" />
    {/* Pulso de corazón bajo la cruz */}
    <polyline
      points="60,148 74,148 80,135 88,160 96,142 108,142"
      fill="none" stroke={C.green600} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
)

const IlluPerfil = () => (
  <svg viewBox="0 0 200 180" width="200" height="180" aria-hidden="true">
    {/* Tarjeta de ID */}
    <rect x="30" y="50" width="140" height="100" rx="16" fill={C.white} stroke={C.green200} strokeWidth="2" />
    <rect x="30" y="50" width="140" height="28" rx="16" fill={C.green600} />
    <rect x="30" y="64" width="140" height="14" fill={C.green600} />
    {/* Texto "ID" */}
    <text x="100" y="69" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">VIDASALUD</text>
    {/* Avatar */}
    <circle cx="62" cy="108" r="22" fill={C.green100} />
    <circle cx="62" cy="102" r="10" fill={C.green500} />
    <ellipse cx="62" cy="122" rx="14" ry="8" fill={C.green500} />
    {/* Líneas de texto */}
    <rect x="92" y="96" width="62" height="8" rx="4" fill={C.green100} />
    <rect x="92" y="110" width="50" height="6" rx="3" fill={C.gray200} />
    <rect x="92" y="122" width="42" height="6" rx="3" fill={C.gray200} />
    {/* Check verde */}
    <circle cx="152" cy="56" r="14" fill={C.green500} />
    <polyline points="146,56 150,61 159,51" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Estrellas decorativas */}
    <circle cx="38" cy="40" r="5" fill={C.green400} opacity="0.6" />
    <circle cx="162" cy="162" r="5" fill={C.amber} opacity="0.6" />
  </svg>
)

const IlluIA = () => (
  <svg viewBox="0 0 200 180" width="200" height="180" aria-hidden="true">
    {/* Burbuja de chat izquierda (paciente) */}
    <rect x="22" y="78" width="80" height="44" rx="14" fill={C.green100} />
    <polygon points="22,108 10,120 30,108" fill={C.green100} />
    <rect x="32" y="90" width="58" height="8" rx="4" fill={C.green400} />
    <rect x="32" y="104" width="44" height="7" rx="3.5" fill={C.green300} />
    {/* Burbuja de chat derecha (IA) */}
    <rect x="98" y="40" width="82" height="60" rx="14" fill={C.green700} />
    <polygon points="180,84 192,96 172,84" fill={C.green700} />
    <rect x="110" y="54" width="58" height="8" rx="4" fill="white" opacity="0.85" />
    <rect x="110" y="68" width="48" height="7" rx="3.5" fill="white" opacity="0.65" />
    <rect x="110" y="80" width="36" height="7" rx="3.5" fill="white" opacity="0.5" />
    {/* Ícono cerebro/IA */}
    <circle cx="116" cy="42" r="18" fill={C.green500} />
    <text x="116" y="48" textAnchor="middle" fontSize="16" fontFamily="sans-serif">🤖</text>
    {/* Destellos decorativos */}
    <circle cx="40" cy="42" r="5" fill={C.amber} opacity="0.7" />
    <circle cx="170" cy="152" r="6" fill={C.green400} opacity="0.5" />
    <circle cx="20" cy="158" r="4" fill={C.green300} opacity="0.6" />
  </svg>
)

// ─── Indicador de pasos ───────────────────────────────────────

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            height: 8,
            width: i + 1 === current ? 24 : 8,
            borderRadius: 4,
            background: i + 1 === current ? C.green600 : C.green200,
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function Onboarding() {
  const navigate         = useNavigate()
  const { user, profile, setProfile } = useAuthStore()

  const [step,       setStep]       = useState(1)
  const [dni,        setDni]        = useState(profile?.dni      ?? '')
  const [phone,      setPhone]      = useState(profile?.phone    ?? '')
  const [dniErr,     setDniErr]     = useState('')
  const [phoneErr,   setPhoneErr]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [slideDir,   setSlideDir]   = useState('right') // 'right' | 'left'

  const firstName = profile?.full_name?.split(' ')[0] ?? 'bienvenido/a'
  const hasData   = !!(profile?.dni && profile?.phone)

  // Marca onboarding_completado = true y va al Home
  async function finish() {
    if (!user?.id) { navigate('/inicio', { replace: true }); return }
    const { data } = await supabase
      .from('profiles')
      .update({ onboarding_completado: true })
      .eq('id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
    navigate('/inicio', { replace: true })
  }

  function goTo(n) {
    setSlideDir(n > step ? 'right' : 'left')
    setStep(n)
  }

  async function handleSaveProfile() {
    let ok = true
    if (!dni || !/^\d{8}$/.test(dni)) {
      setDniErr('Debe tener exactamente 8 dígitos')
      ok = false
    } else setDniErr('')
    if (!phone || !/^\d{9,}$/.test(phone)) {
      setPhoneErr('Debe tener mínimo 9 dígitos')
      ok = false
    } else setPhoneErr('')
    if (!ok) return

    setSaving(true)
    const { data } = await supabase
      .from('profiles')
      .update({ dni: dni.trim(), phone: phone.trim() })
      .eq('id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
    setSaving(false)
    goTo(3)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green700} 40%, ${C.green50} 100%)`,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      padding: '20px 0',
    }}>
      <style>{`
        @keyframes ob-in-right {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ob-in-left {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-slide { animation: none !important; }
        }
      `}</style>

      <div style={{
        width: 390, minHeight: 760,
        background: C.white,
        borderRadius: 32,
        border: '1.5px solid #D1D5DB',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>

        {/* ── Barra superior ─────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px 12px',
          background: C.white,
        }}>
          <StepDots current={step} total={3} />
          <button
            type="button"
            onClick={finish}
            style={{
              background: 'none', border: 'none',
              fontSize: 13, fontWeight: 700, color: C.gray500,
              cursor: 'pointer', fontFamily: 'inherit',
              padding: '4px 8px', borderRadius: 8,
            }}
          >
            Omitir
          </button>
        </div>

        {/* ── Contenido del paso ─────────────────────────── */}
        <div
          key={step}
          className="ob-slide"
          style={{
            flex: 1,
            animation: `${slideDir === 'right' ? 'ob-in-right' : 'ob-in-left'} 0.3s ease`,
            display: 'flex', flexDirection: 'column',
            padding: '8px 28px 32px',
            overflowY: 'auto',
          }}
        >
          {step === 1 && (
            <StepWelcome
              firstName={firstName}
              onNext={() => goTo(2)}
              onSkip={finish}
            />
          )}
          {step === 2 && (
            <StepPerfil
              dni={dni}          setDni={setDni}
              phone={phone}      setPhone={setPhone}
              dniErr={dniErr}    phoneErr={phoneErr}
              hasData={hasData}
              saving={saving}
              onSave={handleSaveProfile}
              onSkip={() => goTo(3)}
            />
          )}
          {step === 3 && (
            <StepConsulta
              firstName={firstName}
              onStart={finish}
              onBrowse={finish}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Paso 1: Bienvenida ───────────────────────────────────────

function StepWelcome({ firstName, onNext }) {
  const FEATURES = [
    { icon: '🩺', title: 'Elige tu médico', desc: 'Especialistas verificados con CMP activo' },
    { icon: '💜', title: 'Paga con Yape', desc: 'Yape, Plin, tarjeta o efectivo' },
    { icon: '📹', title: 'Consulta por video', desc: 'Desde tu celular en menos de 5 min' },
  ]

  return (
    <>
      {/* Ilustración */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, marginTop: 8 }}>
        <IlluWelcome />
      </div>

      {/* Título */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 23, fontWeight: 900, color: C.gray900, lineHeight: 1.2, marginBottom: 8 }}>
          ¡Hola, {firstName}! 👋
        </div>
        <div style={{ fontSize: 14, color: C.gray600, lineHeight: 1.6 }}>
          VIDASALUD conecta pacientes con médicos peruanos certificados. Así de simple:
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {FEATURES.map((f, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: C.green50, border: `1.5px solid ${C.green100}`,
              borderRadius: 14, padding: '12px 16px',
              animation: `ob-in-right 0.35s ease both`,
              animationDelay: `${i * 80}ms`,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gray900 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onNext}
        style={{
          width: '100%', padding: '16px 0',
          background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
          color: C.white, border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        Comenzar 🚀
      </button>

      {/* Sello regulatorio */}
      <div style={{
        marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>🛡️</span>
        <span style={{ fontSize: 11, color: C.gray400 }}>
          Médicos colegiados · Ley 30421 · RENIPRESS
        </span>
      </div>
    </>
  )
}

// ─── Paso 2: Completa tu perfil ───────────────────────────────

function StepPerfil({ dni, setDni, phone, setPhone, dniErr, phoneErr, hasData, saving, onSave, onSkip }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, marginTop: 8 }}>
        <IlluPerfil />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.gray900, lineHeight: 1.2, marginBottom: 8 }}>
          {hasData ? '✅ Perfil completo' : 'Completa tu perfil'}
        </div>
        <div style={{ fontSize: 14, color: C.gray600, lineHeight: 1.6 }}>
          {hasData
            ? 'Tus datos ya están registrados. Puedes actualizarlos si es necesario.'
            : 'Necesitamos tu DNI y teléfono para verificar tu identidad y enviarte notificaciones de tus citas.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {/* DNI */}
        <div>
          <label style={{
            display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6,
          }}>
            DNI (8 dígitos)
          </label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={8}
            value={dni}
            onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
            placeholder="12345678"
            style={{
              width: '100%', padding: '13px 16px',
              border: `1.5px solid ${dniErr ? '#EF4444' : C.gray300}`,
              borderRadius: 12, fontSize: 15, color: C.gray900,
              background: dniErr ? '#FEF2F2' : C.white,
              outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
          />
          {dniErr && (
            <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: '#EF4444', fontWeight: 600 }}>
              ⚠ {dniErr}
            </span>
          )}
        </div>

        {/* Teléfono */}
        <div>
          <label style={{
            display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6,
          }}>
            Teléfono (9 dígitos)
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: C.gray500, pointerEvents: 'none',
            }}>
              +51
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={9}
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="987654321"
              style={{
                width: '100%', padding: '13px 16px 13px 46px',
                border: `1.5px solid ${phoneErr ? '#EF4444' : C.gray300}`,
                borderRadius: 12, fontSize: 15, color: C.gray900,
                background: phoneErr ? '#FEF2F2' : C.white,
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
            />
          </div>
          {phoneErr && (
            <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: '#EF4444', fontWeight: 600 }}>
              ⚠ {phoneErr}
            </span>
          )}
        </div>
      </div>

      {/* Privacidad */}
      <div style={{
        background: C.green50, border: `1px solid ${C.green100}`,
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 20,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>🔒</span>
        <span style={{ fontSize: 11, color: C.green700, lineHeight: 1.5 }}>
          Tus datos están protegidos bajo la Ley 29733. Solo se usan para tu atención médica.
        </span>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            width: '100%', padding: '15px 0',
            background: saving ? C.green100 : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            color: saving ? C.green700 : C.white,
            border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: saving ? 'none' : '0 4px 16px rgba(5,150,105,0.35)',
            transition: 'all 0.15s',
          }}
        >
          {saving ? 'Guardando…' : (hasData ? 'Actualizar y continuar →' : 'Guardar y continuar →')}
        </button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%', padding: '12px 0',
            background: 'none', border: `1.5px solid ${C.gray200}`,
            borderRadius: 14, fontSize: 13, fontWeight: 700,
            color: C.gray500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Completar más tarde
        </button>
      </div>
    </>
  )
}

// ─── Paso 3: Primera consulta ─────────────────────────────────

function StepConsulta({ firstName, onStart, onBrowse }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, marginTop: 8 }}>
        <IlluIA />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.gray900, lineHeight: 1.2, marginBottom: 8 }}>
          ¿Cómo te sientes hoy?
        </div>
        <div style={{ fontSize: 14, color: C.gray600, lineHeight: 1.65 }}>
          Nuestro asistente IA analiza tus síntomas y te conecta con el especialista adecuado en segundos.
        </div>
      </div>

      {/* Qué puede hacer el asistente */}
      <div style={{
        background: C.green50, border: `1.5px solid ${C.green100}`,
        borderRadius: 14, padding: '14px 16px', marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.green800, marginBottom: 10 }}>
          🤖 El asistente IA puede:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            '✓ Identificar qué especialista necesitas',
            '✓ Explicarte cómo funciona la teleconsulta',
            '✓ Reservar tu cita en menos de 2 minutos',
          ].map((item, i) => (
            <div key={i} style={{ fontSize: 12, color: C.green700, fontWeight: 600 }}>{item}</div>
          ))}
        </div>
      </div>

      {/* CTA principal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={onStart}
          style={{
            width: '100%', padding: '16px 0',
            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            color: C.white, border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          🤖 Usar el asistente IA
        </button>

        <button
          type="button"
          onClick={onBrowse}
          style={{
            width: '100%', padding: '14px 0',
            background: C.white, border: `1.5px solid ${C.green200}`,
            borderRadius: 14, fontSize: 14, fontWeight: 700,
            color: C.green700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          🩺 Ver médicos disponibles
        </button>
      </div>

      {/* Nota final */}
      <div style={{
        marginTop: 16, textAlign: 'center',
        fontSize: 11, color: C.gray400, lineHeight: 1.5,
      }}>
        Tu primera consulta puede costar desde S/. 20 · Paga con Yape o tarjeta
      </div>
    </>
  )
}
