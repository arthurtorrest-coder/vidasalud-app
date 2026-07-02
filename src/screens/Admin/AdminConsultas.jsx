import React from 'react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

// ─── Config ───────────────────────────────────────────────────

const PAGE_SIZE = 20

const STATUS_CFG = {
  pending:   { label: 'Pend. pago',  bg: C.amberBg, color: C.amberText },
  paid:      { label: 'Confirmada',  bg: C.green50,  color: C.green700  },
  active:    { label: 'En consulta', bg: C.blueBg,   color: C.blueText  },
  done:      { label: 'Completada',  bg: C.gray100,  color: C.gray500   },
  cancelled: { label: 'Cancelada',   bg: C.redBg,    color: C.red600    },
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtDT(iso) {
  return new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

// ─── Sub-componentes ──────────────────────────────────────────

function FilterInput({ placeholder, value, onChange, type = 'text', style = {} }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
        border: `1.5px solid ${C.gray200}`, color: C.gray900, background: C.white,
        outline: 'none', ...style,
      }}
      onFocus={e  => { e.target.style.borderColor = C.green500 }}
      onBlur={e   => { e.target.style.borderColor = C.gray200  }}
    />
  )
}

function SelectFilter({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
        border: `1.5px solid ${C.gray200}`, color: C.gray900, background: C.white,
        outline: 'none', cursor: 'pointer', ...style,
      }}
    >
      {children}
    </select>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: C.gray100, color: C.gray500 }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function AdminConsultas() {
  const navigate = useNavigate()

  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSpec,   setFilterSpec]   = useState('')
  const [filterFrom,   setFilterFrom]   = useState(isoDate(-30))
  const [filterTo,     setFilterTo]     = useState(isoDate(0))
  const [page,         setPage]         = useState(0)
  const [expanded,     setExpanded]     = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))

    let query = supabase
      .from('appointments')
      .select(`
        id, scheduled_at, status, duration_minutes, precio_total,
        chief_complaint, notes_doctor,
        patient:profiles!patient_id ( full_name, dni ),
        doctor:doctors!doctor_id    ( nombres, apellidos, especialidad, cmp ),
        prescriptions               ( id, pdf_url, diagnosis )
      `)
      .order('scheduled_at', { ascending: false })
      .limit(500)

    if (filterFrom) query = query.gte('scheduled_at', `${filterFrom}T00:00:00-05:00`)
    if (filterTo)   query = query.lte('scheduled_at', `${filterTo}T23:59:59-05:00`)
    if (filterStatus) query = query.eq('status', filterStatus)

    const { data, error } = await safe(query)
    if (error) console.warn('[AdminConsultas]', error.message)
    setAppointments(data ?? [])
    setPage(0)
    setLoading(false)
  }, [filterFrom, filterTo, filterStatus])

  useEffect(() => { fetchAll() }, [fetchAll])

  const specialties = useMemo(
    () => [...new Set(appointments.map(a => a.doctor?.especialidad).filter(Boolean))].sort(),
    [appointments]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return appointments.filter(a => {
      if (filterSpec) {
        if (!(a.doctor?.especialidad ?? '').toLowerCase().includes(filterSpec.toLowerCase())) return false
      }
      if (q) {
        const pName = (a.patient?.full_name ?? '').toLowerCase()
        const pDni  = (a.patient?.dni  ?? '').toLowerCase()
        const dName = `${a.doctor?.nombres ?? ''} ${a.doctor?.apellidos ?? ''}`.toLowerCase()
        if (!pName.includes(q) && !dName.includes(q) && !pDni.includes(q)) return false
      }
      return true
    })
  }, [appointments, search, filterSpec])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function resetFilters() {
    setSearch('')
    setFilterStatus('')
    setFilterSpec('')
    setFilterFrom(isoDate(-30))
    setFilterTo(isoDate(0))
  }

  const skRow = (
    <tr>
      {[1,2,3,4,5,6,7,8].map(j => (
        <td key={j} style={{ padding: '12px 12px', borderBottom: `1px solid ${C.gray100}` }}>
          <div style={{ height: 12, width: j === 1 ? 110 : j >= 5 ? 55 : '75%', background: C.gray200, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        table { border-collapse: collapse; width: 100%; }
        tr.appt-row:hover td { background: ${C.green50} !important; cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

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
          }}>CONSULTAS</span>
        </div>
        <button onClick={fetchAll} disabled={loading} style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: C.white, borderRadius: 8, padding: '6px 14px',
          fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
        }}>↻ Actualizar</button>
      </header>

      <main style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 24px 48px' }}>

        {/* ── Filtros ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: '16px 20px', marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        }}>
          <FilterInput
            placeholder="Buscar paciente, DNI o médico…"
            value={search}
            onChange={v => { setSearch(v); setPage(0) }}
            style={{ minWidth: 240, flex: 1 }}
          />

          <SelectFilter value={filterStatus} onChange={v => { setFilterStatus(v); setPage(0) }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </SelectFilter>

          <SelectFilter value={filterSpec} onChange={v => { setFilterSpec(v); setPage(0) }}>
            <option value="">Todas las especialidades</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectFilter>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.gray500, fontWeight: 600 }}>Desde</span>
            <FilterInput type="date" value={filterFrom} onChange={setFilterFrom} />
            <span style={{ fontSize: 12, color: C.gray500, fontWeight: 600 }}>Hasta</span>
            <FilterInput type="date" value={filterTo} onChange={setFilterTo} />
          </div>

          <button onClick={resetFilters} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${C.gray200}`, background: C.gray50, color: C.gray600,
          }}>Limpiar</button>

          {!loading && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gray500, fontWeight: 600 }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Tabla ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {[
                    { label: 'Fecha / Hora',   w: 140 },
                    { label: 'Paciente',        w: 160 },
                    { label: 'Médico',          w: 160 },
                    { label: 'Especialidad',    w: 130 },
                    { label: 'Dur.',            w: 55,  right: true },
                    { label: 'Estado',          w: 110 },
                    { label: 'Precio',          w: 90,  right: true },
                    { label: '',                w: 90 },
                  ].map(({ label, w, right }) => (
                    <th key={label} style={{
                      padding: '11px 12px', width: w, minWidth: w,
                      textAlign: right ? 'right' : 'left',
                      fontSize: 11, fontWeight: 700, color: C.gray500,
                      background: C.gray50, borderBottom: `1.5px solid ${C.gray200}`,
                      whiteSpace: 'nowrap',
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => <React.Fragment key={i}>{skRow}</React.Fragment>)
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                    No hay consultas que coincidan con los filtros
                  </td></tr>
                ) : paginated.map(a => {
                  const presc    = a.prescriptions?.[0] ?? null
                  const isOpen   = expanded === a.id
                  const dName    = a.doctor  ? `${a.doctor.nombres ?? ''} ${a.doctor.apellidos ?? ''}`.trim() || '—' : '—'
                  const isCPsP   = (a.doctor?.cmp ?? '').startsWith('CPsP')
                  const titulo   = isCPsP ? 'Psic.' : 'Dr(a).'
                  const hasDetail = a.chief_complaint || a.notes_doctor || presc

                  return (
                    <>
                      <tr
                        key={a.id}
                        className="appt-row"
                        onClick={() => hasDetail && setExpanded(isOpen ? null : a.id)}
                      >
                        <td style={{ padding: '11px 12px', fontSize: 12, color: C.gray500, borderBottom: `1px solid ${C.gray100}`, whiteSpace: 'nowrap' }}>
                          {fmtDT(a.scheduled_at)}
                        </td>
                        <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.gray100}` }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.gray900 }}>
                            {a.patient?.full_name ?? <span style={{ color: C.gray400, fontStyle: 'italic' }}>Sin nombre</span>}
                          </div>
                          {a.patient?.dni && (
                            <div style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>DNI: {a.patient.dni}</div>
                          )}
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 13, color: C.gray700, borderBottom: `1px solid ${C.gray100}` }}>
                          {titulo} {dName}
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 12, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>
                          {a.doctor?.especialidad ?? '—'}
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 12, color: C.gray500, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                          {a.duration_minutes ?? 20} min
                        </td>
                        <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.gray100}` }}>
                          <StatusBadge status={a.status} />
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 700, color: C.green700, borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                          {a.precio_total ? fmtSoles(a.precio_total) : <span style={{ color: C.gray400, fontWeight: 400 }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.gray100}`, textAlign: 'right' }}>
                          {hasDetail && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpanded(isOpen ? null : a.id) }}
                              style={{
                                padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit',
                                border: `1.5px solid ${isOpen ? C.green500 : C.gray200}`,
                                background: isOpen ? C.green50 : C.white,
                                color: isOpen ? C.green700 : C.gray500,
                              }}
                            >
                              {isOpen ? '▲ Ocultar' : '▼ Ver detalle'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* ── Detalle expandido ── */}
                      {isOpen && (
                        <tr key={`${a.id}-detail`}>
                          <td colSpan={8} style={{
                            padding: '0', borderBottom: `1px solid ${C.gray200}`,
                            background: C.gray50,
                          }}>
                            <div style={{
                              padding: '16px 20px',
                              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
                            }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                                  Motivo de consulta
                                </div>
                                <div style={{ fontSize: 13, color: C.gray700, lineHeight: 1.5 }}>
                                  {a.chief_complaint || <span style={{ color: C.gray400, fontStyle: 'italic' }}>No registrado</span>}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                                  Notas del médico (SOAP)
                                </div>
                                <div style={{ fontSize: 13, color: C.gray700, lineHeight: 1.5 }}>
                                  {a.notes_doctor || <span style={{ color: C.gray400, fontStyle: 'italic' }}>No registrado</span>}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                                  Diagnóstico / Receta
                                </div>
                                {presc ? (
                                  <>
                                    <div style={{ fontSize: 13, color: C.gray700, lineHeight: 1.5, marginBottom: 10 }}>
                                      {presc.diagnosis || <span style={{ color: C.gray400, fontStyle: 'italic' }}>Sin diagnóstico</span>}
                                    </div>
                                    {presc.pdf_url && (
                                      <a
                                        href={presc.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 6,
                                          padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
                                          background: C.green50, border: `1.5px solid ${C.green200}`,
                                          color: C.green700, fontSize: 12, fontWeight: 700,
                                        }}
                                      >
                                        📄 Descargar receta
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: C.gray400, fontStyle: 'italic', fontSize: 13 }}>Sin receta</span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Paginación ── */}
          {!loading && filtered.length > PAGE_SIZE && (
            <div style={{
              padding: '14px 20px', borderTop: `1px solid ${C.gray100}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${C.gray200}`, background: C.white,
                  color: page === 0 ? C.gray300 : C.gray700,
                }}
              >← Anterior</button>

              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i
                    : page < 4 ? i
                    : page > totalPages - 5 ? totalPages - 7 + i
                    : page - 3 + i
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        width: 32, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                        background: page === p ? C.green700 : C.gray100,
                        color: page === p ? C.white : C.gray600,
                      }}
                    >{p + 1}</button>
                  )
                })}
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${C.gray200}`, background: C.white,
                  color: page >= totalPages - 1 ? C.gray300 : C.gray700,
                }}
              >Siguiente →</button>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
