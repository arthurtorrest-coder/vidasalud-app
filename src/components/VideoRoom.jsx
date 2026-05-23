import { useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'

const C = {
  green800: '#065F46', green600: '#059669', green100: '#D1FAE5',
  red600:   '#DC2626',
  gray900:  '#111827', gray500:  '#6B7280',
  white:    '#FFFFFF',
}

function safeDestroy(frame) {
  try { frame?.destroy() } catch (_) {}
}

export default function VideoRoom({ url, onLeave }) {
  const wrapRef  = useRef(null)
  const frameRef = useRef(null)
  const [status, setStatus] = useState('connecting') // 'connecting' | 'joined' | 'error'
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!wrapRef.current || !url) return

    // isActive: false once React cleanup runs — prevents onLeave() on cleanup-triggered left-meeting
    // hasJoined: true only after joined-meeting — prevents onLeave() when an error ejects us
    let isActive  = true
    let hasJoined = false

    console.log('[VideoRoom] mount — url:', url)

    const frame = DailyIframe.createFrame(wrapRef.current, {
      showLeaveButton:      false,
      showFullscreenButton: true,
      iframeStyle: {
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        border: 'none',
      },
    })
    frameRef.current = frame

    frame
      .on('joined-meeting', () => {
        console.log('[VideoRoom] joined-meeting ✓')
        hasJoined = true
        if (isActive) setStatus('joined')
      })
      .on('left-meeting', () => {
        console.log('[VideoRoom] left-meeting — isActive:', isActive, '| hasJoined:', hasJoined)
        safeDestroy(frame)
        frameRef.current = null
        // Call onLeave only when we were actually in a live call (not on error or cleanup)
        if (isActive && hasJoined) onLeave?.()
      })
      .on('error', ({ errorMsg: msg }) => {
        console.error('[VideoRoom] error event:', msg)
        if (isActive) {
          setStatus('error')
          setErrMsg(msg ?? 'Error de conexión')
        }
      })

    console.log('[VideoRoom] calling frame.join()')
    frame.join({ url })
      .then(() => console.log('[VideoRoom] join() promise resolved'))
      .catch(err => {
        console.error('[VideoRoom] join() rejected:', err?.message ?? err)
        if (isActive) {
          setStatus('error')
          setErrMsg(err?.message ?? 'No se pudo conectar a la sala')
        }
      })

    return () => {
      console.log('[VideoRoom] cleanup — destroying frame (isActive → false)')
      isActive = false
      safeDestroy(frameRef.current)
      frameRef.current = null
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleLeave() {
    const frame = frameRef.current
    // frame is null when: error ejected us (left-meeting already ran) or cleanup already ran
    if (!frame) { onLeave?.(); return }
    console.log('[VideoRoom] handleLeave — calling frame.leave()')
    frame.leave()
      .catch(() => {
        // leave() failed — destroy manually and close
        safeDestroy(frame)
        frameRef.current = null
        onLeave?.()
      })
    // Success: left-meeting will fire with isActive=true, hasJoined=true → onLeave() called there
  }

  return (
    <>
      <style>{`
        @keyframes vs-spin  { to { transform: rotate(360deg) } }
        @keyframes vs-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>

        {/* ── Barra superior ─────────────────────────────────── */}
        <div style={{
          background: C.green800, padding: '10px 16px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {status === 'joined' && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
                animation: 'vs-pulse 2s infinite', display: 'inline-block',
              }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
              VIDASALUD · Videoconsulta
            </span>
            {status === 'joined' && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '2px 8px',
              }}>
                En vivo
              </span>
            )}
          </div>

          <button
            onClick={handleLeave}
            style={{
              background: C.red600, border: 'none', color: C.white,
              borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Salir ✕
          </button>
        </div>

        {/* ── Área de video ───────────────────────────────────── */}
        <div ref={wrapRef} style={{ flex: 1, position: 'relative', background: '#111' }}>

          {/* Conectando */}
          {status === 'connecting' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: '#111', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 20,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                border: `3px solid rgba(255,255,255,0.15)`,
                borderTopColor: C.green600,
                animation: 'vs-spin 0.8s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.white }}>
                  Conectando a la videoconsulta…
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                  Asegúrate de permitir el acceso a cámara y micrófono
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: '#111', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              padding: 28, textAlign: 'center',
            }}>
              <span style={{ fontSize: 44 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>
                  Error de conexión
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5 }}>
                  {errMsg}
                </div>
              </div>
              <button
                onClick={handleLeave}
                style={{
                  marginTop: 4, background: C.green600, border: 'none', color: C.white,
                  borderRadius: 10, padding: '12px 28px', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cerrar
              </button>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
