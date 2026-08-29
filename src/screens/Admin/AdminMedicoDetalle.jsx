import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'
import { TARIFA_GENERAL, esGeneralista } from '../../lib/finanzas'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────
const MESES_ABR  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric',
  })
}

function getMesRango(m, y) {
  return {
    inicio: new Date(Date.UTC(y, m,     1,  5,  0,  0)).toISOString(),
    fin:    new Date(Date.UTC(y, m + 1, 1,  4, 59, 59)).toISOString(),
  }
}

function getIniciales(doc) {
  return ((doc?.nombres?.[0] ?? '') + (doc?.apellidos?.[0] ?? '')).toUpperCase() || '?'
}

function tituloDoc(doc) {
  if ((doc?.cmp ?? '').startsWith('CPsP')) return 'Psic.'
  return (doc?.nombres ?? '').trimEnd().endsWith('a') ? 'Dra.' : 'Dr.'
}

// ── Sub-componentes de tabla ─────────────────────────────────────
const TH = ({ children, right }) => (
  <th style={{
    padding: '10px 14px', textAlign: right ? 'right' : 'left',
    fontSize: 11, fontWeight: 700, color: C.gray500,
    background: C.gray50, borderBottom: `1.5px solid ${C.gray200}`, whiteSpace: 'nowrap',
  }}>{children}</th>
)
const TD = ({ children, right, muted }) => (
  <td style={{
    padding: '11px 14px', textAlign: right ? 'right' : 'left',
    fontSize: 13, color: muted ? C.gray500 : C.gray900,
    borderBottom: `1px solid ${C.gray100}`, verticalAlign: 'middle',
  }}>{children}</td>
)

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
          <div style={{ height: 12, width: j > 1 ? 64 : '70%', background: C.gray200, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )
}

