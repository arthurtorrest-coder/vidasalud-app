import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  AreaChart, Area,
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

// ─── Helpers ──────────────────────────────────────────────────

function getLimaRange() {
  const now  = new Date()
  const lima = new Date(now.getTime() - 5 * 3600 * 1000)
  const y  = lima.getUTCFullYear()
  const mo = lima.getUTCMonth()
  const d  = lima.getUTCDate()
  return {
    start:       new Date(Date.UTC(y, mo, d,     5, 0,  0)).toISOString(),
    end:         new Date(Date.UTC(y, mo, d + 1, 4, 59, 59)).toISOString(),
    weekStart:   new Date(Date.UTC(y, mo, d - 6, 5, 0,  0)).toISOString(),
    y, mo, d,
  }
}

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
  })
}

function fmtSoles(n) {
  return `S/. ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtLastRefresh(d) {
  if (!d) return ''
  return d.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function buildWeekChart(appts) {
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const now  = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const day  = new Date(now)
    day.setDate(day.getDate() - (6 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const count = appts.filter(a => {
      const t = new Date(a.scheduled_at)
      return t >= day && t < next
    }).length
    return {
      dia:   i === 6 ? 'Hoy' : DAYS[day.getDay()],
      citas: count,
      fill:  i === 6 ? '#059669' : '#A7F3D0',
    }
  })
}

function getMonthRange() {
  const now  = new Date()
  const lima = new Date(now.getTime() - 5 * 3600 * 1000)
  const y    = lima.getUTCFullYear()
  const mo   = lima.getUTCMonth()
  const monthLabel = new Date(Date.UTC(y, mo, 15)).toLocaleDateString('es-PE', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  const last30 = new Date(Date.UTC(y, mo, lima.getUTCDate(), 5))
  last30.setDate(last30.getDate() - 29)
  return {
    startOfMonth: new Date(Date.UTC(y, mo, 1, 5, 0, 0)).toISOString(),
    endOfMonth:   new Date(Date.UTC(y, mo + 1, 1, 4, 59, 59)).toISOString(),
    last30Start:  last30.toISOString(),
    monthLabel:   monthLabel.replace(/^\w/, c => c.toUpperCase()),
  }
}

// ─── Sub-componentes ──────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent = C.green700 }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16,
      border: `1.5px solid ${C.gray200}`,
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          color: accent, background: C.green50,
          padding: '3px 8px', borderRadius: 20,
        }}>
          HOY
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: C.gray900, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray400, marginTop: -4 }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.done
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function StarRating({ rating }) {
  const n = Number(rating) || 0
  return (
    <span style={{ color: C.amber, fontWeight: 700, fontSize: 13 }}>
      ★ {n.toFixed(1)}
    </span>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.green200}`,
      padding: '8px 14px', borderRadius: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.green800, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>
        {payload[0].value} {payload[0].value === 1 ? 'cita' : 'citas'}
      </div>
    </div>
  )
}

function SectionHeader({ title, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14,
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>{title}</h2>
      {count != null && (
        <span style={{
          fontSize: 12, fontWeight: 700, color: C.green700,
          background: C.green50, padding: '3px 10px', borderRadius: 20,
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

function EmptyRow({ cols, msg }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '28px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
        {msg}
      </td>
    </tr>
  )
}

const TH = ({ children, right }) => (
  <th style={{
    padding: '10px 14px', textAlign: right ? 'right' : 'left',
    fontSize: 11, fontWeight: 700, color: C.gray500,
    background: C.gray50, borderBottom: `1.5px solid ${C.gray200}`,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </th>
)

const TD = ({ children, right, muted }) => (
  <td style={{
    padding: '11px 14px', textAlign: right ? 'right' : 'left',
    fontSize: 13, color: muted ? C.gray500 : C.gray900,
    borderBottom: `1px solid ${C.gray100}`,
    verticalAlign: 'middle',
  }}>
    {children}
  </td>
)

function MesStatCard({ icon, label, value, sub, accent = C.green700, bg = C.green50 }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16,
      border: `1.5px solid ${C.gray200}`,
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          color: accent, background: bg,
          padding: '3px 8px', borderRadius: 20,
        }}>
          MES
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: C.gray900, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray400, marginTop: -4 }}>{sub}</div>}
    </div>
  )
}

function HorizTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const n = payload[0].value
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.green200}`,
      padding: '8px 14px', borderRadius: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.green800, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>
        {n} {n === 1 ? 'cita' : 'citas'}
      </div>
    </div>
  )
}

function IncomeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.green200}`,
      padding: '8px 14px', borderRadius: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.green800, marginBottom: 2 }}>
        {payload[0]?.payload?.fullDate ?? ''}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>
        {fmtSoles(payload[0].value)}
      </div>
    </div>
  )
}

