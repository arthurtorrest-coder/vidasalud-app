import { useState } from 'react'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  white: '#FFFFFF', gray900: '#111827', gray800: '#1F2937',
  gray700: '#374151', gray600: '#4B5563', gray500: '#6B7280',
  gray200: '#E5E7EB', gray100: '#F3F4F6', gray50: '#F9FAFB',
}

const FAQS = [
  {
    emoji: '📅',
    question: '¿Cómo reservo una cita?',
    steps: [
      'Busca un médico en la pantalla principal escribiendo en la barra de búsqueda',
      'Toca la tarjeta del médico para ver su perfil',
      'Elige el día y la hora que más te convenga',
      'Escribe brevemente por qué quieres la consulta',
      'Paga con Yape, Plin o tarjeta de débito/crédito',
      '¡Listo! Recibirás la confirmación en pantalla',
    ],
  },
  {
    emoji: '📹',
    question: '¿Cómo entro a la videollamada?',
    steps: [
      'Ve a "Mis Citas" tocando el ícono del calendario en la barra inferior',
      'Busca tu cita en la lista de "Próximas"',
      'Cuando el médico inicie la consulta, aparecerá un botón azul',
      'Toca el botón "Unirse a la consulta"',
      'El navegador pedirá acceso a tu cámara y micrófono — toca "Permitir"',
      'Escribe tu nombre y toca "Unirse al video"',
    ],
  },
  {
    emoji: '💊',
    question: '¿Dónde están mis recetas?',
    steps: [
      'Ve a "Mi Historial" tocando el ícono de portapapeles en la barra inferior',
      'Selecciona la pestaña "Recetas"',
      'Verás todas tus recetas digitales en orden de más reciente a más antigua',
      'Toca una receta para verla en detalle',
      'Puedes descargarla en PDF para mostrarla en la farmacia',
    ],
  },
  {
    emoji: '💳',
    question: '¿Cómo pago mi consulta?',
    steps: [
      'Al confirmar tu reserva, la app te llevará a la pantalla de pago',
      'Elige tu método: Yape, Plin, o tarjeta de débito/crédito',
      'Con Yape o Plin: escanea el código QR que aparece en pantalla',
      'Con tarjeta: escribe los 16 números, la fecha de vencimiento y el CVV',
      'Confirma el pago y espera la pantalla de "Pago exitoso"',
    ],
  },
  {
    emoji: '❌',
    question: '¿Cómo cancelo una cita?',
    steps: [
      'Ve a "Mis Citas" tocando el ícono del calendario en la barra inferior',
      'Busca la cita que quieres cancelar en "Próximas"',
      'Toca el botón rojo "Cancelar" que está en la tarjeta de la cita',
      'Confirma tocando "Sí, cancelar cita"',
      'Nota importante: cancela con al menos 1 hora de anticipación',
    ],
  },
]

// ─── Subcomponentes ───────────────────────────────────────────

function FaqItem({ faq, expanded, onToggle }) {
  return (
    <div style={{
      borderRadius: 14,
      border: `1.5px solid ${expanded ? C.green200 : C.gray200}`,
      background: expanded ? C.green50 : C.white,
      overflow: 'hidden',
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      {/* Pregunta */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', padding: '14px 16px',
          background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 12,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: expanded ? C.green100 : C.gray100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
          transition: 'background 0.2s',
        }}>
          {faq.emoji}
        </div>
        <span style={{
          flex: 1, textAlign: 'left',
          fontSize: 15, fontWeight: 700,
          color: expanded ? C.green800 : C.gray800,
          lineHeight: 1.3,
          transition: 'color 0.2s',
        }}>
          {faq.question}
        </span>
        <span style={{
          fontSize: 14, color: expanded ? C.green600 : C.gray500,
          display: 'inline-block',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.25s, color 0.2s',
          flexShrink: 0,
        }}>▼</span>
      </button>

      {/* Respuesta con pasos numerados */}
      {expanded && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: `1px solid ${C.green100}`,
          paddingTop: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faq.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.white, fontSize: 12, fontWeight: 800, lineHeight: 1,
                }}>
                  {i + 1}
                </div>
                <p style={{
                  flex: 1, margin: 0,
                  fontSize: 14, color: C.gray700, lineHeight: 1.6, fontWeight: 500,
                  paddingTop: 3,
                }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────

export default function BotoAyuda() {
  const [open,     setOpen]     = useState(false)
  const [expanded, setExpanded] = useState(null)

  function toggleFaq(i) {
    setExpanded(prev => prev === i ? null : i)
  }

  return (
    <>
      <style>{`
        @keyframes ayuda-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes ayuda-sheet {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ayuda-pop   { animation: none !important; }
          .ayuda-sheet { animation: none !important; }
        }
      `}</style>

      {/* ── Botón flotante ── */}
      {!open && (
        <button
          className="ayuda-pop"
          type="button"
          onClick={() => { setOpen(true); setExpanded(null) }}
          aria-label="Ayuda — preguntas frecuentes"
          style={{
            position: 'absolute',
            bottom: 82, right: 14,
            width: 52, height: 52, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            border: `2.5px solid ${C.white}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, lineHeight: 1,
            boxShadow: '0 4px 20px rgba(5,150,105,0.55), 0 0 0 3px rgba(5,150,105,0.15)',
            zIndex: 600,
            animation: 'ayuda-pop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          ❓
        </button>
      )}

      {/* ── Modal (bottom-sheet) ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 700,
            background: 'rgba(0,0,0,0.55)',
          }}
        >
          <div
            className="ayuda-sheet"
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: C.white,
              borderRadius: '22px 22px 0 0',
              maxHeight: '88%',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              animation: 'ayuda-sheet 0.32s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Drag handle */}
            <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: C.gray200 }} />
            </div>

            {/* Header */}
            <div style={{
              padding: '12px 20px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.gray900 }}>
                  ¿En qué te podemos ayudar?
                </div>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                  Toca una pregunta para ver la respuesta
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: C.gray100, border: 'none',
                  cursor: 'pointer', fontSize: 18, color: C.gray500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Lista de FAQs */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '4px 16px 24px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {FAQS.map((faq, i) => (
                <FaqItem
                  key={i}
                  faq={faq}
                  expanded={expanded === i}
                  onToggle={() => toggleFaq(i)}
                />
              ))}

              {/* Pie con número de soporte */}
              <div style={{
                marginTop: 8,
                background: C.green50, border: `1px solid ${C.green200}`,
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>💬</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.green800 }}>
                    ¿Necesitas más ayuda?
                  </div>
                  <div style={{ fontSize: 11, color: C.green700, marginTop: 1 }}>
                    Escríbenos por WhatsApp o llámanos · VIDASALUD
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
