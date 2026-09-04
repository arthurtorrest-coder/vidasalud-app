import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { withSpanish } from '../lib/daily'

const C = {
  green800: '#065F46', green600: '#059669',
  red600:   '#DC2626',
  white:    '#FFFFFF',
}

// Nombre fijo de la ventana: si ya está abierta, window.open() la enfoca
// en vez de abrir una pestaña duplicada.
const POPUP_NAME = 'vidasalud_videollamada'

export default function VideoRoom({ url, onLeave, extraActions }) {
  const src = withSpanish(url)
  const popupRef = useRef(null)
  const [estado, setEstado] = useState('opening') // 'opening' | 'open' | 'blocked' | 'closed'

  function abrirVentana() {
    const win = window.open(src, POPUP_NAME)
    if (!win) {
      popupRef.current = null
      setEstado('blocked')
    } else {
      popupRef.current = win
      setEstado('open')
    }
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    abrirVentana()
    // Daily.co corre en otra pestaña (origen distinto) — no hay evento que
    // avise cuando el usuario la cierra, así que se sondea periódicamente.
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) setEstado('closed')
    }, 1000)
    return () => {
      clearInterval(interval)
      popupRef.current?.close()
    }
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps

  const mensaje = {
    opening: 'Abriendo tu videollamada…',
    open:    'Cambia a esa pestaña para continuar tu consulta.',
    blocked: 'Tu navegador bloqueó la ventana emergente. Habilítala o vuelve a intentarlo.',
    closed:  'Parece que cerraste la pestaña — puedes volver a abrirla.',
  }[estado]

  return createPortal(
    <>
      <style>{`
        @keyframes vs-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>

        {/* ── Barra superior ── */}
        <div style={{
          background: C.green800, padding: '10px 16px',
          paddingTop: 'max(10px, env(safe-area-inset-top))',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {estado === 'open' && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
                animation: 'vs-pulse 2s infinite', display: 'inline-block',
              }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
              VIDASALUD · Videoconsulta
            </span>
            {estado === 'open' && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '2px 8px',
              }}>
                En otra pestaña
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {extraActions}
            <button
              onClick={onLeave}
              style={{
                background: C.red600, border: 'none', color: C.white,
                borderRadius: 8, padding: '6px 14px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
              }}
            >
              Salir ✕
            </button>
          </div>
        </div>

        {/* ── Aviso de videollamada en otra pestaña ── */}
        <div style={{
          flex: 1, position: 'relative', background: '#111',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 18,
          padding: '32px 24px', textAlign: 'center',
        }}>
          <span style={{ fontSize: 52 }}>📹</span>

          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.white }}>
              Tu videollamada está abierta en otra pestaña
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 8, maxWidth: 340, lineHeight: 1.5 }}>
              {mensaje}
            </div>
          </div>

          <button
            onClick={abrirVentana}
            style={{
              padding: '13px 26px', border: 'none', borderRadius: 12,
              background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
              color: C.white, fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {estado === 'closed' ? '🔁 Reabrir videollamada' : '↗ Abrir / enfocar pestaña'}
          </button>
        </div>

      </div>
    </>,
    document.body
  )
}
