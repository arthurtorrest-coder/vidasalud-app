import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green300: '#6EE7B7', green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  gray900: '#111827', gray800: '#1F2937', gray700: '#374151', gray600: '#4B5563',
  gray500: '#6B7280', gray400: '#9CA3AF', gray300: '#D1D5DB', gray200: '#E5E7EB',
  gray100: '#F3F4F6', gray50: '#F9FAFB', white: '#FFFFFF',
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDoctorName(doc) {
  if (!doc) return 'Médico'
  const isCPsP = (doc.cmp ?? '').startsWith('CPsP')
  const fem    = (doc.nombres ?? '').trimEnd().endsWith('a')
  const titulo = isCPsP ? 'Psic.' : fem ? 'Dra.' : 'Dr.'
  return `${titulo} ${doc.nombres ?? ''} ${doc.apellidos ?? ''}`.trim()
}

function getInitials(str = '') {
  return str.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
}

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return new Date(dateStr).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
  })
}

function fmtCitaDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', weekday: 'short', day: 'numeric', month: 'short',
  })
}

function fmtFullTime(iso) {
  return new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
    day: 'numeric', month: 'short',
  })
}

// Agrupa mensajes consecutivos del mismo sender en "clusters"
function buildClusters(mensajes) {
  const result = []
  let i = 0
  while (i < mensajes.length) {
    const cluster = [mensajes[i]]
    while (i + 1 < mensajes.length && mensajes[i + 1].sender_id === mensajes[i].sender_id) {
      i++
      cluster.push(mensajes[i])
    }
    result.push(cluster)
    i++
  }
  return result
}

// ─── Sub-componentes ──────────────────────────────────────────

function OtherAvatar({ name, photo, size = 28 }) {
  if (photo) {
    return (
      <img src={photo} alt={name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0, alignSelf: 'flex-end',
        }} />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 800, fontSize: size * 0.36,
      alignSelf: 'flex-end',
    }}>
      {getInitials(name)}
    </div>
  )
}

