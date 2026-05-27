import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, addDays, isToday, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

/* ── Paleta (misma que el resto de la app) ───────────────────── */
const C = {
  green900: '#064E3B',
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green500: '#10B981',
  green200: '#A7F3D0',
  green100: '#D1FAE5',
  green50:  '#ECFDF5',
  amber:    '#F59E0B',
  gray900:  '#111827',
  gray700:  '#374151',
  gray500:  '#6B7280',
  gray400:  '#9CA3AF',
  gray300:  '#D1D5DB',
  gray200:  '#E5E7EB',
  gray100:  '#F3F4F6',
  white:    '#FFFFFF',
}

/* ── Slots: 08:00 → 17:30 (20 turnos de 30 min) ─────────────── */
const ALL_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const h = 8 + Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})
const MORNING_SLOTS   = ALL_SLOTS.filter(s => parseInt(s) < 12)   // 08:00–11:30
const AFTERNOON_SLOTS = ALL_SLOTS.filter(s => parseInt(s) >= 12)  // 12:00–17:30

const DATES = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i))

/* ── Helpers ─────────────────────────────────────────────────── */
function doctorTitle(cmp, nombres) {
  if (cmp.startsWith('CPsP')) return 'Psic.'
  return nombres.trimEnd().endsWith('a') ? 'Dra.' : 'Dr.'
}

function nowLimaHHMM() {
  return new Date().toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function isPastSlot(date, slot) {
  return isToday(date) && slot <= nowLimaHHMM()
}

function labelDate(date) {
  if (isToday(date)) return 'Hoy'
  // "lun." → "LUN"
  return format(date, 'EEE', { locale: es }).replace('.', '').toUpperCase()
}

function longDate(date) {
  // "lunes 19 de mayo" → "Lunes 19 de mayo"
  const s = format(date, "EEEE d 'de' MMMM", { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ── Subcomponentes ──────────────────────────────────────────── */
function Avatar({ nombres, apellidos, fotoUrl, size = 52 }) {
  const initials = nombres[0].toUpperCase() + apellidos[0].toUpperCase()
  if (fotoUrl) {
    return (
      <img src={fotoUrl} alt={initials} style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
      }} />
    )
  }
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

/* Título de sección — mismo tamaño que SectionHeader en Home */
function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0,
      padding: '20px 20px 10px',
    }}>
      {children}
    </h2>
  )
}

