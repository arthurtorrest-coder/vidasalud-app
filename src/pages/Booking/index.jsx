import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, addDays, addWeeks, startOfWeek, startOfDay, isToday, isSameDay, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { C } from '../../lib/tokens'

/* Nombres cortos por getDay() — 0=Dom … 6=Sáb */
const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/* Genera slots de durMin minutos dentro de un bloque hora_inicio→hora_fin */
function generateSlots(horaInicio, horaFin, durMin = 20) {
  const [sh, sm] = horaInicio.split(':').map(Number)
  const [eh, em] = horaFin.split(':').map(Number)
  let   cur      = sh * 60 + sm
  const end      = eh * 60 + em
  const slots    = []
  while (cur + durMin <= end) {
    slots.push(
      `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
    )
    cur += durMin
  }
  return slots
}

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
                display: 'block', fontSize: 12, fontWeight: 500,
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

/* ── Calendario semanal ──────────────────────────────────────── */
function WeekCalendar({ selectedDate, onSelectDate, scheduleDays, loadingScheduleDays, weekOffset, onPrev, onNext }) {
  const todayStart = startOfDay(new Date())
  const monday     = startOfWeek(addWeeks(todayStart, weekOffset), { weekStartsOn: 1 })
  const days       = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  // Etiqueta del mes — si la semana cruza dos meses muestra ambos
  const m0 = format(monday,  'MMMM', { locale: es })
  const m6 = format(days[6], 'MMMM', { locale: es })
  const yr = format(days[6], 'yyyy')
  const monthRaw = m0 === m6 ? `${m0} ${yr}` : `${m0.slice(0, 3)} – ${m6.slice(0, 3)} ${yr}`
  const monthCap = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)

  const navStyle = (disabled) => ({
    width: 34, height: 34, borderRadius: 8, fontFamily: 'inherit',
    background: disabled ? C.gray100 : C.green50,
    border: `1.5px solid ${disabled ? C.gray200 : C.green200}`,
    color: disabled ? C.gray300 : C.green700,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  })

  return (
    <div style={{ padding: '0 16px' }}>

      {/* ── Encabezado: mes + navegación ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 12,
      }}>
        <button type="button" onClick={onPrev} disabled={weekOffset === 0} style={navStyle(weekOffset === 0)}>◀</button>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.gray700 }}>{monthCap}</span>
        <button type="button" onClick={onNext} disabled style={navStyle(true)}>▶</button>
      </div>

      {/* ── Letras de días (L M X J V S D) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 800,
            color: C.gray400, letterSpacing: 0.5,
          }}>
            {l}
          </div>
        ))}
      </div>

      {/* ── Celdas de días ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {days.map(day => {
          const isPast   = isBefore(day, todayStart)
          const isHoy    = isToday(day)
          const isSel    = isSameDay(day, selectedDate)
          const hasSch   = !loadingScheduleDays && scheduleDays.has(day.getDay())
          const noSch    = !loadingScheduleDays && !hasSch && !isPast
          const disabled = isPast || noSch

          let bg     = 'transparent'
          let bdCol  = 'transparent'
          let numCol = isPast || noSch ? C.gray300 : C.gray900
          let dotCol = null

          if (isSel && hasSch) {
            bg = C.green700; bdCol = C.green600; numCol = C.white
            dotCol = 'rgba(255,255,255,0.55)'
          } else if (isSel && !hasSch) {
            // selected but no schedule — keep neutral
            bg = C.gray100; bdCol = C.gray300; numCol = C.gray400
          } else if (isHoy) {
            bg = hasSch ? C.green50 : 'transparent'
            bdCol = hasSch ? C.green200 : C.gray200
            numCol = hasSch ? C.green700 : C.gray300
            dotCol = hasSch ? C.green500 : null
          } else if (!isPast) {
            dotCol = hasSch ? C.green500 : C.gray200
          }

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelectDate(day)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 2px 7px', borderRadius: 12,
                background: bg, border: `1.5px solid ${bdCol}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: (isPast && !isHoy) || noSch ? 0.32 : 1,
                gap: 2, fontFamily: 'inherit',
                transition: 'background 0.12s, border-color 0.12s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Nombre del día / etiqueta especial HOY */}
              <span style={{
                fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
                color: isSel ? 'rgba(255,255,255,0.65)'
                     : isHoy ? C.green600
                     : C.gray400,
              }}>
                {isHoy && !isSel ? 'HOY' : DIAS_SHORT[day.getDay()]}
              </span>

              {/* Número de día */}
              <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, color: numCol }}>
                {format(day, 'd')}
              </span>

              {/* Punto indicador de disponibilidad */}
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: dotCol ?? 'transparent',
              }} />
            </button>
          )
        })}
      </div>
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

