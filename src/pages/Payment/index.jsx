import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

/* ── Paleta ─────────────────────────────────────────────────── */
const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green200: '#A7F3D0',
  green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B',
  gray900:  '#111827', gray700: '#374151', gray500: '#6B7280',
  gray400:  '#9CA3AF', gray300: '#D1D5DB', gray200: '#E5E7EB',
  gray100:  '#F3F4F6', white:   '#FFFFFF',
  red: '#EF4444', red50: '#FEF2F2',
}

/* ── Helpers ─────────────────────────────────────────────────── */
function codigoCita(id) {
  return 'VIDA-' + id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

function doctorTitle(cmp, nombres) {
  if (cmp.startsWith('CPsP')) return 'Psic.'
  return nombres.trimEnd().endsWith('a') ? 'Dra.' : 'Dr.'
}

function formatScheduledAt(iso) {
  const dt   = new Date(iso)
  const opts = { timeZone: 'America/Lima' }
  const s    = dt.toLocaleDateString('es-PE', { ...opts, weekday: 'long', day: 'numeric', month: 'long' })
  return {
    fecha: s.charAt(0).toUpperCase() + s.slice(1),
    hora:  dt.toLocaleTimeString('es-PE', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

function fmtCardNum(v) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function fmtExpiry(v) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

function cardBrand(numero) {
  const n = numero.replace(/\s/g, '')
  if (n.startsWith('4'))            return 'VISA'
  if (/^5[1-5]|^2[2-7]/.test(n))   return 'MASTERCARD'
  return null
}

function validateCard(card) {
  const errors = {}
  if (card.numero.replace(/\s/g, '').length < 15) errors.numero  = 'Número de tarjeta inválido'
  if (card.titular.trim().length < 3)              errors.titular = 'Ingresa el nombre del titular'
  const [mm, aa] = (card.expiry || '').split('/')
  const m = parseInt(mm), y = parseInt('20' + aa)
  const now = new Date()
  if (!mm || !aa || m < 1 || m > 12 || y < now.getFullYear() ||
      (y === now.getFullYear() && m < now.getMonth() + 1))
    errors.expiry = 'Fecha de vencimiento inválida'
  if (card.cvv.length < 3) errors.cvv = 'CVV inválido'
  return errors
}

/* ── SVG: QR demo con marcadores de posición reales ────────── */
function QRDemo({ accent }) {
  const sq = (x, y, s = 8) => <rect key={`${x}${y}`} x={x} y={y} width={s} height={s} fill={accent} />
  const finder = (ox, oy) => (
    <g key={`f${ox}${oy}`}>
      <rect x={ox}    y={oy}    width={34} height={34} rx={3} fill={accent} />
      <rect x={ox+7}  y={oy+7}  width={20} height={20} rx={2} fill={C.white} />
      <rect x={ox+11} y={oy+11} width={12} height={12} rx={1} fill={accent} />
    </g>
  )
  const data = [
    [54,8],[62,8],[70,8],[78,8],[86,8],[54,16],[70,16],[86,16],
    [54,24],[62,24],[78,24],[54,32],[70,32],[86,32],[62,40],[78,40],
    [8,50],[16,50],[24,50],[32,50],[54,50],[62,50],[78,50],[86,50],[94,50],[110,50],[118,50],
    [8,58],[24,58],[32,58],[54,58],[70,58],[86,58],[102,58],[118,58],
    [8,66],[16,66],[32,66],[54,66],[62,66],[86,66],[102,66],[110,66],
    [8,74],[24,74],[54,74],[78,74],[94,74],[110,74],[118,74],
    [8,82],[16,82],[24,82],[32,82],[54,82],[62,82],[86,82],[102,82],[118,82],
    [54,90],[70,90],[86,90],[94,90],[110,90],
    [54,98],[62,98],[86,98],[102,98],[118,98],
    [54,106],[78,106],[94,106],[118,106],
    [54,114],[62,114],[70,114],[86,114],[102,114],
    [54,122],[78,122],[94,122],[110,122],[118,122],
  ]
  return (
    <svg width={136} height={136} viewBox="0 0 136 136" style={{ display: 'block', margin: '0 auto' }}>
      <rect width={136} height={136} rx={10} fill={C.white} stroke={C.gray200} strokeWidth={1.5} />
      {finder(8, 8)}
      {finder(94, 8)}
      {finder(8, 94)}
      {data.map(([x, y]) => sq(x, y))}
    </svg>
  )
}

/* ── Método: selector ────────────────────────────────────────── */
const METODOS = [
  { id: 'yape',    label: 'Yape',    emoji: '💜', accent: '#7C3AED' },
  { id: 'plin',    label: 'Plin',    emoji: '💙', accent: '#2563EB' },
  { id: 'tarjeta', label: 'Tarjeta', emoji: '💳', accent: C.green700 },
]

function TabMetodos({ selected, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 20px' }}>
      {METODOS.map(m => {
        const active = selected === m.id
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            style={{
              flex: 1, padding: '10px 4px',
              borderRadius: 12, cursor: 'pointer',
              border: `2px solid ${active ? m.accent : C.gray200}`,
              background: active ? `${m.accent}12` : C.white,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 20 }}>{m.emoji}</span>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: active ? m.accent : C.gray500,
            }}>
              {m.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Vista QR (Yape / Plin) ──────────────────────────────────── */
function MetodoQR({ metodo, precio, loading, onConfirm }) {
  const m      = METODOS.find(x => x.id === metodo)
  const numero = metodo === 'yape' ? '999 888 777' : '987 654 321'
  const app    = metodo === 'yape' ? 'Yape' : 'Plin'

  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: `${m.accent}08`, border: `1.5px solid ${m.accent}30`,
        borderRadius: 16, padding: '20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: m.accent }}>
          {m.emoji} Escanea el código QR con {app}
        </div>
        <QRDemo accent={m.accent} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.gray500 }}>O envía directamente al número</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.gray900, letterSpacing: 1, marginTop: 4 }}>
            {numero}
          </div>
          <div style={{
            marginTop: 6, display: 'inline-block',
            background: `${m.accent}15`, color: m.accent,
            fontSize: 15, fontWeight: 900, padding: '4px 16px', borderRadius: 20,
          }}>
            S/. {precio}.00
          </div>
        </div>
      </div>

      <div style={{
        background: C.gray100, borderRadius: 12, padding: '10px 14px',
        fontSize: 12, color: C.gray500, lineHeight: 1.5,
      }}>
        ① Abre {app} en tu celular · ② Escanea el QR o ingresa el número ·
        ③ Confirma el monto de <strong style={{ color: C.gray700 }}>S/. {precio}.00</strong> ·
        ④ Pulsa el botón de abajo
      </div>

      <button
        onClick={onConfirm}
        disabled={loading}
        style={btnStyle(!loading)}
      >
        {loading ? 'Confirmando…' : `Ya realicé el pago · Confirmar cita`}
      </button>
    </div>
  )
}

/* ── Vista tarjeta ───────────────────────────────────────────── */
function MetodoTarjeta({ precio, loading, onConfirm }) {
  const [card, setCard]     = useState({ numero: '', titular: '', expiry: '', cvv: '' })
  const [errors, setErrors] = useState({})

  function handleChange(field, raw) {
    let v = raw
    if (field === 'numero')  v = fmtCardNum(raw)
    if (field === 'expiry')  v = fmtExpiry(raw)
    if (field === 'cvv')     v = raw.replace(/\D/g, '').slice(0, 4)
    setCard(p => ({ ...p, [field]: v }))
    if (errors[field]) setErrors(p => ({ ...p, [field]: null }))
  }

  function submit() {
    const errs = validateCard(card)
    if (Object.keys(errs).length) { setErrors(errs); return }
    onConfirm()
  }

  const brand = cardBrand(card.numero)
  const inp   = (hasErr) => ({
    width: '100%', padding: '12px 14px',
    border: `1.5px solid ${hasErr ? C.red : C.gray300}`,
    borderRadius: 12, fontSize: 14, color: C.gray900,
    background: hasErr ? C.red50 : C.white, outline: 'none',
    transition: 'border-color 0.15s',
    onFocus: e => { e.target.style.borderColor = C.green500; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)' },
    onBlur:  e => { e.target.style.borderColor = hasErr ? C.red : C.gray300; e.target.style.boxShadow = 'none' },
  })

  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Número */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>Número de tarjeta</label>
          {brand && <span style={{ fontSize: 11, fontWeight: 800, color: C.green700 }}>{brand}</span>}
        </div>
        <input
          value={card.numero}
          onChange={e => handleChange('numero', e.target.value)}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          style={{ ...inp(!!errors.numero), letterSpacing: 2, fontFamily: 'monospace' }}
          onFocus={inp(!!errors.numero).onFocus}
          onBlur={inp(!!errors.numero).onBlur}
        />
        {errors.numero && <span style={errStyle}>{errors.numero}</span>}
      </div>

      {/* Titular */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
          Nombre del titular
        </label>
        <input
          value={card.titular}
          onChange={e => handleChange('titular', e.target.value.toUpperCase())}
          placeholder="TAL COMO APARECE EN LA TARJETA"
          style={{ ...inp(!!errors.titular), letterSpacing: 0.5 }}
          onFocus={inp(!!errors.titular).onFocus}
          onBlur={inp(!!errors.titular).onBlur}
        />
        {errors.titular && <span style={errStyle}>{errors.titular}</span>}
      </div>

      {/* Vencimiento + CVV */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
            Vencimiento
          </label>
          <input
            value={card.expiry}
            onChange={e => handleChange('expiry', e.target.value)}
            placeholder="MM/AA"
            inputMode="numeric"
            style={inp(!!errors.expiry)}
            onFocus={inp(!!errors.expiry).onFocus}
            onBlur={inp(!!errors.expiry).onBlur}
          />
          {errors.expiry && <span style={errStyle}>{errors.expiry}</span>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
            CVV
          </label>
          <input
            value={card.cvv}
            onChange={e => handleChange('cvv', e.target.value)}
            placeholder="123"
            inputMode="numeric"
            type="password"
            style={inp(!!errors.cvv)}
            onFocus={inp(!!errors.cvv).onFocus}
            onBlur={inp(!!errors.cvv).onBlur}
          />
          {errors.cvv && <span style={errStyle}>{errors.cvv}</span>}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: C.green50, border: `1px solid ${C.green100}`,
        borderRadius: 10, padding: '10px 12px',
        fontSize: 11, color: C.green700, fontWeight: 600,
      }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        Pago seguro · Datos cifrados con TLS 1.3 · No almacenamos tu tarjeta
      </div>

      <button onClick={submit} disabled={loading} style={btnStyle(!loading)}>
        {loading ? 'Procesando pago…' : `Pagar S/. ${precio}.00`}
      </button>
    </div>
  )
}

/* ── Estilos compartidos ─────────────────────────────────────── */
const errStyle = {
  display: 'block', marginTop: 4,
  fontSize: 12, color: C.red, fontWeight: 600,
}

function btnStyle(active) {
  return {
    width: '100%', padding: '15px 0', border: 'none', borderRadius: 12,
    background: active
      ? `linear-gradient(135deg, ${C.green800}, ${C.green600})`
      : C.gray200,
    color: active ? C.white : C.gray400,
    fontSize: 15, fontWeight: 800,
    cursor: active ? 'pointer' : 'not-allowed',
    boxShadow: active ? '0 4px 14px rgba(5,150,105,0.35)' : 'none',
    transition: 'all 0.2s',
  }
}

/* ── Vista: cita confirmada ──────────────────────────────────── */
function VistaConfirmada({ appointment, doctor, onVerCitas, onInicio }) {
  const titulo    = doctor ? doctorTitle(doctor.cmp, doctor.nombres) : ''
  const { fecha, hora } = formatScheduledAt(appointment.scheduled_at)
  const codigo    = codigoCita(appointment.id)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Hero confirmación */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green600} 100%)`,
        padding: '40px 24px 36px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        <style>{`@keyframes popIn { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }`}</style>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          animation: 'popIn 0.5s cubic-bezier(.175,.885,.32,1.275) both',
        }}>
          ✅
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.white, textAlign: 'center' }}>
          ¡Cita confirmada!
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
          Tu médico te está esperando
        </div>

        {/* Código de cita */}
        <div style={{
          marginTop: 4,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 12, padding: '10px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
            CÓDIGO DE CITA
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: 2, fontFamily: 'monospace' }}>
            {codigo}
          </div>
        </div>
      </div>

      {/* Detalle de la cita */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{
          background: C.white, border: `1.5px solid ${C.gray200}`,
          borderRadius: 16, overflow: 'hidden',
        }}>

          {/* Médico */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px', borderBottom: `1px solid ${C.gray100}`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontWeight: 700, fontSize: 16,
            }}>
              {doctor ? doctor.nombres[0] + doctor.apellidos[0] : '?'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.gray900 }}>
                {titulo} {doctor?.nombres} {doctor?.apellidos}
              </div>
              <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                {doctor?.especialidad} · {doctor?.cmp}
              </div>
            </div>
          </div>

          {/* Datos */}
          {[
            ['📅 Fecha',      fecha],
            ['🕐 Hora',       `${hora} · hora Lima`],
            ['⏱ Duración',    '20 minutos'],
            ['📍 Modalidad',  'Videollamada (recibirás el enlace)'],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '12px 16px', borderBottom: `1px solid ${C.gray100}`,
              fontSize: 13,
            }}>
              <span style={{ color: C.gray500, flexShrink: 0 }}>{lbl}</span>
              <span style={{ color: C.gray900, fontWeight: 600, textAlign: 'right', maxWidth: '55%' }}>{val}</span>
            </div>
          ))}

          {/* Monto pagado */}
          <div style={{
            padding: '14px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: C.green50,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green800 }}>✅ Pago confirmado</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: C.green700 }}>
              S/. {doctor?.precio}.00
            </span>
          </div>
        </div>

        {/* Aviso receta */}
        <div style={{
          marginTop: 14,
          background: C.green50, border: `1px solid ${C.green100}`,
          borderRadius: 12, padding: '12px 14px',
          fontSize: 11, color: C.green700, fontWeight: 600, lineHeight: 1.6,
        }}>
          🛡️ Al terminar la consulta recibirás tu receta electrónica válida según Ley 30421.
          Guarda el código <strong>{codigo}</strong> para identificar tu cita.
        </div>
      </div>

      {/* Botones de acción */}
      <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onVerCitas}
          style={{
            width: '100%', padding: '14px 0',
            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            color: C.white, border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
          }}
        >
          📋 Ver mis citas
        </button>
        <button
          onClick={onInicio}
          style={{
            width: '100%', padding: '13px 0',
            background: C.white, color: C.green700,
            border: `1.5px solid ${C.green600}`, borderRadius: 12,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          🏠 Volver al inicio
        </button>
      </div>
    </div>
  )
}

/* ── Página principal ───────────────────────────────────────── */
export default function Payment() {
  const { appointmentId } = useParams()
  const navigate           = useNavigate()

  const [appointment,  setAppointment]  = useState(null)
  const [doctor,       setDoctor]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [metodo,       setMetodo]       = useState('yape')
  const [processing,   setProcessing]   = useState(false)
  const [confirmed,    setConfirmed]    = useState(false)

  /* cargar cita y médico */
  useEffect(() => {
    supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()
      .then(async ({ data: appt, error }) => {
        if (error || !appt) {
          toast.error('Cita no encontrada')
          navigate('/', { replace: true })
          return
        }
        setAppointment(appt)
        if (appt.status === 'paid') setConfirmed(true)

        const { data: doc } = await supabase
          .from('doctors')
          .select('*')
          .eq('id', appt.doctor_id)
          .single()
        setDoctor(doc)
        setLoading(false)
      })
  }, [appointmentId, navigate])

  /* confirmar pago: actualiza appointment → 'paid' */
  async function handlePay() {
    setProcessing(true)

    // En producción: llamar a una Edge Function de Supabase que procese
    // el cargo con Culqi y devuelva confirmación antes de este UPDATE.
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'paid' })
      .eq('id', appointmentId)

    setProcessing(false)

    if (error) {
      toast.error('Error al confirmar el pago. Inténtalo de nuevo.')
      return
    }
    setConfirmed(true)
  }

  /* ── Pantalla de carga ── */
  if (loading) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${C.green100}`, borderTopColor: C.green600,
          animation: 'spin 0.75s linear infinite',
        }} />
        <div style={{ fontSize: 13, color: C.gray500, fontWeight: 600 }}>Cargando cita…</div>
      </div>
    )
  }

  /* ── Pantalla de confirmación ── */
  if (confirmed && appointment && doctor) {
    return (
      <VistaConfirmada
        appointment={appointment}
        doctor={doctor}
        onVerCitas={() => navigate('/citas')}
        onInicio={() => navigate('/')}
      />
    )
  }

  /* ── Pantalla de pago ── */
  const { fecha, hora } = appointment ? formatScheduledAt(appointment.scheduled_at) : {}
  const titulo          = doctor ? doctorTitle(doctor.cmp, doctor.nombres) : ''

  return (
    <>
      {/* Cabecera */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green700} 100%)`,
        padding: '16px 20px 22px', flexShrink: 0,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 21, fontWeight: 900, color: C.white }}>Pago seguro</span>
          <span style={{ fontSize: 16 }}>🔒</span>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          Elige cómo deseas pagar tu consulta
        </div>
      </div>

      {/* Contenido scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Mini-resumen */}
        {doctor && appointment && (
          <div style={{
            margin: '16px 20px 0',
            background: C.green50, border: `1.5px solid ${C.green100}`,
            borderRadius: 14, padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gray900 }}>
                {titulo} {doctor.nombres} {doctor.apellidos}
              </div>
              <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                {fecha} · {hora}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.green700, flexShrink: 0 }}>
              S/. {doctor.precio}
            </div>
          </div>
        )}

        {/* Selector de método */}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, padding: '20px 20px 10px', margin: 0 }}>
          Método de pago
        </h2>
        <TabMetodos selected={metodo} onChange={m => { setMetodo(m) }} />

        {/* Separador */}
        <div style={{ height: 20 }} />

        {/* Formulario del método seleccionado */}
        {(metodo === 'yape' || metodo === 'plin') && (
          <MetodoQR
            metodo={metodo}
            precio={doctor?.precio ?? 0}
            loading={processing}
            onConfirm={handlePay}
          />
        )}
        {metodo === 'tarjeta' && (
          <MetodoTarjeta
            precio={doctor?.precio ?? 0}
            loading={processing}
            onConfirm={handlePay}
          />
        )}

        <div style={{ height: 28 }} />
      </div>
    </>
  )
}
