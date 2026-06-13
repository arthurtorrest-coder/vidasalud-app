import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import TriajeBot from '../../components/TriajeBot'
import VideoRoom from '../../components/VideoRoom'
import { C } from '../../lib/tokens'
import { requestPermission, subscribeToPush, saveTokenToSupabase } from '../../lib/pushNotifications'

// Mapa síntoma → especialidad para sugerencias en la búsqueda
const SYMPTOMS = {
  'fiebre': 'General', 'gripe': 'General', 'resfriado': 'General', 'cefalea': 'General',
  'dolor cabeza': 'General', 'dolor de cabeza': 'General',
  'tos': 'Neumología', 'respira': 'Neumología', 'bronquio': 'Neumología', 'asma': 'Neumología',
  'diente': 'Odontología', 'muela': 'Odontología', 'caries': 'Odontología', 'boca': 'Odontología',
  'piel': 'Dermatología', 'acné': 'Dermatología', 'manchas': 'Dermatología', 'sarpullido': 'Dermatología',
  'niño': 'Pediatría', 'bebé': 'Pediatría', 'infante': 'Pediatría', 'infantil': 'Pediatría',
  'corazón': 'Cardiología', 'presión': 'Cardiología', 'colesterol': 'Cardiología', 'arritmia': 'Cardiología',
  'ansiedad': 'Psicología', 'depresión': 'Psicología', 'estrés': 'Psicología', 'tristeza': 'Psicología',
  'dieta': 'Nutrición', 'obesidad': 'Nutrición', 'adelgazar': 'Nutrición', 'peso': 'Nutrición',
  'ojo': 'Oftalmología', 'visión': 'Oftalmología', 'vista': 'Oftalmología',
  'hueso': 'Traumatología', 'rodilla': 'Traumatología', 'fractura': 'Traumatología', 'espalda': 'Traumatología',
  'diabetes': 'Endocrinología', 'tiroides': 'Endocrinología', 'hormona': 'Endocrinología',
  'estómago': 'Gastroenterología', 'digestión': 'Gastroenterología', 'reflujo': 'Gastroenterología',
  'nutrición': 'Nutrición',
}

const SPECIALTIES = [
  { icon: '🩺', label: 'General',     price: 35 },
  { icon: '👶', label: 'Pediatría',   price: 45 },
  { icon: '🧠', label: 'Psicología',  price: 50 },
  { icon: '🥗', label: 'Nutrición',   price: 40 },
  { icon: '❤️', label: 'Cardiología', price: 70 },
  { icon: '🦷', label: 'Odontología', price: 60 },
]

const STATUS_COLORS = {
  now:   { dot: C.green600, label: C.green700, bg: C.green50 },
  soon:  { dot: C.amber,    label: '#B45309',  bg: '#FFFBEB' },
  later: { dot: C.gray500,  label: C.gray500,  bg: C.gray100 },
}

function getLimaDateTime() {
  const now = new Date()
  const lima = new Date(now.getTime() + (now.getTimezoneOffset() - 300) * 60000)
  return {
    diaSemana: lima.getDay(),
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
      (s.hora_fin ?? '') > horaActual
    ) {
      ids.add(s.doctor_id)
    }
  }
  return ids
}

// Transforma fila de Supabase al shape que usa la UI.
// Soporta doctors_seed.sql (nombres/apellidos/especialidad/cmp)
// y schema.sql legacy (specialty/cmp_code, id=profile uuid).
function formatDoc(row) {
  const nombres    = row.nombres   ?? row.full_name ?? '?'
  const apellidos  = row.apellidos ?? ''
  const spec       = row.especialidad ?? row.specialty ?? ''
  const cmp        = row.cmp       ?? row.cmp_code   ?? ''
  const precio     = row.precio    ?? (row.consultation_fee ? Math.round(row.consultation_fee / 100) : 0)
  const isCPsP     = cmp.startsWith('CPsP')
  const esFemenino = nombres.trimEnd().endsWith('a')
  const titulo     = isCPsP ? 'Psic.' : esFemenino ? 'Dra.' : 'Dr.'
  const primerNombre   = nombres[0]?.toUpperCase()   ?? '?'
  const primerApellido = apellidos[0]?.toUpperCase() ?? '?'
  return {
    id:          row.id,
    initials:    primerNombre + primerApellido,
    name:        `${titulo} ${nombres} ${apellidos}`.trim(),
    spec,
    cmp,
    rating:      Number(row.rating ?? 0),
    reviews:     row.total_reviews ?? row.review_count ?? 0,
    price:       precio,
    fotoUrl:     row.foto_url ?? null,
    status:      'now',
    statusLabel: 'Disponible ahora',
  }
}