function MessageCluster({ cluster, isMine, otherName, otherPhoto }) {
  const last = cluster[cluster.length - 1]
  return (
    <div style={{
      display: 'flex',
      flexDirection: isMine ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 8,
    }}>
      {/* Avatar del otro (solo si no es mío) */}
      {!isMine && (
        <OtherAvatar name={otherName} photo={otherPhoto} />
      )}

      {/* Grupo de burbujas */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        alignItems: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '75%',
      }}>
        {cluster.map((msg, i) => {
          const isFirstInCluster = i === 0
          const isLastInCluster  = i === cluster.length - 1
          const r = 16
          const rMine = {
            borderTopLeftRadius: r,
            borderTopRightRadius: isFirstInCluster ? r : 6,
            borderBottomRightRadius: isLastInCluster ? 4 : 6,
            borderBottomLeftRadius: r,
          }
          const rOther = {
            borderTopLeftRadius: isFirstInCluster ? r : 6,
            borderTopRightRadius: r,
            borderBottomRightRadius: r,
            borderBottomLeftRadius: isLastInCluster ? 4 : 6,
          }
          return (
            <div
              key={msg.id}
              style={{
                padding: '9px 13px',
                ...(isMine ? rMine : rOther),
                background: isMine
                  ? `linear-gradient(135deg, ${C.green800}, ${C.green600})`
                  : C.white,
                border: isMine ? 'none' : `1px solid ${C.gray200}`,
                color: isMine ? C.white : C.gray900,
                fontSize: 13, lineHeight: 1.55,
                boxShadow: isMine
                  ? '0 1px 4px rgba(5,150,105,0.22)'
                  : '0 1px 4px rgba(0,0,0,0.06)',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.contenido}
            </div>
          )
        })}

        {/* Pie del cluster: hora + leído */}
        <div style={{
          fontSize: 10, color: C.gray400, marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 3,
          paddingLeft: isMine ? 0 : 4,
          paddingRight: isMine ? 4 : 0,
          flexDirection: isMine ? 'row-reverse' : 'row',
        }}>
          <span>{timeAgo(last.created_at)}</span>
          {isMine && (
            <span style={{
              fontSize: 11,
              color: last.leido ? C.green400 : C.gray300,
              fontWeight: 700,
            }}>
              {last.leido ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function DateSeparator({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '10px 0',
    }}>
      <div style={{ flex: 1, height: 1, background: C.gray200 }} />
      <span style={{
        fontSize: 10, fontWeight: 700, color: C.gray400,
        background: C.gray50, padding: '2px 10px', borderRadius: 20,
        border: `1px solid ${C.gray200}`,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: C.gray200 }} />
    </div>
  )
}

function EmptyState({ otherName }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 28px', gap: 12, textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: C.green50, border: `2px solid ${C.green200}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>
        💬
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.gray800 }}>
        Inicia la conversación
      </div>
      <p style={{ fontSize: 12, color: C.gray500, margin: 0, lineHeight: 1.7 }}>
        Escribe el primer mensaje a <strong>{otherName}</strong>.<br />
        Los mensajes son privados entre ambas partes.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 10,
    }}>
      <style>{`@keyframes chat-spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: `3px solid ${C.green100}`, borderTopColor: C.green600,
        animation: 'chat-spin 0.75s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: C.gray500 }}>Cargando mensajes…</span>
    </div>
  )
}

function NotFoundState({ onBack }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, textAlign: 'center',
    }}>
      <span style={{ fontSize: 48 }}>🔍</span>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.gray700 }}>
        Cita no encontrada
      </div>
      <p style={{ fontSize: 12, color: C.gray500, margin: 0 }}>
        No tienes acceso a este chat o la cita no existe.
      </p>
      <button onClick={onBack} style={{
        marginTop: 8, padding: '10px 28px',
        background: C.green700, color: C.white,
        border: 'none', borderRadius: 10,
        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        Volver
      </button>
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function Chat() {
  const { appointmentId } = useParams()
  const navigate           = useNavigate()
  const { user, profile }  = useAuthStore()

  const [appt,       setAppt]       = useState(null)
  const [mensajes,   setMensajes]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [sending,    setSending]    = useState(false)
  const [text,       setText]       = useState('')
  const [inputRows,  setInputRows]  = useState(1)

  const textareaRef = useRef(null)
  const bottomRef   = useRef(null)
  const myId        = user?.id
  const myRole      = profile?.role ?? 'patient'

  // ── Auto-scroll al último mensaje ──────────────────────────
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [mensajes.length, scrollToBottom])

  // ── Marcar mensajes del otro como leídos ───────────────────
  const markRead = useCallback(async () => {
    if (!appointmentId || !myId) return
    await supabase
      .from('mensajes')
      .update({ leido: true })
      .eq('appointment_id', appointmentId)
      .neq('sender_id', myId)
      .eq('leido', false)
    // Actualizar estado local también
    setMensajes(prev => prev.map(m =>
      m.sender_id !== myId && !m.leido ? { ...m, leido: true } : m
    ))
  }, [appointmentId, myId])

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(() => {
    if (!appointmentId || !myId) return
    let cancelled = false

    async function load() {
      const [{ data: apptData }, { data: msgs }] = await Promise.all([
        supabase
          .from('appointments')
          .select(`
            id, scheduled_at, status,
            patient:profiles!patient_id(id, full_name),
            doctor:doctors!doctor_id(id, profile_id, nombres, apellidos, especialidad, foto_url, cmp)
          `)
          .eq('id', appointmentId)
          .maybeSingle(),
        supabase
          .from('mensajes')
          .select('*')
          .eq('appointment_id', appointmentId)
          .order('created_at', { ascending: true }),
      ])

      if (cancelled) return
      setAppt(apptData ?? null)
      setMensajes(msgs ?? [])
      setLoading(false)
      // Scroll inmediato al abrir (sin animación para no parpadear)
      requestAnimationFrame(() => scrollToBottom('instant'))
      // Marcar como leídos en background
      if (apptData) markRead()
    }

    load()
    return () => { cancelled = true }
  }, [appointmentId, myId, markRead, scrollToBottom])

  // ── Suscripción Realtime ───────────────────────────────────
  useEffect(() => {
    if (!appointmentId || !myId) return

    const channel = supabase
      .channel(`chat-msgs-${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'mensajes',
          filter: `appointment_id=eq.${appointmentId}`,
        },
        payload => {
          const msg = payload.new
          setMensajes(prev => {
            // Evitar duplicado si ya existe (puede llegar del INSERT propio)
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // Si es del otro, marcar como leído automáticamente
          if (msg.sender_id !== myId) {
            supabase.from('mensajes').update({ leido: true }).eq('id', msg.id)
            setMensajes(prev => prev.map(m => m.id === msg.id ? { ...m, leido: true } : m))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'mensajes',
          filter: `appointment_id=eq.${appointmentId}`,
        },
        payload => {
          setMensajes(prev => prev.map(m =>
            m.id === payload.new.id ? { ...m, ...payload.new } : m
          ))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [appointmentId, myId])

  // ── Enviar mensaje ─────────────────────────────────────────
  async function handleSend() {
    const contenido = text.trim()
    if (!contenido || sending || !appt) return

    setSending(true)
    setText('')
    setInputRows(1)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Optimismo: insertar localmente antes de confirmar
    const tmpId = `tmp-${Date.now()}`
    const tmpMsg = {
      id:             tmpId,
      appointment_id: appointmentId,
      sender_id:      myId,
      sender_role:    myRole,
      contenido,
      leido:          false,
      created_at:     new Date().toISOString(),
    }
    setMensajes(prev => [...prev, tmpMsg])

    const { data, error } = await supabase
      .from('mensajes')
      .insert({
        appointment_id: appointmentId,
        sender_id:      myId,
        sender_role:    myRole,
        contenido,
      })
      .select()
      .single()

    if (error) {
      // Revertir mensaje optimista
      setMensajes(prev => prev.filter(m => m.id !== tmpId))
      setText(contenido)
    } else {
      // Reemplazar optimista con el real (el Realtime también lo enviará, dedup lo maneja)
      setMensajes(prev => prev.map(m => m.id === tmpId ? data : m))
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTextChange(e) {
    const val = e.target.value
    setText(val)
    // Auto-altura del textarea
    e.target.style.height = 'auto'
    const newH = Math.min(e.target.scrollHeight, 100)
    e.target.style.height = newH + 'px'
    setInputRows(val ? undefined : 1)
  }

  // ── Renderizar ─────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.gray50 }}>
        <ChatHeader appt={null} onBack={() => navigate(-1)} loading />
        <LoadingState />
      </div>
    )
  }

  if (!appt) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.gray50 }}>
        <NotFoundState onBack={() => navigate(-1)} />
      </div>
    )
  }

  const isPatient  = myRole !== 'doctor'
  const otherName  = isPatient ? formatDoctorName(appt.doctor) : (appt.patient?.full_name ?? 'Paciente')
  const otherPhoto = isPatient ? (appt.doctor?.foto_url ?? null) : null
  const otherSub   = isPatient ? (appt.doctor?.especialidad ?? '') : 'Paciente'

  const clusters = buildClusters(mensajes)

  // Agregar separadores de fecha
  const renderedItems = []
  let lastDate = null
  clusters.forEach((cluster, ci) => {
    const msgDate = new Date(cluster[0].created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
    if (msgDate !== lastDate) {
      lastDate = msgDate
      const today     = new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
      const label = msgDate === today ? 'Hoy' : msgDate === yesterday ? 'Ayer' : fmtFullTime(cluster[0].created_at).split(',')[0]
      renderedItems.push({ type: 'separator', label, key: `sep-${ci}` })
    }
    renderedItems.push({ type: 'cluster', cluster, key: `cluster-${ci}` })
  })

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100%', background: C.gray50,
    }}>
      <style>{`
        @keyframes chat-spin { to { transform: rotate(360deg) } }
        @keyframes chat-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* ── Header ── */}
      <ChatHeader appt={appt} onBack={() => navigate(-1)}
        otherName={otherName} otherPhoto={otherPhoto} otherSub={otherSub} />

      {/* ── Cuerpo de mensajes ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 14px 8px',
        display: 'flex', flexDirection: 'column',
      }}>
        {mensajes.length === 0
          ? <EmptyState otherName={otherName} />
          : renderedItems.map(item =>
              item.type === 'separator'
                ? <DateSeparator key={item.key} label={item.label} />
                : (
                  <MessageCluster
                    key={item.key}
                    cluster={item.cluster}
                    isMine={item.cluster[0].sender_id === myId}
                    otherName={otherName}
                    otherPhoto={otherPhoto}
                  />
                )
            )
        }
        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* ── Input ── */}
      <div style={{
        flexShrink: 0,
        padding: '10px 12px 14px',
        background: C.white,
        borderTop: `1px solid ${C.gray200}`,
        display: 'flex', alignItems: 'flex-end', gap: 8,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.05)',
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje…"
          rows={inputRows ?? 1}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: `1.5px solid ${text ? C.green300 : C.gray200}`,
            borderRadius: 14,
            fontSize: 13, outline: 'none',
            background: text ? C.white : C.gray50,
            color: C.gray900,
            fontFamily: 'inherit', lineHeight: 1.5,
            resize: 'none',
            maxHeight: 100,
            transition: 'border-color 0.15s, background 0.15s',
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            border: 'none',
            background: text.trim() && !sending
              ? `linear-gradient(135deg, ${C.green700}, ${C.green500})`
              : C.gray200,
            cursor: text.trim() && !sending ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
            boxShadow: text.trim() && !sending
              ? '0 2px 10px rgba(5,150,105,0.30)' : 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerDown={e => { if (text.trim() && !sending) e.currentTarget.style.transform = 'scale(0.92)' }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {sending ? (
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: `2px solid rgba(255,255,255,0.4)`, borderTopColor: C.gray400,
              animation: 'chat-spin 0.7s linear infinite',
            }} />
          ) : (
            <span style={{
              fontSize: 17, lineHeight: 1,
              color: text.trim() ? C.white : C.gray400,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              ➤
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Header separado para reutilización en loading state ─────

function ChatHeader({ appt, onBack, otherName, otherPhoto, otherSub, loading = false }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
      padding: '14px 14px 16px',
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Botón volver */}
      <button
        type="button"
        onClick={onBack}
        style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.2)', border: 'none',
          color: C.white, fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit', lineHeight: 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >←</button>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: 120, height: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 6 }} />
            <div style={{ width: 80, height: 9, background: 'rgba(255,255,255,0.15)', borderRadius: 6 }} />
          </div>
        </div>
      ) : (
        <>
          {/* Avatar */}
          {otherPhoto ? (
            <img src={otherPhoto} alt={otherName} style={{
              width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
              border: '2px solid rgba(255,255,255,0.55)', flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.22)',
              border: '2px solid rgba(255,255,255,0.40)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontWeight: 800, fontSize: 14,
            }}>
              {getInitials(otherName)}
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: C.white,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {otherName}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)', marginTop: 1 }}>
              {otherSub}
              {appt?.scheduled_at && (
                <span> · Cita {fmtCitaDate(appt.scheduled_at)}</span>
              )}
            </div>
          </div>

          {/* Dot "En línea" */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: C.green400,
              boxShadow: `0 0 0 2px rgba(52,211,153,0.3)`,
            }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
              En línea
            </span>
          </div>
        </>
      )}
    </div>
  )
}
