import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import VideoRoom     from '../../components/VideoRoom'
import PreCallModal  from '../../components/PreCallModal'

const C = {
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green200: '#A7F3D0',
  green100: '#D1FAE5',
  green50:  '#ECFDF5',
  amber:    '#F59E0B',
  amberBg:  '#FFFBEB',
  amberText:'#B45309',
  blue700:  '#1D4ED8',
  blue600:  '#2563EB',
  blue50:   '#EFF6FF',
  blue100:  '#DBEAFE',
  red600:   '#DC2626',
  red50:    '#FEF2F2',
  gray900:  '#111827',
  gray700:  '#374151',
  gray500:  '#6B7280',
  gray300:  '#D1D5DB',
  gray200:  '#E5E7EB',
  gray100:  '#F3F4F6',
  white:    '#FFFFFF',
}

const STATUS_MAP = {
  pending:   { label: 'Pend. de pago', bg: C.amberBg,  color: C.amberText },
  paid:      { label: 'Confirmada',    bg: C.green50,   color: C.green700  },
  active:    { label: 'En curso',      bg: C.green50,   color: C.green700  },
  done:      { label: 'Completada',    bg: C.gray100,   color: C.gray500   },
  cancelled: { label: 'Cancelada',     bg: C.red50,     color: C.red600    },
}

const TABS = [
  { key: 'proximas',   label: 'Próximas'   },
  { key: 'pasadas',    label: 'Pasadas'    },
  { key: 'canceladas', label: 'Canceladas' },
]

function isFuture(iso) {
  return new Date(iso) > new Date()
}

function categorize(appts) {
  return {
    proximas:   appts.filter(a => ['pending','paid','active'].includes(a.status) && isFuture(a.scheduled_at)),
    pasadas:    appts.filter(a => a.status === 'done' || (['pending','paid','active'].includes(a.status) && !isFuture(a.scheduled_at))),
    canceladas: appts.filter(a => a.status === 'cancelled'),
  }
}

function doctorLabel(doc) {
  const isCPsP   = doc.cmp?.startsWith('CPsP')
  const femenino = doc.nombres?.trimEnd().endsWith('a')
  const titulo   = isCPsP ? 'Psic.' : femenino ? 'Dra.' : 'Dr.'
  return `${titulo} ${doc.nombres} ${doc.apellidos}`
}

function initials(doc) {
  return (doc.nombres?.[0] ?? '?').toUpperCase() + (doc.apellidos?.[0] ?? '?').toUpperCase()
}

function fmtDate(iso) {
  const s = new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
  })
}