// ─── Subcomponentes ───────────────────────────────────────────

function Avatar({ initials, fotoUrl, size = 48 }) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={initials}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 700, fontSize: size * 0.33, flexShrink: 0,
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
        {'★'.repeat(filled)}
        <span style={{ color: C.gray300 }}>{'★'.repeat(5 - filled)}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.gray700 }}>
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

function StatusBadge({ status, label }) {
  const s = STATUS_COLORS[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.label,
      fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
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
        <div style={{ fontSize: 12, color: C.gray500, marginTop: 1 }}>
          {doc.spec} · {doc.cmp}
        </div>
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
        }}>
          Reservar
        </div>
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

function SpecialtyChip({ icon, label, price, selected, onClick }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
        background: selected ? C.green700 : C.white,
        border: `1.5px solid ${selected ? C.green700 : C.gray300}`,
        transition: 'all 0.15s ease', minWidth: 72, flexShrink: 0,
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: selected ? C.white : C.gray700 }}>{label}</span>
      <span style={{ fontSize: 12, color: selected ? C.green100 : C.gray500 }}>S/. {price}</span>
    </div>
  )
}

function PromoStrip() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div style={{
      background: `linear-gradient(90deg, ${C.green800}, ${C.green600})`,
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎉</span>
        <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>
          Primera consulta a S/. 20 — solo hoy
        </span>
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}
        aria-label="Cerrar promoción"
      >×</button>
    </div>
  )
}

function SearchResultItem({ doc, onSelect }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onSelect() }}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        background: pressed ? C.green50 : C.white,
        cursor: 'pointer', transition: 'background 0.1s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Avatar initials={doc.initials} fotoUrl={doc.fotoUrl} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gray900,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.name}
        </div>
        <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>
          {doc.spec}
          {doc.price > 0 && (
            <span style={{ color: C.green700, fontWeight: 700, marginLeft: 5 }}>
              · S/. {doc.price}
            </span>
          )}
        </div>
      </div>
      {doc.rating > 0 && (
        <span style={{ fontSize: 11, color: C.amber, fontWeight: 700, flexShrink: 0 }}>
          ★ {doc.rating.toFixed(1)}
        </span>
      )}
      <span style={{ color: C.gray300, fontSize: 16, flexShrink: 0 }}>›</span>
    </div>
  )
}

function SearchBar({ value, onChange, onFocus, onBlur }) {
  const [focused, setFocused] = useState(false)
  return (
    <div data-tour="search" style={{ position: 'relative', margin: '16px 20px 0' }}>
      <span style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: focused ? C.green600 : C.gray500, fontSize: 18, pointerEvents: 'none',
        zIndex: 1,
      }}>🔍</span>
      <input
        type="text"
        placeholder="Buscar médico, síntoma o especialidad..."
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { setFocused(true); onFocus?.() }}
        onBlur={() => { setFocused(false); onBlur?.() }}
        style={{
          width: '100%', padding: '12px 40px 12px 44px',
          border: `1.5px solid ${focused ? C.green500 : C.gray300}`,
          borderRadius: focused && value ? '12px 12px 0 0' : 12,
          fontSize: 13, outline: 'none',
          background: C.white, color: C.gray900,
          boxShadow: focused ? '0 0 0 3px rgba(16,185,129,0.12)' : 'none',
          transition: 'border-color 0.15s, border-radius 0.15s',
        }}
      />
      {value && (
        <button
          type="button"
          onPointerDown={e => { e.preventDefault(); onChange('') }}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: C.gray200, border: 'none', borderRadius: '50%',
            width: 20, height: 20, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: C.gray500, lineHeight: 1,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 10px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>{title}</h2>
      {actionLabel && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', color: C.green700, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {actionLabel} →
        </button>
      )}
    </div>
  )
}

