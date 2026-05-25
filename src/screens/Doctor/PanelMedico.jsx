import { useState, useEffect, useRef, useMemo } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import VideoRoom from '../../components/VideoRoom'
import RecetaForm from '../../components/RecetaForm'

// ─── Paleta ──────────────────────────────────────────────────
const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green200: '#A7F3D0',
  green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B', amberBg:  '#FFFBEB', amberText: '#B45309',
  blue600:  '#2563EB', blueBg:   '#EFF6FF', blueText:  '#1D4ED8',
  red600:   '#DC2626', redBg:    '#FEF2F2',
  gray900:  '#111827', gray700:  '#374151', gray500:   '#6B7280',
  gray400:  '#9CA3AF', gray300:  '#D1D5DB', gray200:   '#E5E7EB',
  gray100:  '#F3F4F6', gray50:   '#F9FAFB', white:     '#FFFFFF',
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
  })
}

function fmtFechaLarga() {
  return new Date().toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long',
  }).replace(/^\w/, c => c.toUpperCase())
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function parseSoap(raw) {
  try { const p = JSON.parse(raw); if (p?.s !== undefined) return p } catch {}
  return null
}

function getLimaToday() {
  const d = new Date(Date.now() - 5 * 3600 * 1000)
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function dateStrShift(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12))
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function dateSelectorLabel(dateStr) {
  const today = getLimaToday()
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d, 12))
  const dayMonth = dt.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  if (dateStr === today)                   return { top: 'Hoy',    bot: dayMonth }
  if (dateStr === dateStrShift(today,  1)) return { top: 'Mañana', bot: dayMonth }
  if (dateStr === dateStrShift(today, -1)) return { top: 'Ayer',   bot: dayMonth }
  const dow = dt.toLocaleDateString('es-PE', { weekday: 'long', timeZone: 'UTC' })
  return { top: dow.charAt(0).toUpperCase() + dow.slice(1), bot: dayMonth }
}

// ─── Badge de estado ─────────────────────────────────────────
const STATUS_CFG = {
  pending:   { label: 'Pend. pago',   bg: C.amberBg, color: C.amberText },
  paid:      { label: 'Confirmada',   bg: C.green50,  color: C.green700  },
  active:    { label: 'En consulta',  bg: C.blueBg,   color: C.blueText  },
  done:      { label: 'Completada',   bg: C.gray100,  color: C.gray500   },
  cancelled: { label: 'Cancelada',    bg: C.redBg,    color: C.red600    },
}

function Badge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.done
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Avatar del paciente ──────────────────────────────────────
function Avatar({ name, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 700, fontSize: size * 0.32,
    }}>
      {getInitials(name)}
    </div>
  )
}

// ─── Skeleton de carga ────────────────────────────────────────
function SkeletonCard() {
  const bar = (w, h) => (
    <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
  )
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 16, padding: 16, display: 'flex', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.gray200, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bar('55%', 13)}
        {bar('38%', 11)}
        {bar('70%', 11)}
      </div>
    </div>
  )
}

// ─── Formulario SOAP ─────────────────────────────────────────
const SOAP_FIELDS = [
  {
    key: 'S', field: 's',
    label: 'S — Subjetivo',
    hint: 'Lo que refiere el paciente: síntomas, duración, intensidad.',
    placeholder: 'Ej: Paciente masculino de 42 años refiere cefalea pulsátil de 3 días de evolución, 7/10 de intensidad…',
    required: true,
  },
  {
    key: 'O', field: 'o',
    label: 'O — Objetivo',
    hint: 'Hallazgos del examen físico y signos vitales.',
    placeholder: 'Ej: PA 130/85 mmHg, FC 78 lpm, afebril, consciente y orientado…',
    required: false,
  },
  {
    key: 'A', field: 'a',
    label: 'A — Análisis',
    hint: 'Diagnóstico o impresión diagnóstica (CIE-10 si aplica).',
    placeholder: 'Ej: Cefalea tensional (G44.2). Descartar HTA secundaria.',
    required: false,
  },
  {
    key: 'P', field: 'p',
    label: 'P — Plan',
    hint: 'Tratamiento, medicamentos, dosis, indicaciones y seguimiento.',
    placeholder: 'Ej: Ibuprofeno 400 mg c/8h por 3 días. Reposo relativo. Control en 7 días si no mejora.',
    required: false,
  },
]

