import { useState, useEffect } from 'react'

export const TOUR_KEY = 'vidasalud_tour_v1'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  white: '#FFFFFF', gray900: '#111827', gray700: '#374151',
  gray500: '#6B7280', gray200: '#E5E7EB',
}

const STEPS = [
  {
    selector:    '[data-tour="search"]',
    emoji:       '🔍',
    title:       'Busca tu médico',
    text:        'Escribe el nombre de un médico, una especialidad como "Pediatría", o un síntoma. ¡La búsqueda es instantánea!',
    tooltipSide: 'below',
  },
  {
    selector:    '[data-tour="especialidades-btn"]',
    emoji:       '🩺',
    title:       'Todas las especialidades',
    text:        'Toca este botón para ver todos los tipos de médicos: pediatras, psicólogos, cardiólogos y más.',
    tooltipSide: 'above',
  },
  {
    selector:    '[data-tour="doctor-card"]',
    emoji:       '👨‍⚕️',
    title:       'Tarjeta del médico',
    text:        'Toca la tarjeta del médico para ver su perfil completo, sus horarios disponibles y poder reservar tu consulta.',
    tooltipSide: 'above',
  },
  {
    selector:    '[data-tour="nav-consultar"]',
    emoji:       '📹',
    title:       'Botón Consultar',
    text:        'Este botón verde en el centro te lleva directamente a elegir una especialidad y reservar una consulta hoy.',
    tooltipSide: 'above',
  },
  {
    selector:    '[data-tour="nav-citas"]',
    emoji:       '📅',
    title:       'Mis Citas',
    text:        'Aquí encuentras todas tus consultas programadas. Puedes ver la fecha, la hora y unirte a la videollamada cuando sea el momento.',
    tooltipSide: 'above',
  },
]

// ─── Componente ───────────────────────────────────────────────

export default function TourGuiado({ containerRef, onEnd }) {
  const [step,  setStep]  = useState(0)
  const [rect,  setRect]  = useState(null)   // { x, y, w, h } relativo al container
  const [ready, setReady] = useState(false)

  const current = STEPS[step]

  // Cada vez que cambia el paso: scroll + medir posición del elemento
  useEffect(() => {
    let cancelled = false
    setReady(false)

    async function measure() {
      const el = document.querySelector(current.selector)

      if (!el) {
        if (!cancelled) { setRect(null); setReady(true) }
        return
      }

      // Llevar el elemento a la vista
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await new Promise(r => setTimeout(r, 450))
      if (cancelled) return

      const container = containerRef.current
      if (!container) { if (!cancelled) setReady(true); return }

      const cr  = container.getBoundingClientRect()
      const er  = el.getBoundingClientRect()
      const PAD = 8

      if (!cancelled) {
        setRect({
          x: er.left - cr.left - PAD,
          y: er.top  - cr.top  - PAD,
          w: er.width  + PAD * 2,
          h: er.height + PAD * 2,
        })
        setReady(true)
      }
    }

    measure()
    return () => { cancelled = true }
  }, [step, containerRef, current.selector])

  function handleNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else finish()
  }

  function handlePrev() {
    if (step > 0) setStep(s => s - 1)
  }

  function finish() {
    localStorage.setItem(TOUR_KEY, 'true')
    onEnd()
  }

  // ── Posición del tooltip ─────────────────────────────────
  const containerH = containerRef.current?.clientHeight ?? 780
  const TOOLTIP_H  = 210
  const GAP        = 14

  let tooltipY = 200
  if (rect) {
    tooltipY = current.tooltipSide === 'below'
      ? rect.y + rect.h + GAP
      : rect.y - TOOLTIP_H - GAP
    // Limitar dentro del container
    tooltipY = Math.max(52, Math.min(tooltipY, containerH - TOOLTIP_H - 80))
  }

  // ── Arrow pointing to target ─────────────────────────────
  const arrowUp   = current.tooltipSide === 'below'  // tooltip está debajo → flecha arriba
  const arrowDown = current.tooltipSide === 'above'   // tooltip arriba → flecha abajo

  return (
    <>
      <style>{`
        @keyframes tour-glow {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 3px rgba(52,211,153,0.95); }
          50%       { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 8px rgba(52,211,153,0.4); }
        }
        @keyframes tour-fade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @media (prefers-reduced-motion: reduce) {
          .tour-glow { animation: none !important; }
          .tour-fade { animation: none !important; }
        }
      `}</style>

      {/* Capa de captura: evita scroll accidental durante el tour */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 998, pointerEvents: 'none' }} />

      {/* ── Spotlight ── */}
      {ready && rect && (
        <div
          className="tour-glow"
          style={{
            position: 'absolute',
            top:    rect.y,
            left:   rect.x,
            width:  rect.w,
            height: rect.h,
            borderRadius: 12,
            animation: 'tour-glow 1.8s ease-in-out infinite',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Overlay oscuro (cuando no hay rect todavía) ── */}
      {(!ready || !rect) && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.78)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `3px solid ${C.green100}`, borderTopColor: C.green500,
            animation: 'pa-spin 0.7s linear infinite',
          }} />
        </div>
      )}

      {/* ── Tooltip card ── */}
      {ready && (
        <div
          className="tour-fade"
          style={{
            position: 'absolute',
            top:   tooltipY,
            left:  '4%',
            width: '92%',
            background: C.white,
            borderRadius: 20,
            padding: '16px 18px',
            zIndex: 1001,
            boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
            animation: 'tour-fade 0.25s ease',
          }}
        >
          {/* Flecha apuntando al elemento */}
          {rect && (
            <div style={{
              position: 'absolute',
              left: Math.max(16, Math.min(rect.x + rect.w / 2 - 8, 320)),
              ...(arrowDown ? { bottom: -10 } : { top: -10 }),
              width: 0, height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              ...(arrowDown
                ? { borderTop: `10px solid ${C.white}` }
                : { borderBottom: `10px solid ${C.white}` }),
            }} />
          )}

          {/* Barra de progreso */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= step ? C.green500 : C.gray200,
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          {/* Emoji + título + paso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: C.green50, border: `1.5px solid ${C.green200}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {current.emoji}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.gray900, lineHeight: 1.2 }}>
                {current.title}
              </div>
              <div style={{ fontSize: 11, color: C.green600, fontWeight: 700, marginTop: 2 }}>
                Paso {step + 1} de {STEPS.length}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <p style={{
            fontSize: 14, color: C.gray700, lineHeight: 1.65,
            margin: '0 0 16px', fontWeight: 500,
          }}>
            {current.text}
          </p>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 ? (
              <button
                onClick={handlePrev}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  border: `1.5px solid ${C.green200}`,
                  background: C.white, color: C.green700,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ← Anterior
              </button>
            ) : (
              <button
                onClick={finish}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  border: `1.5px solid ${C.gray200}`,
                  background: C.white, color: C.gray500,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Saltar
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, ${C.green800}, ${C.green500})`,
                color: C.white, fontSize: 14, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 3px 12px rgba(5,150,105,0.4)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {step < STEPS.length - 1 ? 'Siguiente →' : '¡Entendido! ✅'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