function apptCode(id) {
  return 'VIDA-' + id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

// ─── Instrucciones videollamada ───────────────────────────────

const HOW_TO_STEPS = [
  {
    icon:  '📹',
    title: 'Toca el botón azul',
    text:  'Busca el botón grande azul que dice "Unirse a la consulta" y tócalo con el dedo.',
    color: '#2563EB',
    bg:    '#EFF6FF',
    border:'#BFDBFE',
  },
  {
    icon:  '🎤',
    title: 'Acepta cámara y micrófono',
    text:  'Cuando aparezca un aviso en pantalla, toca "Permitir". Así el médico podrá verte y escucharte.',
    color: '#047857',
    bg:    '#ECFDF5',
    border:'#A7F3D0',
  },
  {
    icon:  '✍️',
    title: 'Escribe tu nombre',
    text:  'Escribe tu nombre completo en el cuadro de texto que aparece y luego toca "Unirse".',
    color: '#7C3AED',
    bg:    '#F5F3FF',
    border:'#DDD6FE',
  },
  {
    icon:  '⏳',
    title: 'Espera al médico',
    text:  '¡Ya estás adentro! El médico se unirá en unos momentos. Quédate en un lugar tranquilo y bien iluminado.',
    color: '#B45309',
    bg:    '#FFFBEB',
    border:'#FDE68A',
  },
]

function HowToJoinModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 390,
          background: C.white,
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 40px',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh', overflowY: 'auto',
          animation: 'slide-up 0.25s ease',
        }}
      >
        <div style={{ width: 40, height: 4, background: C.gray200, borderRadius: 2, margin: '0 auto 18px' }} />

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.gray900 }}>
            ¿Cómo entrar a la consulta?
          </div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 5, lineHeight: 1.5 }}>
            Siga estos 4 pasos sencillos
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {HOW_TO_STEPS.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                background: step.bg,
                borderRadius: 14,
                padding: '14px 16px',
                border: `1.5px solid ${step.border}`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: step.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: C.white,
                }}>
                  {i + 1}
                </div>
                {i < HOW_TO_STEPS.length - 1 && (
                  <div style={{ width: 2, height: 16, background: `${step.color}30`, borderRadius: 1, marginTop: 4 }} />
                )}
              </div>

              <div style={{ flex: 1, paddingTop: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 20 }}>{step.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: step.color }}>{step.title}</span>
                </div>
                <div style={{ fontSize: 13, color: C.gray700, lineHeight: 1.65 }}>
                  {step.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 14,
          background: C.green50, borderRadius: 12, padding: '12px 14px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
          border: `1px solid ${C.green100}`,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
          <span style={{ fontSize: 12, color: C.green700, lineHeight: 1.6 }}>
            <strong>Consejo:</strong> Asegúrese de tener buena conexión a internet y de estar en un lugar tranquilo con buena luz.
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16, width: '100%', padding: '14px 0',
            background: `linear-gradient(135deg, #047857, #059669)`,
            border: 'none', color: C.white,
            borderRadius: 12, fontSize: 15, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
          }}
        >
          ✓ Entendido
        </button>
      </div>
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────

function Avatar({ doc, size = 46 }) {
  if (doc.foto_url) {
    return <img src={doc.foto_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 700, fontSize: size * 0.33,
    }}>
      {initials(doc)}
    </div>
  )
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.done
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0 }}>
      {s.label}
    </span>
  )
}