function SoapForm({ soap, onChange, onFinish, saving }) {
  const [focused, setFocused] = useState(null)
  const formRef = useRef(null)

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div
      ref={formRef}
      style={{
        marginTop: 12, borderTop: `2px dashed ${C.green200}`,
        paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>📝</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.green800 }}>
          Nota SOAP
        </span>
        <span style={{ fontSize: 11, color: C.gray500 }}>· campo S obligatorio</span>
      </div>

      {SOAP_FIELDS.map(({ key, field, label, hint, placeholder, required }) => (
        <div key={key}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: C.green700 }}>
              {label}
              {required && <span style={{ color: C.red600 }}> *</span>}
            </label>
            <span style={{ fontSize: 11, color: C.gray400 }}>{hint}</span>
          </div>
          <textarea
            value={soap[field]}
            onChange={e => onChange(field, e.target.value)}
            onFocus={() => setFocused(field)}
            onBlur={() => setFocused(null)}
            placeholder={placeholder}
            rows={3}
            style={{
              width: '100%', padding: '10px 12px',
              border: `1.5px solid ${focused === field ? C.green500 : C.gray300}`,
              borderRadius: 10, fontSize: 13, color: C.gray900,
              background: C.white, outline: 'none', resize: 'vertical',
              fontFamily: 'inherit', lineHeight: 1.5,
              boxShadow: focused === field ? '0 0 0 3px rgba(16,185,129,0.1)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
        </div>
      ))}

      <button
        onClick={onFinish}
        disabled={saving}
        style={{
          width: '100%', padding: '14px 0',
          background: saving
            ? C.green100
            : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
          color: saving ? C.green700 : C.white,
          border: 'none', borderRadius: 12,
          fontSize: 14, fontWeight: 800,
          cursor: saving ? 'not-allowed' : 'pointer',
          boxShadow: saving ? 'none' : '0 4px 14px rgba(5,150,105,0.3)',
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}
      >
        {saving ? 'Guardando nota…' : '✅ Terminar consulta'}
      </button>
    </div>
  )
}

