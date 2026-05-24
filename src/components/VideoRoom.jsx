import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const C = {
  green800: '#065F46', green600: '#059669',
  red600:   '#DC2626',
  white:    '#FFFFFF',
}

export default function VideoRoom({ url, onLeave }) {
  const [loaded, setLoaded] = useState(false)
  const iframeRef = useRef(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      if (iframeRef.current) iframeRef.current.src = ''
    }
  }, [])

  return createPortal(
    <>
      <style>{`
        @keyframes vs-spin  { to { transform: rotate(360deg) } }
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
            {loaded && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
                animation: 'vs-pulse 2s infinite', display: 'inline-block',
              }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
              VIDASALUD · Videoconsulta
            </span>
            {loaded && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '2px 8px',
              }}>
                En vivo
              </span>
            )}
          </div>

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

        {/* ── Área de video ── */}
        <div style={{ flex: 1, position: 'relative', background: '#111', overflow: 'hidden' }}>

          {/* Spinner mientras carga Daily.co */}
          {!loaded && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: '#111', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 20,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.15)',
                borderTopColor: C.green600,
                animation: 'vs-spin 0.8s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.white }}>
                  Conectando a la videoconsulta…
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                  Permite el acceso a cámara y micrófono cuando se solicite
                </div>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={url}
            allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              border: 'none',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.25s ease',
            }}
          />
        </div>

      </div>
    </>,
    document.body
  )
}