function AppointmentCard({ appt, onCancel, onJoin, onCalificar, onChat }) {
  const doc        = appt.doctor
  const canCancel  = ['pending','paid'].includes(appt.status) && isFuture(appt.scheduled_at)
  const canJoin    = appt.status === 'active' && !!appt.video_url
  const isDone     = appt.status === 'done'
  const canChat    = ['paid','active','done'].includes(appt.status)
  const [showHowTo,   setShowHowTo]   = useState(false)
  const [showPreCall, setShowPreCall] = useState(false)

  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${canJoin ? '#3B82F6' : C.gray200}`,
      borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
      boxShadow: canJoin ? '0 4px 20px rgba(59,130,246,0.12)' : 'none',
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar doc={doc} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {doctorLabel(doc)}
          </div>
          <div style={{ fontSize: 12, color: C.gray500, marginTop: 1 }}>{doc.especialidad}</div>
        </div>
        <StatusBadge status={appt.status} />
      </div>

      <div style={{ background: C.gray100, borderRadius: 10, padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>📅</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.gray700 }}>{fmtDate(appt.scheduled_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>🕐</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.gray700 }}>{fmtTime(appt.scheduled_at)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: C.gray500 }}>
          Código: <strong style={{ color: C.gray700 }}>{apptCode(appt.id)}</strong>
        </span>
        {canCancel && (
          <button
            onClick={() => onCancel(appt)}
            style={{
              background: 'none', border: `1px solid ${C.red600}`, color: C.red600,
              borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Botones de acción — visibles cuando el médico ya inició */}
      {showPreCall && (
        <PreCallModal
          onEnter={() => { onJoin(appt.video_url); setShowPreCall(false) }}
          onClose={() => setShowPreCall(false)}
        />
      )}

      {canJoin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setShowPreCall(true)}
            style={{
              width: '100%', padding: '14px 0',
              background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
              color: C.white, border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              animation: 'pulse-btn 2s infinite',
            }}
          >
            📹 Unirse a la consulta
          </button>
          <button
            onClick={() => setShowHowTo(true)}
            style={{
              width: '100%', padding: '10px 0',
              background: C.white, color: C.blue600,
              border: `1.5px solid ${C.blue100}`, borderRadius: 12,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'inherit',
            }}
          >
            ❓ ¿Cómo entrar?
          </button>
        </div>
      )}

      {/* Botón chat + calificar */}
      {(canChat || isDone) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {canChat && (
            <button
              onClick={() => onChat(appt.id)}
              style={{
                flex: 1, padding: '11px 0',
                background: C.white,
                border: `1.5px solid ${C.green200}`,
                borderRadius: 12, color: C.green700,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              💬 Chat
            </button>
          )}
          {isDone && (
            <button
              onClick={() => onCalificar(appt.id)}
              style={{
                flex: 1, padding: '11px 0',
                background: C.green50, border: `1.5px solid ${C.green200}`,
                borderRadius: 12, color: C.green700,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              ⭐ Calificar
            </button>
          )}
        </div>
      )}

      {showHowTo && <HowToJoinModal onClose={() => setShowHowTo(false)} />}
    </div>
  )
}

function CardSkeleton() {
  const bar = (w, h, r = 6) => (
    <div style={{ height: h, width: w, background: C.gray100, borderRadius: r }} />
  )
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: C.gray100, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bar('58%', 14)}
          {bar('38%', 11)}
        </div>
        {bar(78, 22, 20)}
      </div>
      {bar('100%', 44, 10)}
      {bar('42%', 14)}
    </div>
  )
}

function EmptyState({ tab, onCTA }) {
  const map = {
    proximas:   { icon: '📅', title: 'Sin citas próximas',        sub: 'Reserva una consulta con un médico disponible.', cta: 'Buscar médico' },
    pasadas:    { icon: '🕐', title: 'Sin historial de consultas', sub: 'Tus consultas completadas aparecerán aquí.',     cta: null            },
    canceladas: { icon: '✅', title: 'Sin citas canceladas',       sub: '',                                               cta: null            },
  }
  const e = map[tab]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 24px', gap: 10 }}>
      <span style={{ fontSize: 48 }}>{e.icon}</span>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.gray700 }}>{e.title}</div>
      {e.sub && <div style={{ fontSize: 12, color: C.gray500 }}>{e.sub}</div>}
      {e.cta && (
        <button
          onClick={onCTA}
          style={{
            marginTop: 8, background: C.green700, border: 'none', color: C.white,
            borderRadius: 14, padding: '13px 32px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {e.cta}
        </button>
      )}
    </div>
  )
}

function CancelModal({ appt, loading, onConfirm, onClose }) {
  if (!appt) return null
  return (
    <div
      onClick={() => !loading && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 390, background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ width: 40, height: 4, background: C.gray200, borderRadius: 2, margin: '0 auto -4px' }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: C.gray900, textAlign: 'center' }}>Cancelar cita</div>
        <div style={{ fontSize: 13, color: C.gray500, textAlign: 'center', lineHeight: 1.6 }}>
          ¿Confirmas que deseas cancelar la cita con{' '}
          <strong style={{ color: C.gray900 }}>{doctorLabel(appt.doctor)}</strong>{' '}
          el <strong style={{ color: C.gray900 }}>{fmtDate(appt.scheduled_at)}</strong> a las{' '}
          <strong style={{ color: C.gray900 }}>{fmtTime(appt.scheduled_at)}</strong>?
          <br />Esta acción no se puede deshacer.
        </div>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            background: C.red600, border: 'none', color: C.white,
            borderRadius: 12, padding: '14px 0', width: '100%',
            fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Cancelando...' : 'Sí, cancelar cita'}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          style={{
            background: 'none', border: `1.5px solid ${C.gray300}`, color: C.gray700,
            borderRadius: 12, padding: '13px 0', width: '100%',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Mantener cita
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function Citas() {
  const { user }                    = useAuthStore()
  const navigate                    = useNavigate()
  const [appts,      setAppts]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState('proximas')
  const [toCancel,   setToCancel]   = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [videoUrl,   setVideoUrl]   = useState(null)   // URL de sala abierta

  const fetchAppts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(nombres, apellidos, especialidad, cmp, foto_url)')
      .eq('patient_id', user.id)
      .order('scheduled_at', { ascending: false })
    if (error) toast.error('Error al cargar citas')
    else setAppts(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchAppts() }, [fetchAppts])

  // Suscripción realtime: actualiza status y video_url sin refetch completo
  useEffect(() => {
    if (!user) return
    console.log('[Citas] creando canal realtime para patient_id:', user.id)
    const channel = supabase
      .channel(`citas-paciente-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `patient_id=eq.${user.id}` },
        (payload) => {
          console.log('[Citas] UPDATE recibido — id:', payload.new.id, '| status:', payload.new.status)
          setAppts(prev => prev.map(a =>
            a.id === payload.new.id
              ? { ...a, status: payload.new.status, video_url: payload.new.video_url }
              : a
          ))
          if (payload.new.status === 'done') {
            console.log('[Citas] redirigiendo a /calificar/', payload.new.id)
            navigate(`/calificar/${payload.new.id}`)
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Citas] subscription status:', status, err ?? '')
      })
    return () => {
      console.log('[Citas] removiendo canal realtime')
      supabase.removeChannel(channel)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const cats   = categorize(appts)
  const counts = { proximas: cats.proximas.length, pasadas: cats.pasadas.length, canceladas: cats.canceladas.length }
  const shown  = cats[activeTab] ?? []

  async function handleCancelConfirm() {
    setCancelling(true)
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', toCancel.id)
    if (error) {
      toast.error('No se pudo cancelar la cita')
    } else {
      toast.success('Cita cancelada')
      setAppts(prev => prev.map(a => a.id === toCancel.id ? { ...a, status: 'cancelled' } : a))
      setToCancel(null)
      setActiveTab('canceladas')
    }
    setCancelling(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes pulse-btn {
          0%,100% { box-shadow: 0 4px 14px rgba(37,99,235,0.3); }
          50%      { box-shadow: 0 4px 24px rgba(37,99,235,0.55); }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <Toaster position="top-center" />

      {videoUrl && (
        <VideoRoom url={videoUrl} onLeave={() => setVideoUrl(null)} />
      )}

      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.gray900, margin: 0 }}>Mis citas</h1>
        <p style={{ fontSize: 13, color: C.gray500, margin: '4px 0 0' }}>
          {loading ? 'Cargando...' : appts.length === 0 ? 'Sin citas registradas' : `${appts.length} cita${appts.length !== 1 ? 's' : ''} en total`}
        </p>
      </div>

      <div style={{ display: 'flex', padding: '14px 20px 0', borderBottom: `1px solid ${C.gray200}`, flexShrink: 0 }}>
        {TABS.map(t => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 4px 12px',
                borderBottom: active ? `2px solid ${C.green600}` : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? C.green700 : C.gray500,
                transition: 'color 0.15s',
              }}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                  background: active ? C.green100 : C.gray100,
                  color: active ? C.green700 : C.gray500,
                }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>}

        {!loading && shown.length === 0 && (
          <EmptyState tab={activeTab} onCTA={() => navigate('/inicio')} />
        )}

        {!loading && shown.map(a => (
          <AppointmentCard
            key={a.id}
            appt={a}
            onCancel={setToCancel}
            onJoin={setVideoUrl}
            onCalificar={id => navigate(`/calificar/${id}`)}
            onChat={id => navigate(`/chat/${id}`)}
          />
        ))}
      </div>

      <CancelModal
        appt={toCancel}
        loading={cancelling}
        onConfirm={handleCancelConfirm}
        onClose={() => !cancelling && setToCancel(null)}
      />
    </div>
  )
}