// ─── Tarjeta de cita ──────────────────────────────────────────
function AppointmentCard({ appt, isActive, hasAnyActive, onStart, starting, soap, onSoapChange, onFinish, saving, onOpenVideo }) {
  const patient   = appt.patient
  const name      = patient?.full_name ?? 'Paciente'
  const canStart  = appt.status === 'paid' && !hasAnyActive
  const blocked   = appt.status === 'paid' && hasAnyActive && !isActive

  return (
    <div style={{
      background: C.white,
      border: `2px solid ${isActive ? C.green500 : C.gray200}`,
      borderRadius: 16, padding: 16,
      boxShadow: isActive ? '0 4px 20px rgba(16,185,129,0.15)' : 'none',
      transition: 'all 0.2s',
    }}>
      {/* Fila principal */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* Hora */}
        <div style={{
          flexShrink: 0, width: 52, textAlign: 'center',
          background: isActive ? C.green50 : C.gray100,
          borderRadius: 10, padding: '6px 0',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: isActive ? C.green800 : C.gray700 }}>
            {fmtHora(appt.scheduled_at)}
          </div>
          <div style={{ fontSize: 10, color: C.gray500, marginTop: 1 }}>
            {appt.duration_minutes} min
          </div>
        </div>

        {/* Paciente */}
        <Avatar name={name} size={44} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          {patient?.dni && (
            <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>
              DNI {patient.dni}
            </div>
          )}
        </div>

        <Badge status={appt.status} />
      </div>

      {/* Motivo de consulta */}
      {appt.chief_complaint && (
        <div style={{
          marginTop: 10, background: C.gray50, borderRadius: 10,
          padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>💬</span>
          <span style={{ fontSize: 12, color: C.gray700, lineHeight: 1.5 }}>
            {appt.chief_complaint}
          </span>
        </div>
      )}

      {/* Nota SOAP ya guardada (cita completada) */}
      {appt.status === 'done' && parseSoap(appt.notes_doctor) && (() => {
        const s = parseSoap(appt.notes_doctor)
        return (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 12, fontWeight: 600, color: C.green700, cursor: 'pointer' }}>
              Ver nota SOAP guardada
            </summary>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SOAP_FIELDS.map(({ key, field, label }) => s[field] ? (
                <div key={key} style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.green800 }}>{label}:</span>{' '}
                  <span style={{ color: C.gray700 }}>{s[field]}</span>
                </div>
              ) : null)}
            </div>
          </details>
        )
      })()}

      {/* Botón "Iniciar consulta" */}
      {canStart && (
        <button
          onClick={() => onStart(appt)}
          disabled={starting}
          style={{
            marginTop: 12, width: '100%', padding: '12px 0',
            background: starting
              ? C.green100
              : `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
            color: starting ? C.green700 : C.white,
            border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 700,
            cursor: starting ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
        >
          {starting ? 'Iniciando…' : '▶ Iniciar consulta'}
        </button>
      )}

      {blocked && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.amberText, textAlign: 'center', fontWeight: 600 }}>
          ⏳ Hay una consulta en curso — termínala primero
        </div>
      )}

      {/* Botón de videollamada (cita activa con sala creada) */}
      {isActive && appt.video_url && (
        <button
          onClick={() => onOpenVideo(appt.video_url)}
          style={{
            marginTop: 12, width: '100%', padding: '12px 0',
            background: `linear-gradient(135deg, #1D4ED8, #2563EB)`,
            color: C.white, border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            transition: 'all 0.15s',
          }}
        >
          📹 Abrir videollamada
        </button>
      )}

      {/* Formulario SOAP (solo cuando está activa) */}
      {isActive && (
        <SoapForm
          soap={soap}
          onChange={onSoapChange}
          onFinish={onFinish}
          saving={saving}
        />
      )}
    </div>
  )
}

// ─── Estado vacío ─────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 52 }}>🗓️</span>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.gray700 }}>Sin citas para este día</div>
      <p style={{ fontSize: 13, color: C.gray500, margin: 0, lineHeight: 1.6 }}>
        No hay consultas programadas para la fecha seleccionada.
        Las nuevas reservas aparecerán aquí automáticamente.
      </p>
    </div>
  )
}

