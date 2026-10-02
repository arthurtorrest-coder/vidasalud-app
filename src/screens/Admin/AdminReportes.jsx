import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Toaster, toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'
import { repartoConsulta } from '../../lib/finanzas'

// ─── Helpers de mes "YYYY-MM" (todo en Lima, UTC-5 sin DST) ────

function currentLimaMonthKey() {
  const now  = new Date()
  const lima = new Date(now.getTime() - 5 * 3600 * 1000)
  return `${lima.getUTCFullYear()}-${String(lima.getUTCMonth() + 1).padStart(2, '0')}`
}

function limaMonthKeyOf(iso) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function addMonthsToKey(ymKey, delta) {
  const [y, m]  = ymKey.split('-').map(Number)
  const total   = y * 12 + (m - 1) + delta
  const ny      = Math.floor(total / 12)
  const nm      = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function monthRangeISO(ymKey) {
  const [y, m] = ymKey.split('-').map(Number)
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 5, 0, 0)).toISOString(),
    end:   new Date(Date.UTC(y, m,     1, 4, 59, 59)).toISOString(),
  }
}

function monthLabelFromKey(ymKey, fmt = { month: 'long', year: 'numeric' }) {
  const [y, m] = ymKey.split('-').map(Number)
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-PE', { ...fmt, timeZone: 'UTC' })
  return label.replace(/^\w/, c => c.toUpperCase()).replace(/\.$/, '')
}