/* Grilla de turnos con skeleton de carga */
function SlotGrid({ slots, selected, booked, date, onSelect, loading }) {
  if (loading) {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, padding: '0 20px',
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            height: 40, borderRadius: 10,
            background: C.gray100, border: `1.5px solid ${C.gray200}`,
          }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: 8, padding: '0 20px',
    }}>
      {slots.map(slot => {
        const past     = isPastSlot(date, slot)
        const occupied = booked.has(slot)
        const disabled = past || occupied
        const active   = selected === slot

        return (
          <button
            key={slot}
            disabled={disabled}
            onClick={() => onSelect(slot)}
            style={{
              padding: '10px 0 8px',
              borderRadius: 10,
              border: `1.5px solid ${
                active   ? C.green600 :
                disabled ? C.gray200  : C.gray300
              }`,
              background: active   ? C.green700 :
                          disabled ? C.gray100  : C.white,
              color: active   ? C.white   :
                     disabled ? C.gray400 : C.gray900,
              fontSize: 14, fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.12s',
              lineHeight: 1,
              boxShadow: active ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
            }}
          >
            {slot}
            {occupied && !past && (
              <span style={{
                display: 'block', fontSize: 9, fontWeight: 500,
                color: C.gray400, marginTop: 3,
              }}>
                Ocupado
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* Fila de resumen (etiqueta + valor) */
function ResumenFila({ label, value, grande }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: grande ? 13 : 12,
    }}>
      <span style={{ color: grande ? C.green800 : C.gray500, fontWeight: grande ? 700 : 400 }}>
        {label}
      </span>
      <span style={{
        color: grande ? C.green700 : C.gray900,
        fontWeight: grande ? 900 : 600,
        fontSize: grande ? 18 : 12,
        textAlign: 'right', maxWidth: '60%',
      }}>
        {value}
      </span>
    </div>
  )
}

/* ── Página de reserva ───────────────────────────────────────── */
export default function Booking() {
  const { doctorId } = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuthStore()

  const [doctor,        setDoctor]        = useState(null)
  const [loadingDoctor, setLoadingDoctor] = useState(true)
  const [selectedDate,  setSelectedDate]  = useState(DATES[0])
  const [selectedTime,  setSelectedTime]  = useState(null)
  const [booked,        setBooked]        = useState(new Set())
  const [loadingSlots,  setLoadingSlots]  = useState(true)
  const [motivo,        setMotivo]        = useState(() => {
    const saved = sessionStorage.getItem('vidasalud_triaje')
    if (saved) sessionStorage.removeItem('vidasalud_triaje')
    return saved ?? ''
  })
  const [submitting,    setSubmitting]    = useState(false)

  /* cargar datos del médico */
  useEffect(() => {
    supabase
      .from('doctors')
      .select('*')
      .eq('id', doctorId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error('Médico no encontrado')
          navigate('/', { replace: true })
        } else {
          setDoctor(data)
        }
        setLoadingDoctor(false)
      })
  }, [doctorId, navigate])

  /* cargar turnos ocupados al cambiar la fecha */
  useEffect(() => {
    setSelectedTime(null)
    setLoadingSlots(true)
    supabase
      .rpc('get_booked_slots', {
        p_doctor_id: doctorId,
        p_date: format(selectedDate, 'yyyy-MM-dd'),
      })
      .then(({ data }) => {
        setBooked(new Set((data ?? []).map(r => r.slot_time)))
        setLoadingSlots(false)
      })
  }, [selectedDate, doctorId])

  /* crear cita y navegar al pago */
  async function handleConfirm() {
    if (!selectedTime) { toast.error('Selecciona un horario'); return }
    if (motivo.trim().length < 10) { toast.error('Describe el motivo (mínimo 10 caracteres)'); return }

    setSubmitting(true)
    const scheduledAt = new Date(
      `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00-05:00`
    )

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id:       user.id,
        doctor_id:        doctorId,
        status:           'pending',
        scheduled_at:     scheduledAt.toISOString(),
        duration_minutes: 20,
        chief_complaint:  motivo.trim(),
      })
      .select('id')
      .single()

    setSubmitting(false)

    if (error) {
      if (error.code === '23505') {
        toast.error('Ese horario acaba de ser reservado. Elige otro.')
        setBooked(prev => new Set([...prev, selectedTime]))
        setSelectedTime(null)
      } else {
        toast.error('No se pudo crear la cita. Inténtalo de nuevo.')
      }
      return
    }
    navigate(`/pago/${data.id}`)
  }

  const readyToSubmit = !!selectedTime && motivo.trim().length >= 10
  const titulo        = doctor ? doctorTitle(doctor.cmp, doctor.nombres) : ''
  const motivoFaltante = 10 - motivo.trim().length

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Cabecera ── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green700} 100%)`,
        padding: '16px 20px 22px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: 20, padding: '6px 14px', marginBottom: 14,
            color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Volver
        </button>
        <div style={{ fontSize: 21, fontWeight: 900, color: C.white, lineHeight: 1.1 }}>
          Reservar cita
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          Elige fecha, horario y motivo de consulta
        </div>
      </div>

      {/* ── Contenido desplazable ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Tarjeta del médico */}
        <div style={{ padding: '16px 20px 0' }}>
          {loadingDoctor ? (
            <div style={{
              height: 82, borderRadius: 16,
              background: C.gray100, border: `1.5px solid ${C.gray200}`,
            }} />
          ) : doctor && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: C.green50, border: `1.5px solid ${C.green100}`,
              borderRadius: 16, padding: '14px 16px',
            }}>
              <Avatar
                nombres={doctor.nombres}
                apellidos={doctor.apellidos}
                fotoUrl={doctor.foto_url}
                size={52}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.gray900 }}>
                  {titulo} {doctor.nombres} {doctor.apellidos}
                </div>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                  {doctor.especialidad} · {doctor.cmp}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.amber, fontWeight: 700 }}>
                    ★ {Number(doctor.rating).toFixed(1)}
                  </span>
                  <span style={{ fontSize: 11, color: C.gray400 }}>
                    ({doctor.total_reviews} reseñas)
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.green700, marginLeft: 'auto' }}>
                    S/. {doctor.precio}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Selector de fecha ── */}
        <SectionTitle>📅 Elige una fecha</SectionTitle>
        <div style={{ display: 'flex', gap: 8, padding: '0 20px', overflowX: 'auto' }}>
          {DATES.map(date => {
            const active = isSameDay(date, selectedDate)
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                style={{
                  flexShrink: 0, minWidth: 54,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                  background: active ? C.green700 : C.white,
                  border: `1.5px solid ${active ? C.green700 : C.gray300}`,
                  transition: 'all 0.12s',
                  boxShadow: active ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: active ? C.green100 : C.gray500 }}>
                  {labelDate(date)}
                </span>
                <span style={{ fontSize: 20, fontWeight: 900, color: active ? C.white : C.gray900, lineHeight: 1.2 }}>
                  {format(date, 'd')}
                </span>
                <span style={{ fontSize: 10, fontWeight: 500, color: active ? C.green200 : C.gray500 }}>
                  {format(date, 'MMM', { locale: es })}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Horarios de mañana ── */}
        <SectionTitle>☀️ Por la mañana · 08:00 – 11:30</SectionTitle>
        <SlotGrid
          slots={MORNING_SLOTS}
          selected={selectedTime}
          booked={booked}
          date={selectedDate}
          onSelect={setSelectedTime}
          loading={loadingSlots}
        />

        {/* ── Horarios de tarde ── */}
        <SectionTitle>🌅 Por la tarde · 12:00 – 17:30</SectionTitle>
        <SlotGrid
          slots={AFTERNOON_SLOTS}
          selected={selectedTime}
          booked={booked}
          date={selectedDate}
          onSelect={setSelectedTime}
          loading={loadingSlots}
        />

        {/* ── Motivo de consulta ── */}
        <SectionTitle>📝 Motivo de consulta</SectionTitle>
        <div style={{ padding: '0 20px' }}>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Describe brevemente tu síntoma o motivo de consulta. Ej: Tengo dolor de cabeza frecuente desde hace 3 días..."
            maxLength={400}
            rows={4}
            style={{
              width: '100%', padding: '13px 14px',
              border: `1.5px solid ${C.gray300}`,
              borderRadius: 12, fontSize: 13, color: C.gray900,
              resize: 'none', outline: 'none', lineHeight: 1.6,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = C.green500
              e.target.style.boxShadow   = '0 0 0 3px rgba(16,185,129,0.12)'
            }}
            onBlur={e => {
              e.target.style.borderColor = C.gray300
              e.target.style.boxShadow   = 'none'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: motivoFaltante > 0 ? C.gray400 : C.green600,
            }}>
              {motivoFaltante > 0
                ? `Mínimo 10 caracteres · faltan ${motivoFaltante}`
                : '✓ Descripción completa'}
            </span>
            <span style={{ fontSize: 11, color: C.gray400 }}>{motivo.length}/400</span>
          </div>
        </div>

        {/* ── Resumen (aparece al elegir horario) ── */}
        {selectedTime && doctor && (
          <div style={{ margin: '20px 20px 0' }}>
            <div style={{
              background: C.green50, border: `1.5px solid ${C.green100}`,
              borderRadius: 14, padding: '16px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.green800, marginBottom: 2 }}>
                Resumen de tu cita
              </div>
              <ResumenFila label="👨‍⚕️ Médico"    value={`${titulo} ${doctor.nombres} ${doctor.apellidos}`} />
              <ResumenFila label="📅 Fecha"      value={longDate(selectedDate)} />
              <ResumenFila label="🕐 Hora"       value={`${selectedTime} · hora Lima`} />
              <ResumenFila label="⏱ Duración"   value="20 minutos" />
              <div style={{ borderTop: `1px solid ${C.green200}`, paddingTop: 10, marginTop: 2 }}>
                <ResumenFila label="Total a pagar" value={`S/. ${doctor.precio}`} grande />
              </div>
            </div>
          </div>
        )}

        {/* ── Botón principal ── */}
        <div style={{ padding: '20px 20px 28px' }}>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              width: '100%', padding: '15px 0',
              background: readyToSubmit && !submitting
                ? `linear-gradient(135deg, ${C.green800}, ${C.green600})`
                : C.gray200,
              color:  readyToSubmit && !submitting ? C.white : C.gray400,
              border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 800,
              cursor: readyToSubmit && !submitting ? 'pointer' : 'default',
              boxShadow: readyToSubmit && !submitting
                ? '0 4px 14px rgba(5,150,105,0.35)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {submitting         ? 'Reservando…'                     :
             !selectedTime      ? 'Elige un horario para continuar' :
             motivoFaltante > 0 ? 'Describe el motivo para continuar':
                                  'Continuar al pago →'}
          </button>
        </div>

      </div>
    </>
  )
}