// ─── Panel principal ──────────────────────────────────────────
export default function PanelMedico() {
  const { user, profile } = useAuthStore()

  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [doctorInfo,   setDoctorInfo]   = useState(null)
  const [disponible,   setDisponible]   = useState(null)
  const [toggling,     setToggling]     = useState(false)
  const [soap,         setSoap]         = useState({ s: '', o: '', a: '', p: '' })
  const [saving,       setSaving]       = useState(false)
  const [startingId,   setStartingId]   = useState(null)
  const [videoUrl,     setVideoUrl]     = useState(null)
  const [selectedDate, setSelectedDate] = useState(getLimaToday)
  const [recetaData,   setRecetaData]   = useState(null)

  const activeAppt  = useMemo(() => appointments.find(a => a.status === 'active') ?? null, [appointments])
  const hasAnyActive = activeAppt !== null

  // Pre-cargar nota SOAP si la cita activa ya tiene una parcialmente guardada
  useEffect(() => {
    if (!activeAppt) return
    const prev = parseSoap(activeAppt.notes_doctor)
    if (prev) setSoap(prev)
    else setSoap({ s: '', o: '', a: '', p: '' })
  }, [activeAppt?.id])

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`panel-medico-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAppointments(prev =>
              prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a)
            )
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function fetchData() {
    setLoading(true)

    // Rango del día seleccionado en hora Lima (UTC-5)
    const [y, mo, d] = selectedDate.split('-').map(Number)
    const start = new Date(Date.UTC(y, mo - 1, d,     5, 0,  0)).toISOString()  // 00:00 Lima = 05:00 UTC
    const end   = new Date(Date.UTC(y, mo - 1, d + 1, 4, 59, 59)).toISOString() // 23:59:59 Lima = 04:59:59 UTC

    const [apptRes, docRes] = await Promise.all([
      supabase
        .from('appointments')
        .select(`*, patient:profiles!patient_id ( full_name, phone, dni )`)
        .eq('doctor_id', user.id)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('doctors')
        .select('id, activo, especialidad, cmp, specialty, cmp_code')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    if (apptRes.error) {
      console.error('[PanelMedico] Error al cargar citas:', apptRes.error)
      toast.error('Error al cargar las citas: ' + apptRes.error.message)
    }
    if (apptRes.data) setAppointments(apptRes.data)

    // Buscar por id primero (schema.sql: doctors.id = auth uuid)
    let info = docRes.data
    if (!info) {
      // Fallback: doctors registrados con RegisterMedico tienen profile_id = auth uuid
      const { data } = await supabase
        .from('doctors')
        .select('id, activo, especialidad, cmp, specialty, cmp_code')
        .eq('profile_id', user.id)
        .maybeSingle()
      info = data
    }
    if (info) {
      setDoctorInfo(info)
      setDisponible(info.activo ?? false)
    } else {
      console.warn('[PanelMedico] No se encontró fila en doctors para este usuario')
      setDisponible(false)
    }
    setLoading(false)
  }

  async function handleStart(appt) {
    console.log('[handleStart] appt.id:', appt.id, '| existing video_url:', appt.video_url)
    setStartingId(appt.id)

    // Siempre llamar a la Edge Function — ella gestiona idempotencia y renovación de sala
    toast.loading('Creando sala de video…', { id: 'room-creation' })
    console.log('[handleStart] invoking create-daily-room…')
    const { data, error: fnError } = await supabase.functions.invoke('create-daily-room', {
      body: { appointmentId: appt.id },
    })
    toast.dismiss('room-creation')
    console.log('[handleStart] function response — data:', data, '| error:', fnError)

    if (fnError || !data?.url) {
      console.error('[handleStart] Edge Function failed:', fnError ?? 'no url in response')
      toast.error('No se pudo crear la sala de video. Verifica que la Edge Function esté desplegada.')
      setStartingId(null)
      return
    }
    const roomUrl = data.url

    console.log('[handleStart] roomUrl to use:', roomUrl)

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'active', video_url: roomUrl })
      .eq('id', appt.id)

    console.log('[handleStart] DB update error:', error)

    if (error) {
      toast.error('No se pudo iniciar la consulta')
    } else {
      setAppointments(prev =>
        prev.map(a => a.id === appt.id ? { ...a, status: 'active', video_url: roomUrl } : a)
      )
      setSoap({ s: '', o: '', a: '', p: '' })
      console.log('[handleStart] calling setVideoUrl with:', roomUrl)
      setVideoUrl(roomUrl)
      toast.success('Consulta iniciada · Sala de video lista')
    }
    setStartingId(null)
  }

  async function handleFinish() {
    if (!activeAppt) return
    if (!soap.s.trim()) {
      toast.error('El campo Subjetivo (S) es obligatorio antes de terminar')
      return
    }

    setSaving(true)
    // Capture before state updates (activeAppt becomes null after status→done)
    const apptSnapshot = activeAppt
    const soapSnapshot = { ...soap }

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'done', notes_doctor: JSON.stringify(soap) })
      .eq('id', activeAppt.id)

    if (error) {
      toast.error('No se pudo guardar la nota SOAP')
    } else {
      setAppointments(prev =>
        prev.map(a =>
          a.id === activeAppt.id
            ? { ...a, status: 'done', notes_doctor: JSON.stringify(soap) }
            : a
        )
      )
      setSoap({ s: '', o: '', a: '', p: '' })
      toast.success('Consulta completada · Nota SOAP guardada', { duration: 4000 })
      setRecetaData({ appointment: apptSnapshot, soap: soapSnapshot })
    }
    setSaving(false)
  }

  function handleSoapChange(field, value) {
    setSoap(prev => ({ ...prev, [field]: value }))
  }

  async function handleToggle() {
    if (toggling || !doctorInfo?.id) return
    const next = !disponible
    setDisponible(next)
    setToggling(true)
    const { error } = await supabase
      .from('doctors')
      .update({ activo: next })
      .eq('id', doctorInfo.id)
    setToggling(false)
    if (error) {
      setDisponible(!next)
      toast.error('No se pudo actualizar la disponibilidad')
    } else {
      toast.success(next ? 'Ahora estás disponible para nuevas citas' : 'Ya no apareces en la lista de médicos')
    }
  }

  // ── Estadísticas del día ──────────────────────────────────
  const stats = useMemo(() => ({
    total:      appointments.length,
    pendientes: appointments.filter(a => ['pending', 'paid'].includes(a.status)).length,
    completadas:appointments.filter(a => a.status === 'done').length,
  }), [appointments])

  const doctorName = profile?.full_name ?? 'Doctor'
  const cmp        = doctorInfo?.cmp        ?? doctorInfo?.cmp_code  ?? ''
  const specialty  = doctorInfo?.especialidad ?? doctorInfo?.specialty ?? ''

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.gray100}; font-family: 'DM Sans', system-ui, sans-serif; }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.7); }
          70%  { box-shadow: 0 0 0 7px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      <Toaster
        position="bottom-center"
        toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13, maxWidth: 340 } }}
      />

      {/* Overlay de videollamada */}
      {videoUrl && (
        <VideoRoom url={videoUrl} onLeave={() => setVideoUrl(null)} />
      )}

      {/* Formulario de receta electrónica */}
      {recetaData && (
        <RecetaForm
          appointment={recetaData.appointment}
          doctorInfo={doctorInfo}
          doctorName={doctorName}
          soap={recetaData.soap}
          onClose={() => setRecetaData(null)}
          onSuccess={() => setRecetaData(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', padding: '20px 0', background: C.gray100 }}>
        <div style={{
          width: 390, background: C.white, borderRadius: 32, overflow: 'hidden',
          border: `1.5px solid ${C.gray300}`, display: 'flex', flexDirection: 'column',
          maxHeight: 780,
        }}>

          {/* ── Status bar ─────────────────────────────────── */}
          <div style={{
            background: C.green800, color: C.white, padding: '10px 20px 8px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>VIDASALUD · Médico</span>
            <span style={{ fontSize: 12 }}>▲ ● ■</span>
          </div>

          {/* ── Header del médico ───────────────────────────── */}
          <div style={{
            background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
            padding: '20px 20px 24px', flexShrink: 0,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>
              {fmtFechaLarga()}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.white, lineHeight: 1.2 }}>
              Dr. {doctorName.split(' ')[0]} 👋
            </div>
            {(specialty || cmp) && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                {specialty}{specialty && cmp && ' · '}{cmp}
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {[
                { n: stats.total,       label: 'Citas'        },
                { n: stats.pendientes,  label: 'Pendientes'   },
                { n: stats.completadas, label: 'Completadas'  },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, background: 'rgba(255,255,255,0.15)',
                  borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{s.n}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Toggle de disponibilidad */}
            <div
              onClick={handleToggle}
              style={{
                marginTop: 14,
                background: disponible
                  ? 'rgba(52,211,153,0.18)'
                  : 'rgba(0,0,0,0.18)',
                border: `1.5px solid ${disponible ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 14,
                padding: '11px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: (toggling || disponible === null) ? 'not-allowed' : 'pointer',
                opacity: toggling ? 0.7 : 1,
                transition: 'background 0.25s, border-color 0.25s, opacity 0.15s',
                userSelect: 'none',
              }}
            >
              {/* Lado izquierdo: indicador + texto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                  background: disponible ? C.green400 : 'rgba(255,255,255,0.3)',
                  animation: disponible ? 'pulse-dot 1.6s ease-in-out infinite' : 'none',
                }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.white, lineHeight: 1 }}>
                    {disponible === null
                      ? 'Cargando…'
                      : disponible
                        ? 'Disponible'
                        : 'No disponible'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>
                    {disponible
                      ? 'Los pacientes pueden reservarte'
                      : 'No apareces en la lista'}
                  </div>
                </div>
              </div>

              {/* Lado derecho: switch */}
              <div style={{
                width: 52, height: 28, borderRadius: 14, flexShrink: 0,
                background: disponible ? C.green400 : 'rgba(255,255,255,0.2)',
                position: 'relative',
                transition: 'background 0.25s',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 3,
                  left: disponible ? 27 : 3,
                  width: 22, height: 22, borderRadius: '50%',
                  background: C.white,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                  transition: 'left 0.22s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
            </div>
          </div>

          {/* ── Cuerpo scrollable ───────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ── Selector de fecha ──────────────────────────── */}
            {(() => {
              const { top, bot } = dateSelectorLabel(selectedDate)
              const isToday = selectedDate === getLimaToday()
              const btnStyle = {
                width: 34, height: 34, borderRadius: 10,
                border: `1.5px solid ${C.gray200}`, background: C.white,
                fontSize: 13, cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.gray700,
              }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button style={btnStyle} onClick={() => setSelectedDate(p => dateStrShift(p, -1))}>◀</button>

                  <label style={{ flex: 1, position: 'relative', cursor: 'pointer' }}>
                    <div style={{
                      textAlign: 'center', background: C.gray50,
                      border: `1.5px solid ${C.gray200}`, borderRadius: 10, padding: '6px 8px',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.gray900 }}>{top}</div>
                      <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>{bot}</div>
                    </div>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      style={{
                        position: 'absolute', inset: 0, opacity: 0,
                        width: '100%', height: '100%', cursor: 'pointer',
                      }}
                    />
                  </label>

                  <button style={btnStyle} onClick={() => setSelectedDate(p => dateStrShift(p, 1))}>▶</button>

                  {!isToday && (
                    <button
                      onClick={() => setSelectedDate(getLimaToday())}
                      style={{
                        padding: '6px 10px', borderRadius: 10, border: 'none',
                        background: C.green100, color: C.green800,
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        flexShrink: 0, fontFamily: 'inherit',
                      }}
                    >Hoy</button>
                  )}

                  <button
                    onClick={fetchData}
                    disabled={loading}
                    style={{
                      background: 'none', border: 'none', fontSize: 17,
                      color: loading ? C.gray300 : C.green700,
                      cursor: loading ? 'default' : 'pointer', flexShrink: 0, lineHeight: 1,
                    }}
                    title="Actualizar"
                  >↻</button>
                </div>
              )
            })()}

            {/* Estado: cargando */}
            {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

            {/* Estado: sin citas */}
            {!loading && appointments.length === 0 && <EmptyState />}

            {/* Lista de citas */}
            {!loading && appointments.map(appt => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                isActive={appt.id === activeAppt?.id}
                hasAnyActive={hasAnyActive}
                onStart={handleStart}
                starting={startingId === appt.id}
                soap={soap}
                onSoapChange={handleSoapChange}
                onFinish={handleFinish}
                saving={saving}
                onOpenVideo={setVideoUrl}
              />
            ))}

            {/* Sello regulatorio */}
            {!loading && (
              <div style={{
                marginTop: 4, background: C.green50, border: `1px solid ${C.green100}`,
                borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>🛡️</span>
                <span style={{ fontSize: 11, color: C.green700, lineHeight: 1.6 }}>
                  Las notas SOAP quedan registradas bajo tu CMP en cumplimiento de la Ley 30421.
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
