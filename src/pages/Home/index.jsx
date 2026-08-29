import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import VideoRoom from '../../components/VideoRoom'
import { C } from '../../lib/tokens'
import { precioTotalPaciente } from '../../lib/finanzas'
import { enviarWhatsapp } from '../../lib/whatsapp'

const SPECIALTIES = [
  { icon: '🩺', label: 'General',     price: 31 },
  { icon: '👶', label: 'Pediatría',   price: 45 },
  { icon: '🧠', label: 'Psicología',  price: 50 },
  { icon: '🥗', label: 'Nutrición',   price: 40 },
  { icon: '❤️', label: 'Cardiología', price: 70 },
  { icon: '🦷', label: 'Odontología', price: 60 },
]

const STATUS_COLORS = {
  now:   { dot: C.green600, label: C.green700, bg: C.green50  },
  soon:  { dot: C.amber,    label: '#B45309',  bg: '#FFFBEB'  },
  later: { dot: C.gray500,  label: C.gray500,  bg: C.gray100  },
}

// ─── Helpers ──────────────────────────────────────────────────

function getLimaDateTime() {
  const now  = new Date()
  const lima = new Date(now.getTime() + (now.getTimezoneOffset() - 300) * 60000)
  return {
    diaSemana:  lima.getDay(),
    horaActual: `${String(lima.getHours()).padStart(2,'0')}:${String(lima.getMinutes()).padStart(2,'0')}`,
  }
}

function computeAvailableNowIds(schedules) {
  const { diaSemana, horaActual } = getLimaDateTime()
  const ids = new Set()
  for (const s of schedules) {
    if (
      s.activo !== false &&
      s.dia_semana === diaSemana &&
      (s.hora_inicio ?? '') <= horaActual &&
      (s.hora_fin    ?? '') >  horaActual
    ) ids.add(s.doctor_id)
  }
  return ids
}

function getProximosDisponibles(allSchedules, allDoctors, limit = 5) {
  const { diaSemana, horaActual } = getLimaDateTime()
  const results = []
  for (let offset = 0; offset <= 1 && results.length < limit; offset++) {
    const dia     = (diaSemana + offset) % 7
    const isToday = offset === 0
    const blocks  = allSchedules
      .filter(s => s.activo !== false && s.dia_semana === dia && (!isToday || (s.hora_inicio ?? '') > horaActual))
      .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
    for (const block of blocks) {
      if (results.length >= limit) break
      const doc = allDoctors.find(d => d.id === block.doctor_id)
      if (!doc) continue
      if (results.some(r => r.docId === doc.id)) continue
      results.push({ docId: doc.id, name: doc.name, spec: doc.spec, fotoUrl: doc.fotoUrl, initials: doc.initials, hora: block.hora_inicio, esManana: !isToday })
    }
  }
  return results
}

function formatHora12(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')}${h >= 12 ? 'pm' : 'am'}`
}

function formatDoc(row) {
  const nombres    = row.nombres   ?? row.full_name ?? '?'
  const apellidos  = row.apellidos ?? ''
  const spec       = row.especialidad ?? row.specialty ?? ''
  const cmp        = row.cmp       ?? row.cmp_code   ?? ''
  const precioNeto = row.precio    ?? (row.consultation_fee ? Math.round(row.consultation_fee / 100) : 0)
  const precio     = precioTotalPaciente({ especialidad: spec, precioMedico: precioNeto })
  const isCPsP     = cmp.startsWith('CPsP')
  const esFemenino = nombres.trimEnd().endsWith('a')
  const titulo     = isCPsP ? 'Psic.' : esFemenino ? 'Dra.' : 'Dr.'
  return {
    id:       row.id,
    initials: (nombres[0]?.toUpperCase() ?? '?') + (apellidos[0]?.toUpperCase() ?? '?'),
    name:     `${titulo} ${nombres} ${apellidos}`.trim(),
    spec, cmp,
    rating:   Number(row.rating ?? 0),
    reviews:  row.total_reviews ?? row.review_count ?? 0,
    price:    precio,
    fotoUrl:  row.foto_url ?? null,
    status:      'now',
    statusLabel: 'Disponible ahora',
  }
}

// ─── Subcomponentes ───────────────────────────────────────────