/* ── Modal: completa tu perfil antes de reservar ──────────────── */
function ProfileCompleteModal({ onSaved, onClose }) {
  const { user, profile, setProfile } = useAuthStore()
  const [dni,      setDni]      = useState(profile?.dni   ?? '')
  const [phone,    setPhone]    = useState(profile?.phone ?? '')
  const [dniErr,   setDniErr]   = useState('')
  const [phoneErr, setPhoneErr] = useState('')
  const [saving,   setSaving]   = useState(false)

  async function handleSave() {
    let ok = true
    if (!dni || !/^\d{8}$/.test(dni))      { setDniErr('Debe tener 8 dígitos');    ok = false } else setDniErr('')
    if (!phone || !/^\d{9,}$/.test(phone)) { setPhoneErr('Mínimo 9 dígitos');      ok = false } else setPhoneErr('')
    if (!ok) return

    setSaving(true)
    const { data } = await supabase
      .from('profiles')
      .update({ dni: dni.trim(), phone: phone.trim() })
      .eq('id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
    setSaving(false)
    onSaved()
  }

  const inp = (err) => ({
    width: '100%', padding: '13px 14px',
    border: `1.5px solid ${err ? C.red600 : C.gray300}`,
    borderRadius: 12, fontSize: 15, color: C.gray900,
    background: err ? '#FEF2F2' : C.white,
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
  })

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.52)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 390,
          background: C.white, borderRadius: '22px 22px 0 0',
          padding: '20px 24px 36px',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
          animation: 'slideUp 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.gray200, margin: '-4px auto 0' }} />

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.gray900 }}>
            ¡Casi listo!
          </div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 4, lineHeight: 1.5 }}>
            Necesitamos tu DNI y teléfono para confirmar la cita y enviarte recordatorios.
          </div>
        </div>

        {/* DNI */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
            DNI (8 dígitos)
          </label>
          <input
            type="tel" inputMode="numeric" maxLength={8}
            value={dni}
            onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
            placeholder="12345678"
            style={inp(dniErr)}
          />
          {dniErr && (
            <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: C.red600, fontWeight: 600 }}>
              ⚠ {dniErr}
            </span>
          )}
        </div>

        {/* Teléfono */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
            Teléfono (9 dígitos)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '13px 12px', border: `1.5px solid ${C.gray300}`,
              borderRadius: 12, fontSize: 14, color: C.gray500,
              background: C.gray100, flexShrink: 0, fontWeight: 600,
            }}>+51</span>
            <input
              type="tel" inputMode="numeric" maxLength={9}
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="987654321"
              style={{ ...inp(phoneErr), flex: 1 }}
            />
          </div>
          {phoneErr && (
            <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: C.red600, fontWeight: 600 }}>
              ⚠ {phoneErr}
            </span>
          )}
        </div>

        {/* Privacidad */}
        <div style={{
          background: C.green50, border: `1px solid ${C.green100}`,
          borderRadius: 10, padding: '9px 13px',
          fontSize: 11, color: C.green700, lineHeight: 1.5,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0 }}>🔒</span>
          Datos protegidos bajo Ley 29733. Solo se usan para tu atención médica.
        </div>

        {/* Botones */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '15px 0',
            background: saving ? C.green100 : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            color: saving ? C.green700 : C.white,
            border: 'none', borderRadius: 13,
            fontSize: 15, fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
            boxShadow: saving ? 'none' : '0 4px 14px rgba(5,150,105,0.3)',
          }}
        >
          {saving ? 'Guardando…' : 'Confirmar datos y reservar →'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', padding: '13px 0',
            background: 'none', border: `1.5px solid ${C.gray200}`,
            borderRadius: 13, color: C.gray500,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ── Página de reserva ───────────────────────────────────────── */
export default function Booking() {
  const { doctorId } = useParams()
  const navigate     = useNavigate()
  const { user, profile, setProfile } = useAuthStore()

  const [needsProfile, setNeedsProfile] = useState(false)
  const [doctor,          setDoctor]          = useState(null)
  const [loadingDoctor,   setLoadingDoctor]   = useState(true)
  const [weekOffset,           setWeekOffset]           = useState(0)
  const [docScheduleDays,      setDocScheduleDays]      = useState(new Set())
  const [loadingScheduleDays,  setLoadingScheduleDays]  = useState(true)
  const [selectedDate,    setSelectedDate]    = useState(() => new Date())
  const [selectedTime,  setSelectedTime]  = useState(null)
  const [booked,         setBooked]         = useState(new Set())
  const [loadingSlots,   setLoadingSlots]   = useState(true)
  const [availableSlots, setAvailableSlots] = useState([])
  const [motivo,        setMotivo]        = useState(() => {
    const saved = sessionStorage.getItem('vidasalud_triaje')
    if (saved) sessionStorage.removeItem('vidasalud_triaje')
    return saved ?? ''
  })
  const [submitting,    setSubmitting]    = useState(false)

  /* cargar datos del médico + días de horario configurados */
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

    supabase
      .from('doctor_schedules')
      .select('dia_semana')
      .eq('doctor_id', doctorId)
      .eq('activo', true)
      .then(({ data }) => {
        setDocScheduleDays(new Set((data ?? []).map(s => Number(s.dia_semana))))
        setLoadingScheduleDays(false)
      })
  }, [doctorId, navigate])

  /* cargar horarios del médico y turnos ocupados al cambiar la fecha */
  useEffect(() => {
    setSelectedTime(null)
    setLoadingSlots(true)

    async function loadSlots() {
      const dayOfWeek  = selectedDate.getDay()
      const dateStr    = format(selectedDate, 'yyyy-MM-dd')
      const [y, mo, d] = dateStr.split('-').map(Number)
      const dayStart   = new Date(Date.UTC(y, mo - 1, d,     5, 0,  0)).toISOString()
      const dayEnd     = new Date(Date.UTC(y, mo - 1, d + 1, 4, 59, 59)).toISOString()

      const [{ data: scheduleData }, { data: apptData }] = await Promise.all([
        supabase
          .from('doctor_schedules')
          .select('hora_inicio, hora_fin')
          .eq('doctor_id', doctorId)
          .eq('dia_semana', dayOfWeek)
          .eq('activo', true),
        supabase
          .from('appointments')
          .select('scheduled_at')
          .eq('doctor_id', doctorId)
          .gte('scheduled_at', dayStart)
          .lte('scheduled_at', dayEnd)
          .in('status', ['pending', 'paid', 'active', 'done']),
      ])

      setAvailableSlots(
        (scheduleData ?? []).flatMap(b => generateSlots(b.hora_inicio, b.hora_fin))
      )

      setBooked(new Set(
        (apptData ?? []).map(a => {
          // Convertir UTC → hora Lima (UTC-5)
          const t = new Date(new Date(a.scheduled_at).getTime() - 5 * 3600000)
          return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
        })
      ))

      setLoadingSlots(false)
    }

    loadSlots()
  }, [selectedDate, doctorId])

  /* crear cita y navegar al pago */
  async function proceedWithBooking() {
    setSubmitting(true)
    const dateStr     = format(selectedDate, 'yyyy-MM-dd')
    const scheduledAt = new Date(`${dateStr}T${selectedTime}:00-05:00`)

    // Calcular posición en la cola del día
    const [yy, mm, dd] = dateStr.split('-').map(Number)
    const dayStart = new Date(Date.UTC(yy, mm - 1, dd,     5,  0,  0)).toISOString()
    const dayEnd   = new Date(Date.UTC(yy, mm - 1, dd + 1, 4, 59, 59)).toISOString()
    const { count: colaCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .in('status', ['pending', 'paid', 'active', 'done'])

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id:       user.id,
        doctor_id:        doctorId,
        status:           'pending',
        scheduled_at:     scheduledAt.toISOString(),
        duration_minutes: 20,
        chief_complaint:  motivo.trim(),
        posicion_cola:    (colaCount ?? 0) + 1,
        hora_referencial: selectedTime,
      })
      .select('id')
      .single()
    setSubmitting(false)
    if (error) {
      console.error('[Booking] appointments insert error:', error)
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

  async function handleConfirm() {
    if (!selectedTime) { toast.error('Selecciona un horario'); return }
    if (motivo.trim().length < 10) { toast.error('Describe el motivo (mínimo 10 caracteres)'); return }

    // Si el paciente no tiene DNI o teléfono, pedirlos antes de reservar
    if (!profile?.dni || !profile?.phone) {
      setNeedsProfile(true)
      return
    }

    await proceedWithBooking()
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

        {/* ── Calendario semanal ── */}
        <SectionTitle>📅 Elige una fecha</SectionTitle>
        <WeekCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          scheduleDays={docScheduleDays}
          loadingScheduleDays={loadingScheduleDays}
          weekOffset={weekOffset}
          onPrev={() => setWeekOffset(w => Math.max(0, w - 1))}
          onNext={() => setWeekOffset(w => Math.min(8, w + 1))}
        />

        {/* Fecha seleccionada — confirma visualmente la elección */}
        <div style={{
          margin: '10px 20px 0',
          padding: '9px 14px',
          background: C.green50,
          border: `1px solid ${C.green100}`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>📅</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.green700 }}>
            {longDate(selectedDate)}
          </span>
          {!loadingSlots && availableSlots.length > 0 && (
            <span style={{
              marginLeft: 'auto', fontSize: 12, fontWeight: 700,
              background: C.green100, color: C.green700,
              padding: '2px 8px', borderRadius: 20,
            }}>
              {availableSlots.length} horarios
            </span>
          )}
        </div>

        {/* ── Horarios disponibles (dinámicos desde doctor_schedules) ── */}
        {loadingSlots ? (
          <>
            <SectionTitle>Cargando horarios…</SectionTitle>
            <SlotGrid slots={[]} selected={null} booked={new Set()} date={selectedDate} onSelect={() => {}} loading />
          </>
        ) : availableSlots.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '36px 20px',
            display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
          }}>
            <span style={{ fontSize: 44 }}>📅</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.gray700 }}>
              Sin horarios para este día
            </div>
            <div style={{ fontSize: 12, color: C.gray500, lineHeight: 1.55, maxWidth: 260 }}>
              {doctor
                ? `${doctorTitle(doctor.cmp, doctor.nombres)} ${doctor.nombres} no tiene disponibilidad el ${longDate(selectedDate).toLowerCase()}.`
                : 'El médico no tiene disponibilidad para este día.'}
              {' '}Prueba con otra fecha.
            </div>
          </div>
        ) : (
          <>
            {availableSlots.some(s => parseInt(s) < 12) && (
              <>
                <SectionTitle>☀️ Por la mañana</SectionTitle>
                <SlotGrid
                  slots={availableSlots.filter(s => parseInt(s) < 12)}
                  selected={selectedTime}
                  booked={booked}
                  date={selectedDate}
                  onSelect={setSelectedTime}
                  loading={false}
                />
              </>
            )}
            {availableSlots.some(s => parseInt(s) >= 12 && parseInt(s) < 19) && (
              <>
                <SectionTitle>🌅 Por la tarde</SectionTitle>
                <SlotGrid
                  slots={availableSlots.filter(s => parseInt(s) >= 12 && parseInt(s) < 19)}
                  selected={selectedTime}
                  booked={booked}
                  date={selectedDate}
                  onSelect={setSelectedTime}
                  loading={false}
                />
              </>
            )}
            {availableSlots.some(s => parseInt(s) >= 19) && (
              <>
                <SectionTitle>🌙 Por la noche</SectionTitle>
                <SlotGrid
                  slots={availableSlots.filter(s => parseInt(s) >= 19)}
                  selected={selectedTime}
                  booked={booked}
                  date={selectedDate}
                  onSelect={setSelectedTime}
                  loading={false}
                />
              </>
            )}
          </>
        )}

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

      {/* Modal: completar perfil si faltan DNI / teléfono */}
      {needsProfile && (
        <ProfileCompleteModal
          onSaved={() => { setNeedsProfile(false); proceedWithBooking() }}
          onClose={() => setNeedsProfile(false)}
        />
      )}
    </>
  )
}