// ── Pantalla principal ─────────────────────────────────────────────
export default function AdminMedicoDetalle() {
  const { doctorId } = useParams()
  const navigate     = useNavigate()

  const limaAhora = useMemo(() => new Date(Date.now() - 5 * 3_600_000), [])

  const [doctor,    setDoctor]    = useState(null)
  const [consultas, setConsultas] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [mes,       setMes]       = useState(() => limaAhora.getUTCMonth())
  const [anio,      setAnio]      = useState(() => limaAhora.getUTCFullYear())

  // Datos del médico
  useEffect(() => {
    supabase
      .from('doctors')
      .select('id, nombres, apellidos, especialidad, cmp, precio, rating, total_reviews, activo, foto_url')
      .eq('id', doctorId)
      .single()
      .then(({ data }) => setDoctor(data ?? null))
  }, [doctorId])

  // Consultas del mes seleccionado
  const fetchConsultas = useCallback(async () => {
    setLoading(true)
    const { inicio, fin } = getMesRango(mes, anio)
    const { data } = await supabase
      .from('appointments')
      .select('id, scheduled_at, precio_total, patient:profiles!patient_id(full_name)')
      .eq('doctor_id', doctorId)
      .eq('status', 'done')
      .gte('scheduled_at', inicio)
      .lte('scheduled_at', fin)
      .order('scheduled_at', { ascending: false })
    setConsultas(data ?? [])
    setLoading(false)
  }, [doctorId, mes, anio])

  useEffect(() => { fetchConsultas() }, [fetchConsultas])

  // Gráfico últimos 6 meses
  useEffect(() => {
    const curM = limaAhora.getUTCMonth()
    const curY = limaAhora.getUTCFullYear()

    const meses6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(curY, curM - (5 - i), 1, 12))
      return { m: d.getUTCMonth(), y: d.getUTCFullYear(), label: MESES_ABR[d.getUTCMonth()] }
    })

    const { inicio } = getMesRango(meses6[0].m, meses6[0].y)
    const { fin }    = getMesRango(meses6[5].m, meses6[5].y)

    supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('doctor_id', doctorId)
      .eq('status', 'done')
      .gte('scheduled_at', inicio)
      .lte('scheduled_at', fin)
      .then(({ data }) => {
        const byMonth = {}
        for (const a of (data ?? [])) {
          const d   = new Date(new Date(a.scheduled_at).getTime() - 5 * 3_600_000)
          const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
          byMonth[key] = (byMonth[key] ?? 0) + 1
        }
        setChartData(meses6.map(({ m, y, label }) => ({
          mes:      label,
          consultas: byMonth[`${y}-${m}`] ?? 0,
        })))
      })
  }, [doctorId, limaAhora])

  // ── Cálculos financieros ─────────────────────────────────────────
  const esGeneral = esGeneralista(doctor?.especialidad)

  function montoXConsulta(appt) {
    if (esGeneral) return TARIFA_GENERAL
    return Number(appt.precio_total) || Number(doctor?.precio) || 0
  }

  const totalConsultas = consultas.length
  const totalMonto     = consultas.reduce((s, a) => s + montoXConsulta(a), 0)

  const aniosDisponibles = [limaAhora.getUTCFullYear(), limaAhora.getUTCFullYear() - 1]

  const nombreCompleto = doctor
    ? `${tituloDoc(doctor)} ${[doctor.nombres, doctor.apellidos].filter(Boolean).join(' ')}`
    : ''

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        table { border-collapse: collapse; width: 100%; }
        tbody tr:hover td { background: ${C.green50} !important; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button
          onClick={() => navigate('/admin/medicos')}
          style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: C.white, borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >← Médicos</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: C.green400,
          background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
        }}>DETALLE MÉDICO</span>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Card del médico ── */}
        <div style={{
          background: C.white, borderRadius: 20, border: `1.5px solid ${C.gray200}`,
          padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 22,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          {doctor?.foto_url ? (
            <img src={doctor.foto_url} alt={doctor.nombres}
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontWeight: 900, fontSize: 26,
            }}>
              {doctor ? getIniciales(doctor) : '…'}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.gray900, lineHeight: 1.2 }}>
              {doctor ? nombreCompleto : <span style={{ color: C.gray300 }}>Cargando…</span>}
            </div>
            <div style={{ fontSize: 13, color: C.gray500, marginTop: 5, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {doctor?.especialidad && <span>🩺 {doctor.especialidad}</span>}
              {doctor?.cmp         && <span>📋 {doctor.cmp}</span>}
              {doctor?.precio != null && (
                <span>💰 Tarifa en sistema:
                  <strong style={{ color: C.green700, marginLeft: 4 }}>S/. {doctor.precio}</strong>
                </span>
              )}
            </div>
            {/* Badge de modelo financiero */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: esGeneral ? '#EFF6FF' : C.green50,
                color:      esGeneral ? '#1D4ED8' : C.green700,
                border: `1px solid ${esGeneral ? '#BFDBFE' : C.green200}`,
              }}>
                {esGeneral
                  ? `Medicina General · recibe S/. ${TARIFA_GENERAL} fijo`
                  : `Especialista · recibe su precio neto`}
              </span>
            </div>
            {Number(doctor?.rating) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ color: C.amber, fontSize: 15 }}>★</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>{Number(doctor.rating).toFixed(1)}</span>
                <span style={{ fontSize: 12, color: C.gray400 }}>({doctor.total_reviews} reseñas)</span>
              </div>
            )}
          </div>

          <span style={{
            fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 20, flexShrink: 0,
            background: doctor?.activo !== false ? C.green50  : C.gray100,
            color:      doctor?.activo !== false ? C.green700 : C.gray500,
            border: `1px solid ${doctor?.activo !== false ? C.green200 : C.gray200}`,
          }}>
            {doctor?.activo !== false ? '● Activo' : '○ Inactivo'}
          </span>
        </div>

        {/* ── Selector de período + KPIs ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>Período:</span>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              style={{
                padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.gray200}`,
                fontSize: 13, color: C.gray900, background: C.white,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              }}
            >
              {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              style={{
                padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.gray200}`,
                fontSize: 13, color: C.gray900, background: C.white,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              }}
            >
              {aniosDisponibles.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 32 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: C.gray900, lineHeight: 1 }}>
                {loading ? '…' : totalConsultas}
              </div>
              <div style={{ fontSize: 11, color: C.gray400, fontWeight: 600, marginTop: 4 }}>
                Consultas completadas
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: C.green700, lineHeight: 1 }}>
                {loading ? '…' : fmtSoles(totalMonto)}
              </div>
              <div style={{ fontSize: 11, color: C.gray400, fontWeight: 600, marginTop: 4 }}>
                A pagar al médico
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabla de consultas ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: C.gray900, margin: 0 }}>
              Consultas — {MESES_FULL[mes]} {anio}
            </h2>
            {!loading && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.green700,
                background: C.green50, padding: '3px 10px', borderRadius: 20,
                border: `1px solid ${C.green200}`,
              }}>
                {totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <table>
            <thead>
              <tr>
                <TH>Fecha</TH>
                <TH>Paciente</TH>
                <TH right>Precio consulta</TH>
                <TH right>Al médico</TH>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [1,2,3].map(i => <SkeletonRow key={i} cols={4} />)
                : consultas.length === 0
                  ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                        Sin consultas completadas en {MESES_FULL[mes]} {anio}
                      </td>
                    </tr>
                  )
                  : consultas.map(a => (
                    <tr key={a.id}>
                      <TD muted>{fmtFecha(a.scheduled_at)}</TD>
                      <TD>{a.patient?.full_name ?? '—'}</TD>
                      <TD right muted>
                        {a.precio_total ? fmtSoles(a.precio_total) : <span style={{ color: C.gray300 }}>—</span>}
                      </TD>
                      <TD right>
                        <span style={{
                          fontSize: 12, fontWeight: 800, color: C.green700,
                          background: C.green50, padding: '3px 9px', borderRadius: 20,
                          border: `1px solid ${C.green200}`,
                        }}>
                          {fmtSoles(montoXConsulta(a))}
                        </span>
                      </TD>
                    </tr>
                  ))
              }
            </tbody>
            {!loading && totalConsultas > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={{
                    padding: '13px 14px', borderTop: `2px solid ${C.gray200}`,
                    background: C.gray50, fontSize: 12, fontWeight: 700,
                    color: C.gray600, textAlign: 'right',
                  }}>
                    Total a pagar — {totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''}:
                  </td>
                  <td style={{ padding: '13px 14px', borderTop: `2px solid ${C.gray200}`, background: C.gray50, textAlign: 'right' }}>
                    <span style={{
                      fontSize: 15, fontWeight: 900, color: C.green700,
                      background: C.green50, padding: '4px 12px', borderRadius: 20,
                      border: `1.5px solid ${C.green300}`,
                    }}>
                      {fmtSoles(totalMonto)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Gráfico últimos 6 meses ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: '20px 24px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: C.gray900, marginBottom: 18 }}>
            Evolución — últimos 6 meses
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={30} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: C.gray500, fontFamily: 'inherit' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: C.gray400 }}
                axisLine={false} tickLine={false}
              />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const n = payload[0].value
                  return (
                    <div style={{
                      background: C.green800, color: C.white,
                      padding: '7px 12px', borderRadius: 8,
                      fontSize: 11, fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}>
                      <div style={{ marginBottom: 2 }}>{label}</div>
                      <div>{n} consulta{n !== 1 ? 's' : ''}</div>
                    </div>
                  )
                }}
                cursor={{ fill: C.green50 }}
              />
              <Bar dataKey="consultas" fill={C.green500} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </main>
    </div>
  )
}
