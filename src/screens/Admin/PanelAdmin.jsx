import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Toaster, toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { C } from '../../lib/tokens'

const STATUS_CFG = {
  pending:   { label: 'Pend. pago',  bg: C.amberBg,  color: C.amberText },
  paid:      { label: 'Confirmada',  bg: C.green50,   color: C.green700  },
  active:    { label: 'En consulta', bg: C.blueBg,    color: C.blueText  },
  done:      { label: 'Completada',  bg: C.gray100,   color: C.gray500   },
  cancelled: { label: 'Cancelada',   bg: C.redBg,     color: C.red600    },
}

function getLimaRange() {
  const now  = new Date()
  const lima = new Date(now.getTime() - 5 * 3600 * 1000)
  const y = lima.getUTCFullYear(), mo = lima.getUTCMonth(), d = lima.getUTCDate()
  return {
    start: new Date(Date.UTC(y, mo, d,     5, 0, 0)).toISOString(),
    end:   new Date(Date.UTC(y, mo, d + 1, 4, 59, 59)).toISOString(),
  }
}

function getMonthRange() {
  const now  = new Date()
  const lima = new Date(now.getTime() - 5 * 3600 * 1000)
  const y = lima.getUTCFullYear(), mo = lima.getUTCMonth()
  return {
    last30Start: new Date(Date.UTC(y, mo, lima.getUTCDate() - 29, 5, 0, 0)).toISOString(),
  }
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
  })
}

function fmtLastRefresh(d) {
  if (!d) return ''
  return d.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Sub-componentes ──────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent = C.green700 }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: accent, background: C.green50, padding: '3px 8px', borderRadius: 20 }}>HOY</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: C.gray900, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray400, marginTop: -4 }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.done
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function NavCard({ icon, label, sub, accent = C.green700, bg = C.green50, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? bg : C.white,
        border: `1.5px solid ${hov ? accent : C.gray200}`,
        borderRadius: 16, padding: '22px 20px', cursor: 'pointer',
        boxShadow: hov ? `0 4px 16px rgba(0,0,0,0.08)` : '0 1px 4px rgba(0,0,0,0.06)',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <span style={{ fontSize: 32 }}>{icon}</span>
      <div style={{ fontSize: 15, fontWeight: 800, color: hov ? accent : C.gray900 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: C.gray500 }}>{sub}</div>}
    </div>
  )
}

function IncomeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.green200}`, padding: '8px 14px', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.green800, marginBottom: 2 }}>{payload[0]?.payload?.fullDate ?? ''}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>{fmtSoles(payload[0].value)}</div>
    </div>
  )
}

// ─── Panel principal ──────────────────────────────────────────

export default function PanelAdmin() {
  const { profile }  = useAuthStore()
  const navigate     = useNavigate()
  const adminName    = profile?.full_name ?? 'Administrador'

  const [todayAppts,     setTodayAppts]     = useState([])
  const [income,         setIncome]         = useState(null)
  const [pendingDoctors, setPendingDoctors] = useState([])
  const [pendingBoticas, setPendingBoticas] = useState([])
  const [thirtyDayAppts, setThirtyDayAppts] = useState([])
  const [sessionLogs,    setSessionLogs]    = useState([])
  const [loading,        setLoading]        = useState(true)
  const [lastRefresh,    setLastRefresh]    = useState(null)
  const [sendingReminders, setSendingReminders] = useState(false)

  const stats = useMemo(() => ({
    total:       todayAppts.length,
    completadas: todayAppts.filter(a => a.status === 'done').length,
    activas:     todayAppts.filter(a => a.status === 'active').length,
    ingresos:    income ?? 0,
  }), [todayAppts, income])

  const incomeByDay = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(now)
      day.setDate(day.getDate() - (29 - i))
      day.setHours(0, 0, 0, 0)
      const next = new Date(day); next.setDate(next.getDate() + 1)
      const ing = thirtyDayAppts
        .filter(a => { const t = new Date(a.scheduled_at); return t >= day && t < next })
        .reduce((s, a) => s + (Number(a.precio_total) || 0), 0)
      const label = i % 7 === 0 || i === 29
        ? day.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })
        : ''
      return {
        dia:      label,
        fullDate: day.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }),
        ingresos: ing,
      }
    })
  }, [thirtyDayAppts])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end }   = getLimaRange()
      const { last30Start }  = getMonthRange()
      const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))

      const [apptRes, payRes, pendingRes, boticasRes, thirtyRes, sessionRes] = await Promise.all([
        safe(supabase
          .from('appointments')
          .select(`id, scheduled_at, status, duration_minutes,
            patient:profiles!patient_id ( full_name ),
            doctor:doctors!doctor_id    ( nombres, apellidos )`)
          .gte('scheduled_at', start)
          .lte('scheduled_at', end)
          .order('scheduled_at', { ascending: true })),

        safe(supabase
          .from('payments')
          .select('amount, monto')
          .gte('created_at', start)
          .lte('created_at', end)),

        safe(supabase
          .from('doctors')
          .select('id, nombres, apellidos, especialidad, cmp, anos_experiencia, bio, precio, profile_id, created_at')
          .eq('aprobado', false)
          .order('created_at', { ascending: true })),

        safe(supabase
          .from('farmacias')
          .select('id, nombre, codigo_digemid, ciudad, distrito, direccion, telefono, propietario_nombre, email, codigo_referido, comision_porcentaje, profile_id, created_at')
          .eq('aprobado', false)
          .order('created_at', { ascending: true })),

        safe(supabase
          .from('appointments')
          .select('id, precio_total, scheduled_at')
          .eq('status', 'done')
          .gte('scheduled_at', last30Start)),

        safe(supabase
          .from('session_logs')
          .select(`id, inicio_sesion, fin_sesion, duracion_minutos, estado,
            doctor:doctors!doctor_id ( nombres, apellidos ),
            patient:profiles!patient_id ( full_name )`)
          .order('inicio_sesion', { ascending: false })
          .limit(20)),
      ])

      if (apptRes.error)    console.warn('[PanelAdmin] appointments:', apptRes.error.message)
      if (payRes.error)     console.warn('[PanelAdmin] payments:',     payRes.error.message)
      if (pendingRes.error) console.warn('[PanelAdmin] pending:',      pendingRes.error.message)
      if (boticasRes.error) console.warn('[PanelAdmin] boticas:',      boticasRes.error.message)
      if (thirtyRes.error)  console.warn('[PanelAdmin] thirtyDays:',   thirtyRes.error.message)
      if (sessionRes.error) console.warn('[PanelAdmin] sessions:',     sessionRes.error.message)

      setTodayAppts(apptRes.data ?? [])
      setPendingDoctors((pendingRes.data ?? []).map(d => ({
        ...d, full_name: [d.nombres, d.apellidos].filter(Boolean).join(' ') || 'Médico',
      })))
      setPendingBoticas(boticasRes.data ?? [])
      if (!thirtyRes.error)  setThirtyDayAppts(thirtyRes.data ?? [])
      if (!sessionRes.error) setSessionLogs(sessionRes.data ?? [])

      if (!payRes.error && payRes.data?.length) {
        setIncome(payRes.data.reduce((s, p) => {
          const val = p.amount ?? p.monto ?? 0
          return s + (p.amount != null ? Number(val) / 100 : Number(val))
        }, 0))
      } else {
        setIncome(0)
      }

      setLastRefresh(new Date())
    } catch (err) {
      console.error('[PanelAdmin] fetchAll error:', err)
      toast.error('Error al cargar el panel. Intenta actualizar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSendReminders() {
    setSendingReminders(true)
    try {
      const { data, error } = await supabase.functions.invoke('enviar-recordatorio')
      if (error) throw error
      const sent = data?.sent ?? 0
      toast.success(
        sent === 0 ? 'No hay citas en las próximas 2 horas'
          : `🔔 ${sent} recordatorio${sent !== 1 ? 's' : ''} enviado${sent !== 1 ? 's' : ''}`,
        { duration: 4000 }
      )
    } catch (err) {
      toast.error(`Error al enviar recordatorios: ${err.message ?? err}`)
    } finally {
      setSendingReminders(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleApprove(doc) {
    const { data: updated, error: docErr } = await supabase
      .from('doctors').update({ aprobado: true, activo: true }).eq('id', doc.id).select('id')
    if (docErr || !updated?.length) {
      toast.error('Error al aprobar médico — ejecuta supabase/admin_rls_doctors.sql en el Dashboard')
      return
    }
    if (doc.profile_id) {
      await supabase.from('profiles').update({ role: 'doctor' }).eq('id', doc.profile_id)
    }
    setPendingDoctors(prev => prev.filter(d => d.id !== doc.id))
    toast.success(`${doc.full_name} aprobado/a y activo/a`)
  }

  async function handleReject(doc) {
    if (!window.confirm(`¿Rechazar la solicitud de ${doc.full_name}? Se eliminará su registro.`)) return
    if (doc.profile_id) {
      await supabase.auth.admin?.deleteUser(doc.profile_id).catch(() => null)
      await supabase.from('profiles').delete().eq('id', doc.profile_id)
    }
    await supabase.from('doctors').delete().eq('id', doc.id)
    setPendingDoctors(prev => prev.filter(d => d.id !== doc.id))
    toast.success(`Solicitud de ${doc.full_name} rechazada`)
  }

  async function handleApproveBotica(botica) {
    const { data: updated, error } = await supabase
      .from('farmacias').update({ aprobado: true, activo: true }).eq('id', botica.id).select('id')
    if (error || !updated?.length) {
      toast.error('Error al aprobar botica — verifica las políticas RLS de farmacias')
      return
    }
    setPendingBoticas(prev => prev.filter(b => b.id !== botica.id))
    toast.success(`${botica.nombre} aprobada y activa`)
  }

  async function handleRejectBotica(botica) {
    if (!window.confirm(`¿Rechazar la solicitud de ${botica.nombre}? Se eliminará su registro.`)) return
    await supabase.from('farmacias').delete().eq('id', botica.id)
    setPendingBoticas(prev => prev.filter(b => b.id !== botica.id))
    toast.success(`Solicitud de ${botica.nombre} rechazada`)
  }

  const skeletonBar = (w = '60%', h = 14) => (
    <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
  )

  const totalPending = pendingDoctors.length + pendingBoticas.length

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.gray100}; }
        @keyframes pa-spin { to { transform: rotate(360deg); } }
        @keyframes pa-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        table { border-collapse: collapse; width: 100%; }
        tr:hover td { background: ${C.green50} !important; }
      `}</style>

      <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }} />

      {/* ── Header ── */}
      <header style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green400, background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5 }}>ADMIN</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>·</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>Panel de Administración</span>
          {totalPending > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#FDE68A', background: 'rgba(251,191,36,0.2)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(251,191,36,0.3)' }}>
              ⚠ {totalPending} pendiente{totalPending !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              Actualizado {fmtLastRefresh(lastRefresh)}
            </span>
          )}
          <button
            onClick={handleSendReminders} disabled={sendingReminders}
            style={{
              background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.4)',
              color: '#FDE68A', borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: sendingReminders ? 'default' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              opacity: sendingReminders ? 0.6 : 1,
            }}
          >
            <span style={sendingReminders ? { display: 'inline-block', animation: 'pa-spin 0.7s linear infinite' } : {}}>🔔</span>
            {sendingReminders ? 'Enviando…' : 'Recordatorios'}
          </button>
          <button
            onClick={fetchAll} disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: C.white, borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1,
            }}
          >
            <span style={loading ? { display: 'inline-block', animation: 'pa-spin 0.7s linear infinite' } : {}}>↻</span>
            Actualizar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${C.green500}, ${C.green700})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.white }}>
              {adminName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>{adminName}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', color: '#FCA5A5', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* ── Stats hoy ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24, animation: 'pa-fade 0.3s ease' }}>
          {loading ? [1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {skeletonBar('40%', 28)} {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <StatCard icon="📅" label="Citas programadas"    value={stats.total}      sub={`${stats.completadas} completadas`} />
            <StatCard icon="✅" label="Consultas completadas" value={stats.completadas} sub={stats.total ? `${Math.round(stats.completadas / stats.total * 100)}% del día` : '—'} />
            <StatCard icon="💰" label="Ingresos del día"     value={fmtSoles(stats.ingresos)} sub="Pagos procesados hoy" />
            <StatCard icon="🩺" label="En consulta ahora"    value={stats.activas}    sub="Salas activas" accent={C.blueText} />
          </>}
        </div>

        {/* ── Menú de navegación ── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, marginBottom: 14 }}>Gestión</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            <NavCard icon="🩺" label="Médicos"   sub="Lista, filtros y tarifas"  onClick={() => navigate('/admin/medicos')}   accent={C.green700}  bg={C.green50} />
            <NavCard icon="🏪" label="Boticas"   sub="Lista y detalles"          onClick={() => navigate('/admin/boticas')}   accent='#6D28D9'     bg='#F5F3FF'  />
            <NavCard icon="📊" label="Cobertura" sub="Disponibilidad por hora"   onClick={() => navigate('/admin/cobertura')} accent={C.blueText}  bg={C.blueBg} />
            <NavCard icon="📅" label="Consultas" sub="Historial de citas"        onClick={() => toast('Próximamente')}        accent={C.amberText} bg={C.amberBg} />
            <NavCard icon="💰" label="Finanzas"  sub="Ingresos y comisiones"     onClick={() => toast('Próximamente')}        accent={C.green700}  bg={C.green50} />
          </div>
        </div>

        {/* ── Citas de hoy ── */}
        <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>Citas de hoy</h2>
            {!loading && <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>{todayAppts.length}</span>}
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 280 }}>
            <table>
              <thead>
                <tr>
                  {['Hora', 'Paciente', 'Médico', 'Estado', 'Dur.'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: C.gray500, background: C.gray50, borderBottom: `1.5px solid ${C.gray200}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [1, 2, 3].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5].map(j => (
                      <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        {skeletonBar(j === 1 ? '50px' : '80%', 12)}
                      </td>
                    ))}
                  </tr>
                )) : todayAppts.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '28px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>Sin citas programadas para hoy</td></tr>
                ) : todayAppts.map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>{fmtHora(a.scheduled_at)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray900, borderBottom: `1px solid ${C.gray100}` }}>{a.patient?.full_name ?? 'Paciente'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>
                      {a.doctor ? [a.doctor.nombres, a.doctor.apellidos].filter(Boolean).join(' ') || '—' : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.gray100}` }}><StatusBadge status={a.status} /></td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{a.duration_minutes ?? 20} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Médicos pendientes de aprobación ── */}
        {(loading || pendingDoctors.length > 0) && (
          <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid #FDE68A`, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>⏳</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>Médicos pendientes de aprobación</span>
              {!loading && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: C.amberBg, color: C.amberText }}>
                  {pendingDoctors.length}
                </span>
              )}
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.gray200 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {skeletonBar('40%', 14)} {skeletonBar('60%', 11)}
                    </div>
                    <div style={{ width: 80, height: 32, background: C.gray200, borderRadius: 8 }} />
                    <div style={{ width: 80, height: 32, background: C.gray200, borderRadius: 8 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingDoctors.map(doc => {
                  const isCPsP = doc.cmp?.startsWith('CPsP')
                  return (
                    <div key={doc.id} style={{ border: `1px solid #FDE68A`, background: C.amberBg, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${C.amber}, #D97706)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontWeight: 800, fontSize: 16 }}>
                        {(doc.full_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray900 }}>
                          {isCPsP ? 'Psic.' : 'Dr(a).'} {doc.full_name}
                        </div>
                        <div style={{ fontSize: 12, color: C.amberText, marginTop: 2 }}>
                          {doc.especialidad ?? '—'} · {doc.cmp ?? '—'}
                          {doc.anos_experiencia ? ` · ${doc.anos_experiencia} años exp.` : ''}
                          {doc.precio ? ` · S/. ${doc.precio}` : ''}
                        </div>
                        {doc.bio && (
                          <div style={{ fontSize: 12, color: C.gray500, marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                            "{doc.bio}"
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: C.gray400, marginTop: 4 }}>
                          Solicitado: {new Date(doc.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => handleApprove(doc)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`, color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Aprobar</button>
                        <button onClick={() => handleReject(doc)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.red600}`, background: C.white, color: C.red600, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Rechazar</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Boticas pendientes de aprobación ── */}
        {(loading || pendingBoticas.length > 0) && (
          <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid #DDD6FE`, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>🏪</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>Boticas pendientes de aprobación</span>
              {!loading && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: C.yapeBg, color: C.yape }}>
                  {pendingBoticas.length}
                </span>
              )}
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.gray200 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {skeletonBar('40%', 14)} {skeletonBar('60%', 11)} {skeletonBar('50%', 11)}
                    </div>
                    <div style={{ width: 80, height: 32, background: C.gray200, borderRadius: 8 }} />
                    <div style={{ width: 80, height: 32, background: C.gray200, borderRadius: 8 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingBoticas.map(botica => (
                  <div key={botica.id} style={{ border: `1px solid #DDD6FE`, background: C.yapeBg, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${C.yape}, #4C1D95)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontWeight: 800, fontSize: 16 }}>
                      {(botica.nombre ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.gray900 }}>{botica.nombre}</div>
                      <div style={{ fontSize: 12, color: C.yape, marginTop: 2 }}>
                        DIGEMID: {botica.codigo_digemid ?? '—'} · {botica.ciudad ?? '—'}{botica.distrito ? `, ${botica.distrito}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: C.gray500, marginTop: 3 }}>
                        📍 {botica.direccion ?? '—'} · 📞 {botica.telefono ?? '—'}
                      </div>
                      <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                        Propietario: <span style={{ fontWeight: 600, color: C.gray700 }}>{botica.propietario_nombre ?? '—'}</span>
                        {botica.email ? ` · ${botica.email}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray400, marginTop: 4 }}>
                        Solicitado: {new Date(botica.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {botica.comision_porcentaje ? ` · Comisión: ${botica.comision_porcentaje}%` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => handleApproveBotica(botica)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`, color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Aprobar</button>
                      <button onClick={() => handleRejectBotica(botica)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.red600}`, background: C.white, color: C.red600, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tendencia de ingresos (30 días) ── */}
        <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>
              Ingresos por día — últimos 30 días
            </h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 800, color: C.green700, background: C.green50, padding: '4px 14px', borderRadius: 20 }}>
                Total: {fmtSoles(thirtyDayAppts.reduce((s, a) => s + (Number(a.precio_total) || 0), 0))}
              </span>
            )}
          </div>
          {loading ? (
            <div style={{ height: 200, background: C.gray50, borderRadius: 12 }} />
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incomeByDay} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.green500} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={C.green500} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => v === 0 ? '0' : `S/.${v}`} tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<IncomeTooltip />} cursor={{ stroke: C.green200, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="ingresos" stroke={C.green600} strokeWidth={2} fill="url(#incomeGrad)" dot={false} activeDot={{ r: 4, fill: C.green600, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ width: 20, height: 2, background: C.green600, borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: C.gray400 }}>Ingresos diarios de citas completadas</span>
          </div>
        </div>

        {/* ── Registro de sesiones (Ley 30421) ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🛡️</span>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>
                Registro de sesiones
              </h2>
              <span style={{
                fontSize: 10, fontWeight: 700, color: C.green700,
                background: C.green50, padding: '3px 8px', borderRadius: 20, letterSpacing: 0.4,
              }}>LEY 30421</span>
            </div>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                {sessionLogs.length} recientes
              </span>
            )}
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 380 }}>
            <table>
              <thead>
                <tr>
                  {['Fecha / Hora inicio', 'Médico', 'Paciente', 'Duración', 'Estado'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: i === 3 ? 'right' : 'left',
                      fontSize: 11, fontWeight: 700, color: C.gray500,
                      background: C.gray50, borderBottom: `1.5px solid ${C.gray200}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i}>
                      {[1,2,3,4,5].map(j => (
                        <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                          <div style={{ height: 12, width: j === 4 ? '40px' : '75%', background: C.gray200, borderRadius: 6 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sessionLogs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '28px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>Sin sesiones registradas aún</td></tr>
                ) : sessionLogs.map(s => {
                  const doctorName  = s.doctor  ? [s.doctor.nombres, s.doctor.apellidos].filter(Boolean).join(' ') || '—' : '—'
                  const patientName = s.patient?.full_name ?? '—'
                  const fechaHora   = s.inicio_sesion
                    ? new Date(s.inicio_sesion).toLocaleString('es-PE', {
                        timeZone: 'America/Lima', day: '2-digit', month: 'short',
                        year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })
                    : '—'
                  const estadoCfg = {
                    iniciada:     { bg: C.blueBg,  color: C.blueText, label: '⬤ Iniciada'     },
                    completada:   { bg: C.green50,  color: C.green700, label: '✓ Completada'   },
                    interrumpida: { bg: C.redBg,    color: C.red600,   label: '✗ Interrumpida' },
                  }[s.estado] ?? { bg: C.gray100, color: C.gray500, label: s.estado }
                  return (
                    <tr key={s.id}>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>{fechaHora}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray900, borderBottom: `1px solid ${C.gray100}` }}>{doctorName}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>{patientName}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                        {s.duracion_minutos != null ? `${s.duracion_minutos} min` : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color, whiteSpace: 'nowrap' }}>
                          {estadoCfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.gray400 }}>VIDASALUD · Panel de Administración · Perú</div>
          <div style={{ fontSize: 11, color: C.gray300, marginTop: 4 }}>RENIPRESS registrado · Ley 30421 · Colegio Médico del Perú</div>
        </div>

      </main>
    </div>
  )
}