function Avatar({ initials, fotoUrl, size = 48 }) {
  if (fotoUrl) return (
    <img src={fotoUrl} alt={initials}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 700, fontSize: size * 0.33,
    }}>
      {initials}
    </div>
  )
}

function StarRating({ rating }) {
  const filled = Math.round(rating)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ color: C.amber, letterSpacing: 1, fontSize: 13, lineHeight: 1 }}>
        {'★'.repeat(filled)}<span style={{ color: C.gray300 }}>{'★'.repeat(5 - filled)}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.gray700 }}>{rating.toFixed(1)}</span>
    </span>
  )
}

function StatusBadge({ status, label }) {
  const s = STATUS_COLORS[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.label, fontSize: 12, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.dot,
        ...(status === 'now' ? { animation: 'pulse 2s infinite' } : {}),
      }} />
      {label}
    </span>
  )
}

function DoctorCard({ doc, onBook }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onPointerDown={() => setHovered(true)}
      onPointerUp={() => setHovered(false)}
      onPointerLeave={() => setHovered(false)}
      onClick={() => onBook(doc)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: C.white,
        border: `1.5px solid ${hovered ? C.green500 : C.gray300}`,
        borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: hovered ? 'scale(0.985)' : 'scale(1)',
        boxShadow: hovered ? '0 6px 20px rgba(16,185,129,0.13)' : 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Avatar initials={doc.initials} fotoUrl={doc.fotoUrl} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray900 }}>{doc.name}</div>
        <div style={{ fontSize: 12, color: C.gray500, marginTop: 1 }}>{doc.spec} · {doc.cmp}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <StarRating rating={doc.rating} />
          <span style={{ fontSize: 11, color: C.gray500 }}>({doc.reviews} reseñas)</span>
          <StatusBadge status={doc.status} label={doc.statusLabel} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.green700 }}>S/. {doc.price}</div>
        <div style={{
          marginTop: 6, background: C.green700, color: C.white,
          fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8,
          opacity: hovered ? 1 : 0.85, transition: 'opacity 0.15s',
        }}>Reservar</div>
      </div>
    </div>
  )
}

function DoctorSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: C.white, border: `1.5px solid ${C.gray200}`,
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div className="vs-shimmer" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="vs-shimmer" style={{ height: 14, width: '60%', borderRadius: 6 }} />
        <div className="vs-shimmer" style={{ height: 12, width: '80%', borderRadius: 6 }} />
        <div className="vs-shimmer" style={{ height: 12, width: '40%', borderRadius: 6 }} />
      </div>
      <div style={{ width: 56, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div className="vs-shimmer" style={{ height: 16, width: 48, borderRadius: 6 }} />
        <div className="vs-shimmer" style={{ height: 24, width: 56, borderRadius: 8 }} />
      </div>
    </div>
  )
}

function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 10px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>{title}</h2>
      {actionLabel && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', color: C.green700, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {actionLabel} →
        </button>
      )}
    </div>
  )
}

function doctorTitulo(doc) {
  const isCPsP = (doc?.cmp ?? '').startsWith('CPsP')
  const fem    = (doc?.nombres ?? '').trimEnd().endsWith('a')
  return isCPsP ? 'Psic.' : fem ? 'Dra.' : 'Dr.'
}

function ActiveCallBanner({ appt, onEnter }) {
  const doc    = appt.doctor ?? {}
  const titulo = doctorTitulo(doc)
  const nombre = [doc.nombres, doc.apellidos].filter(Boolean).join(' ') || 'tu médico'
  const spec   = doc.especialidad ?? ''
  return (
    <div style={{
      background: 'linear-gradient(135deg, #065F46, #059669)',
      padding: '16px 20px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
      animation: 'banner-glow 2s ease-in-out infinite', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, animation: 'dot-blink 1s step-end infinite' }}>🔴</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
            Tu médico te está esperando ahora
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 3 }}>
            {titulo} {nombre}{spec ? ` · ${spec}` : ''}
          </div>
        </div>
      </div>
      <button
        onClick={() => onEnter(appt.video_url)}
        style={{
          width: '100%', padding: '14px 0',
          background: '#FFFFFF', color: '#065F46', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}
      >
        📹 Entrar a la consulta
      </button>
    </div>
  )
}

