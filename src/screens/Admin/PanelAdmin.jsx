import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

// ─── Paleta ───────────────────────────────────────────────────
const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B', amberBg:  '#FFFBEB', amberText: '#B45309',
  blue600:  '#2563EB', blueBg:   '#EFF6FF', blueText:  '#1D4ED8',
  red600:   '#DC2626', redBg:    '#FEF2F2',
  gray900:  '#111827', gray700:  '#374151', gray500:   '#6B7280',
  gray400:  '#9CA3AF', gray300:  '#D1D5DB', gray200:   '#E5E7EB',
  gray100:  '#F3F4F6', gray50:   '#F9FAFB', white:     '#FFFFFF',
}

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
      dia:    i === 6 ? 'Hoy' : DAYS[day.getDay()],
      citas:  count,
      isHoy:  i === 6,
    }
  })
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

// ─── Panel principal ──────────────────────────────────────────

export default function PanelAdmin() {
  const { profile }  = useAuthStore()
  const navigate     = useNavigate()
  const adminName    = profile?.full_name ?? 'Administrador'

  const [todayAppts, setTodayAppts] = useState([])
  const [weekAppts,  setWeekAppts]  = useState([])
  const [doctors,    setDoctors]    = useState([])
  const [income,     setIncome]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const stats = useMemo(() => ({
    total:       todayAppts.length,
    completadas: todayAppts.filter(a => a.status === 'done').length,
    ingresos:    income ?? 0,
    activos:     doctors.filter(d => d.activo !== false).length,
  }), [todayAppts, doctors, income])

  const chartData = useMemo(() => buildWeekChart(weekAppts), [weekAppts])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { start, end, weekStart } = getLimaRange()

    const [apptRes, weekRes, docRes, profRes, payRes] = await Promise.all([
      supabase
        .from('appointments')
        .select(`
          id, scheduled_at, status, duration_minutes,
          patient:profiles!patient_id ( full_name ),
          doctor:profiles!doctor_id   ( full_name )
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
        .select('id, specialty, cmp_code, rating, total_reviews, activo, precio')
        .order('rating', { ascending: false }),

      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'doctor'),

      supabase
        .from('payments')
        .select('monto')
        .gte('created_at', start)
        .lte('created_at', end),
    ])

    if (apptRes.error)  console.warn('[PanelAdmin] appointments:', apptRes.error.message)
    if (weekRes.error)  console.warn('[PanelAdmin] weekAppts:', weekRes.error.message)
    if (docRes.error)   console.warn('[PanelAdmin] doctors:', docRes.error.message)

    setTodayAppts(apptRes.data ?? [])
    setWeekAppts(weekRes.data ?? [])

    // Merge doctor rows with profile names
    const profMap = Object.fromEntries((profRes.data ?? []).map(p => [p.id, p.full_name]))
    setDoctors((docRes.data ?? []).map(d => ({ ...d, full_name: profMap[d.id] ?? 'Médico' })))

    // Income: try payments table (monto in céntimos), fallback to 0
    if (!payRes.error && payRes.data?.length) {
      setIncome(payRes.data.reduce((s, p) => s + (Number(p.monto) || 0), 0) / 100)
    } else {
      setIncome(0)
    }

    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
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
                        <TD muted>{a.doctor?.full_name ?? '—'}</TD>
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
                    <Bar dataKey="citas" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isHoy ? C.green600 : C.green200}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.gray500 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: C.green600, display: 'inline-block' }} />
                Hoy
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.gray500 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: C.green200, display: 'inline-block' }} />
                Días anteriores
              </span>
            </div>
          </div>
        </div>

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
                  const isCPsP   = doc.cmp_code?.startsWith('CPsP')
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
                      <TD muted>{doc.specialty ?? '—'}</TD>
                      <TD muted>{doc.cmp_code ?? '—'}</TD>
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
