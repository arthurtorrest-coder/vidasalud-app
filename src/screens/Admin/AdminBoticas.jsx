import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function AdminBoticas() {
  const navigate = useNavigate()

  const [boticas,      setBoticas]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filterCity,   setFilterCity]   = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expanded,     setExpanded]     = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))

    const { data, error } = await safe(supabase
      .from('farmacias')
      .select('id, nombre, codigo_digemid, ciudad, distrito, direccion, telefono, propietario_nombre, email, codigo_referido, aprobado, activo, comision_porcentaje, created_at')
      .eq('aprobado', true)
      .order('nombre', { ascending: true }))

    if (error) console.warn('[AdminBoticas] farmacias:', error.message)
    setBoticas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleToggleActivo(botica) {
    const newActivo = !botica.activo
    const { error } = await supabase
      .from('farmacias')
      .update({ activo: newActivo })
      .eq('id', botica.id)
    if (error) {
      toast.error('Error al cambiar estado de la botica')
      return
    }
    setBoticas(prev => prev.map(b => b.id === botica.id ? { ...b, activo: newActivo } : b))
    toast.success(`${botica.nombre} ${newActivo ? 'activada' : 'desactivada'}`)
  }

  const cities = [...new Set(boticas.map(b => b.ciudad).filter(Boolean))].sort()

  const filtered = boticas.filter(b => {
    if (filterCity   && b.ciudad !== filterCity) return false
    if (filterStatus === 'active'   && !b.activo) return false
    if (filterStatus === 'inactive' &&  b.activo) return false
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
            }}
          >
            ← Panel
          </button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>BOTICAS</span>
        </div>
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
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* Filtros */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>Filtrar:</div>

          <select
            value={filterCity}
            onChange={e => setFilterCity(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.gray200}`,
              fontSize: 13, color: C.gray900, background: C.white, cursor: 'pointer',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            <option value="">Todas las ciudades</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'all',      label: 'Todas'    },
              { id: 'active',   label: '● Activas'   },
              { id: 'inactive', label: '○ Inactivas' },
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
              {filtered.length} botica{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Lista de boticas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} style={{
                background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
                padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                display: 'flex', gap: 20,
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {skeletonBar('40%', 16)} {skeletonBar('65%', 12)} {skeletonBar('50%', 11)}
                </div>
                <div style={{ width: 80, height: 32, background: C.gray200, borderRadius: 8, alignSelf: 'center' }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{
              background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
              padding: '40px 20px', textAlign: 'center', color: C.gray400, fontSize: 13,
            }}>
              🏪 No hay boticas que coincidan con los filtros
            </div>
          ) : (
            filtered.map(botica => {
              const isExpanded = expanded === botica.id
              return (
                <div key={botica.id} style={{
                  background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
                }}>
                  {/* Fila principal */}
                  <div style={{
                    padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: C.white, fontWeight: 900, fontSize: 18,
                    }}>
                      💊
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.gray900 }}>
                        {botica.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: C.gray500, marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>📍 {botica.ciudad}{botica.distrito ? `, ${botica.distrito}` : ''}</span>
                        <span>🏷 DIGEMID: <strong style={{ color: C.gray700 }}>{botica.codigo_digemid ?? '—'}</strong></span>
                        <span>💰 Comisión: <strong style={{ color: C.green700 }}>{botica.comision_porcentaje ?? 5}%</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                        background: botica.activo ? C.green50 : C.gray100,
                        color:      botica.activo ? C.green700 : C.gray500,
                        border: `1px solid ${botica.activo ? C.green200 : C.gray200}`,
                      }}>
                        {botica.activo ? '● Activa' : '○ Inactiva'}
                      </span>

                      <button
                        onClick={() => handleToggleActivo(botica)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          border: `1px solid ${botica.activo ? C.red600 : C.green600}`,
                          background: C.white,
                          color: botica.activo ? C.red600 : C.green700,
                        }}
                      >
                        {botica.activo ? 'Desactivar' : 'Activar'}
                      </button>

                      <button
                        onClick={() => setExpanded(isExpanded ? null : botica.id)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          border: `1.5px solid ${C.gray200}`, background: C.gray50, color: C.gray600,
                        }}
                      >
                        {isExpanded ? '▲ Ocultar' : '▼ Detalles'}
                      </button>
                    </div>
                  </div>

                  {/* Detalles expandidos */}
                  {isExpanded && (
                    <div style={{
                      borderTop: `1px solid ${C.gray100}`, padding: '14px 20px',
                      background: C.gray50,
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
                    }}>
                      {[
                        ['Propietario',      botica.propietario_nombre ?? '—'],
                        ['Email',            botica.email              ?? '—'],
                        ['Teléfono',         botica.telefono           ?? '—'],
                        ['Dirección',        botica.direccion          ?? '—'],
                        ['Código referido',  botica.codigo_referido    ?? '—'],
                        ['Registrado',       fmtDate(botica.created_at)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 }}>
                            {label}
                          </div>
                          <div style={{ fontSize: 13, color: C.gray900, fontWeight: 600, wordBreak: 'break-all' }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