// ─── Modal: sin médico disponible ────────────────────────────

function AgendarModal({ onAviso, onEspecialidades, onDespues, onClose, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 430,
        background: C.white, borderRadius: '20px 20px 0 0',
        padding: '24px 22px 36px',
        animation: 'slideUp 0.25s ease both',
      }}>
        {/* Pill de arrastre */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: C.gray300, margin: '0 auto 18px',
        }} />

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: C.green50, border: `1.5px solid ${C.green200}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 12px',
          }}>🩺</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.gray900 }}>
            No hay médicos disponibles ahora
          </div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 6, lineHeight: 1.55 }}>
            No hay médicos de Medicina General disponibles en este momento.
            ¿Qué prefieres hacer?
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Opción 1: verde oscuro (principal) */}
          <button
            onClick={onAviso}
            disabled={loading}
            style={{
              width: '100%', padding: '15px 16px',
              background: loading
                ? C.green100
                : `linear-gradient(135deg, #065F46, ${C.green600})`,
              color: loading ? C.green700 : C.white,
              border: 'none', borderRadius: 14,
              fontSize: 14, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'inherit',
              boxShadow: loading ? 'none' : '0 6px 20px rgba(6,95,70,0.35)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div>{loading ? 'Registrando solicitud…' : 'Avisar cuando haya médico'}</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.82, marginTop: 2 }}>
                Te notificamos en cuanto uno esté disponible (máx. 30 min)
              </div>
            </div>
          </button>

          {/* Opción 2: verde claro */}
          <button
            onClick={onEspecialidades}
            style={{
              width: '100%', padding: '14px 16px',
              background: C.green50,
              border: `1.5px solid ${C.green200}`,
              borderRadius: 14,
              fontSize: 14, fontWeight: 700, color: C.green800,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>🩺</span>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div>Ver otras especialidades</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: C.green700, marginTop: 2 }}>
                Pediatría, Psicología, Nutrición y más
              </div>
            </div>
          </button>

          {/* Opción 3: blanco con borde */}
          <button
            onClick={onDespues}
            style={{
              width: '100%', padding: '13px 16px',
              background: C.white,
              border: `1.5px solid ${C.gray300}`,
              borderRadius: 14,
              fontSize: 14, fontWeight: 600, color: C.gray600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>📅</span>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div>Agendar para después</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: C.gray400, marginTop: 2 }}>
                Elige un horario disponible próximamente
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Banner de espera de turno ────────────────────────────────

function TurnoEsperaBanner({ solicitud, onCancel }) {
  const [tiempoEspera, setTiempoEspera] = useState('')

  useEffect(() => {
    function calcular() {
      const mins = Math.floor((Date.now() - new Date(solicitud.created_at).getTime()) / 60000)
      setTiempoEspera(mins < 1 ? 'Hace unos segundos' : `Hace ${mins} min`)
    }
    calcular()
    const t = setInterval(calcular, 30_000)
    return () => clearInterval(t)
  }, [solicitud.created_at])

  const minRestantes = Math.max(0, Math.floor(
    (new Date(solicitud.expires_at).getTime() - Date.now()) / 60000
  ))

  return (
    <div style={{
      background: 'linear-gradient(135deg, #065F46, #059669)',
      padding: '16px 20px 18px',
      display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0,
      animation: 'banner-glow 2s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24, animation: 'dot-blink 2s step-end infinite' }}>🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
            Buscando médico disponible…
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
            {tiempoEspera} · Caduca en {minRestantes} min
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: C.white, borderRadius: 20, padding: '5px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Cancelar
        </button>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.13)', borderRadius: 10, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>⏳</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          En cuanto un médico tome tu turno, te dirigiremos al pago automáticamente.
        </span>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function Home() {
  const navigate    = useNavigate()
  const { profile, user } = useAuthStore()
  const firstName   = profile?.full_name?.split(' ')[0] ?? ''

  const [selectedSpec,    setSelectedSpec]    = useState(null)
  const [doctors,         setDoctors]         = useState([])
  const [availableNowIds, setAvailableNowIds] = useState(new Set())
  const [schedules,       setSchedules]       = useState([])
  const [loadingDocs,     setLoadingDocs]     = useState(true)
  const [errorDocs,       setErrorDocs]       = useState(null)
  const [activeAppt,      setActiveAppt]      = useState(null)
  const [videoUrl,        setVideoUrl]        = useState(null)
  const [showAllSpecs,    setShowAllSpecs]    = useState(false)
  const [showAgendarModal, setShowAgendarModal] = useState(false)
  const [solicitudActiva,  setSolicitudActiva]  = useState(null)
  const [solicitudLoading, setSolicitudLoading] = useState(false)

  const checkActiveAppt = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('appointments')
      .select('id, video_url, doctor:doctors(nombres, apellidos, especialidad, cmp)')
      .eq('patient_id', user.id)
      .eq('status', 'active')
      .not('video_url', 'is', null)
      .maybeSingle()
    setActiveAppt(data ?? null)
  }, [user?.id])

  useEffect(() => { checkActiveAppt() }, [checkActiveAppt])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`home-active-appt-${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `patient_id=eq.${user.id}` },
        () => { checkActiveAppt() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, checkActiveAppt])

  const checkSolicitud = useCallback(async () => {
    if (!user?.id) return
    console.log('[checkSolicitud] buscando solicitud pendiente — patient:', user.id)
    const { data, error } = await supabase
      .from('solicitudes_turno')
      .select('id, status, created_at, expires_at, appointment_id')
      .eq('patient_id', user.id)
      .eq('status', 'pendiente')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    console.log('[checkSolicitud] resultado:', { data, error: error?.message ?? null })
    setSolicitudActiva(data ?? null)
  }, [user?.id])

  useEffect(() => { checkSolicitud() }, [checkSolicitud])

  // Realtime: cuando el médico toma el turno → redirigir al pago
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`solicitud-turno-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'solicitudes_turno', filter: `patient_id=eq.${user.id}` },
        (payload) => {
          if (payload.new.status === 'tomada' && payload.new.appointment_id) {
            setSolicitudActiva(null)
            toast.success('¡Un médico tomó tu turno! Redirigiendo al pago…', { duration: 4000 })
            enviarWhatsapp({
              to: profile?.phone,
              template_name: 'medico_disponible',
              parameters: [profile?.full_name ?? 'Paciente'],
            })
            navigate(`/pago/${payload.new.appointment_id}`)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, profile, navigate])

  async function crearSolicitud() {
    if (!user?.id) return
    setSolicitudLoading(true)

    // Si ya existe una solicitud pendiente vigente, mostrarla directamente
    const { data: existente } = await supabase
      .from('solicitudes_turno')
      .select('id, status, created_at, expires_at, appointment_id')
      .eq('patient_id', user.id)
      .eq('status', 'pendiente')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existente) {
      setSolicitudActiva(existente)
      setSolicitudLoading(false)
      setShowAgendarModal(false)
      return
    }

    const { data, error } = await supabase
      .from('solicitudes_turno')
      .insert({ patient_id: user.id })
      .select()
      .single()

    setSolicitudLoading(false)

    if (error) {
      toast.error('No se pudo registrar la solicitud: ' + error.message)
      return
    }

    setSolicitudActiva(data)
    setShowAgendarModal(false)
    toast.success('¡Listo! Te avisamos cuando haya un médico disponible.')

    // Notificar a médicos de Medicina General vía Web Push (fire-and-forget)
    const nombrePaciente = profile?.full_name ?? 'Paciente'
    supabase.functions
      .invoke('notificar-turno-medicos', {
        body: { patient_id: user.id, patient_name: nombrePaciente },
      })
      .then(({ error: fnErr }) => {
        if (fnErr) console.warn('[notificar-turno-medicos]', fnErr.message)
        else       console.log('[notificar-turno-medicos] notificaciones enviadas')
      })
  }

  async function cancelarSolicitud() {
    if (!solicitudActiva?.id) return
    console.log('[cancelarSolicitud] actualizando status → expirada, id:', solicitudActiva.id)

    const { data, error } = await supabase
      .from('solicitudes_turno')
      .update({ status: 'expirada' })
      .eq('id', solicitudActiva.id)
      .eq('patient_id', user.id)   // doble filtro por seguridad
      .select('id, status')

    console.log('[cancelarSolicitud] resultado:', { data, error: error?.message ?? null })

    if (error) {
      toast.error('No se pudo cancelar: ' + error.message)
      return
    }

    if (!data?.length) {
      // UPDATE no afectó ninguna fila — lo más probable es RLS bloqueando
      // Ejecutar en Supabase SQL Editor:
      //   CREATE POLICY "st_paciente_update" ON public.solicitudes_turno
      //     FOR UPDATE USING (auth.uid() = patient_id);
      console.error('[cancelarSolicitud] 0 filas afectadas — verificar política RLS st_paciente_update')
      toast.error('No se pudo cancelar. Revisa la consola para más detalles.')
      return
    }

    setSolicitudActiva(null)
    toast('Solicitud cancelada.', { icon: 'ℹ️' })
  }

  async function fetchDoctors() {
    const [{ data: docs, error }, { data: scheds }] = await Promise.all([
      supabase.from('doctors').select('*').order('rating', { ascending: false }),
      supabase.from('doctor_schedules').select('doctor_id, dia_semana, hora_inicio, hora_fin, activo'),
    ])
    if (error) {
      console.error('[Home] doctors:', error.message)
      setErrorDocs(`No se pudo cargar la lista de médicos. (${error.message})`)
      setLoadingDocs(false)
      return
    }
    const activos      = (docs ?? []).filter(d => d.activo !== false && d.aprobado !== false)
    const schedulesData = scheds ?? []
    setDoctors(activos.map(formatDoc))
    setSchedules(schedulesData)
    setAvailableNowIds(computeAvailableNowIds(schedulesData))
    setLoadingDocs(false)
  }

  useEffect(() => { fetchDoctors() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel('home-doctors-availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => fetchDoctors())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBook = (doc) => { navigate(`/medico/${doc.id}`) }

  // Sin médicos de Medicina General disponibles en este momento
  const generalAvailableNow = !loadingDocs && doctors.some(
    d => availableNowIds.has(d.id) && d.spec.toLowerCase().includes('general')
  )

  function handleAgendarCita() {
    if (loadingDocs || generalAvailableNow) {
      navigate('/especialidades')
      return
    }
    // Hay solicitud activa → mostrar el banner de espera directamente
    if (solicitudActiva) return
    setShowAgendarModal(true)
  }

  const allSpecs = useMemo(() => {
    const quick = new Set(SPECIALTIES.map(s => s.label))
    const extra = [...new Set(doctors.map(d => d.spec).filter(Boolean))]
      .filter(s => !quick.has(s))
      .sort()
    return [...SPECIALTIES.map(s => s.label), ...extra]
  }, [doctors])

  const proximosDisponibles = useMemo(
    () => (availableNowIds.size === 0 && !selectedSpec)
      ? getProximosDisponibles(schedules, doctors)
      : [],
    [schedules, doctors, availableNowIds, selectedSpec]
  )

  const filteredDocs = doctors.filter(d => {
    const specMatch = !selectedSpec || d.spec.toLowerCase().includes(selectedSpec.toLowerCase())
    const nowMatch  = selectedSpec ? true : availableNowIds.has(d.id)
    return specMatch && nowMatch
  })

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes banner-glow {
          0%,100% { box-shadow: 0 4px 24px rgba(5,150,105,0.45); }
          50%      { box-shadow: 0 4px 40px rgba(5,150,105,0.75); }
        }
        @keyframes dot-blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {videoUrl && <VideoRoom url={videoUrl} onLeave={() => setVideoUrl(null)} />}

      {activeAppt && profile?.role === 'patient' && (
        <ActiveCallBanner appt={activeAppt} onEnter={setVideoUrl} />
      )}

      {solicitudActiva && profile?.role === 'patient' && !activeAppt && (
        <TurnoEsperaBanner solicitud={solicitudActiva} onCancel={cancelarSolicitud} />
      )}

      {/* ── Hero compacto ── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
        padding: '16px 20px 20px', flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
          {firstName ? `Hola, ${firstName} 👋` : 'Bienvenido 👋'}
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: C.white, marginTop: 2 }}>
          ¿Cómo te sientes hoy?
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
          📍 Perú · Médicos disponibles ahora
        </div>
      </div>

      {/* ── Accesos de rol ── */}
      {profile?.role === 'admin' && (
        <button
          onClick={() => navigate('/admin/panel')}
          style={{
            margin: '12px 20px 0', width: 'calc(100% - 40px)',
            padding: '13px 18px',
            background: `linear-gradient(135deg, ${C.green900}, ${C.green800})`,
            border: `1.5px solid ${C.green700}`, borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 20px rgba(6,79,60,0.35)', fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚙️</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>Panel de administrador</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Gestiona citas, médicos e ingresos</div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>›</span>
        </button>
      )}

      {profile?.role === 'doctor' && (
        <button
          onClick={() => navigate('/medico/panel')}
          style={{
            margin: '12px 20px 0', width: 'calc(100% - 40px)',
            padding: '13px 18px',
            background: `linear-gradient(135deg, ${C.green900}, ${C.green800})`,
            border: `1.5px solid ${C.green700}`, borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 20px rgba(6,79,60,0.35)', fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🩺</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>Ir a mi panel médico</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Ver tus citas y consultas pendientes</div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>›</span>
        </button>
      )}

      {/* ── Acciones rápidas ── */}
      <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { icon: '📹', label: 'Agendar cita',  bg: '#1D4ED8', border: '#3B82F6', color: '#FFFFFF', h: 48, shadow: '0 6px 20px rgba(6,95,70,0.45)',  shadowPress: '0 2px 6px rgba(6,95,70,0.25)',  action: handleAgendarCita },
          { icon: '📅', label: 'Mis citas',      bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', h: 40, shadow: '0 4px 14px rgba(6,95,70,0.10)', shadowPress: '0 1px 4px rgba(6,95,70,0.06)', action: () => navigate('/citas') },
          { icon: '💊', label: 'Receta digital', bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', h: 40, shadow: '0 4px 14px rgba(6,95,70,0.10)', shadowPress: '0 1px 4px rgba(6,95,70,0.06)', action: () => navigate('/historial', { state: { filtro: 'recetas' } }) },
          { icon: '📋', label: 'Mi historial',   bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', h: 40, shadow: '0 4px 14px rgba(6,95,70,0.10)', shadowPress: '0 1px 4px rgba(6,95,70,0.06)', action: () => navigate('/historial') },
        ].map((a, i) => (
          <button
            key={i}
            onClick={a.action}
            style={{
              width: '100%', height: a.h,
              background: a.bg, border: `1.5px solid ${a.border}`,
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              padding: '0 14px', gap: 10,
              fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
              boxShadow: a.shadow,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onPointerDown={e => {
              e.currentTarget.style.transform = 'translateY(2px)'
              e.currentTarget.style.boxShadow = a.shadowPress
            }}
            onPointerUp={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = a.shadow
            }}
            onPointerLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = a.shadow
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{a.icon}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: a.color, textAlign: 'left' }}>
              {a.label}
            </span>
            <span style={{ fontSize: 16, color: a.color, opacity: 0.6, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>

      {/* ── Botica aliada ── */}
      <div
        onClick={() => navigate('/farmacias')}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && navigate('/farmacias')}
        style={{
          margin: '12px 20px 0',
          background: `linear-gradient(135deg, ${C.green50}, #fff)`,
          border: `1.5px solid ${C.green200}`,
          borderRadius: 14, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ width: 40, height: 40, borderRadius: 10, background: C.green100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.green800 }}>Encuentra una botica aliada</div>
          <div style={{ fontSize: 11, color: C.green700, marginTop: 2 }}>Recetas electrónicas aceptadas · Cerca de ti</div>
        </div>
        <span style={{ color: C.green500, fontSize: 18, flexShrink: 0 }}>›</span>
      </div>

      {/* ── Especialidades ── */}
      <SectionHeader title="¿Qué médico necesitas?" />
      <div style={{ padding: '0 20px 0' }}>
        <button
          onClick={() => setShowAllSpecs(v => !v)}
          style={{
            width: '100%', padding: '12px 0',
            background: showAllSpecs ? C.green700 : `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
            color: C.white, border: 'none', borderRadius: 12,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(5,150,105,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          🩺 {showAllSpecs ? 'Ocultar especialidades ▲' : 'Ver todas las especialidades ▼'}
        </button>
      </div>
      {showAllSpecs && (
        <div style={{
          margin: '10px 20px 0', border: `1.5px solid ${C.green200}`,
          borderRadius: 14, padding: '14px 12px', background: C.white,
          boxShadow: '0 4px 16px rgba(5,150,105,0.10)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green800, marginBottom: 10, paddingLeft: 4 }}>
            Selecciona una especialidad
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allSpecs.map(spec => {
              const quick  = SPECIALTIES.find(s => s.label === spec)
              const active = selectedSpec === spec
              return (
                <button
                  key={spec}
                  onClick={() => { setSelectedSpec(active ? null : spec); setShowAllSpecs(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                    background: active ? C.green700 : C.green50,
                    border: `1.5px solid ${active ? C.green700 : C.green200}`,
                    color: active ? C.white : C.green800,
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {quick && <span>{quick.icon}</span>}
                  {spec}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Lista de médicos ── */}
      <SectionHeader
        title={selectedSpec ?? 'Disponibles ahora'}
        actionLabel={selectedSpec ? 'Limpiar' : undefined}
        onAction={() => setSelectedSpec(null)}
      />

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loadingDocs && <><DoctorSkeleton /><DoctorSkeleton /><DoctorSkeleton /></>}

        {!loadingDocs && errorDocs && (
          <div style={{ textAlign: 'center', padding: 24, color: C.gray500, fontSize: 13, background: C.gray100, borderRadius: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            {errorDocs}
            <button
              onClick={() => { setLoadingDocs(true); setErrorDocs(null); fetchDoctors() }}
              style={{ display: 'block', margin: '12px auto 0', background: 'none', border: `1px solid ${C.green600}`, color: C.green700, borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >Reintentar</button>
          </div>
        )}

        {/* Próximos disponibles hoy */}
        {!loadingDocs && !errorDocs && proximosDisponibles.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
              <span style={{ fontSize: 13 }}>🕐</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>Próximos disponibles hoy</span>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {proximosDisponibles.map(d => (
                <div
                  key={d.docId}
                  onClick={() => navigate(`/medico/${d.docId}`)}
                  style={{
                    flexShrink: 0, width: 130, background: C.white,
                    border: `1.5px solid ${C.gray200}`, borderRadius: 14,
                    padding: '12px 12px 10px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  {d.fotoUrl
                    ? <img src={d.fotoUrl} alt={d.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontWeight: 800, fontSize: 15 }}>{d.initials}</div>
                  }
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gray900, textAlign: 'center', lineHeight: 1.3, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontSize: 10, color: C.gray500, textAlign: 'center' }}>{d.spec}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.green700, background: C.green50, border: `1px solid ${C.green200}`, padding: '3px 8px', borderRadius: 20, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {d.esManana ? 'Mañana ' : ''}{formatHora12(d.hora)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sin resultados */}
        {!loadingDocs && !errorDocs && filteredDocs.length === 0 && proximosDisponibles.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: C.gray500, fontSize: 13 }}>
            No se encontraron médicos disponibles
          </div>
        )}

        {/* Tarjetas de médicos */}
        {!loadingDocs && !errorDocs && filteredDocs.map((d, i) => (
          <div
            key={d.id}
            data-tour={i === 0 ? 'doctor-card' : undefined}
            style={{ animation: 'cardIn 0.32s ease both', animationDelay: `${Math.min(i, 6) * 55}ms` }}
          >
            <DoctorCard doc={d} onBook={handleBook} />
          </div>
        ))}
      </div>

      {/* Sello de confianza */}
      <div style={{
        margin: '20px 20px 8px',
        background: C.green50, border: `1px solid ${C.green100}`,
        borderRadius: 14, padding: '12px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green800 }}>Atención regulada · RENIPRESS registrado</div>
          <div style={{ fontSize: 11, color: C.green700, marginTop: 2 }}>Médicos colegiados · Receta electrónica válida · Ley 30421</div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {showAgendarModal && (
        <AgendarModal
          loading={solicitudLoading}
          onAviso={crearSolicitud}
          onEspecialidades={() => { setShowAgendarModal(false); navigate('/especialidades') }}
          onDespues={() => { setShowAgendarModal(false); navigate('/especialidades') }}
          onClose={() => setShowAgendarModal(false)}
        />
      )}
    </>
  )
}
