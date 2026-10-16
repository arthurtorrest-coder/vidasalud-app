import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

const TIPO_CFG = {
  reembolso:      { icon: '↩️', label: 'Reembolso' },
  reprogramacion: { icon: '📅', label: 'Reprogramación' },
  reclamo:        { icon: '📢', label: 'Reclamo' },
}

const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  bg: C.amberBg, color: C.amberText, border: '#FDE68A' },
  en_proceso: { label: 'En proceso', bg: C.blueBg,  color: C.blueText,  border: '#BFDBFE' },
  resuelto:   { label: 'Resuelto',   bg: C.green50, color: C.green700,  border: C.green200 },
  rechazado:  { label: 'Rechazado',  bg: C.redBg,   color: C.red600,    border: '#FECACA' },
}

const TABS = [
  { key: 'pendiente',  label: 'Pendientes'  },
  { key: 'en_proceso', label: 'En proceso'  },
  { key: 'resuelto',   label: 'Resueltas'   },
  { key: 'rechazado',  label: 'Rechazadas'  },
  { key: 'todas',      label: 'Todas'       },
]

function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function EstadoBadge({ estado }) {
  const e = ESTADO_CFG[estado] ?? ESTADO_CFG.pendiente
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>
      {e.label}
    </span>
  )
}

function SolicitudRow({ s, onUpdate }) {
  const [respondiendo, setRespondiendo] = useState(false)
  const [respuesta,    setRespuesta]    = useState(s.respuesta_admin ?? '')
  const [saving,        setSaving]       = useState(false)

  const tipo       = TIPO_CFG[s.tipo] ?? TIPO_CFG.reclamo
  const estadoCfg  = ESTADO_CFG[s.estado] ?? ESTADO_CFG.pendiente
  const nombrePaciente = s.patient?.full_name || '—'
  const nombreMedico   = s.appointment?.doctor
    ? [s.appointment.doctor.nombres, s.appointment.doctor.apellidos].filter(Boolean).join(' ')
    : null
  const monto = s.appointment?.precio_total

  async function actualizarEstado(nuevoEstado, { requiereRespuesta } = {}) {
    if (requiereRespuesta && !respuesta.trim()) {
      toast.error('Escribe una respuesta antes de continuar')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('solicitudes_soporte')
      .update({
        estado: nuevoEstado,
        ...(requiereRespuesta ? { respuesta_admin: respuesta.trim() } : {}),
      })
      .eq('id', s.id)
      .select('id')
    setSaving(false)
    if (error || !data?.length) {
      toast.error('No se pudo actualizar: ' + (error?.message ?? 'sin permisos'))
      return
    }
    toast.success('Solicitud actualizada')
    setRespondiendo(false)
    onUpdate(s.id, { estado: nuevoEstado, respuesta_admin: requiereRespuesta ? respuesta.trim() : s.respuesta_admin })
  }

  return (
    <div style={{
      border: `1.5px solid ${estadoCfg.border}`, background: estadoCfg.bg + '40',
      borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{tipo.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.3 }}>{tipo.label}</span>
            <EstadoBadge estado={s.estado} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.gray900, marginTop: 3 }}>{s.motivo}</div>
          {s.descripcion && (
            <div style={{ fontSize: 13, color: C.gray700, marginTop: 4, lineHeight: 1.5 }}>{s.descripcion}</div>
          )}
          <div style={{ fontSize: 11, color: C.gray500, marginTop: 6 }}>
            👤 {nombrePaciente}{nombreMedico ? ` · 🩺 ${nombreMedico}` : ''}{monto ? ` · 💰 ${fmtSoles(monto)}` : ''} · {fmtFecha(s.created_at)}
          </div>
          {s.respuesta_admin && !respondiendo && (
            <div style={{
              marginTop: 8, background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 10,
              padding: '8px 12px', fontSize: 12, color: C.gray700,
            }}>
              <strong style={{ color: C.gray900 }}>Respuesta:</strong> {s.respuesta_admin}
            </div>
          )}
        </div>
      </div>

      {respondiendo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={respuesta}
            onChange={e => setRespuesta(e.target.value)}
            placeholder="Escribe la respuesta para el paciente…"
            rows={3}
            style={{
              padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
              fontSize: 13, color: C.gray900, fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => actualizarEstado('resuelto', { requiereRespuesta: true })}
              disabled={saving}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`, color: C.white, fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >✓ Resolver</button>
            <button
              onClick={() => actualizarEstado('rechazado', { requiereRespuesta: true })}
              disabled={saving}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${C.red600}`, background: C.white, color: C.red600, fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >✗ Rechazar</button>
            <button
              onClick={() => setRespondiendo(false)}
              disabled={saving}
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.gray300}`, background: C.white, color: C.gray700, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {s.estado === 'pendiente' && (
            <button
              onClick={() => actualizarEstado('en_proceso')}
              disabled={saving}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.blueText}`, background: C.white, color: C.blueText, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >🔄 Marcar en proceso</button>
          )}
          {['pendiente', 'en_proceso'].includes(s.estado) && (
            <button
              onClick={() => setRespondiendo(true)}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`, color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >💬 Responder y resolver/rechazar</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminSoporte() {
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tab,          setTab]         = useState('pendiente')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('solicitudes_soporte')
      .select('*, patient:profiles!patient_id(full_name), appointment:appointments(precio_total, scheduled_at, doctor:doctors(nombres, apellidos))')
      .order('created_at', { ascending: false })
    if (error) { console.error('[AdminSoporte] fetch:', error.message); toast.error('No se pudieron cargar las solicitudes') }
    setSolicitudes(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Realtime: cualquier solicitud nueva o cambio de estado se refleja sin recargar
  useEffect(() => {
    const channel = supabase
      .channel('admin-soporte')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_soporte' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  function handleUpdateLocal(id, patch) {
    setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const counts = useMemo(() => ({
    pendiente:  solicitudes.filter(s => s.estado === 'pendiente').length,
    en_proceso: solicitudes.filter(s => s.estado === 'en_proceso').length,
    resuelto:   solicitudes.filter(s => s.estado === 'resuelto').length,
    rechazado:  solicitudes.filter(s => s.estado === 'rechazado').length,
    todas:      solicitudes.length,
  }), [solicitudes])

  const shown = tab === 'todas' ? solicitudes : solicitudes.filter(s => s.estado === tab)

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }} />

      <header style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin/panel')} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: C.white, borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>← Panel</button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>SOPORTE</span>
        </div>
        <button onClick={fetchAll} disabled={loading} style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: C.white, borderRadius: 8, padding: '6px 14px',
          fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
        }}>↻ Actualizar</button>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 48px' }}>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                  border: `1.5px solid ${active ? C.green700 : C.gray200}`,
                  background: active ? C.green700 : C.white,
                  color: active ? C.white : C.gray700,
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                  background: active ? 'rgba(255,255,255,0.25)' : C.gray100,
                  color: active ? C.white : C.gray500,
                }}>
                  {counts[t.key]}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? [1,2,3].map(i => (
            <div key={i} style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 14, width: '40%', background: C.gray200, borderRadius: 6 }} />
              <div style={{ height: 14, width: '70%', background: C.gray200, borderRadius: 6 }} />
              <div style={{ height: 30, width: '100%', background: C.gray100, borderRadius: 8 }} />
            </div>
          )) : shown.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: C.gray400, fontSize: 14, background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}` }}>
              🎧 Sin solicitudes en esta categoría
            </div>
          ) : shown.map(s => (
            <SolicitudRow key={s.id} s={s} onUpdate={handleUpdateLocal} />
          ))}
        </div>

      </main>
    </div>
  )
}
