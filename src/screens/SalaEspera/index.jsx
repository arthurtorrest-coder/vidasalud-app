import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'
import VideoRoom from '../../components/VideoRoom'

// ─── Helpers ──────────────────────────────────────────────────

function getLimaDayBounds(isoString) {
  const lima = new Date(new Date(isoString).getTime() - 5 * 3_600_000)
  const y = lima.getUTCFullYear(), m = lima.getUTCMonth(), d = lima.getUTCDate()
  return {
    start: new Date(Date.UTC(y, m, d,     5,  0,  0)).toISOString(),
    end:   new Date(Date.UTC(y, m, d + 1, 4, 59, 59)).toISOString(),
  }
}

function fmtHora12(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}

function doctorTitle(cmp = '', nombres = '') {
  if (cmp.startsWith('CPsP')) return 'Psic.'
  return nombres.trimEnd().endsWith('a') ? 'Dra.' : 'Dr.'
}

// ─── Sub-componentes ──────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
      border: `3px solid ${C.green100}`, borderTopColor: C.green600,
      animation: 'se-spin 0.75s linear infinite',
    }} />
  )
}

function QueueDots({ total, mineIndex }) {
  const capped = Math.min(total, 10)
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: capped }).map((_, i) => {
        const isMe  = i === mineIndex
        const isDone = i < mineIndex
        return (
          <div key={i} style={{
            width: isMe ? 30 : 22, height: isMe ? 30 : 22,
            borderRadius: '50%', flexShrink: 0,
            background: isMe
              ? `linear-gradient(135deg, ${C.green600}, ${C.green400})`
              : isDone ? C.gray200 : C.green100,
            border: `2px solid ${isMe ? C.green500 : isDone ? C.gray200 : C.green200}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMe ? 10 : 9, fontWeight: 800,
            color: isMe ? C.white : isDone ? C.gray400 : C.green700,
            animation: isMe ? 'se-pulse 2s ease-in-out infinite' : 'none',
          }}>
            {isMe ? 'Tú' : isDone ? '✓' : i + 1}
          </div>
        )
      })}
      {total > capped && (
        <span style={{ fontSize: 11, color: C.gray500, alignSelf: 'center' }}>+{total - capped}</span>
      )}
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function SalaEspera() {
  const { appointmentId } = useParams()
  const navigate          = useNavigate()

  const [appt,       setAppt]       = useState(null)
  const [adelante,   setAdelante]   = useState(0)
  const [totalCola,  setTotalCola]  = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [countdown,  setCountdown]  = useState(30)
  const [videoUrl,   setVideoUrl]   = useState(null)

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)

    const { data: myAppt, error } = await supabase
      .from('appointments')
      .select(`
        id, status, scheduled_at, posicion_cola, hora_referencial, video_url,
        doctor:doctors(id, nombres, apellidos, especialidad, cmp, foto_url)
      `)
      .eq('id', appointmentId)
      .single()

    if (error || !myAppt) {
      navigate('/citas', { replace: true })
      return
    }

    // Normalizar doctor: Supabase puede inferirlo como array en el tipo TS
    const doctorRaw = myAppt.doctor
    const doctorObj = Array.isArray(doctorRaw) ? doctorRaw[0] ?? null : doctorRaw
    const normalized = { ...myAppt, doctor: doctorObj }
    setAppt(normalized)

    if (!['pending', 'paid', 'active'].includes(myAppt.status)) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    const bounds   = getLimaDayBounds(myAppt.scheduled_at)
    const doctorId = doctorObj?.id

    const { data: colaRaw } = await supabase
      .from('appointments')
      .select('id, posicion_cola, status')
      .eq('doctor_id', doctorId)
      .gte('scheduled_at', bounds.start)
      .lte('scheduled_at', bounds.end)
      .in('status', ['paid', 'active'])

    const cola   = colaRaw ?? []
    const myPos  = myAppt.posicion_cola ?? 9999
    const before = cola.filter(
      a => a.id !== appointmentId && (a.posicion_cola ?? 9999) < myPos
    )

    setAdelante(before.length)
    setTotalCola(Math.max(cola.length, 1))
    setCountdown(30)
    setLoading(false)
    setRefreshing(false)
  }, [appointmentId, navigate])

  useEffect(() => { loadData() }, [loadData])

  // Realtime: cualquier UPDATE en appointments recarga la cola
  useEffect(() => {
    if (!appt) return
    const channel = supabase
      .channel(`sala-espera-${appointmentId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        () => loadData(true)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [appt, appointmentId, loadData])

  // Cuenta regresiva y auto-refresh cada 30 s
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { loadData(true); return 30 }
        return c - 1
      })
    }, 1_000)
    return () => clearInterval(tick)
  }, [loadData])

  // ── Variables derivadas ───────────────────────────────────
  const doc       = appt?.doctor ?? {}
  const titulo    = doctorTitle(doc.cmp, doc.nombres)
  const docName   = [doc.nombres, doc.apellidos].filter(Boolean).join(' ')
  const horaRef   = fmtHora12(appt?.hora_referencial)
  const esActiva  = appt?.status === 'active'
  const esDone    = ['done', 'cancelled'].includes(appt?.status)
  const listoCola = appt?.status === 'paid' && adelante === 0
  const minEsp    = adelante * 20
  const myIndex   = Math.max(0, totalCola - adelante - 1)

  return (
    <div style={{
      minHeight: '100vh', background: C.gray50,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');
        @keyframes se-spin  { to { transform: rotate(360deg) } }
        @keyframes se-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.14)} }
        @keyframes se-glow  { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} 50%{box-shadow:0 0 0 14px rgba(16,185,129,0.20)} }
        @keyframes se-slide { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes se-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {videoUrl && <VideoRoom url={videoUrl} onLeave={() => setVideoUrl(null)} />}

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '18px 20px 24px', flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/citas')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: C.white, borderRadius: 20, padding: '5px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
            fontFamily: 'inherit',
          }}
        >
          ← Mis citas
        </button>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.white, letterSpacing: -0.3 }}>
          🪑 Sala de espera virtual
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
          Actualización en tiempo real · Tu turno se notifica automáticamente
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{
        flex: 1, padding: '16px 18px 40px',
        display: 'flex', flexDirection: 'column', gap: 12,
        maxWidth: 440, margin: '0 auto', width: '100%',
      }}>

        {/* Cargando */}
        {loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '48px 0',
          }}>
            <Spinner />
            <span style={{ fontSize: 13, color: C.gray500 }}>Cargando sala de espera…</span>
          </div>
        )}

        {/* Cita terminada */}
        {!loading && esDone && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            background: C.white, borderRadius: 20, border: `1.5px solid ${C.gray200}`,
            animation: 'se-slide 0.4s ease both',
          }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.gray900, marginTop: 12 }}>
              Consulta completada
            </div>
            <div style={{ fontSize: 13, color: C.gray500, marginTop: 6 }}>
              Tu cita con {titulo} {docName} ha finalizado.
            </div>
            <button
              onClick={() => navigate('/citas')}
              style={{
                marginTop: 20, padding: '12px 28px',
                background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                color: C.white, border: 'none', borderRadius: 12,
                fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ver mis citas
            </button>
          </div>
        )}

        {/* Estado principal de la cola */}
        {!loading && !esDone && (
          <>
            {/* Tarjeta de estado */}
            <div style={{
              background: C.white,
              border: `1.5px solid ${esActiva ? C.green300 : listoCola ? C.green200 : C.gray200}`,
              borderRadius: 20, overflow: 'hidden',
              animation: 'se-slide 0.4s ease both',
            }}>
              {/* Barra de progreso */}
              <div style={{
                height: 5,
                background: esActiva
                  ? `linear-gradient(90deg, ${C.green500}, ${C.green400})`
                  : listoCola
                    ? `linear-gradient(90deg, ${C.green400}, ${C.green300})`
                    : `linear-gradient(90deg, ${C.amber}, #FDE68A)`,
              }} />

              <div style={{ padding: '22px 18px 24px', textAlign: 'center' }}>

                {/* ── Es tu turno ── */}
                {esActiva && (
                  <>
                    <div style={{ fontSize: 52, animation: 'se-blink 1.2s step-end infinite' }}>🔔</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.green800, marginTop: 12, letterSpacing: -0.3 }}>
                      ¡Es tu turno!
                    </div>
                    <div style={{ fontSize: 13, color: C.green700, marginTop: 6, lineHeight: 1.5 }}>
                      {titulo} {docName} está listo para atenderte.
                    </div>
                    <button
                      onClick={() => appt?.video_url ? setVideoUrl(appt.video_url) : navigate('/inicio')}
                      style={{
                        marginTop: 18, width: '100%', padding: '15px 0',
                        background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                        color: C.white, border: 'none', borderRadius: 14,
                        fontSize: 15, fontWeight: 900, cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(5,150,105,0.40)', fontFamily: 'inherit',
                        animation: 'se-glow 2s ease-in-out infinite',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      📹 Entrar a la consulta
                    </button>
                  </>
                )}

                {/* ── Siguiente en la cola ── */}
                {!esActiva && listoCola && (
                  <>
                    <div style={{ fontSize: 48 }}>⚡</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: C.green800, marginTop: 10 }}>
                      ¡Eres el siguiente!
                    </div>
                    <div style={{ fontSize: 13, color: C.green700, marginTop: 6, lineHeight: 1.5 }}>
                      El médico te llamará en breve.<br />Mantente listo.
                    </div>
                    <button
                      onClick={() => navigate('/inicio')}
                      style={{
                        marginTop: 16, width: '100%', padding: '14px 0',
                        background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                        color: C.white, border: 'none', borderRadius: 12,
                        fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                      }}
                    >
                      ⚡ Entrar ahora
                    </button>
                  </>
                )}

                {/* ── En espera ── */}
                {!esActiva && !listoCola && (
                  <>
                    <div style={{
                      fontSize: 56, fontWeight: 900, lineHeight: 1,
                      background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                      #{appt?.posicion_cola ?? '—'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.gray700, marginTop: 4 }}>
                      Tu posición en la cola
                    </div>

                    {totalCola > 0 && (
                      <div style={{ margin: '18px 0 10px' }}>
                        <QueueDots total={totalCola} mineIndex={myIndex} />
                      </div>
                    )}

                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      background: C.gray100, borderRadius: 20, padding: '6px 16px', marginTop: 8,
                    }}>
                      <span style={{ fontSize: 15 }}>👤</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>
                        {adelante === 0
                          ? 'No hay nadie antes que tú'
                          : `${adelante} paciente${adelante !== 1 ? 's' : ''} antes que tú`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tiempo estimado */}
            {!esActiva && !listoCola && (
              <div style={{
                background: C.amberBg, border: `1.5px solid #FDE68A`,
                borderRadius: 16, padding: '14px 16px',
                display: 'flex', gap: 12, alignItems: 'center',
                animation: 'se-slide 0.4s 0.08s ease both',
              }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>⏱️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.amberText }}>
                    Tiempo estimado de espera
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.amberText, marginTop: 2 }}>
                    {minEsp < 5 ? 'Menos de 5 min' : `~${minEsp} minutos`}
                  </div>
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 2, opacity: 0.8 }}>
                    {adelante} × 20 min por consulta
                  </div>
                </div>
              </div>
            )}

            {/* Info del médico */}
            <div style={{
              background: C.white, border: `1.5px solid ${C.gray200}`,
              borderRadius: 16, padding: '14px 16px',
              animation: 'se-slide 0.4s 0.12s ease both',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: C.gray500,
                letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
              }}>
                Detalle de tu cita
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {doc.foto_url ? (
                  <img src={doc.foto_url} alt={docName}
                    style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: C.white, fontWeight: 800, fontSize: 16,
                  }}>
                    {(doc.nombres?.[0] ?? '?') + (doc.apellidos?.[0] ?? '')}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>
                    {titulo} {docName}
                  </div>
                  {doc.especialidad && (
                    <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>{doc.especialidad}</div>
                  )}
                </div>
                {horaRef && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: C.gray400, fontWeight: 600 }}>Tu hora</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.green700 }}>{horaRef}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Indicador de actualización */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 2px',
              animation: 'se-slide 0.4s 0.16s ease both',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {refreshing ? <Spinner /> : (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: C.green500,
                    animation: 'se-pulse 2s ease-in-out infinite',
                  }} />
                )}
                <span style={{ fontSize: 11, color: C.gray500 }}>
                  {refreshing ? 'Actualizando…' : `Actualiza en ${countdown}s`}
                </span>
              </div>
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                style={{
                  background: 'none', border: `1px solid ${C.gray200}`,
                  borderRadius: 20, padding: '4px 12px',
                  fontSize: 11, fontWeight: 700, color: C.gray500,
                  cursor: refreshing ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                ↻ Actualizar
              </button>
            </div>

            {/* Nota de privacidad */}
            <div style={{ textAlign: 'center', fontSize: 10, color: C.gray400, lineHeight: 1.6 }}>
              🔒 Los datos de los demás pacientes son privados.<br />
              Solo ves tu posición en la cola, no los nombres de otros.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
