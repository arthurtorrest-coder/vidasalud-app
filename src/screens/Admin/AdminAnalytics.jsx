import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatCard({ label, value, sub, accent = false, loading = false }) {
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, ${C.green700}, ${C.green500})` : C.white,
      borderRadius: 16,
      border: accent ? 'none' : `1.5px solid ${C.gray200}`,
      padding: '20px 24px',
      boxShadow: accent ? '0 4px 20px rgba(5,150,105,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent ? 'rgba(255,255,255,0.75)' : C.gray400, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: 32, width: 80, background: accent ? 'rgba(255,255,255,0.2)' : C.gray200, borderRadius: 8 }} />
      ) : (
        <div style={{ fontSize: 32, fontWeight: 900, color: accent ? C.white : C.gray900, lineHeight: 1, letterSpacing: -1 }}>
          {value}
        </div>
      )}
      {sub && !loading && (
        <div style={{ fontSize: 12, color: accent ? 'rgba(255,255,255,0.7)' : C.gray400, marginTop: 6, fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: C.gray700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, marginTop: 28 }}>
      {children}
    </div>
  )
}

function FunnelBar({ label, value, max, color = C.green500 }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.gray700 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.gray900 }}>{value.toLocaleString('es-PE')} <span style={{ fontSize: 11, color: C.gray400, fontWeight: 500 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 8, background: C.gray100, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function StatusRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.gray100}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 13, color: C.gray700, fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: C.gray900 }}>{value.toLocaleString('es-PE')}</span>
    </div>
  )
}

function MiniChart({ data }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 100, H = 48
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.count / max) * (H - 4)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.green400} stopOpacity="0.3" />
          <stop offset="100%" stopColor={C.green400} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#chartGrad)" />
      <polyline points={pts} fill="none" stroke={C.green500} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function AdminAnalytics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))
    const since30 = `${isoDate(-30)}T00:00:00-05:00`
    const since7  = `${isoDate(-7)}T00:00:00-05:00`

    const [
      { data: profiles },
      { data: doctors },
      { data: appts },
      { data: events },
      { data: payments },
      { data: regTrend },
    ] = await Promise.all([
      safe(supabase.from('profiles').select('id, role, created_at')),
      safe(supabase.from('doctors').select('id, aprobado, created_at')),
      safe(supabase.from('appointments').select('id, status, created_at, precio_total')),
      safe(supabase.from('user_events').select('event_name, created_at')),
      safe(supabase.from('payments').select('id, monto, estado, created_at')),
      safe(supabase.from('profiles').select('created_at').gte('created_at', since30)),
    ])

    const pList   = profiles ?? []
    const dList   = doctors  ?? []
    const aList   = appts    ?? []
    const eList   = events   ?? []
    const payList = payments ?? []
    const regList = regTrend ?? []

    const totalPatients   = pList.filter(p => p.role === 'patient').length
    const newPatientsW    = pList.filter(p => p.role === 'patient' && p.created_at >= since7).length
    const totalDoctors    = dList.length
    const doctorsApproved = dList.filter(d => d.aprobado === true).length
    const doctorsPending  = dList.filter(d => !d.aprobado).length

    const apptByStatus = {
      pending:   aList.filter(a => a.status === 'pending').length,
      paid:      aList.filter(a => a.status === 'paid').length,
      active:    aList.filter(a => a.status === 'active').length,
      done:      aList.filter(a => a.status === 'done').length,
      cancelled: aList.filter(a => a.status === 'cancelled').length,
    }
    const totalAppts = aList.length
    const apptsDone  = apptByStatus.done
    const apptsWeek  = aList.filter(a => a.created_at >= since7).length

    const ingresoTotal = payList.filter(p => p.estado === 'succeeded' || p.estado === 'paid').reduce((s, p) => s + (p.monto ?? 0), 0) / 100
    const ingresoMes   = payList.filter(p => (p.estado === 'succeeded' || p.estado === 'paid') && p.created_at >= since30).reduce((s, p) => s + (p.monto ?? 0), 0) / 100

    const countEvent = name => eList.filter(e => e.event_name === name).length

    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().slice(0, 10)
    })
    const countByDay = {}
    regList.forEach(r => { const d = r.created_at?.slice(0, 10); if (d) countByDay[d] = (countByDay[d] ?? 0) + 1 })
    const trendData  = days.map(d => ({ date: d, count: countByDay[d] ?? 0 }))
    const trendTotal = trendData.reduce((s, d) => s + d.count, 0)

    setMetrics({
      totalPatients, newPatientsW, totalDoctors, doctorsApproved, doctorsPending,
      apptByStatus, totalAppts, apptsDone, apptsWeek, ingresoTotal, ingresoMes,
      funnel: { ver: countEvent('ver_home'), booking: countEvent('iniciar_booking'), pago: countEvent('llegar_pago'), done: apptsDone },
      trendData, trendTotal,
    })
    setLastFetch(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  const m = metrics ?? {}

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <header style={{ background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`, padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin/panel')} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: C.white, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Panel</button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green400, background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5 }}>ANALYTICS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastFetch && !loading && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Actualizado {lastFetch.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button onClick={fetchAll} disabled={loading} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: C.white, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>↻ Actualizar</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 4 }}>
          <StatCard label="Pacientes registrados" value={loading ? '—' : (m.totalPatients ?? 0).toLocaleString('es-PE')} sub={`+${m.newPatientsW ?? 0} esta semana`} accent loading={loading} />
          <StatCard label="Consultas totales"     value={loading ? '—' : (m.totalAppts ?? 0).toLocaleString('es-PE')} sub={`+${m.apptsWeek ?? 0} esta semana`} loading={loading} />
          <StatCard label="Consultas completadas" value={loading ? '—' : (m.apptsDone ?? 0).toLocaleString('es-PE')} sub={m.totalAppts ? `${Math.round((m.apptsDone / m.totalAppts) * 100)}% tasa de éxito` : ''} loading={loading} />
          <StatCard label="Médicos en plataforma" value={loading ? '—' : (m.totalDoctors ?? 0).toLocaleString('es-PE')} sub={`${m.doctorsApproved ?? 0} aprobados · ${m.doctorsPending ?? 0} pendientes`} loading={loading} />
          <StatCard label="Ingresos este mes"     value={loading ? '—' : fmtSoles(m.ingresoMes)} sub={`Total: ${fmtSoles(m.ingresoTotal)}`} loading={loading} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginTop: 8 }}>
          <div>
            <SectionTitle>Consultas por estado</SectionTitle>
            <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {loading ? [1,2,3,4,5].map(i => (
                <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${C.gray100}`, display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ height: 12, width: 100, background: C.gray200, borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 12, width: 36, background: C.gray200, borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
                </div>
              )) : <>
                <StatusRow label="Pend. de pago"  value={m.apptByStatus?.pending   ?? 0} color="#D97706" />
                <StatusRow label="Confirmada"      value={m.apptByStatus?.paid      ?? 0} color={C.green500} />
                <StatusRow label="En consulta"     value={m.apptByStatus?.active    ?? 0} color="#2563EB" />
                <StatusRow label="Completada"      value={m.apptByStatus?.done      ?? 0} color={C.gray400} />
                <StatusRow label="Cancelada"       value={m.apptByStatus?.cancelled ?? 0} color="#DC2626" />
                <div style={{ marginTop: 14, padding: '10px 14px', background: C.gray50, borderRadius: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.gray500 }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: C.gray900 }}>{(m.totalAppts ?? 0).toLocaleString('es-PE')}</span>
                </div>
              </>}
            </div>
          </div>

          <div>
            <SectionTitle>Embudo de interacción</SectionTitle>
            <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {loading ? [1,2,3,4].map(i => (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ height: 10, width: '60%', background: C.gray200, borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 8, background: C.gray200, borderRadius: 99, animation: 'pulse 1.5s infinite' }} />
                </div>
              )) : (() => {
                const fMax = m.funnel?.ver ?? 1
                return <>
                  <FunnelBar label="🏠 Visitas a Home"      value={m.funnel?.ver     ?? 0} max={fMax} color="#6EE7B7" />
                  <FunnelBar label="📅 Iniciaron booking"   value={m.funnel?.booking ?? 0} max={fMax} color={C.green500} />
                  <FunnelBar label="💳 Llegaron al pago"    value={m.funnel?.pago    ?? 0} max={fMax} color={C.green700} />
                  <FunnelBar label="✅ Consulta completada" value={m.funnel?.done    ?? 0} max={fMax} color="#064E3B" />
                  {(m.funnel?.ver ?? 0) > 0 && (
                    <div style={{ marginTop: 16, padding: '10px 14px', background: '#ECFDF5', borderRadius: 10, textAlign: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.green700 }}>
                        Conversión Home → Completada: {Math.round(((m.funnel?.done ?? 0) / (m.funnel?.ver ?? 1)) * 100)}%
                      </span>
                    </div>
                  )}
                </>
              })()}
            </div>
          </div>

          <div>
            <SectionTitle>Estado de médicos</SectionTitle>
            <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {loading ? <div style={{ height: 80, background: C.gray100, borderRadius: 10, animation: 'pulse 1.5s infinite' }} /> : <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  {[
                    { label: 'Aprobados',  value: m.doctorsApproved ?? 0, color: C.green500 },
                    { label: 'Pendientes', value: m.doctorsPending  ?? 0, color: '#D97706'  },
                    { label: 'Total',      value: m.totalDoctors    ?? 0, color: C.gray500  },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', padding: '14px 8px', background: C.gray50, borderRadius: 12 }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.gray400, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                    </div>
                  ))}
                </div>
                {(m.totalDoctors ?? 0) > 0 && (
                  <div style={{ height: 8, background: C.gray100, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(((m.doctorsApproved ?? 0) / (m.totalDoctors ?? 1)) * 100)}%`, background: C.green500, borderRadius: 99 }} />
                  </div>
                )}
                {(m.doctorsPending ?? 0) > 0 && (
                  <button onClick={() => navigate('/admin/medicos')} style={{ marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 10, background: 'rgba(217,119,6,0.08)', border: '1.5px solid rgba(217,119,6,0.3)', color: '#B45309', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ⚠️ Revisar {m.doctorsPending} médico{m.doctorsPending !== 1 ? 's' : ''} pendiente{m.doctorsPending !== 1 ? 's' : ''}
                  </button>
                )}
              </>}
            </div>
          </div>

          <div>
            <SectionTitle>Registros últimos 30 días</SectionTitle>
            <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {loading ? <div style={{ height: 100, background: C.gray100, borderRadius: 10, animation: 'pulse 1.5s infinite' }} /> : <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: C.gray900, lineHeight: 1 }}>{(m.trendTotal ?? 0).toLocaleString('es-PE')}</div>
                    <div style={{ fontSize: 12, color: C.gray400, fontWeight: 500, marginTop: 4 }}>usuarios nuevos</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.gray400, fontWeight: 600 }}>Últimos 30 días</div>
                </div>
                <MiniChart data={m.trendData} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: C.gray400 }}>{m.trendData?.[0]?.date?.slice(5) ?? ''}</span>
                  <span style={{ fontSize: 10, color: C.gray400 }}>{m.trendData?.[m.trendData.length - 1]?.date?.slice(5) ?? ''}</span>
                </div>
              </>}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: C.gray400, fontWeight: 500 }}>
          Los datos se cargan en tiempo real desde Supabase · Haz clic en "Actualizar" para refrescar
        </div>
      </main>
    </div>
  )
}