function buildMonthList(fromKey, toKey) {
  const months = []
  let cur = fromKey
  let guard = 0
  while (guard++ < 240) {
    months.push(cur)
    if (cur === toKey) break
    cur = addMonthsToKey(cur, 1)
  }
  return months
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Sub-componentes ────────────────────────────────────────────

function StatCard({ icon, value, label, sub, accent = C.green700, bg = C.green50 }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray400 }}>{sub}</div>}
      <div style={{ width: 28, height: 3, borderRadius: 2, background: bg }} />
    </div>
  )
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const ingresos  = payload.find(p => p.dataKey === 'ingresos')?.value
  const consultas = payload.find(p => p.dataKey === 'consultas')?.value
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.green200}`,
      padding: '8px 14px', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.green800, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.green700 }}>{fmtSoles(ingresos)}</div>
      <div style={{ fontSize: 12, color: C.blueText }}>{consultas} consulta{consultas !== 1 ? 's' : ''}</div>
    </div>
  )
}

function skeletonBar(w = '60%', h = 12) {
  return <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
}

const TH = ({ label, w, right }) => (
  <th style={{
    padding: '10px 14px', width: w, textAlign: right ? 'right' : 'left',
    fontSize: 11, fontWeight: 700, color: C.gray500,
    background: C.gray50, borderBottom: `1.5px solid ${C.gray200}`, whiteSpace: 'nowrap',
  }}>{label}</th>
)

// ─── Pantalla principal ─────────────────────────────────────────

export default function AdminReportes() {
  const navigate = useNavigate()

  const [monthsDisponibles, setMonthsDisponibles] = useState([currentLimaMonthKey()])
  const [loadingMonths,     setLoadingMonths]      = useState(true)
  const [monthSel,          setMonthSel]           = useState(currentLimaMonthKey())
  const [monthAplicado,     setMonthAplicado]      = useState(currentLimaMonthKey())
  const [appts,             setAppts]              = useState([])   // rango de 6 meses (trend + mes seleccionado)
  const [farmacias,         setFarmacias]          = useState([])
  const [loading,           setLoading]            = useState(true)

  // Mes más antiguo con alguna cita completada → límite inferior del selector
  useEffect(() => {
    let cancelled = false
    async function cargarRangoDisponible() {
      setLoadingMonths(true)
      const { data, error } = await supabase
        .from('appointments')
        .select('scheduled_at')
        .eq('status', 'done')
        .order('scheduled_at', { ascending: true })
        .limit(1)
      if (cancelled) return
      if (error) console.warn('[AdminReportes] rango disponible:', error.message)
      const hoy = currentLimaMonthKey()
      const desde = data?.[0]?.scheduled_at ? limaMonthKeyOf(data[0].scheduled_at) : hoy
      setMonthsDisponibles(buildMonthList(desde, hoy).reverse()) // más reciente primero
      setLoadingMonths(false)
    }
    cargarRangoDisponible()
    return () => { cancelled = true }
  }, [])

  // Cargar datos: 6 meses terminando en monthAplicado (para la tendencia),
  // de donde también se extrae el detalle del mes seleccionado.
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))

    const { start } = monthRangeISO(addMonthsToKey(monthAplicado, -5))
    const { end }   = monthRangeISO(monthAplicado)

    const [apptsRes, farmRes] = await Promise.all([
      safe(supabase
        .from('appointments')
        .select('id, precio_total, scheduled_at, farmacia_referente_id, doctor:doctors!doctor_id(id, nombres, apellidos, especialidad, precio, foto_url)')
        .eq('status', 'done')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)),
      safe(supabase
        .from('farmacias')
        .select('id, nombre, ciudad, coordinador_id')
        .eq('aprobado', true)),
    ])

    if (apptsRes.error) { console.error('[AdminReportes] appts:', apptsRes.error.message); toast.error('No se pudieron cargar las consultas') }
    if (farmRes.error)  { console.warn('[AdminReportes] farmacias:', farmRes.error.message) }

    setAppts(apptsRes.data ?? [])
    setFarmacias(farmRes.data ?? [])
    setLoading(false)
  }, [monthAplicado])

  useEffect(() => { fetchAll() }, [fetchAll])

  const farmaciaMap = useMemo(
    () => Object.fromEntries(farmacias.map(f => [f.id, f])),
    [farmacias]
  )

  const repartoAppt = useCallback((a) => {
    const farm = a.farmacia_referente_id ? farmaciaMap[a.farmacia_referente_id] : null
    return repartoConsulta({
      especialidad:     a.doctor?.especialidad,
      precioNeto:       Number(a.precio_total) || Number(a.doctor?.precio) || 0,
      tieneBotica:      !!a.farmacia_referente_id,
      tieneCoordinador: !!farm?.coordinador_id,
    })
  }, [farmaciaMap])

  // ── Citas exactamente del mes aplicado (Secciones 2, 4, 5, 6) ──
  const { start: startSel, end: endSel } = useMemo(() => monthRangeISO(monthAplicado), [monthAplicado])
  const monthAppts = useMemo(
    () => appts.filter(a => a.scheduled_at >= startSel && a.scheduled_at <= endSel),
    [appts, startSel, endSel]
  )

  // ── Sección 2: resumen mensual ──────────────────────────────
  const resumen = useMemo(() => {
    const repartos = monthAppts.map(repartoAppt)
    return {
      consultas:    monthAppts.length,
      ingresos:     monthAppts.reduce((s, a) => s + (Number(a.precio_total) || 0), 0),
      pagoMedicos:  repartos.reduce((s, r) => s + r.medico,      0),
      comBoticas:   repartos.reduce((s, r) => s + r.botica,      0),
      comCoord:     repartos.reduce((s, r) => s + r.coordinador, 0),
      gananciaNeta: repartos.reduce((s, r) => s + r.clinica,     0),
    }
  }, [monthAppts, repartoAppt])

  // ── Sección 3: tendencia últimos 6 meses (terminan en monthAplicado) ──
  const trendData = useMemo(() => {
    const meses = buildMonthList(addMonthsToKey(monthAplicado, -5), monthAplicado)
    return meses.map(key => {
      const { start, end } = monthRangeISO(key)
      const delMes = appts.filter(a => a.scheduled_at >= start && a.scheduled_at <= end)
      return {
        mes:       monthLabelFromKey(key, { month: 'short', year: '2-digit' }),
        ingresos:  delMes.reduce((s, a) => s + (Number(a.precio_total) || 0), 0),
        consultas: delMes.length,
      }
    })
  }, [appts, monthAplicado])

  // ── Sección 4: por médico ────────────────────────────────────
  const medicosData = useMemo(() => {
    const map = {}
    for (const a of monthAppts) {
      const doc = a.doctor
      if (!doc?.id) continue
      if (!map[doc.id]) {
        map[doc.id] = {
          id: doc.id, nombres: doc.nombres ?? '', apellidos: doc.apellidos ?? '',
          especialidad: doc.especialidad ?? '—', foto_url: doc.foto_url ?? null,
          consultas: 0, ingresos: 0, pago: 0,
        }
      }
      map[doc.id].consultas++
      map[doc.id].ingresos += Number(a.precio_total) || 0
      map[doc.id].pago     += repartoAppt(a).medico
    }
    return Object.values(map).sort((a, b) => b.ingresos - a.ingresos)
  }, [monthAppts, repartoAppt])

  // ── Sección 5: por botica ────────────────────────────────────
  const boticasData = useMemo(() => {
    const map = {}
    for (const a of monthAppts) {
      if (!a.farmacia_referente_id) continue
      const farm = farmaciaMap[a.farmacia_referente_id]
      if (!farm) continue
      if (!map[farm.id]) {
        map[farm.id] = { id: farm.id, nombre: farm.nombre, ciudad: farm.ciudad, consultas: 0, comision: 0 }
      }
      map[farm.id].consultas++
      map[farm.id].comision += repartoAppt(a).botica
    }
    return Object.values(map).sort((a, b) => b.comision - a.comision)
  }, [monthAppts, farmaciaMap, repartoAppt])

  // ── Sección 6: por especialidad ──────────────────────────────
  const especialidadesData = useMemo(() => {
    const map = {}
    for (const a of monthAppts) {
      const esp = a.doctor?.especialidad || 'Sin especialidad'
      if (!map[esp]) map[esp] = { especialidad: esp, consultas: 0, ingresos: 0 }
      map[esp].consultas++
      map[esp].ingresos += Number(a.precio_total) || 0
    }
    return Object.values(map).sort((a, b) => b.ingresos - a.ingresos)
  }, [monthAppts])

  const monthLabelSel = monthLabelFromKey(monthAplicado)

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
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
          <button onClick={() => navigate('/admin/panel')} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: C.white, borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>← Panel</button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>REPORTES</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{monthLabelSel}</span>
        </div>
        <button onClick={fetchAll} disabled={loading} style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: C.white, borderRadius: 8, padding: '6px 14px',
          fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
        }}>↻ Actualizar</button>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* ── Sección 1: selector de período ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: '16px 20px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>📅 Período:</span>
          <select
            value={monthSel}
            onChange={e => setMonthSel(e.target.value)}
            disabled={loadingMonths}
            style={{
              padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
              fontSize: 13, fontWeight: 600, color: C.gray900, fontFamily: 'inherit',
              background: C.white, cursor: loadingMonths ? 'default' : 'pointer', minWidth: 180,
            }}
          >
            {monthsDisponibles.map(key => (
              <option key={key} value={key}>{monthLabelFromKey(key)}</option>
            ))}
          </select>
          <button
            onClick={() => setMonthAplicado(monthSel)}
            disabled={loading || loadingMonths}
            style={{
              background: C.green600, border: 'none', color: C.white,
              borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700,
              cursor: (loading || loadingMonths) ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: (loading || loadingMonths) ? 0.6 : 1,
            }}
          >
            {loading ? 'Cargando…' : 'Ver reporte'}
          </button>
        </div>

        {/* ── Sección 2: resumen mensual ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {loading ? [1,2,3,4,5,6].map(i => (
            <div key={i} style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skeletonBar('40%', 22)} {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <StatCard icon="📋" value={resumen.consultas}            label="Total consultas"            sub={monthLabelSel} />
            <StatCard icon="💵" value={fmtSoles(resumen.ingresos)}    label="Ingresos totales"           sub="Suma de precio_total" accent={C.green700} bg={C.green50} />
            <StatCard icon="👨‍⚕️" value={fmtSoles(resumen.pagoMedicos)} label="Pagado a médicos"            sub="A liquidar"           accent={C.blueText} bg={C.blueBg} />
            <StatCard icon="🏪" value={fmtSoles(resumen.comBoticas)}  label="Comisiones boticas"          sub="Por referidos"        accent={C.amberText} bg={C.amberBg} />
            <StatCard icon="🧭" value={fmtSoles(resumen.comCoord)}    label="Comisiones coordinadores"    sub="Por referidos con coordinador" accent="#6D28D9" bg="#F5F3FF" />
            <StatCard icon="🏥" value={fmtSoles(resumen.gananciaNeta)} label="Ganancia neta clínica"      sub="Ingresos − comisiones − pago médico" accent={C.green800} bg={C.green50} />
          </>}
        </div>

        {/* ── Sección 3: tendencia 6 meses ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, marginBottom: 14 }}>
            📈 Tendencia — últimos 6 meses (hasta {monthLabelSel})
          </h2>
          {loading ? (
            <div style={{ height: 240, background: C.gray50, borderRadius: 12 }} />
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans,sans-serif' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ingresos" tickFormatter={v => v === 0 ? '0' : `S/.${v}`} tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans,sans-serif' }} axisLine={false} tickLine={false} width={60} />
                  <YAxis yAxisId="consultas" orientation="right" tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans,sans-serif' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                  <Tooltip content={<TrendTooltip />} cursor={{ stroke: C.green200, strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans,sans-serif' }} />
                  <Line yAxisId="ingresos"  type="monotone" dataKey="ingresos"  name="Ingresos (S/.)" stroke={C.green600} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line yAxisId="consultas" type="monotone" dataKey="consultas" name="Consultas"      stroke={C.blueText} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Sección 4: por médico ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>👨‍⚕️ Por médico — {monthLabelSel}</h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.blueText, background: C.blueBg, padding: '3px 10px', borderRadius: 20 }}>
                {medicosData.length} médico{medicosData.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <TH label="Médico" />
                <TH label="Especialidad" w={160} />
                <TH label="Consultas" w={100} right />
                <TH label="Ingresos generados" w={150} right />
                <TH label="Pago médico" w={130} right />
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => (
                <tr key={i}>{[1,2,3,4,5].map(j => (
                  <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>{skeletonBar(j > 1 ? '60px' : '70%', 12)}</td>
                ))}</tr>
              )) : medicosData.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>Sin consultas completadas en {monthLabelSel.toLowerCase()}</td></tr>
              ) : medicosData.map(m => {
                const nombre = [m.nombres, m.apellidos].filter(Boolean).join(' ') || '—'
                return (
                  <tr key={m.id}>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.gray900, borderBottom: `1px solid ${C.gray100}` }}>{nombre}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>{m.especialidad}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.gray900, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{m.consultas}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.green700, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{fmtSoles(m.ingresos)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 900, color: C.blueText, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{fmtSoles(m.pago)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Sección 5: por botica ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>🏪 Por botica — {monthLabelSel}</h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.amberText, background: C.amberBg, padding: '3px 10px', borderRadius: 20 }}>
                {boticasData.length} botica{boticasData.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <TH label="Botica" />
                <TH label="Ciudad" w={140} />
                <TH label="Consultas referidas" w={150} right />
                <TH label="Comisión total" w={140} right />
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => (
                <tr key={i}>{[1,2,3,4].map(j => (
                  <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>{skeletonBar(j > 2 ? '60px' : '70%', 12)}</td>
                ))}</tr>
              )) : boticasData.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>Sin boticas con consultas referidas en {monthLabelSel.toLowerCase()}</td></tr>
              ) : boticasData.map(b => (
                <tr key={b.id}>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.gray900, borderBottom: `1px solid ${C.gray100}` }}>{b.nombre}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>{b.ciudad}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.gray900, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{b.consultas}</td>
                  <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 900, color: C.amberText, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{fmtSoles(b.comision)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Sección 6: por especialidad ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>🩺 Por especialidad — {monthLabelSel}</h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                {especialidadesData.length} especialidad{especialidadesData.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <TH label="Especialidad" />
                <TH label="Total consultas" w={150} right />
                <TH label="Ingresos" w={150} right />
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => (
                <tr key={i}>{[1,2,3].map(j => (
                  <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>{skeletonBar(j > 1 ? '60px' : '70%', 12)}</td>
                ))}</tr>
              )) : especialidadesData.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '40px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>Sin consultas completadas en {monthLabelSel.toLowerCase()}</td></tr>
              ) : especialidadesData.map(e => (
                <tr key={e.especialidad}>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.gray900, borderBottom: `1px solid ${C.gray100}` }}>{e.especialidad}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.gray900, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{e.consultas}</td>
                  <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 900, color: C.green700, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>{fmtSoles(e.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  )
}