function QuickActions() {
  const navigate = useNavigate()
  const actions = [
    { icon: '⚡', label: 'Consultar\nahora',  color: C.green50,  border: C.green200, to: '/especialidades' },
    { icon: '📅', label: 'Mis\ncitas',         color: '#EFF6FF',  border: '#BFDBFE', to: '/citas'          },
    { icon: '💊', label: 'Receta\ndigital',    color: '#FFF7ED',  border: '#FED7AA', onTap: () => navigate('/historial', { state: { filtro: 'recetas' } }) },
    { icon: '📋', label: 'Mi\nhistorial',      color: '#F5F3FF',  border: '#DDD6FE', to: '/historial'      },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 20px' }}>
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => a.onTap ? a.onTap() : navigate(a.to)}
          style={{
            background: a.color, border: `1.5px solid ${a.border}`,
            borderRadius: 14, padding: '12px 8px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'transform 0.12s',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <span style={{ fontSize: 22 }}>{a.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.gray700, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
            {a.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Alerta de consulta activa ────────────────────────────────

function doctorTitulo(doc) {
  const isCPsP = (doc?.cmp ?? '').startsWith('CPsP')
  const fem    = (doc?.nombres ?? '').trimEnd().endsWith('a')
  return isCPsP ? 'Psic.' : fem ? 'Dra.' : 'Dr.'
}

function ActiveCallBanner({ appt, onEnter }) {
  const doc      = appt.doctor ?? {}
  const titulo   = doctorTitulo(doc)
  const nombre   = [doc.nombres, doc.apellidos].filter(Boolean).join(' ') || 'tu médico'
  const spec     = doc.especialidad ?? ''

  return (
    <div style={{
      background: 'linear-gradient(135deg, #065F46, #059669)',
      padding: '16px 20px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
      animation: 'banner-glow 2s ease-in-out infinite',
      flexShrink: 0,
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
          background: '#FFFFFF', color: '#065F46',
          border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}
      >
        📹 Entrar a la consulta
      </button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function Home() {
  const navigate    = useNavigate()
  const { profile, user } = useAuthStore()
  const firstName   = profile?.full_name?.split(' ')[0] ?? ''

  const [search,          setSearch]          = useState('')
  const [selectedSpec,    setSelectedSpec]    = useState(null)
  const [doctors,         setDoctors]         = useState([])
  const [availableNowIds, setAvailableNowIds] = useState(new Set())
  const [loadingDocs,     setLoadingDocs]     = useState(true)
  const [errorDocs,       setErrorDocs]       = useState(null)
  const [showTriaje,      setShowTriaje]      = useState(false)
  const [activeAppt,      setActiveAppt]      = useState(null)
  const [videoUrl,        setVideoUrl]        = useState(null)
  const [showPushBanner,  setShowPushBanner]  = useState(false)

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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `patient_id=eq.${user.id}` },
        () => { checkActiveAppt() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, checkActiveAppt])

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
    const activos = (docs ?? []).filter(d => d.activo !== false && d.aprobado !== false)
    const schedulesData = scheds ?? []
    setDoctors(activos.map(formatDoc))
    setAvailableNowIds(computeAvailableNowIds(schedulesData))
    setLoadingDocs(false)
  }

  useEffect(() => {
    fetchDoctors()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel('home-doctors-availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors' },
        () => { fetchDoctors() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      profile?.role === 'patient' &&
      'Notification' in window &&
      Notification.permission === 'default' &&
      !localStorage.getItem('vs-push-dismissed')
    ) {
      const t = setTimeout(() => setShowPushBanner(true), 2500)
      return () => clearTimeout(t)
    }
  }, [profile?.role])

  async function handleActivarPush() {
    setShowPushBanner(false)
    localStorage.setItem('vs-push-dismissed', '1')
    const permission = await requestPermission()
    if (permission !== 'granted') return
    const subscription = await subscribeToPush()
    if (!subscription) return
    await saveTokenToSupabase(subscription)
    toast.success('¡Recordatorios de citas activados! 🔔')
  }

  function handleDismissPush() {
    setShowPushBanner(false)
    localStorage.setItem('vs-push-dismissed', '1')
  }

  const handleBook = (doc) => {
    navigate(`/medico/${doc.id}`)
  }

  // Especialidad sugerida cuando el texto coincide con un síntoma conocido
  const symptomSpec = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    for (const [kw, spec] of Object.entries(SYMPTOMS)) {
      if (q.includes(kw)) return spec
    }
    return null
  }, [search])

  // Resultados en tiempo real para el panel de búsqueda
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    const byName = doctors.filter(d =>
      d.name.toLowerCase().includes(q) || d.spec.toLowerCase().includes(q)
    )
    const bySymptom = symptomSpec
      ? doctors.filter(d =>
          d.spec.toLowerCase().includes(symptomSpec.toLowerCase()) &&
          !byName.some(b => b.id === d.id)
        )
      : []
    return [...byName, ...bySymptom].slice(0, 7)
  }, [search, doctors, symptomSpec])

  const filteredDocs = doctors.filter(d => {
    const q         = search.toLowerCase()
    const specMatch = !selectedSpec || d.spec.toLowerCase().includes(selectedSpec.toLowerCase())
    const txtMatch  = !q || d.name.toLowerCase().includes(q) || d.spec.toLowerCase().includes(q)
    const nowMatch  = selectedSpec ? true : availableNowIds.has(d.id)
    return specMatch && txtMatch && nowMatch
  })

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
      `}</style>

      {videoUrl && <VideoRoom url={videoUrl} onLeave={() => setVideoUrl(null)} />}

      {activeAppt && profile?.role === 'patient' && (
        <ActiveCallBanner appt={activeAppt} onEnter={setVideoUrl} />
      )}

      {showTriaje && (
        <TriajeBot
          onClose={() => setShowTriaje(false)}
          onSelectSpecialty={(spec) => {
            setSelectedSpec(spec)
            setSearch('')
            setShowTriaje(false)
          }}
          onBookNow={() => {
            setShowTriaje(false)
            const general = doctors.find(d =>
              d.spec.toLowerCase().includes('general')
            )
            if (general) {
              navigate(`/booking/${general.id}`)
            } else {
              setSelectedSpec('General')
              setSearch('')
            }
          }}
        />
      )}

      <PromoStrip />

      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
        padding: '20px 20px 28px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              {firstName ? `Hola, ${firstName} 👋` : 'Bienvenido 👋'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginTop: 2 }}>
              ¿Cómo te sientes hoy?
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
              📍 Perú · Médicos disponibles ahora
            </div>
          </div>
          <button
            onClick={() => toast('Sin notificaciones nuevas')}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 20 }}>🔔</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[
            { n: loadingDocs ? '…' : String(doctors.filter(d => availableNowIds.has(d.id)).length), label: 'Médicos online'  },
            { n: '< 5 min',                                   label: 'Espera promedio' },
            { n: 'S/. 20',                                    label: 'Promo hoy'       },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, background: 'rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '8px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{s.n}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Banner de acceso a panel propio — solo para admin / doctor */}
      {profile?.role === 'admin' && (
        <button
          onClick={() => navigate('/admin/panel')}
          style={{
            margin: '16px 20px 0',
            width: 'calc(100% - 40px)',
            padding: '14px 18px',
            background: `linear-gradient(135deg, ${C.green900}, ${C.green800})`,
            border: `1.5px solid ${C.green700}`,
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 20px rgba(6,79,60,0.35)',
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>⚙️</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>
              Panel de administrador
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              Gestiona citas, médicos e ingresos
            </div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, flexShrink: 0 }}>›</span>
        </button>
      )}

      {profile?.role === 'doctor' && (
        <button
          onClick={() => navigate('/medico/panel')}
          style={{
            margin: '16px 20px 0',
            width: 'calc(100% - 40px)',
            padding: '14px 18px',
            background: `linear-gradient(135deg, ${C.green900}, ${C.green800})`,
            border: `1.5px solid ${C.green700}`,
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 20px rgba(6,79,60,0.35)',
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>🩺</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>
              Ir a mi panel médico
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              Ver tus citas y consultas pendientes
            </div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, flexShrink: 0 }}>›</span>
        </button>
      )}

      <SearchBar value={search} onChange={setSearch} />

      {/* ── Panel de búsqueda en tiempo real ── */}
      {search.trim().length > 0 && (
        <div style={{
          margin: '0 20px',
          background: C.white,
          border: `1.5px solid ${C.green200}`,
          borderTop: 'none',
          borderRadius: '0 0 14px 14px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(5,150,105,0.13)',
          zIndex: 10,
        }}>

          {/* Sugerencia de síntoma */}
          {symptomSpec && (
            <div
              onPointerDown={e => {
                e.preventDefault()
                setSearch('')
                setSelectedSpec(symptomSpec)
              }}
              style={{
                padding: '8px 16px', cursor: 'pointer',
                background: '#FFFBEB',
                borderBottom: `1px solid #FDE68A`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>💡</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: '#B45309', fontWeight: 600 }}>
                  Síntoma detectado · Ver médicos de{' '}
                </span>
                <span style={{ fontSize: 11, color: '#92400E', fontWeight: 800 }}>
                  {symptomSpec}
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#B45309' }}>›</span>
            </div>
          )}

          {/* Cabecera de resultados */}
          <div style={{
            padding: '8px 16px 6px',
            background: C.green50,
            borderBottom: `1px solid ${C.green100}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.green800 }}>
              {searchResults.length > 0
                ? `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''} para "${search}"`
                : `Sin resultados para "${search}"`}
            </span>
            <button
              type="button"
              onPointerDown={e => { e.preventDefault(); setSearch('') }}
              style={{
                background: 'none', border: 'none', color: C.gray400,
                fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Lista de resultados */}
          {searchResults.length === 0 ? (
            <div style={{
              padding: '20px 16px', textAlign: 'center',
              color: C.gray400, fontSize: 12,
            }}>
              No encontramos médicos para "{search}".<br />
              <span style={{ color: C.green700, fontWeight: 600 }}>
                Intenta con el nombre del médico o una especialidad.
              </span>
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {searchResults.map((doc, i) => (
                <div key={doc.id}>
                  {i > 0 && (
                    <div style={{ height: 1, background: C.gray100, margin: '0 16px' }} />
                  )}
                  <SearchResultItem
                    doc={doc}
                    onSelect={() => {
                      setSearch('')
                      navigate(`/medico/${doc.id}`)
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pie: ver todos */}
          {searchResults.length > 0 && (
            <div style={{ padding: '6px 16px 10px', borderTop: `1px solid ${C.gray100}` }}>
              <button
                type="button"
                onPointerDown={e => { e.preventDefault() }}
                onClick={() => setSearch(search)}
                style={{
                  width: '100%', padding: '7px 0',
                  background: 'none',
                  border: `1px solid ${C.green200}`,
                  borderRadius: 8, fontSize: 11, fontWeight: 700,
                  color: C.green700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Ver todos los resultados en la lista ↓
              </button>
            </div>
          )}
        </div>
      )}

      {/* Asistente de triaje IA */}
      <button
        onClick={() => setShowTriaje(true)}
        style={{
          margin: '12px 20px 0',
          width: 'calc(100% - 40px)',
          padding: '13px 16px',
          background: `linear-gradient(135deg, ${C.green900}, ${C.green700})`,
          border: 'none', borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 16px rgba(5,150,105,0.28)',
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>🤖</span>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>
            ¿Qué médico necesito?
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Describe tus síntomas · La IA te orienta en segundos
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, flexShrink: 0 }}>›</span>
      </button>

      {/* Banner de notificaciones push */}
      {showPushBanner && (
        <div style={{
          margin: '12px 20px 0',
          background: `linear-gradient(135deg, ${C.green900}, ${C.green700})`,
          border: `1px solid ${C.green600}`,
          borderRadius: 16, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: '0 4px 20px rgba(6,79,60,0.30)',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🔔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>
                ¿Quieres recordatorios de tus citas?
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3, lineHeight: 1.4 }}>
                Te avisamos 1 hora antes de cada consulta para que no la olvides.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleActivarPush}
              style={{
                flex: 1, padding: '9px 0',
                background: C.white, color: C.green800,
                border: 'none', borderRadius: 10,
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sí, activar
            </button>
            <button
              onClick={handleDismissPush}
              style={{
                flex: 1, padding: '9px 0',
                background: 'rgba(255,255,255,0.15)', color: C.white,
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      <SectionHeader title="Acciones rápidas" />
      <QuickActions />

      <SectionHeader title="Especialidades" />
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 4px', overflowX: 'auto' }}>
        {SPECIALTIES.map((s, i) => (
          <SpecialtyChip
            key={i}
            {...s}
            selected={selectedSpec === s.label}
            onClick={() => setSelectedSpec(selectedSpec === s.label ? null : s.label)}
          />
        ))}
      </div>
      <div style={{ padding: '10px 20px 0' }}>
        <button
          data-tour="especialidades-btn"
          onClick={() => navigate('/especialidades')}
          style={{
            width: '100%', padding: '12px 0',
            background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
            color: C.white, border: 'none', borderRadius: 12,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(5,150,105,0.28)',
          }}
        >
          🩺 Ver todas las especialidades
        </button>
      </div>

      <SectionHeader
        title={selectedSpec ?? 'Disponibles ahora'}
        actionLabel="Ver todos"
        onAction={() => {}}
      />

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Estado: cargando */}
        {loadingDocs && (
          <>
            <DoctorSkeleton />
            <DoctorSkeleton />
            <DoctorSkeleton />
          </>
        )}

        {/* Estado: error */}
        {!loadingDocs && errorDocs && (
          <div style={{
            textAlign: 'center', padding: 24, color: C.gray500, fontSize: 13,
            background: C.gray100, borderRadius: 12,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            {errorDocs}
            <button
              onClick={() => { setLoadingDocs(true); setErrorDocs(null); }}
              style={{
                display: 'block', margin: '12px auto 0',
                background: 'none', border: `1px solid ${C.green600}`,
                color: C.green700, borderRadius: 8, padding: '6px 16px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Estado: sin resultados del filtro */}
        {!loadingDocs && !errorDocs && filteredDocs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: C.gray500, fontSize: 13 }}>
            No se encontraron médicos
            {search && ` para "${search}"`}
          </div>
        )}

        {/* Lista de médicos — entrada escalonada */}
        {!loadingDocs && !errorDocs && filteredDocs.map((d, i) => (
          <div
            key={d.id}
            data-tour={i === 0 ? 'doctor-card' : undefined}
            style={{
              animation: 'cardIn 0.32s ease both',
              animationDelay: `${Math.min(i, 6) * 55}ms`,
            }}
          >
            <DoctorCard doc={d} onBook={handleBook} />
          </div>
        ))}
      </div>

      {/* Sello de confianza */}
      <div style={{
        margin: '20px 20px 8px',
        background: C.green50, border: `1px solid ${C.green100}`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green800 }}>
            Atención regulada · RENIPRESS registrado
          </div>
          <div style={{ fontSize: 11, color: C.green700, marginTop: 2 }}>
            Médicos colegiados · Receta electrónica válida · Ley 30421
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />
    </>
  )
}
