import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { toast, Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

// ─── Helpers ──────────────────────────────────────────────────

function getLimaMonthRange() {
  const now  = new Date()
  const lima = new Date(now.getTime() - 5 * 3600 * 1000)
  const y = lima.getUTCFullYear(), mo = lima.getUTCMonth(), d = lima.getUTCDate()
  const label = new Date(Date.UTC(y, mo, 15)).toLocaleDateString('es-PE', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  return {
    startOfMonth: new Date(Date.UTC(y, mo, 1,  5, 0, 0)).toISOString(),
    endOfMonth:   new Date(Date.UTC(y, mo + 1, 1, 4, 59, 59)).toISOString(),
    last30Start:  new Date(Date.UTC(y, mo, d - 29, 5, 0, 0)).toISOString(),
    monthLabel:   label.replace(/^\w/, c => c.toUpperCase()),
    today:        now,
  }
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Sub-componentes ──────────────────────────────────────────

function StatCard({ icon, value, label, sub, accent = C.green700, bg = C.green50, pill }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        {pill && (
          <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: bg, padding: '3px 8px', borderRadius: 20 }}>
            {pill}
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray400, marginTop: -4 }}>{sub}</div>}
    </div>
  )
}

function IncomeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.green200}`,
      padding: '8px 14px', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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

// ─── Pantalla principal ───────────────────────────────────────

export default function AdminFinanzas() {
  const navigate = useNavigate()

  const [appts,     setAppts]     = useState([])   // last 30 days done
  const [farmacias, setFarmacias] = useState([])   // lookup
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [{ startOfMonth, endOfMonth, last30Start, monthLabel, today }, setRange] =
    useState(getLimaMonthRange)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))

    const [apptsRes, farmRes] = await Promise.all([
      safe(supabase
        .from('appointments')
        .select('id, precio_total, scheduled_at, farmacia_referente_id, doctor:doctors!doctor_id(especialidad)')
        .eq('status', 'done')
        .gte('scheduled_at', last30Start)),
      safe(supabase
        .from('farmacias')
        .select('id, nombre, ciudad, comision_porcentaje')
        .eq('aprobado', true)),
    ])

    if (apptsRes.error) console.warn('[AdminFinanzas] appts:', apptsRes.error.message)
    if (farmRes.error)  console.warn('[AdminFinanzas] farmacias:', farmRes.error.message)

    setAppts(apptsRes.data ?? [])
    setFarmacias(farmRes.data ?? [])
    setLoading(false)
  }, [last30Start])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Estadísticas del mes actual ──────────────────────────────
  const monthAppts = useMemo(
    () => appts.filter(a => a.scheduled_at >= startOfMonth && a.scheduled_at <= endOfMonth),
    [appts, startOfMonth, endOfMonth]
  )

  const stats = useMemo(() => {
    const ingresos     = monthAppts.reduce((s, a) => s + Number(a.precio_total ?? 0), 0)
    const consultas    = monthAppts.length
    const ticket       = consultas > 0 ? ingresos / consultas : 0
    const comisiones   = monthAppts.reduce((s, a) => {
      if (!a.farmacia_referente_id) return s
      const farm = farmacias.find(f => f.id === a.farmacia_referente_id)
      return s + Number(a.precio_total ?? 0) * Number(farm?.comision_porcentaje ?? 5) / 100
    }, 0)
    return { ingresos, consultas, ticket, comisiones }
  }, [monthAppts, farmacias])

  // ── Datos del gráfico (últimos 30 días) ─────────────────────
  const incomeByDay = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(now)
      day.setDate(day.getDate() - (29 - i))
      day.setHours(0, 0, 0, 0)
      const next = new Date(day); next.setDate(next.getDate() + 1)
      const ing = appts
        .filter(a => { const t = new Date(a.scheduled_at); return t >= day && t < next })
        .reduce((s, a) => s + Number(a.precio_total ?? 0), 0)
      const label = i % 7 === 0 || i === 29
        ? day.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })
        : ''
      return {
        dia:      label,
        fullDate: day.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' }),
        ingresos: ing,
      }
    })
  }, [appts])

  // ── Comisiones por botica ────────────────────────────────────
  const boticasData = useMemo(() => {
    const map = {}
    for (const a of appts) {
      if (!a.farmacia_referente_id) continue
      const farm = farmacias.find(f => f.id === a.farmacia_referente_id)
      if (!farm) continue
      if (!map[a.farmacia_referente_id]) {
        map[a.farmacia_referente_id] = {
          id:         farm.id,
          nombre:     farm.nombre,
          ciudad:     farm.ciudad,
          pct:        Number(farm.comision_porcentaje ?? 5),
          consultas:  0,
          totalMonto: 0,
          comision:   0,
        }
      }
      const monto = Number(a.precio_total ?? 0)
      map[a.farmacia_referente_id].consultas++
      map[a.farmacia_referente_id].totalMonto += monto
      map[a.farmacia_referente_id].comision   += monto * Number(farm.comision_porcentaje ?? 5) / 100
    }
    return Object.values(map).sort((a, b) => b.totalMonto - a.totalMonto)
  }, [appts, farmacias])

  // ── Exportar PDF ─────────────────────────────────────────────
  async function exportPDF() {
    if (loading) { toast.error('Espera a que carguen los datos'); return }
    setExporting(true)
    const toastId = 'pdf'
    toast.loading('Generando reporte PDF…', { id: toastId })
    try {
      const GN  = [6, 78, 59], GM = [5, 150, 105], GL = [209, 250, 229]
      const WH  = [255, 255, 255], GY = [55, 65, 81], GYL = [156, 163, 175]
      const GYX = [249, 250, 251]
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const PW = 210, ML = 18, MR = 18, TW = PW - ML - MR

      const genDate = today.toLocaleDateString('es-PE', {
        timeZone: 'America/Lima', day: '2-digit', month: 'long', year: 'numeric',
      })
      const genTime = today.toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
      })

      // Portada
      doc.setFillColor(...GN); doc.rect(0, 0, PW, 50, 'F')
      doc.setFillColor(...GM); doc.rect(0, 44, PW, 6, 'F')
      doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WH)
      doc.text('VIDASALUD', ML, 22)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 240, 210)
      doc.text('Telemedicina para todo el Perú  ·  RENIPRESS  ·  Ley 30421', ML, 30)

      doc.setFillColor(...GM); doc.roundedRect(ML, 33, 82, 9, 2, 2, 'F')
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WH)
      doc.text('REPORTE FINANCIERO', ML + 41, 39.5, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 245, 220)
      doc.text(monthLabel.toUpperCase(), ML + 88, 39.5)

      let y = 58
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GYL)
      doc.text(`Generado el ${genDate} · ${genTime}`, ML, y)

      // KPIs
      y = 68
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GN)
      doc.text('Resumen del mes', ML, y)
      doc.setDrawColor(...GL); doc.setLineWidth(0.5)
      doc.line(ML, y + 2, ML + 52, y + 2)
      y += 7

      const kpis = [
        { label: 'Ingresos del mes', value: fmtSoles(stats.ingresos), sub: `${stats.consultas} consultas` },
        { label: 'Ticket promedio',  value: fmtSoles(stats.ticket),   sub: 'por consulta'             },
        { label: 'Comisiones boticas', value: fmtSoles(stats.comisiones), sub: 'a liquidar'           },
        { label: 'Consultas',        value: String(stats.consultas),   sub: 'completadas'              },
      ]
      const bW = (TW - 9) / 4
      kpis.forEach((k, i) => {
        const x = ML + i * (bW + 3)
        doc.setFillColor(236, 253, 245); doc.roundedRect(x, y, bW, 26, 3, 3, 'F')
        doc.setDrawColor(...GL); doc.setLineWidth(0.35); doc.roundedRect(x, y, bW, 26, 3, 3, 'S')
        doc.setFillColor(...GM); doc.rect(x, y, 2.5, 26, 'F')
        doc.setFontSize(i === 0 || i === 1 || i === 2 ? 8 : 13)
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...GN)
        doc.text(k.value, x + bW / 2, y + 10, { align: 'center' })
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GY)
        doc.text(k.label, x + bW / 2, y + 16, { align: 'center' })
        doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GYL)
        doc.text(k.sub, x + bW / 2, y + 21, { align: 'center' })
      })
      y += 36

      // Tabla ingresos por día
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GN)
      doc.text('Ingresos por día (últimos 30 días)', ML, y)
      doc.setDrawColor(...GL); doc.setLineWidth(0.4); doc.line(ML, y + 2, ML + 90, y + 2)
      y += 4

      const dayRows = incomeByDay
        .filter(d => d.ingresos > 0)
        .map(d => [d.fullDate, fmtSoles(d.ingresos)])

      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Ingresos']],
        body: dayRows.length ? dayRows : [['Sin datos', '—']],
        theme: 'striped',
        headStyles: { fillColor: GN, textColor: WH, fontSize: 9, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: 9, textColor: GY, cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 } },
        alternateRowStyles: { fillColor: GYX },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 72, halign: 'right' } },
        margin: { left: ML, right: MR, bottom: 18 },
      })

      // Tabla comisiones boticas
      let yBot = (doc.lastAutoTable?.finalY ?? 200) + 12
      if (yBot + 50 > 280) { doc.addPage(); yBot = 22 }

      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GN)
      doc.text('Comisiones por botica', ML, yBot)
      doc.setDrawColor(...GL); doc.setLineWidth(0.4); doc.line(ML, yBot + 2, ML + 68, yBot + 2)

      const botRows = boticasData.map(b => [
        b.nombre, b.ciudad, String(b.consultas), fmtSoles(b.totalMonto),
        `${b.pct}%`, fmtSoles(b.comision),
      ])

      autoTable(doc, {
        startY: yBot + 5,
        head: [['Botica', 'Ciudad', 'Citas', 'Monto', 'Comis.%', 'Comisión']],
        body: botRows.length ? botRows : [['Sin boticas con referidos', '—', '—', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: GN, textColor: WH, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: 8, textColor: GY, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: GYX },
        columnStyles: {
          0: { cellWidth: 50 }, 1: { cellWidth: 28 }, 2: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 28, halign: 'right' },
        },
        margin: { left: ML, right: MR, bottom: 18 },
      })

      // Footer
      const tot = doc.internal.getNumberOfPages()
      for (let pg = 1; pg <= tot; pg++) {
        doc.setPage(pg)
        doc.setDrawColor(...GL); doc.setLineWidth(0.3); doc.line(ML, 284, PW - MR, 284)
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GYL)
        doc.text(`Generado el ${genDate} · ${genTime}`, ML, 289)
        doc.text('Confidencial — VIDASALUD', PW - MR, 289, { align: 'right' })
        doc.text(`Pág. ${pg} / ${tot}`, PW / 2, 289, { align: 'center' })
      }

      const slug = monthLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')
      doc.save(`finanzas-vidasalud-${slug}.pdf`)
      toast.success('✅ Reporte descargado', { id: toastId, duration: 4000 })
    } catch (err) {
      console.error('[AdminFinanzas] PDF:', err)
      toast.error('Error al generar el PDF', { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  const skeletonBar = (w = '60%', h = 12) => (
    <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
  )

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
          }}>FINANZAS</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{monthLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={exportPDF}
            disabled={loading || exporting}
            style={{
              background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.4)',
              color: C.white, borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: loading || exporting ? 'default' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              opacity: loading || exporting ? 0.5 : 1,
            }}
          >
            📥 Exportar PDF
          </button>
          <button onClick={fetchAll} disabled={loading} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: C.white, borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
          }}>↻ Actualizar</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* ── Stats del mes ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {loading ? [1,2,3,4].map(i => (
            <div key={i} style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {skeletonBar('40%', 26)} {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <StatCard icon="💰" value={fmtSoles(stats.ingresos)}  label="Ingresos del mes"    sub={`${stats.consultas} consultas completadas`} pill="MES" />
            <StatCard icon="✅" value={stats.consultas}           label="Consultas pagadas"    sub="Con status=done" accent={C.blueText} bg={C.blueBg} pill="MES" />
            <StatCard icon="📊" value={fmtSoles(stats.ticket)}    label="Ticket promedio"      sub="Ingreso por consulta" accent={C.amberText} bg={C.amberBg} pill="MES" />
            <StatCard icon="🏪" value={fmtSoles(stats.comisiones)} label="Comisiones a boticas" sub={`${boticasData.length} botica${boticasData.length !== 1 ? 's' : ''} con referidos`} pill="MES" />
          </>}
        </div>

        {/* ── Gráfico de ingresos 30 días ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>
              Ingresos por día — últimos 30 días
            </h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 800, color: C.green700, background: C.green50, padding: '4px 14px', borderRadius: 20 }}>
                Total: {fmtSoles(appts.reduce((s, a) => s + Number(a.precio_total ?? 0), 0))}
              </span>
            )}
          </div>
          {loading ? (
            <div style={{ height: 220, background: C.gray50, borderRadius: 12 }} />
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incomeByDay} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.green500} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.green500} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans,sans-serif' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => v === 0 ? '0' : `S/.${v}`} tick={{ fontSize: 10, fill: C.gray400, fontFamily: 'DM Sans,sans-serif' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<IncomeTooltip />} cursor={{ stroke: C.green200, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="ingresos" stroke={C.green600} strokeWidth={2} fill="url(#fg)" dot={false} activeDot={{ r: 4, fill: C.green600, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ width: 20, height: 2, background: C.green600, borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: C.gray400 }}>Ingresos diarios de consultas completadas</span>
          </div>
        </div>

        {/* ── Comisiones por botica ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>
              🏪 Comisiones por botica — últimos 30 días
            </h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                {boticasData.length} botica{boticasData.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                {[
                  { label: 'Botica',            w: undefined },
                  { label: 'Ciudad',            w: 120       },
                  { label: 'Consultas ref.',    w: 110, right: true },
                  { label: 'Monto total',       w: 120, right: true },
                  { label: 'Comisión %',        w: 100, right: true },
                  { label: 'Comisión ganada',   w: 130, right: true },
                ].map(({ label, w, right }) => (
                  <th key={label} style={{
                    padding: '10px 14px', width: w, textAlign: right ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: C.gray500,
                    background: C.gray50, borderBottom: `1.5px solid ${C.gray200}`, whiteSpace: 'nowrap',
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}>
                    {[1,2,3,4,5,6].map(j => (
                      <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        {skeletonBar(j > 2 ? '60px' : '70%', 12)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : boticasData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                    🏪 Sin boticas con consultas referidas en los últimos 30 días
                  </td>
                </tr>
              ) : boticasData.map(b => (
                <tr key={b.id}>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.gray900, borderBottom: `1px solid ${C.gray100}` }}>
                    {b.nombre}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>
                    {b.ciudad}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray900, fontWeight: 600, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                    {b.consultas}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.gray800, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                    {fmtSoles(b.totalMonto)}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 8px', borderRadius: 20 }}>
                      {b.pct}%
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 900, color: C.green700, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                    {fmtSoles(b.comision)}
                  </td>
                </tr>
              ))}
              {!loading && boticasData.length > 0 && (
                <tr style={{ background: C.green50 }}>
                  <td colSpan={2} style={{ padding: '11px 14px', fontSize: 13, fontWeight: 800, color: C.green800, borderTop: `2px solid ${C.green200}` }}>
                    TOTAL
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 800, color: C.green800, textAlign: 'right', borderTop: `2px solid ${C.green200}` }}>
                    {boticasData.reduce((s, b) => s + b.consultas, 0)}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 800, color: C.green800, textAlign: 'right', borderTop: `2px solid ${C.green200}` }}>
                    {fmtSoles(boticasData.reduce((s, b) => s + b.totalMonto, 0))}
                  </td>
                  <td style={{ borderTop: `2px solid ${C.green200}` }} />
                  <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 900, color: C.green700, textAlign: 'right', borderTop: `2px solid ${C.green200}` }}>
                    {fmtSoles(boticasData.reduce((s, b) => s + b.comision, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  )
}
