import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { C } from '../../lib/tokens'
import { precioTotalPaciente } from '../../lib/finanzas'
import { enviarWhatsapp } from '../../lib/whatsapp'

const IZIPAY_SCRIPT_URL = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js'
const IZIPAY_CSS_URL    = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/classic-reset.css'

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

function fmtICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function buildGoogleCalendarUrl(appointment, doctor, codigo) {
  const start   = new Date(appointment.scheduled_at)
  const end     = new Date(start.getTime() + 20 * 60 * 1000)
  const titulo  = doctorTitle(doctor.cmp, doctor.nombres)
  const docName = `${titulo} ${doctor.nombres} ${doctor.apellidos}`
  const params  = new URLSearchParams({
    action:   'TEMPLATE',
    text:     `Consulta médica VIDASALUD con ${docName}`,
    dates:    `${fmtICSDate(start)}/${fmtICSDate(end)}`,
    details:  `Código de cita: ${codigo}. Accede a tu consulta desde la app VIDASALUD.`,
    location: 'Videollamada VIDASALUD',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function downloadICS(appointment, doctor, codigo) {
  const start   = new Date(appointment.scheduled_at)
  const end     = new Date(start.getTime() + 20 * 60 * 1000)
  const titulo  = doctorTitle(doctor.cmp, doctor.nombres)
  const docName = `${titulo} ${doctor.nombres} ${doctor.apellidos}`
  const lines   = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VIDASALUD//Telemedicina Peru//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${codigo}@vidasalud.pe`,
    `DTSTART:${fmtICSDate(start)}`,
    `DTEND:${fmtICSDate(end)}`,
    `SUMMARY:Consulta médica VIDASALUD con ${docName}`,
    `DESCRIPTION:Código de cita: ${codigo}\\nAccede desde la app VIDASALUD.`,
    'LOCATION:Videollamada VIDASALUD',
    'STATUS:CONFIRMED',
    `CREATED:${fmtICSDate(new Date())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: `vidasalud-${codigo}.ics` })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ── Método: selector ────────────────────────────────────────────
   Los 3 son puramente visuales — las tres pestañas abren el mismo
   formulario embebido de Izipay (Krypton). Dentro de ese formulario,
   Izipay muestra su propio selector de tarjeta/Yape/Plin según lo que
   tengas habilitado en tu cuenta; no existe (verificado) un parámetro
   de la API de Krypton para forzar una sola pestaña desde acá. */
const METODOS = [
  { id: 'tarjeta', label: 'Tarjeta', emoji: '💳', accent: C.green700 },
  { id: 'yape',    label: 'Yape',    emoji: '📱', accent: '#7C3AED' },
  { id: 'plin',    label: 'Plin',    emoji: '🏦', accent: '#2563EB' },
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
            {m.id === 'yape' ? (
              <LogoYape width={60} />
            ) : m.id === 'plin' ? (
              <LogoPlin compact />
            ) : (
              <span style={{ fontSize: 20 }}>{m.emoji}</span>
            )}
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

/* ── Logos de marca ───────────────────────────────────────────
   Yape: imagen real de Wikimedia Commons (File:Yape peru logotype.svg,
   subida por la comunidad bajo CC-BY-SA 4.0 — no es el asset oficial de
   la marca, pero es una imagen real y verificable, a diferencia de las
   URLs de yape.com.pe que probamos antes y no existen).
   Plin: no existe ningún logo de Plin en Wikimedia Commons ni una URL
   oficial pública verificable, así que se mantiene como badge CSS con
   los colores de marca en vez de enlazar una imagen que podría no
   existir o romperse. */
const YAPE_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/76/Yape_peru_logotype.svg'

function LogoYape({ width = 120 }) {
  return (
    <img
      src={YAPE_LOGO_URL}
      alt="Yape"
      width={width}
      style={{ width, height: 'auto', display: 'block', margin: '0 auto' }}
    />
  )
}

function LogoPlin({ width = 160, compact = false }) {
  // "compact" es para la pestaña de selección (equivalente visual al
  // ancho de 60px del logo de Yape) — con texto, escalar por width lineal
  // lo haría ilegible, así que usa un tamaño fijo pensado para ese espacio.
  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #00B4D8, #0077B6)',
        borderRadius: 8, padding: '4px 10px', minWidth: 60, boxSizing: 'border-box',
      }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: C.white, letterSpacing: -0.2 }}>
          Plin
        </span>
      </div>
    )
  }
  const scale = width / 160
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'linear-gradient(135deg, #00B4D8, #0077B6)',
      borderRadius: 14 * scale, padding: `${10 * scale}px ${22 * scale}px`,
      boxShadow: '0 4px 14px rgba(0,119,182,0.35)',
    }}>
      <span style={{ fontSize: 20 * scale, fontWeight: 900, color: C.white, letterSpacing: -0.3 }}>
        Plin
      </span>
    </div>
  )
}

/* ── Vista Izipay (formulario embebido Krypton V4) ───────────────
   Krypton se monta como un formulario embebido directo en la página una
   vez que tenemos el formToken — por eso acá no hay un botón "Pagar", el
   propio widget de Izipay tiene su botón de pago con tarjeta/Yape/Plin
   nativos de Izipay (el método exacto a mostrar lo decide el panel de
   Izipay, no nuestro código — ver METODOS más arriba). */
/* Mensaje de estado del pago en curso — se actualiza vía KR.onSubmit
   ("procesando"), KR.onError ("error") y la suscripción realtime a
   appointments ("exito", cuando webhook-izipay confirma status='paid'). */
function EstadoPagoIzipay({ estado }) {
  const cfg = {
    procesando: { bg: '#FEF3C7', border: '#FDE68A', color: '#92400E', text: '⏳ Procesando tu pago, por favor espera...' },
    exito:      { bg: '#D1FAE5', border: '#A7F3D0', color: '#065F46', text: '✅ ¡Pago realizado con éxito! Redirigiendo...' },
    error:      { bg: '#FEE2E2', border: '#FECACA', color: '#991B1B', text: '❌ Pago rechazado. Intenta nuevamente.' },
  }[estado]
  if (!cfg) return null
  return (
    <div style={{
      background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 12,
      padding: '12px 16px', fontSize: 13, fontWeight: 700, color: cfg.color, textAlign: 'center',
    }}>
      {cfg.text}
    </div>
  )
}

function MetodoIzipay({ scriptReady, loadingForm, error, estadoPago, precio }) {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error ? (
        <div style={{
          background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12,
          padding: '14px 16px', fontSize: 13, color: '#991B1B', fontWeight: 600, textAlign: 'center',
        }}>
          {error}
        </div>
      ) : (!scriptReady || loadingForm) ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '28px 0', color: C.gray500, fontSize: 13, fontWeight: 600,
        }}>
          <style>{`@keyframes izp-spin { to { transform:rotate(360deg) } }`}</style>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `3px solid ${C.gray200}`, borderTopColor: '#0B4F9C',
            animation: 'izp-spin 0.75s linear infinite',
          }} />
          Cargando formulario de pago…
        </div>
      ) : (
        <>
          <EstadoPagoIzipay estado={estadoPago} />
          <div id="izipay-form-container">
            <div className="kr-embedded" />
          </div>
        </>
      )}

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: C.green50, border: `1px solid ${C.green100}`,
        borderRadius: 10, padding: '10px 12px',
        fontSize: 11, color: C.green700, fontWeight: 600,
      }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        Pago seguro procesado por Izipay · S/. {precio}.00
      </div>
    </div>
  )
}

/* ── Modal: pago confirmado ───────────────────────────────────
   Se muestra en cuanto la suscripción realtime detecta
   appointments.status='paid' (confirmado por webhook-izipay). */
function ModalPagoExitoso({ onIrSalaEspera }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(6,95,70,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, zIndex: 1000,
    }}>
      <div style={{
        background: C.white, borderRadius: 20, padding: '36px 28px 28px',
        maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{ fontSize: 64, lineHeight: 1 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.green800, marginTop: 14 }}>
          ¡Pago confirmado!
        </div>
        <div style={{ fontSize: 14, color: C.gray600, marginTop: 10, lineHeight: 1.6 }}>
          Tu consulta está reservada. El médico te atenderá en breve.
        </div>
        <button
          onClick={onIrSalaEspera}
          style={{
            width: '100%', marginTop: 24, padding: '14px 0',
            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            color: C.white, border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
          }}
        >
          Ir a sala de espera
        </button>
      </div>
    </div>
  )
}

/* ── Vista: cita confirmada ──────────────────────────────────── */
function VistaConfirmada({ appointment, doctor, onInicio, onMensaje, onCola }) {
  const titulo    = doctor ? doctorTitle(doctor.cmp, doctor.nombres) : ''
  const { fecha, hora } = formatScheduledAt(appointment.scheduled_at)
  const codigo    = codigoCita(appointment.id)
  const docName   = doctor ? `${doctor.nombres} ${doctor.apellidos}` : 'tu médico'
  // Si la cita ya trae un precio_total fijado (ej. atención inmediata a
  // S/. 35), respetarlo — es el monto real que procesar-pago-culqi cobró.
  // Si no, calcularlo igual que una consulta agendada normal.
  const precioPaciente = appointment.precio_total
    ? Number(appointment.precio_total)
    : doctor
      ? precioTotalPaciente({ especialidad: doctor.especialidad, precioMedico: doctor.precio })
      : 0

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <style>{`
        @keyframes vc-drawCircle { to { stroke-dashoffset: 0 } }
        @keyframes vc-drawCheck  { to { stroke-dashoffset: 0 } }
        @keyframes vc-pop   { 0%{transform:scale(0.4);opacity:0} 65%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes vc-slide { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes vc-glow  { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} 50%{box-shadow:0 0 0 12px rgba(16,185,129,0.18)} }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green600} 100%)`,
        padding: '36px 24px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        {/* Checkmark animado SVG */}
        <div style={{ animation: 'vc-pop 0.55s cubic-bezier(.175,.885,.32,1.275) both' }}>
          <svg width="88" height="88" viewBox="0 0 88 88" style={{ display: 'block', filter: 'drop-shadow(0 4px 20px rgba(16,185,129,0.5))' }}>
            <circle
              cx="44" cy="44" r="39"
              fill="rgba(255,255,255,0.15)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="4"
              strokeDasharray="245"
              strokeDashoffset="245"
              style={{ animation: 'vc-drawCircle 0.5s ease-out 0.1s forwards' }}
            />
            <polyline
              points="23,46 37,61 65,29"
              fill="none"
              stroke="#ffffff"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="72"
              strokeDashoffset="72"
              style={{ animation: 'vc-drawCheck 0.38s ease-out 0.52s forwards' }}
            />
          </svg>
        </div>

        <div style={{
          fontSize: 24, fontWeight: 900, color: C.white,
          textAlign: 'center', letterSpacing: -0.3,
          animation: 'vc-slide 0.4s 0.3s ease both',
        }}>
          ¡Cita confirmada!
        </div>

        <div style={{
          fontSize: 13, color: 'rgba(255,255,255,0.78)',
          textAlign: 'center', lineHeight: 1.5,
          animation: 'vc-slide 0.4s 0.4s ease both',
        }}>
          Tu salud es lo primero.<br />
          {titulo} {docName} estará listo para atenderte.
        </div>

        {/* Código grande */}
        <div style={{
          marginTop: 6,
          background: 'rgba(255,255,255,0.14)',
          border: '1.5px solid rgba(255,255,255,0.25)',
          borderRadius: 14, padding: '12px 28px',
          textAlign: 'center',
          animation: 'vc-slide 0.4s 0.5s ease both',
        }}>
          <div style={{
            fontSize: 10, color: 'rgba(255,255,255,0.55)',
            fontWeight: 800, letterSpacing: 3, marginBottom: 6,
            textTransform: 'uppercase',
          }}>
            Código de cita
          </div>
          <div style={{
            fontSize: 24, fontWeight: 900, color: C.white,
            letterSpacing: 4, fontFamily: 'monospace',
            animation: 'vc-glow 3s 1s ease infinite',
          }}>
            {codigo}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Doctor ── */}
        <div style={{
          background: C.white, border: `1.5px solid ${C.gray200}`,
          borderRadius: 16, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          animation: 'vc-slide 0.4s 0.55s ease both',
        }}>
          {doctor?.foto_url ? (
            <img src={doctor.foto_url} alt={docName}
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontWeight: 800, fontSize: 18,
            }}>
              {(doctor?.nombres?.[0] ?? '?') + (doctor?.apellidos?.[0] ?? '')}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.gray900 }}>
              {titulo} {doctor?.nombres} {doctor?.apellidos}
            </div>
            <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
              {doctor?.especialidad}
            </div>
            {doctor?.cmp && (
              <span style={{
                display: 'inline-block', marginTop: 4,
                fontSize: 10, fontWeight: 700, color: C.green700,
                background: C.green50, border: `1px solid ${C.green200}`,
                padding: '2px 8px', borderRadius: 8,
              }}>
                {doctor.cmp}
              </span>
            )}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green700,
            background: C.green50, border: `1px solid ${C.green200}`,
            padding: '4px 10px', borderRadius: 20, flexShrink: 0,
          }}>
            Confirmada
          </span>
        </div>

        {/* ── Detalles de la cita ── */}
        <div style={{
          background: C.white, border: `1.5px solid ${C.gray200}`,
          borderRadius: 16, overflow: 'hidden',
          animation: 'vc-slide 0.4s 0.6s ease both',
        }}>
          {[
            ['📅 Fecha',     fecha],
            ['🕐 Hora',      `${hora} (hora Lima)`],
            ['⏱️ Duración',  '20 minutos'],
            ['📍 Modalidad', 'Videollamada'],
          ].map(([lbl, val], i, arr) => (
            <div key={lbl} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.gray100}` : 'none',
              fontSize: 13,
            }}>
              <span style={{ color: C.gray500 }}>{lbl}</span>
              <span style={{ color: C.gray900, fontWeight: 700, textAlign: 'right', maxWidth: '58%' }}>{val}</span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 16px',
            background: C.green50, borderTop: `1px solid ${C.green100}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green800 }}>✅ Total pagado</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.green700 }}>
              S/. {precioPaciente}.00
            </span>
          </div>
        </div>

        {/* ── Agregar al calendario ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <a
            href={buildGoogleCalendarUrl(appointment, doctor, codigo)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 8px', borderRadius: 12, textDecoration: 'none',
              background: '#EFF6FF', border: '1.5px solid #BFDBFE',
              color: '#1D4ED8', fontSize: 12, fontWeight: 800,
            }}
          >
            📅 Google Calendar
          </a>
          <button
            onClick={() => downloadICS(appointment, doctor, codigo)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 8px', borderRadius: 12,
              background: '#F5F3FF', border: '1.5px solid #DDD6FE',
              color: '#6D28D9', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            💾 Descargar .ics
          </button>
        </div>

        {/* ── Aviso receta ── */}
        <div style={{
          background: C.green50, border: `1px solid ${C.green100}`,
          borderRadius: 12, padding: '11px 14px',
          fontSize: 11, color: C.green700, fontWeight: 600, lineHeight: 1.6,
        }}>
          🛡️ Recibirás tu receta electrónica al finalizar la consulta (Ley 30421).
          Guarda el código <strong>{codigo}</strong> para identificar tu cita.
        </div>

        {/* ── Botones de acción ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingBottom: 20 }}>
          <button
            onClick={onCola}
            style={{
              width: '100%', padding: '14px 0',
              background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
              color: C.white, border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(5,150,105,0.35)', fontFamily: 'inherit',
            }}
          >
            🪑 Ver mi lugar en la cola
          </button>
          <button
            onClick={onMensaje}
            style={{
              width: '100%', padding: '13px 0',
              background: C.white, color: C.green700,
              border: `1.5px solid ${C.green200}`, borderRadius: 12,
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            💬 Mensaje al médico
          </button>
          <button
            onClick={onInicio}
            style={{
              width: '100%', padding: '13px 0',
              background: 'none', color: C.gray500,
              border: 'none', borderRadius: 12,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🏠 Ir al inicio
          </button>
        </div>

      </div>
    </div>
  )
}

/* ── Página principal ───────────────────────────────────────── */
export default function Payment() {
  const { appointmentId } = useParams()
  const navigate           = useNavigate()
  const { user }           = useAuthStore()

  const [appointment,  setAppointment]  = useState(null)
  const [doctor,       setDoctor]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [metodo,       setMetodo]       = useState('yape')
  const [confirmed,    setConfirmed]    = useState(false)
  const [esDesdeTurno, setEsDesdeTurno] = useState(false)

  const [izipayScriptReady, setIzipayScriptReady] = useState(false)
  const [izipayFormToken,   setIzipayFormToken]   = useState(null)
  const [izipayLoadingForm, setIzipayLoadingForm] = useState(false)
  const [izipayError,       setIzipayError]       = useState(null)
  const [izipayEstado,      setIzipayEstado]      = useState('idle')   // idle | procesando | exito | error
  const [mostrarModalExito, setMostrarModalExito] = useState(false)
  const izipayMountedTokenRef = useRef(null)   // evita re-montar el mismo formToken dos veces
  const pagoConfirmadoRef     = useRef(false)  // evita duplicar el WhatsApp si dos caminos confirman el mismo pago

  /* cargar cita, médico y verificar si viene de turno de guardia */
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
        if (appt.status === 'paid') { setConfirmed(true); pagoConfirmadoRef.current = true }

        const [docRes, turnoRes] = await Promise.all([
          supabase.from('doctors').select('*').eq('id', appt.doctor_id).single(),
          supabase
            .from('solicitudes_turno')
            .select('id')
            .eq('appointment_id', appointmentId)
            .maybeSingle(),
        ])

        setDoctor(docRes.data ?? null)
        if (turnoRes.data) setEsDesdeTurno(true)
        setLoading(false)
      })
  }, [appointmentId, navigate])

  /* Cargar el script de Krypton (Izipay) — único procesador de pagos de
     esta pantalla, se carga siempre al entrar. */
  useEffect(() => {
    const publicKey = import.meta.env.VITE_IZIPAY_PUBLIC_KEY

    if (!publicKey) {
      console.error('[Payment][Izipay] VITE_IZIPAY_PUBLIC_KEY no está definida')
      setIzipayError('Izipay no está disponible por el momento.')
      return
    }
    if (window.KR) {
      setIzipayScriptReady(true)
      return
    }
    if (!document.querySelector(`link[href="${IZIPAY_CSS_URL}"]`)) {
      const link = document.createElement('link')
      link.rel  = 'stylesheet'
      link.href = IZIPAY_CSS_URL
      document.head.appendChild(link)
    }
    const existing = document.querySelector(`script[src="${IZIPAY_SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => setIzipayScriptReady(true))
      return
    }
    console.log('[Payment][Izipay] inyectando <script> de Krypton…')
    const script = document.createElement('script')
    script.src   = IZIPAY_SCRIPT_URL
    script.async = true
    script.setAttribute('kr-public-key', publicKey)
    script.onload = () => {
      console.log('[Payment][Izipay] script de Krypton cargado — window.KR:', !!window.KR)
      setIzipayScriptReady(true)
    }
    script.onerror = (e) => {
      console.error('[Payment][Izipay] no se pudo cargar el script de Krypton:', e)
      setIzipayError('No se pudo cargar el formulario de pago de Izipay.')
    }
    document.body.appendChild(script)
  }, [])

  /* Pedir el formToken a crear-formulario-izipay y montar el formulario
     embebido de Krypton — una sola vez por cita mientras no esté pagada. */
  useEffect(() => {
    if (!izipayScriptReady || !appointment || confirmed) return
    if (izipayFormToken) return   // ya se pidió el token para esta cita

    let cancelled = false
    async function crearFormulario() {
      setIzipayLoadingForm(true)
      setIzipayError(null)
      const { data, error } = await supabase.functions.invoke('crear-formulario-izipay', {
        body: { appointmentId, email: user?.email },
      })
      if (cancelled) return
      if (error || !data?.ok) {
        console.error('[Payment][Izipay] crear-formulario-izipay falló:', error, data)
        setIzipayError(data?.error ?? error?.message ?? 'No se pudo iniciar el pago con Izipay')
        setIzipayLoadingForm(false)
        return
      }
      setIzipayFormToken(data.formToken)
      setIzipayLoadingForm(false)
    }
    crearFormulario()
    return () => { cancelled = true }
  }, [izipayScriptReady, appointment, confirmed, izipayFormToken, appointmentId, user])

  /* Montar/actualizar el formulario de Krypton en el DOM una vez que
     tenemos script + formToken. KR.onSubmit se registra una sola vez;
     devuelve false para que Krypton no intente redirigir por su cuenta —
     la confirmación real llega por el webhook (ver suscripción realtime
     más abajo), no desde este callback del navegador. */
  useEffect(() => {
    if (!izipayScriptReady || !izipayFormToken || !window.KR) return
    if (izipayMountedTokenRef.current === izipayFormToken) return

    let cancelled = false
    window.KR.onSubmit((paymentData) => {
      console.log('[Payment][Izipay] KR.onSubmit —', paymentData?.clientAnswer?.orderStatus)
      setIzipayEstado('procesando')
      return false
    })

    window.KR.onError((event) => {
      console.error('[Payment][Izipay] KR.onError —', event?.errorCode, event?.errorMessage)
      setIzipayEstado('error')
    })

    window.KR.setFormConfig({ formToken: izipayFormToken, 'kr-language': 'es-ES' })
    window.KR.attachForm('#izipay-form-container')
      .then(({ KR, result }) => {
        if (cancelled) return
        izipayMountedTokenRef.current = izipayFormToken
        return KR.showForm(result.formId)
      })
      .catch((err) => {
        console.error('[Payment][Izipay] error montando el formulario:', err)
        if (!cancelled) setIzipayError('No se pudo mostrar el formulario de pago de Izipay.')
      })

    return () => { cancelled = true }
  }, [izipayScriptReady, izipayFormToken])

  /* Se ejecuta cuando la cita queda marcada como pagada — actualiza la UI
     y dispara el WhatsApp de confirmación. Único disparador hoy: la
     suscripción realtime de más abajo, cuando webhook-izipay marca
     status='paid'. El guard evita confirmar (y mandar el WhatsApp) dos
     veces si llegara a dispararse más de una vez para el mismo pago. */
  const finalizarPagoExitoso = useCallback(async () => {
    if (pagoConfirmadoRef.current) return
    pagoConfirmadoRef.current = true

    setAppointment(prev => (prev ? { ...prev, status: 'paid' } : prev))
    setConfirmed(true)

    if (appointment && doctor) {
      const { data: pat } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', appointment.patient_id)
        .maybeSingle()
      const { fecha, hora } = formatScheduledAt(appointment.scheduled_at)
      enviarWhatsapp({
        to: pat?.phone,
        template_name: 'confirmacion_cita',
        parameters: [`${doctor.nombres} ${doctor.apellidos}`.trim(), `${fecha} ${hora}`],
      })
    }
  }, [appointment, doctor])

  /* Suscripción realtime: webhook-izipay confirma el pago server-to-server
     y actualiza appointments.status — acá es donde el frontend se entera,
     ya que Krypton no nos devuelve una confirmación final propia en el
     navegador (ver KR.onSubmit más arriba). */
  useEffect(() => {
    if (!appointmentId || confirmed) return
    const channel = supabase
      .channel(`payment-${appointmentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${appointmentId}` },
        (payload) => {
          if (payload.new?.status === 'paid') {
            console.log('[Payment] appointments.status pasó a paid vía realtime (webhook)')
            setIzipayEstado('exito')
            setMostrarModalExito(true)
            finalizarPagoExitoso()
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [appointmentId, confirmed, finalizarPagoExitoso])

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
      <>
        <VistaConfirmada
          appointment={appointment}
          doctor={doctor}
          onInicio={() => navigate('/inicio')}
          onMensaje={() => navigate(`/chat/${appointmentId}`)}
          onCola={() => navigate(`/sala-espera/${appointmentId}`)}
        />
        {mostrarModalExito && (
          <ModalPagoExitoso
            onIrSalaEspera={() => {
              setMostrarModalExito(false)
              navigate(`/sala-espera/${appointmentId}`)
            }}
          />
        )}
      </>
    )
  }

  /* ── Pantalla de pago ── */
  const { fecha, hora } = appointment ? formatScheduledAt(appointment.scheduled_at) : {}
  const titulo          = doctor ? doctorTitle(doctor.cmp, doctor.nombres) : ''
  // Igual que en VistaConfirmada: respetar precio_total si ya viene fijado
  // en la cita (ej. atención inmediata a S/. 35) en vez de recalcularlo.
  const precioPaciente  = appointment?.precio_total
    ? Number(appointment.precio_total)
    : doctor
      ? precioTotalPaciente({ especialidad: doctor.especialidad, precioMedico: doctor.precio })
      : 0

  // El formulario de Krypton está listo para recibir KR.submit() recién
  // cuando ya cargamos el formToken y no hay error — antes de eso el botón
  // queda deshabilitado en vez de oculto, para que el paciente siempre vea
  // el precio aunque el formulario todavía esté cargando.
  const formIzipayListo = izipayScriptReady && !izipayLoadingForm && !izipayError && !!izipayFormToken

  function handlePagarIzipayClick() {
    if (!window.KR?.submit) {
      console.error('[Payment][Izipay] KR.submit no disponible — formulario no está listo')
      toast.error('El formulario de pago aún está cargando. Intenta de nuevo en unos segundos.')
      return
    }
    console.log('[Payment][Izipay] KR.submit() disparado desde el botón flotante')
    window.KR.submit().catch((err) => {
      console.error('[Payment][Izipay] KR.submit() falló:', err)
    })
  }

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

      {/* Banner: médico disponible ahora (turno de guardia) */}
      {esDesdeTurno && !confirmed && doctor && (
        <div style={{
          background: 'linear-gradient(135deg, #065F46, #059669)',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          {doctor.foto_url ? (
            <img
              src={doctor.foto_url}
              alt={doctor.nombres}
              style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FFFFFF', fontWeight: 800, fontSize: 15,
            }}>
              {(doctor.nombres?.[0] ?? '?').toUpperCase()}{(doctor.apellidos?.[0] ?? '').toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3 }}>
              🩺 {doctorTitle(doctor.cmp, doctor.nombres)} {doctor.nombres} {doctor.apellidos} está listo para atenderte
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
              Realiza tu pago para iniciar la consulta
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 800, color: '#065F46',
            background: '#34D399', padding: '4px 10px', borderRadius: 20,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#065F46',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            Médico disponible ahora
          </span>
        </div>
      )}

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
              S/. {precioPaciente}
            </div>
          </div>
        )}

        {/* Selector de método */}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, padding: '20px 20px 10px', margin: 0 }}>
          Método de pago
        </h2>
        <TabMetodos selected={metodo} onChange={m => { setMetodo(m) }} />

        {/* Las 3 pestañas de arriba son solo visuales — todas abren el mismo
            formulario embebido de Izipay. Verificado: Krypton no ofrece un
            parámetro para preseleccionar tarjeta/Yape/Plin desde acá, así
            que el paciente elige dentro del propio formulario. */}
        <div style={{
          padding: '10px 20px 0', textAlign: 'center',
          fontSize: 12, color: C.gray500, fontWeight: 600,
        }}>
          Selecciona tu método preferido en el formulario de abajo
        </div>

        {/* Separador */}
        <div style={{ height: 16 }} />

        <MetodoIzipay
          scriptReady={izipayScriptReady}
          loadingForm={izipayLoadingForm}
          error={izipayError}
          estadoPago={izipayEstado}
          precio={precioPaciente}
        />

        <div style={{ height: 100 }} />
      </div>

      {/* Botón flotante — más visible que el botón "Pagar" nativo del
          formulario de Krypton; dispara el mismo submit programáticamente. */}
      <button
        onClick={handlePagarIzipayClick}
        disabled={!formIzipayListo}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#065F46', borderTop: '3px solid #34D399',
          borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
          color: C.white, padding: '18px 20px',
          fontSize: 18, fontWeight: 900, textAlign: 'center',
          cursor: formIzipayListo ? 'pointer' : 'not-allowed',
          opacity: formIzipayListo ? 1 : 0.6,
          fontFamily: 'inherit', zIndex: 500,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
        }}
      >
        💳 PAGAR S/. {precioPaciente}.00
      </button>

      {mostrarModalExito && (
        <ModalPagoExitoso
          onIrSalaEspera={() => {
            setMostrarModalExito(false)
            navigate(`/sala-espera/${appointmentId}`)
          }}
        />
      )}
    </>
  )
}
