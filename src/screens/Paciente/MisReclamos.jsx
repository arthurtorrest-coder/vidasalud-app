import { useState, useEffect, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import SolicitudSoporteModal from '../../components/SolicitudSoporteModal'

const C = {
  green800: '#065F46', green700: '#047857', green600: '#059669',
  green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  amber: '#F59E0B', amberBg: '#FFFBEB', amberText: '#B45309',
  blue700: '#1D4ED8', blue50: '#EFF6FF',
  red600: '#DC2626', red50: '#FEF2F2',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280',
  gray300: '#D1D5DB', gray200: '#E5E7EB', gray100: '#F3F4F6', white: '#FFFFFF',
}

const TIPO_CFG = {
  reembolso:      { icon: '↩️', label: 'Reembolso' },
  reprogramacion: { icon: '📅', label: 'Reprogramación' },
  reclamo:        { icon: '📢', label: 'Reclamo' },
}

const ESTADO_CFG = {
  pendiente:   { label: 'Pendiente',  bg: C.amberBg, color: C.amberText },
  en_proceso:  { label: 'En proceso', bg: C.blue50,  color: C.blue700   },
  resuelto:    { label: 'Resuelto',   bg: C.green50, color: C.green700  },
  rechazado:   { label: 'Rechazado',  bg: C.red50,   color: C.red600    },
}

function fmtFecha(iso) {
  const s = new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function EstadoBadge({ estado }) {
  const e = ESTADO_CFG[estado] ?? ESTADO_CFG.pendiente
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: e.bg, color: e.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
      {e.label}
    </span>
  )
}

function SolicitudCard({ s }) {
  const tipo = TIPO_CFG[s.tipo] ?? TIPO_CFG.reclamo
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{tipo.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.3 }}>{tipo.label}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.gray900, marginTop: 2 }}>{s.motivo}</div>
        </div>
        <EstadoBadge estado={s.estado} />
      </div>

      {s.descripcion && (
        <div style={{ fontSize: 13, color: C.gray700, lineHeight: 1.6, background: C.gray100, borderRadius: 10, padding: '10px 12px' }}>
          {s.descripcion}
        </div>
      )}

      {s.respuesta_admin && (
        <div style={{
          background: C.green50, border: `1px solid ${C.green100}`, borderRadius: 10,
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green700 }}>Respuesta de VIDASALUD</div>
          <div style={{ fontSize: 13, color: C.gray900, lineHeight: 1.6 }}>{s.respuesta_admin}</div>
        </div>
      )}

      <div style={{ fontSize: 11, color: C.gray500 }}>{fmtFecha(s.created_at)}</div>
    </div>
  )
}

function CardSkeleton() {
  const bar = (w, h) => <div style={{ height: h, width: w, background: C.gray100, borderRadius: 6 }} />
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {bar('40%', 11)}
      {bar('70%', 15)}
      {bar('100%', 36)}
    </div>
  )
}

export default function MisReclamos() {
  const { user } = useAuthStore()
  const [solicitudes, setSolicitudes] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showNuevo,   setShowNuevo]   = useState(false)

  const fetchSolicitudes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('solicitudes_soporte')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error('Error al cargar tus solicitudes')
    else setSolicitudes(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchSolicitudes() }, [fetchSolicitudes])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Toaster position="top-center" />

      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.gray900, margin: 0 }}>Mis reclamos</h1>
        <p style={{ fontSize: 13, color: C.gray500, margin: '4px 0 0' }}>
          {loading ? 'Cargando…' : solicitudes.length === 0 ? 'Sin solicitudes registradas' : `${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''} en total`}
        </p>
      </div>

      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <button
          onClick={() => setShowNuevo(true)}
          style={{
            width: '100%', padding: '13px 0',
            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            border: 'none', color: C.white, borderRadius: 12,
            fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          📢 Crear un reclamo general
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <><CardSkeleton /><CardSkeleton /></>}

        {!loading && solicitudes.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 24px', gap: 10 }}>
            <span style={{ fontSize: 48 }}>🎧</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.gray700 }}>Sin reclamos ni solicitudes</div>
            <div style={{ fontSize: 12, color: C.gray500 }}>
              Si tienes un problema con una cita o quieres hacer un reclamo, créalo desde el botón de arriba.
            </div>
          </div>
        )}

        {!loading && solicitudes.map(s => <SolicitudCard key={s.id} s={s} />)}
      </div>

      {showNuevo && (
        <SolicitudSoporteModal
          tipo="reclamo"
          onClose={() => setShowNuevo(false)}
          onCreated={fetchSolicitudes}
        />
      )}
    </div>
  )
}