// ─── Panel principal ──────────────────────────────────────────

export default function PanelAdmin() {
  const { profile }  = useAuthStore()
  const navigate     = useNavigate()
  const adminName    = profile?.full_name ?? 'Administrador'

  const [todayAppts,     setTodayAppts]     = useState([])
  const [weekAppts,      setWeekAppts]      = useState([])
  const [doctors,        setDoctors]        = useState([])
  const [pendingDoctors, setPendingDoctors] = useState([])
  const [pendingTarifas, setPendingTarifas] = useState([])
  const [income,         setIncome]         = useState(null)
  const [sessionLogs,    setSessionLogs]    = useState([])
  const [loading,        setLoading]        = useState(true)
  const [lastRefresh,    setLastRefresh]    = useState(null)
  const [monthAppts,     setMonthAppts]     = useState([])
  const [newPatients,    setNewPatients]    = useState(0)
  const [thirtyDayAppts, setThirtyDayAppts] = useState([])

  const stats = useMemo(() => ({
    total:       todayAppts.length,
    completadas: todayAppts.filter(a => a.status === 'done').length,
    ingresos:    income ?? 0,
    activos:     doctors.filter(d => d.activo !== false).length,
  }), [todayAppts, doctors, income])

  const chartData = useMemo(() => buildWeekChart(weekAppts), [weekAppts])

  const monthStats = useMemo(() => {
    const citasMes    = monthAppts.length
    const ingresosMes = monthAppts.reduce((s, a) => s + (Number(a.precio_total) || 0), 0)
    const avgRating   = doctors.length
      ? doctors.reduce((s, d) => s + (Number(d.rating) || 0), 0) / doctors.length
      : 0
    return { citasMes, ingresosMes, avgRating, nuevosPacientes: newPatients }
  }, [monthAppts, doctors, newPatients])

  const topDoctors = useMemo(() => {
    if (!monthAppts.length) return []
    const map = new Map()
    monthAppts.forEach(a => {
      if (!a.doctor?.id) return
      const k = a.doctor.id
      if (!map.has(k)) map.set(k, { ...a.doctor, citasMes: 0 })
      map.get(k).citasMes++
    })
    return [...map.values()].sort((a, b) => b.citasMes - a.citasMes).slice(0, 5)
  }, [monthAppts])

  const specData = useMemo(() => {
    if (!monthAppts.length) return []
    const m = new Map()
    monthAppts.forEach(a => {
      const s = (a.doctor?.especialidad ?? 'Otra')
        .replace('Medicina General', 'Med. General')
        .replace('Gastroenterología', 'Gastro.')
      m.set(s, (m.get(s) ?? 0) + 1)
    })
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([especialidad, citas]) => ({ especialidad, citas }))
  }, [monthAppts])

  const incomeByDay = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(now)
      day.setDate(day.getDate() - (29 - i))
      day.setHours(0, 0, 0, 0)
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      const income = thirtyDayAppts.filter(a => {
        const t = new Date(a.scheduled_at)
        return t >= day && t < next
      }).reduce((s, a) => s + (Number(a.precio_total) || 0), 0)
      const label = i % 7 === 0 || i === 29
        ? day.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })
        : ''
      return {
        dia:      label,
        fullDate: day.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }),
        ingresos: income,
      }
    })
  }, [thirtyDayAppts])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { start, end, weekStart }                    = getLimaRange()
    const { startOfMonth, endOfMonth, last30Start }    = getMonthRange()

    const [apptRes, weekRes, docRes, payRes, pendingRes, tarifasRes, sessionRes, monthRes, patientRes, thirtyRes] = await Promise.all([
      supabase
        .from('appointments')
        .select(`
          id, scheduled_at, status, duration_minutes,
          patient:profiles!patient_id ( full_name ),
          doctor:doctors!doctor_id    ( nombres, apellidos )
        `)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: true }),

      supabase
        .from('appointments')
        .select('scheduled_at, status')
        .gte('scheduled_at', weekStart)
        .lte('scheduled_at', end),

      supabase
        .from('doctors')
        .select('id, nombres, apellidos, especialidad, cmp, precio, rating, total_reviews, activo, aprobado')
        .eq('aprobado', true)
        .order('rating', { ascending: false }),

      supabase
        .from('payments')
        .select('amount, monto')
        .gte('created_at', start)
        .lte('created_at', end),

      supabase
        .from('doctors')
        .select('id, nombres, apellidos, especialidad, cmp, anos_experiencia, bio, precio, profile_id, created_at')
        .eq('aprobado', false)
        .order('created_at', { ascending: true }),

      supabase
        .from('doctors')
        .select('id, nombres, apellidos, especialidad, cmp, precio, precio_propuesto')
        .eq('precio_pendiente_aprobacion', true)
        .order('nombres', { ascending: true }),

      supabase
        .from('session_logs')
        .select(`
          id, inicio_sesion, fin_sesion, duracion_minutos, estado,
          doctor:doctors!doctor_id ( nombres, apellidos ),
          patient:profiles!patient_id ( full_name )
        `)
        .order('inicio_sesion', { ascending: false })
        .limit(20),

      // Citas completadas del mes (con datos del médico para rankings)
      supabase
        .from('appointments')
        .select('id, precio_total, scheduled_at, doctor:doctors!doctor_id(id, nombres, apellidos, especialidad, rating, foto_url, cmp)')
        .eq('status', 'done')
        .gte('scheduled_at', startOfMonth)
        .lte('scheduled_at', endOfMonth),

      // Nuevos pacientes registrados este mes
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'patient')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth),

      // Citas completadas últimos 30 días (tendencia de ingresos)
      supabase
        .from('appointments')
        .select('id, precio_total, scheduled_at')
        .eq('status', 'done')
        .gte('scheduled_at', last30Start),
    ])

    if (apptRes.error)    console.warn('[PanelAdmin] appointments:', apptRes.error.message)
    if (weekRes.error)    console.warn('[PanelAdmin] weekAppts:',   weekRes.error.message)
    if (docRes.error)     console.warn('[PanelAdmin] doctors:',     docRes.error.message)
    if (payRes.error)     console.warn('[PanelAdmin] payments:',    payRes.error.message)
    if (pendingRes.error) console.warn('[PanelAdmin] pending:',     pendingRes.error.message)
    if (tarifasRes.error) console.warn('[PanelAdmin] tarifas:',     tarifasRes.error.message)
    if (sessionRes.error)  console.warn('[PanelAdmin] sessions:',    sessionRes.error.message)
    if (monthRes?.error)   console.warn('[PanelAdmin] monthAppts:',  monthRes.error.message)
    if (patientRes?.error) console.warn('[PanelAdmin] newPatients:', patientRes.error.message)
    if (thirtyRes?.error)  console.warn('[PanelAdmin] thirtyDays:',  thirtyRes.error.message)

    setTodayAppts(apptRes.data ?? [])
    setWeekAppts(weekRes.data ?? [])

    setDoctors((docRes.data ?? []).map(d => ({
      ...d,
      full_name: [d.nombres, d.apellidos].filter(Boolean).join(' ') || 'Médico',
    })))
    setPendingDoctors((pendingRes.data ?? []).map(d => ({
      ...d,
      full_name: [d.nombres, d.apellidos].filter(Boolean).join(' ') || 'Médico',
    })))
    setPendingTarifas((tarifasRes.data ?? []).map(d => ({
      ...d,
      full_name: [d.nombres, d.apellidos].filter(Boolean).join(' ') || 'Médico',
    })))

    // Income: soporta 'amount' (schema.sql, en céntimos) y 'monto' (legacy, en soles)
    if (!payRes.error && payRes.data?.length) {
      setIncome(payRes.data.reduce((s, p) => {
        const val = p.amount ?? p.monto ?? 0
        // amount está en céntimos; monto en soles enteros
        return s + (p.amount != null ? Number(val) / 100 : Number(val))
      }, 0))
    } else {
      setIncome(0)
    }

    setSessionLogs(sessionRes.data ?? [])
    if (!monthRes?.error)   setMonthAppts(monthRes?.data ?? [])
    if (!patientRes?.error) setNewPatients(patientRes?.count ?? 0)
    if (!thirtyRes?.error)  setThirtyDayAppts(thirtyRes?.data ?? [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleApprove(doc) {
    const { data: updated, error: docErr } = await supabase
      .from('doctors')
      .update({ aprobado: true, activo: true })
      .eq('id', doc.id)
      .select('id')
    if (docErr || !updated?.length) {
      toast.error('Error al aprobar médico — ejecuta supabase/admin_rls_doctors.sql en el Dashboard')
      return
    }
    if (doc.profile_id) {
      await supabase.from('profiles').update({ role: 'doctor' }).eq('id', doc.profile_id)
    }
    setPendingDoctors(prev => prev.filter(d => d.id !== doc.id))
    setDoctors(prev => [...prev, { ...doc, aprobado: true, activo: true, full_name: doc.full_name }])
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

  async function handleApproveTarifa(doc) {
    const { data: updated, error } = await supabase
      .from('doctors')
      .update({ precio: doc.precio_propuesto, precio_propuesto: null, precio_pendiente_aprobacion: false })
      .eq('id', doc.id)
      .select('id')
    if (error || !updated?.length) {
      toast.error('Error al aprobar la tarifa — ejecuta supabase/admin_rls_doctors.sql en el Dashboard')
      return
    }
    setPendingTarifas(prev => prev.filter(d => d.id !== doc.id))
    setDoctors(prev => prev.map(d => d.id === doc.id ? { ...d, precio: doc.precio_propuesto } : d))
    toast.success(`Tarifa de ${doc.full_name} actualizada a S/. ${doc.precio_propuesto}`)
  }

  async function handleRejectTarifa(doc) {
    const { data: updated, error } = await supabase
      .from('doctors')
      .update({ precio_propuesto: null, precio_pendiente_aprobacion: false })
      .eq('id', doc.id)
      .select('id')
    if (error || !updated?.length) {
      toast.error('Error al rechazar la tarifa — ejecuta supabase/admin_rls_doctors.sql en el Dashboard')
      return
    }
    setPendingTarifas(prev => prev.filter(d => d.id !== doc.id))
    toast.success(`Propuesta de tarifa de ${doc.full_name} rechazada`)
  }

  // ── Skeleton ──────────────────────────────────────────────
  const skeletonBar = (w = '60%', h = 14) => (
    <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
  )

  return (
    <div style={{
      minHeight: '100vh', background: C.gray100,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.gray100}; }
        @keyframes pa-spin { to { transform: rotate(360deg); } }
        @keyframes pa-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        table { border-collapse: collapse; width: 100%; }
        tr:hover td { background: ${C.green50} !important; }
      `}</style>

      <Toaster
        position="bottom-right"
        toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }}
      />

      {/* ── Header ── */}
      <header style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
            VIDASALUD
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20,
            letterSpacing: 0.5,
          }}>
            ADMIN
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>·</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
            Panel de Administración
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              Actualizado {fmtLastRefresh(lastRefresh)}
            </span>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: C.white, borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <span style={loading ? { display: 'inline-block', animation: 'pa-spin 0.7s linear infinite' } : {}}>↻</span>
            Actualizar
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 14px',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.green500}, ${C.green700})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: C.white,
            }}>
              {adminName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>{adminName}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
              color: '#FCA5A5', borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* ── Stats cards ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16, marginBottom: 24, animation: 'pa-fade 0.3s ease',
        }}>
          {loading ? [1, 2, 3, 4].map(i => (
            <div key={i} style={{
              background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
              padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {skeletonBar('40%', 28)}
              {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <StatCard icon="📅" label="Citas programadas" value={stats.total}
              sub={`${stats.completadas} completadas`} />
            <StatCard icon="✅" label="Consultas completadas" value={stats.completadas}
              sub={stats.total ? `${Math.round(stats.completadas / stats.total * 100)}% del día` : '—'} />
            <StatCard icon="💰" label="Ingresos del día" value={fmtSoles(stats.ingresos)}
              sub="Pagos procesados hoy" />
            <StatCard icon="👨‍⚕️" label="Médicos activos" value={stats.activos}
              sub={`de ${doctors.length} registrados`} />
          </>}
        </div>

        {/* ── Middle row: Citas + Gráfico ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 380px',
          gap: 20, marginBottom: 24,
        }}>

          {/* Citas de hoy */}
          <div style={{
            background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
            padding: 20, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <SectionHeader title="Citas de hoy" count={loading ? null : todayAppts.length} />
            <div style={{ overflowY: 'auto', maxHeight: 340 }}>
              <table>
                <thead>
                  <tr>
                    <TH>Hora</TH>
                    <TH>Paciente</TH>
                    <TH>Médico</TH>
                    <TH>Estado</TH>
                    <TH right>Duración</TH>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3, 4, 5].map(i => (
                      <tr key={i}>
                        {[1, 2, 3, 4, 5].map(j => (
                          <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                            {skeletonBar(j === 1 ? '50px' : j === 5 ? '40px' : '80%', 12)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : todayAppts.length === 0 ? (
                    <EmptyRow cols={5} msg="Sin citas programadas para hoy" />
                  ) : (
                    todayAppts.map(a => (
                      <tr key={a.id}>
                        <TD muted>{fmtHora(a.scheduled_at)}</TD>
                        <TD>{a.patient?.full_name ?? 'Paciente'}</TD>
                        <TD muted>
                          {a.doctor
                            ? [a.doctor.nombres, a.doctor.apellidos].filter(Boolean).join(' ') || '—'
                            : '—'}
                        </TD>
                        <TD><StatusBadge status={a.status} /></TD>
                        <TD right muted>{a.duration_minutes ?? 20} min</TD>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico semanal */}
          <div style={{
            background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
            padding: 20, display: 'flex', flexDirection: 'column',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <SectionHeader title="Citas — últimos 7 días" />

            {loading ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'flex-end',
                gap: 8, padding: '8px 0',
              }}>
                {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`, background: C.gray200, borderRadius: 4,
                  }} />
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={28}
                    margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: C.gray500, fontFamily: 'DM Sans, sans-serif' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: C.gray400, fontFamily: 'DM Sans, sans-serif' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: C.green50 }} />
                    <Bar dataKey="citas" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
              {[
                { color: C.green600, label: 'Hoy' },
                { color: C.green200, label: 'Días anteriores' },
              ].map(({ color, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.gray500 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Estadísticas del mes ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>
              Estadísticas del mes
            </h2>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.green700,
              background: C.green50, padding: '3px 10px', borderRadius: 20, letterSpacing: 0.3,
            }}>
              {getMonthRange().monthLabel}
            </span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16, animation: 'pa-fade 0.3s ease',
          }}>
            {loading ? [1, 2, 3, 4].map(i => (
              <div key={i} style={{
                background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
                padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {skeletonBar('40%', 28)} {skeletonBar('55%', 12)}
              </div>
            )) : <>
              <MesStatCard
                icon="💰" label="Ingresos del mes"
                value={fmtSoles(monthStats.ingresosMes)}
                sub={`${monthStats.citasMes} citas completadas`}
              />
              <MesStatCard
                icon="✅" label="Consultas completadas"
                value={monthStats.citasMes}
                sub="Status done este mes"
              />
              <MesStatCard
                icon="⭐" label="Rating promedio"
                value={`${monthStats.avgRating.toFixed(1)} / 5`}
                sub="Promedio médicos activos"
                accent={C.amberText} bg={C.amberBg}
              />
              <MesStatCard
                icon="👥" label="Nuevos pacientes"
                value={monthStats.nuevosPacientes}
                sub="Registrados este mes"
                accent={C.blueText} bg={C.blueBg}
              />
            </>}
          </div>
        </div>

        {/* ── Rankings: Médicos top + Especialidades ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 400px',
          gap: 20, marginBottom: 24,
        }}>

          {/* Médicos más consultados */}
          <div style={{
            background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
            padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <SectionHeader
              title="Médicos más consultados"
              count={loading ? null : topDoctors.length ? `Top ${topDoctors.length}` : null}
            />
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.gray200, flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {skeletonBar('50%', 12)} {skeletonBar('35%', 10)}
                    </div>
                    <div style={{ width: 48, height: 28, background: C.gray200, borderRadius: 8 }} />
                  </div>
                ))}
              </div>
            ) : topDoctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.gray400, fontSize: 13 }}>
                Sin citas completadas este mes
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topDoctors.map((doc, i) => {
                  const initials = ((doc.nombres?.[0] ?? '?') + (doc.apellidos?.[0] ?? '?')).toUpperCase()
                  const isCPsP   = (doc.cmp ?? '').startsWith('CPsP')
                  const titulo   = isCPsP ? 'Psic.' : 'Dr(a).'
                  const name     = [doc.nombres, doc.apellidos].filter(Boolean).join(' ')
                  const medals   = ['🥇', '🥈', '🥉']
                  return (
                    <div key={doc.id ?? i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 12,
                      background: i === 0 ? C.green50 : 'transparent',
                      border: `1px solid ${i === 0 ? C.green200 : 'transparent'}`,
                    }}>
                      <span style={{
                        width: 22, textAlign: 'center', flexShrink: 0,
                        fontSize: i < 3 ? 16 : 13, fontWeight: 900,
                        color: i < 3 ? C.green700 : C.gray400,
                      }}>
                        {i < 3 ? medals[i] : `${i + 1}.`}
                      </span>
                      {doc.foto_url ? (
                        <img src={doc.foto_url} alt={name}
                          style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: C.white, fontWeight: 800, fontSize: 13,
                        }}>
                          {initials}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: C.gray900,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {titulo} {name}
                        </div>
                        <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>
                          {doc.especialidad ?? '—'}
                          {doc.rating > 0 && (
                            <span style={{ color: C.amber, fontWeight: 700, marginLeft: 6 }}>
                              ★ {Number(doc.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{
                          fontSize: 20, fontWeight: 900,
                          color: i === 0 ? C.green700 : C.gray800,
                        }}>
                          {doc.citasMes}
                        </div>
                        <div style={{ fontSize: 10, color: C.gray400, fontWeight: 600 }}>citas</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Especialidades más demandadas */}
          <div style={{
            background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
            padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column',
          }}>
            <SectionHeader title="Especialidades más demandadas" />
            {loading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                {[85, 65, 55, 40, 30, 20, 14].map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 90, height: 10, background: C.gray200, borderRadius: 4, flexShrink: 0 }} />
                    <div style={{ height: 22, width: `${w}%`, background: C.gray200, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ) : specData.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.gray400, fontSize: 13,
              }}>
                Sin datos este mes
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={specData}
                    layout="vertical"
                    barSize={18}
                    margin={{ top: 0, right: 28, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} horizontal={false} />
                    <XAxis
                      type="number" allowDecimals={false}
                      tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans, sans-serif' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      type="category" dataKey="especialidad" width={96}
                      tick={{ fontSize: 10, fill: C.gray600, fontFamily: 'DM Sans, sans-serif' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<HorizTooltip />} cursor={{ fill: C.green50 }} />
                    <Bar dataKey="citas" fill={C.green500} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ── Tendencia de ingresos (30 días) ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>
              Ingresos por día — últimos 30 días
            </h2>
            {!loading && (
              <span style={{
                fontSize: 12, fontWeight: 800, color: C.green700,
                background: C.green50, padding: '4px 14px', borderRadius: 20,
              }}>
                Total: {fmtSoles(monthStats.ingresosMes)}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{
              height: 200, background: C.gray50, borderRadius: 12,
              animation: 'pa-fade 1.5s ease infinite alternate',
            }} />
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={incomeByDay}
                  margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
                >
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.green500} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={C.green500} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans, sans-serif' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => v === 0 ? '0' : `S/.${v}`}
                    tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans, sans-serif' }}
                    axisLine={false} tickLine={false} width={56}
                  />
                  <Tooltip content={<IncomeTooltip />} cursor={{ stroke: C.green200, strokeWidth: 1 }} />
                  <Area
                    type="monotone" dataKey="ingresos"
                    stroke={C.green600} strokeWidth={2}
                    fill="url(#incomeGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: C.green600, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ width: 20, height: 2, background: C.green600, borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: C.gray400 }}>
              Ingresos diarios de citas completadas (precio_total)
            </span>
          </div>
        </div>

        {/* ── Médicos pendientes de aprobación ── */}
        {(loading || pendingDoctors.length > 0) && (
          <div style={{
            background: C.white, borderRadius: 16,
            border: `1.5px solid #FDE68A`,
            padding: 20, marginBottom: 24,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⏳</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>
                  Médicos pendientes de aprobación
                </span>
                {!loading && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: C.amberBg, color: C.amberText,
                  }}>
                    {pendingDoctors.length}
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{
                    border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 16,
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.gray200 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {skeletonBar('40%', 14)}
                      {skeletonBar('60%', 11)}
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
                    <div key={doc.id} style={{
                      border: `1px solid #FDE68A`,
                      background: C.amberBg,
                      borderRadius: 12, padding: '14px 16px',
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${C.amber}, #D97706)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: C.white, fontWeight: 800, fontSize: 16,
                      }}>
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
                          <div style={{
                            fontSize: 12, color: C.gray500, marginTop: 6,
                            lineHeight: 1.5, fontStyle: 'italic',
                          }}>
                            "{doc.bio}"
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: C.gray400, marginTop: 4 }}>
                          Solicitado: {new Date(doc.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => handleApprove(doc)}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: 'none',
                            background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                            color: C.white, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={() => handleReject(doc)}
                          style={{
                            padding: '7px 14px', borderRadius: 8,
                            border: `1px solid ${C.red600}`,
                            background: C.white, color: C.red600,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          ✗ Rechazar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tarifas pendientes de aprobación ── */}
        {(loading || pendingTarifas.length > 0) && (
          <div style={{
            background: C.white, borderRadius: 16,
            border: `1.5px solid ${C.blue600}`,
            padding: 20, marginBottom: 24,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>💰</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>
                Tarifas pendientes de aprobación
              </span>
              {!loading && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: C.blueBg, color: C.blueText,
                }}>
                  {pendingTarifas.length}
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{
                    border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 16,
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {skeletonBar('40%', 13)}
                      {skeletonBar('60%', 11)}
                    </div>
                    <div style={{ width: 90, height: 32, background: C.gray200, borderRadius: 8 }} />
                    <div style={{ width: 90, height: 32, background: C.gray200, borderRadius: 8 }} />
                  </div>
                ))}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <TH>Médico</TH>
                    <TH>Especialidad</TH>
                    <TH right>Tarifa actual</TH>
                    <TH right>Tarifa propuesta</TH>
                    <TH right>Acción</TH>
                  </tr>
                </thead>
                <tbody>
                  {pendingTarifas.length === 0 ? (
                    <EmptyRow cols={5} msg="Sin tarifas pendientes" />
                  ) : (
                    pendingTarifas.map(doc => (
                      <tr key={doc.id}>
                        <TD>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: `linear-gradient(135deg, ${C.blue600}, #1D4ED8)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: C.white, fontWeight: 800, fontSize: 12,
                            }}>
                              {(doc.full_name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: C.gray900 }}>
                              {doc.full_name}
                            </span>
                          </div>
                        </TD>
                        <TD muted>{doc.especialidad ?? '—'}</TD>
                        <TD right>
                          <span style={{ color: C.gray500, fontWeight: 600 }}>
                            {doc.precio ? `S/. ${doc.precio}` : '—'}
                          </span>
                        </TD>
                        <TD right>
                          <span style={{
                            fontWeight: 800, color: C.blue600,
                            background: C.blueBg, padding: '3px 10px', borderRadius: 20,
                            fontSize: 13,
                          }}>
                            S/. {doc.precio_propuesto}
                          </span>
                        </TD>
                        <TD right>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleApproveTarifa(doc)}
                              style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none',
                                background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                                color: C.white, fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              ✓ Aprobar
                            </button>
                            <button
                              onClick={() => handleRejectTarifa(doc)}
                              style={{
                                padding: '6px 14px', borderRadius: 8,
                                border: `1px solid ${C.red600}`,
                                background: C.white, color: C.red600,
                                fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              ✗ Rechazar
                            </button>
                          </div>
                        </TD>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Médicos registrados ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <SectionHeader title="Médicos registrados" count={loading ? null : doctors.length} />
          <table>
            <thead>
              <tr>
                <TH>Médico</TH>
                <TH>Especialidad</TH>
                <TH>CMP / CPsP</TH>
                <TH right>Rating</TH>
                <TH right>Consultas</TH>
                <TH right>Tarifa</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6, 7].map(j => (
                      <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        {skeletonBar(j > 3 ? '50px' : '75%', 12)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : doctors.length === 0 ? (
                <EmptyRow cols={7} msg="No hay médicos registrados" />
              ) : (
                doctors.map((doc, i) => {
                  const isCPsP   = doc.cmp?.startsWith('CPsP')
                  const isActive = doc.activo !== false
                  return (
                    <tr key={doc.id ?? i}>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: C.white, fontWeight: 800, fontSize: 12,
                          }}>
                            {(doc.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: C.gray900 }}>
                              {isCPsP ? 'Psic.' : 'Dr(a).'} {doc.full_name}
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD muted>{doc.especialidad ?? '—'}</TD>
                      <TD muted>{doc.cmp ?? '—'}</TD>
                      <TD right><StarRating rating={doc.rating ?? 0} /></TD>
                      <TD right muted>{(doc.total_reviews ?? 0).toLocaleString('es-PE')}</TD>
                      <TD right>
                        {doc.precio ? (
                          <span style={{ fontWeight: 700, color: C.green700 }}>
                            S/. {doc.precio}
                          </span>
                        ) : <span style={{ color: C.gray400 }}>—</span>}
                      </TD>
                      <TD>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: isActive ? C.green50 : C.gray100,
                          color: isActive ? C.green700 : C.gray500,
                        }}>
                          {isActive ? '● Activo' : '○ Inactivo'}
                        </span>
                      </TD>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Registro de sesiones (Ley 30421) ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
              }}>
                LEY 30421
              </span>
            </div>
            {!loading && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: C.green700,
                background: C.green50, padding: '3px 10px', borderRadius: 20,
              }}>
                {sessionLogs.length} recientes
              </span>
            )}
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 380 }}>
            <table>
              <thead>
                <tr>
                  <TH>Fecha / Hora inicio</TH>
                  <TH>Médico</TH>
                  <TH>Paciente</TH>
                  <TH right>Duración</TH>
                  <TH>Estado</TH>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5].map(j => (
                        <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                          {skeletonBar(j === 4 ? '40px' : '75%', 12)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sessionLogs.length === 0 ? (
                  <EmptyRow cols={5} msg="Sin sesiones registradas aún" />
                ) : (
                  sessionLogs.map(s => {
                    const doctorName = s.doctor
                      ? [s.doctor.nombres, s.doctor.apellidos].filter(Boolean).join(' ') || '—'
                      : '—'
                    const patientName = s.patient?.full_name ?? '—'
                    const fechaHora   = s.inicio_sesion
                      ? new Date(s.inicio_sesion).toLocaleString('es-PE', {
                          timeZone: 'America/Lima',
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'
                    const estadoCfg = {
                      iniciada:     { bg: C.blueBg,   color: C.blueText,  label: '⬤ Iniciada'    },
                      completada:   { bg: C.green50,   color: C.green700,  label: '✓ Completada'  },
                      interrumpida: { bg: C.redBg,     color: C.red600,    label: '✗ Interrumpida' },
                    }[s.estado] ?? { bg: C.gray100, color: C.gray500, label: s.estado }
                    return (
                      <tr key={s.id}>
                        <TD muted>{fechaHora}</TD>
                        <TD>{doctorName}</TD>
                        <TD muted>{patientName}</TD>
                        <TD right muted>
                          {s.duracion_minutos != null ? `${s.duracion_minutos} min` : '—'}
                        </TD>
                        <TD>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: estadoCfg.bg, color: estadoCfg.color, whiteSpace: 'nowrap',
                          }}>
                            {estadoCfg.label}
                          </span>
                        </TD>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.gray400 }}>
            VIDASALUD · Panel de Administración · Perú
          </div>
          <div style={{ fontSize: 11, color: C.gray300, marginTop: 4 }}>
            RENIPRESS registrado · Ley 30421 · Colegio Médico del Perú
          </div>
        </div>

      </main>
    </div>
  )
}
