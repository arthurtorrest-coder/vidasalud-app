import { useState } from 'react'

const BLUE  = '#2563EB'
const GREEN = '#059669'
const WHITE = '#FFFFFF'

const PASOS = [
  { icon: '1️⃣', text: 'Toca el botón "Entendido, entrar ahora".' },
  { icon: '2️⃣', text: 'Cuando tu celular muestre el mensaje de permisos, toca PERMITIR o ALLOW.' },
  { icon: '3️⃣', text: 'Si no ves al médico, recarga la página y vuelve a entrar.' },
  { icon: '4️⃣', text: 'Asegúrate de tener buena conexión a internet (WiFi o datos 4G).' },
]

// ─── SVG: diálogo de permisos del celular ─────────────────────

function PermissionSVG() {
  return (
    <svg
      width="200" height="200" viewBox="0 0 200 200"
      style={{ display: 'block', margin: '0 auto' }}
      aria-label="Pantalla de celular pidiendo permiso de cámara"
    >
      {/* Sombra del teléfono */}
      <rect x="57" y="8" width="90" height="155" rx="13" fill="rgba(0,0,0,0.07)" />

      {/* Cuerpo del teléfono */}
      <rect x="55" y="5" width="90" height="155" rx="12" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="2" />

      {/* Notch */}
      <rect x="88" y="9" width="24" height="5" rx="2.5" fill="#D1D5DB" />

      {/* Pantalla */}
      <rect x="60" y="20" width="80" height="135" rx="5" fill="#FFFFFF" />

      {/* Tarjeta del diálogo de permisos */}
      <rect x="63" y="42" width="74" height="108" rx="8" fill="white" stroke="#E5E7EB" strokeWidth="1.5" />

      {/* Ícono de cámara dentro del diálogo */}
      <rect x="85" y="52" width="30" height="22" rx="5" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1.5" />
      <circle cx="100" cy="63" r="7" fill="none" stroke="#2563EB" strokeWidth="2" />
      <circle cx="100" cy="63" r="3" fill="#2563EB" />
      <rect x="109" y="55" width="5" height="4" rx="1.5" fill="#BFDBFE" />

      {/* Texto del diálogo */}
      <text x="100" y="84" textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#111827" fontFamily="system-ui, sans-serif">
        VIDASALUD
      </text>
      <text x="100" y="94" textAnchor="middle" fontSize="4.8" fill="#6B7280" fontFamily="system-ui, sans-serif">
        quiere acceder a la cámara
      </text>
      <text x="100" y="102" textAnchor="middle" fontSize="4.8" fill="#6B7280" fontFamily="system-ui, sans-serif">
        y al micrófono
      </text>

      {/* Halo verde alrededor del botón Permitir */}
      <rect x="66" y="109" width="68" height="22" rx="8" fill="none" stroke="#34D399" strokeWidth="2.5" opacity="0.85" />

      {/* Botón PERMITIR — verde */}
      <rect x="68" y="111" width="64" height="18" rx="6" fill={GREEN} />
      <text x="100" y="123.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="white" fontFamily="system-ui, sans-serif">
        ✓  PERMITIR
      </text>

      {/* Botón Bloquear — gris */}
      <rect x="68" y="133" width="64" height="14" rx="5" fill="#F3F4F6" />
      <text x="100" y="143" textAnchor="middle" fontSize="5.5" fill="#9CA3AF" fontFamily="system-ui, sans-serif">
        Bloquear / Block
      </text>

      {/* Dedo señalando PERMITIR */}
      <text x="144" y="126" textAnchor="middle" fontSize="17">👆</text>
    </svg>
  )
}

// ─── Modal principal ──────────────────────────────────────────

export default function PreCallModal({ onEnter, onClose }) {
  const [showGuide, setShowGuide] = useState(false)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.58)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes pcm-slide {
          from { transform: translateY(100%); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440,
          background: WHITE, borderRadius: '22px 22px 0 0',
          padding: '14px 22px 38px',
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'pcm-slide 0.28s cubic-bezier(0.4,0,0.2,1)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E7EB', margin: '0 auto' }} />

        {!showGuide ? (

          /* ── Vista 1: instrucciones de permisos ── */
          <>
            <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 900, color: '#111827', lineHeight: 1.3 }}>
              📷 Antes de entrar a tu consulta
            </div>

            <PermissionSVG />

            {/* Instrucciones */}
            <div style={{
              background: '#ECFDF5', border: '1.5px solid #A7F3D0',
              borderRadius: 14, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                Tu celular te pedirá permiso para usar la <strong>cámara</strong> y el <strong>micrófono</strong>.
              </p>

              <div style={{
                background: WHITE, borderRadius: 10, padding: '10px 12px',
                border: '1.5px solid #A7F3D0',
                fontSize: 13, lineHeight: 1.6,
              }}>
                👆 Debes tocar{' '}
                <strong style={{ color: GREEN }}>PERMITIR</strong> o{' '}
                <strong style={{ color: GREEN }}>ALLOW</strong>{' '}
                para que el médico pueda verte y escucharte.
              </div>

              <p style={{ margin: 0, fontSize: 12, color: '#B45309', lineHeight: 1.5 }}>
                ⚠️ Si tocas <strong>Bloquear</strong> o <strong>Block</strong>, el médico no podrá verte.
              </p>
            </div>

            <button
              onClick={onEnter}
              style={{
                width: '100%', padding: '14px 0', border: 'none', borderRadius: 12,
                background: `linear-gradient(135deg, #1D4ED8, ${BLUE})`,
                color: WHITE, fontSize: 15, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              Entendido, entrar ahora
            </button>

            <button
              onClick={() => setShowGuide(true)}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 12,
                background: WHITE, color: BLUE,
                border: '1.5px solid #DBEAFE',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ver cómo hacerlo
            </button>
          </>

        ) : (

          /* ── Vista 2: guía paso a paso ── */
          <>
            <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 900, color: '#111827' }}>
              📋 Cómo entrar a tu consulta
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {PASOS.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: '#F9FAFB', borderRadius: 12, padding: '11px 14px',
                  border: '1px solid #E5E7EB',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.25 }}>{p.icon}</span>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, fontWeight: 600 }}>{p.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onEnter}
              style={{
                width: '100%', padding: '14px 0', border: 'none', borderRadius: 12,
                background: `linear-gradient(135deg, #1D4ED8, ${BLUE})`,
                color: WHITE, fontSize: 15, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              Entrar ahora
            </button>

            <button
              onClick={() => setShowGuide(false)}
              style={{
                width: '100%', padding: '10px 0', border: 'none', borderRadius: 12,
                background: 'none', color: '#6B7280',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ← Volver
            </button>
          </>
        )}
      </div>
    </div>
  )
}
