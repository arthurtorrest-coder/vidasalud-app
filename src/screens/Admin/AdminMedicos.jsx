import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    borderBottom: `1px solid ${C.gray100}`, verticalAlign: 'middle',
  }}>
    {children}
  </td>
)

function StarRating({ rating }) {
  const n = Number(rating) || 0
  return <span style={{ color: C.amber, fontWeight: 700, fontSize: 13 }}>★ {n.toFixed(1)}</span>
}

export default function AdminMedicos() {
  const navigate = useNavigate()

  const [doctors,        setDoctors]        = useState([])
  const [pendingTarifas, setPendingTarifas] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filterSpec,     setFilterSpec]     = useState('')
  const [filterStatus,   setFilterStatus]   = useState('all')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))

    const [docRes, tarifasRes] = await Promise.all([
      safe(supabase
        .from('doctors')
        .select('id, nombres, apellidos, especialidad, cmp, precio, rating, total_reviews, activo, aprobado, foto_url')
        .eq('aprobado', true)
        .order('rating', { ascending: false })),
      safe(supabase
        .from('doctors')
        .select('id, nombres, apellidos, especialidad, cmp, precio, precio_propuesto')
        .eq('precio_pendiente_aprobacion', true)
        .order('nombres', { ascending: true })),
    ])

    if (docRes.error)     console.warn('[AdminMedicos] doctors:', docRes.error.message)
    if (tarifasRes.error) console.warn('[AdminMedicos] tarifas:', tarifasRes.error.message)

    setDoctors((docRes.data ?? []).map(d => ({
      ...d,
      full_name: [d.nombres, d.apellidos].filter(Boolean).join(' ') || 'Médico',
    })))
    setPendingTarifas((tarifasRes.data ?? []).map(d => ({
      ...d,
      full_name: [d.nombres, d.apellidos].filter(Boolean).join(' ') || 'Médico',
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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

  const specialties = [...new Set(doctors.map(d => d.especialidad).filter(Boolean))].sort()

  const filtered = doctors.filter(d => {
    if (filterSpec && d.especialidad !== filterSpec) return false
    if (filterStatus === 'active'   && d.activo === false) return false
    if (filterStatus === 'inactive' && d.activo !== false) return false
    return true
  })

  const skeletonBar = (w = '60%', h = 13) => (
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

      {/* Header */}
      <header style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/admin/panel')}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: C.white, borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ← Panel
          </button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>MÉDICOS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: C.white, borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
            }}
          >
            ↻ Actualizar
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* Tarifas pendientes */}
        {(loading || pendingTarifas.length > 0) && (
          <div style={{
            background: C.white, borderRadius: 16, border: `1.5px solid ${C.blue600}`,
            padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
                      {skeletonBar('40%', 13)} {skeletonBar('60%', 11)}
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
                    <TH>Médico</TH><TH>Especialidad</TH>
                    <TH right>Tarifa actual</TH><TH right>Tarifa propuesta</TH><TH right>Acción</TH>
                  </tr>
                </thead>
                <tbody>
                  {pendingTarifas.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>Sin tarifas pendientes</td></tr>
                  ) : pendingTarifas.map(doc => (
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
                          <span style={{ fontWeight: 700, fontSize: 13, color: C.gray900 }}>{doc.full_name}</span>
                        </div>
                      </TD>
                      <TD muted>{doc.especialidad ?? '—'}</TD>
                      <TD right><span style={{ color: C.gray500, fontWeight: 600 }}>{doc.precio ? `S/. ${doc.precio}` : '—'}</span></TD>
                      <TD right>
                        <span style={{ fontWeight: 800, color: C.blue600, background: C.blueBg, padding: '3px 10px', borderRadius: 20, fontSize: 13 }}>
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
                              color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >✓ Aprobar</button>
                          <button
                            onClick={() => handleRejectTarifa(doc)}
                            style={{
                              padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.red600}`,
                              background: C.white, color: C.red600, fontSize: 12, fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >✗ Rechazar</button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Filtros */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>Filtrar:</div>

          <select
            value={filterSpec}
            onChange={e => setFilterSpec(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.gray200}`,
              fontSize: 13, color: C.gray900, background: C.white, cursor: 'pointer',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            <option value="">Todas las especialidades</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'all',      label: 'Todos'    },
              { id: 'active',   label: '● Activos'   },
              { id: 'inactive', label: '○ Inactivos' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterStatus(id)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: filterStatus === id ? C.green700 : C.gray100,
                  color:      filterStatus === id ? C.white    : C.gray500,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {!loading && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gray500, fontWeight: 600 }}>
              {filtered.length} médico{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Lista de médicos */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>Médicos registrados</h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                {filtered.length}
              </span>
            )}
          </div>
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
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6, 7].map(j => (
                      <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        {skeletonBar(j > 3 ? '50px' : '75%', 12)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                    No hay médicos que coincidan con los filtros
                  </td>
                </tr>
              ) : filtered.map((doc, i) => {
                const isCPsP   = doc.cmp?.startsWith('CPsP')
                const isActive = doc.activo !== false
                return (
                  <tr key={doc.id ?? i}>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {doc.foto_url ? (
                          <img src={doc.foto_url} alt={doc.full_name}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: C.white, fontWeight: 800, fontSize: 13,
                          }}>
                            {(doc.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.gray900 }}>
                          {isCPsP ? 'Psic.' : 'Dr(a).'} {doc.full_name}
                        </div>
                      </div>
                    </TD>
                    <TD muted>{doc.especialidad ?? '—'}</TD>
                    <TD muted>{doc.cmp ?? '—'}</TD>
                    <TD right><StarRating rating={doc.rating ?? 0} /></TD>
                    <TD right muted>{(doc.total_reviews ?? 0).toLocaleString('es-PE')}</TD>
                    <TD right>
                      {doc.precio
                        ? <span style={{ fontWeight: 700, color: C.green700 }}>S/. {doc.precio}</span>
                        : <span style={{ color: C.gray400 }}>—</span>}
                    </TD>
                    <TD>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: isActive ? C.green50 : C.gray100,
                        color:      isActive ? C.green700 : C.gray500,
                      }}>
                        {isActive ? '● Activo' : '○ Inactivo'}
                      </span>
                    </TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
