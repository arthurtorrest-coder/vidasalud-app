import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C, R, S } from '../../lib/tokens'

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function estadoDisplay(plan) {
  if (!plan) return 'pendiente'
  if (plan.estado === 'activo' && plan.fecha_fin_contrato && new Date(plan.fecha_fin_contrato) < new Date()) {
    return 'vencido'
  }
  return plan.estado
}

const ESTADO_CFG = {
  activo:    { label: '● Activo',    bg: C.green50,  color: C.green700  },
  pendiente: { label: '⏳ Pendiente', bg: C.amberBg,  color: C.amberText },
  vencido:   { label: '✗ Vencido',   bg: C.redBg,    color: C.red600    },
  inactivo:  { label: '○ Inactivo',  bg: C.gray100,  color: C.gray500   },
}

const TIPO_CFG = {
  empresa: { label: '🏢 Empresa', bg: C.blueBg,  color: C.blueText },
  mineria: { label: '⛏️ Minería', bg: C.gray100, color: C.gray700  },
}

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

function StatCard({ icon, label, value, accent = C.green700 }) {
  return (
    <div style={{
      background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: S.sm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
    </div>
  )
}

function inputStyle() {
  return {
    width: '100%', padding: '9px 11px', borderRadius: R.input,
    border: `1.5px solid ${C.gray300}`, fontSize: 13, color: C.gray900,
    background: C.white, outline: 'none', fontFamily: 'inherit',
  }
}

const FILA_VACIA = () => ({ nombre: '', dni: '', email: '' })

// ── Modal: Agregar trabajadores ───────────────────────────────
function AgregarTrabajadoresModal({ planId, onClose, onDone }) {
  const [filas, setFilas]   = useState([FILA_VACIA()])
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState(null) // null hasta que se envía

  function setFila(i, field, value) {
    setFilas(fs => fs.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }
  function addFila() {
    setFilas(fs => [...fs, FILA_VACIA()])
  }
  function removeFila(i) {
    setFilas(fs => fs.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validas = filas.filter(f => f.nombre.trim() && f.dni.trim())
    if (validas.length === 0) {
      toast.error('Agrega al menos un trabajador con nombre y DNI')
      return
    }
    setEnviando(true)
    const salida = []
    for (const f of validas) {
      const { data, error } = await supabase.functions.invoke('crear-trabajador-corporativo', {
        body: { nombre: f.nombre.trim(), dni: f.dni.trim(), email: f.email.trim(), plan_id: planId, rol: 'trabajador' },
      })
      if (error || !data?.ok) {
        salida.push({ nombre: f.nombre, ok: false, error: data?.error ?? error?.message ?? 'Error desconocido' })
      } else {
        salida.push({ nombre: f.nombre, ok: true, email: data.email, temp_password: data.temp_password })
      }
    }
    setEnviando(false)
    setResultados(salida)
    if (salida.some(r => r.ok)) onDone()
  }

  return (
    <div
      onClick={enviando ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(17,24,39,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
          background: C.white, borderRadius: R.modal, boxShadow: S.lg,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{
          background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
          padding: '20px 24px', borderRadius: `${R.modal}px ${R.modal}px 0 0`,
        }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.white }}>Agregar trabajadores</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Se crea una cuenta VIDASALUD para cada trabajador
          </div>
        </div>

        {resultados ? (
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.gray900 }}>Resultado</div>
            {resultados.map((r, i) => (
              <div key={i} style={{
                border: `1.5px solid ${r.ok ? C.green200 : C.red600}`,
                background: r.ok ? C.green50 : C.redBg,
                borderRadius: 12, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.gray900 }}>
                  {r.ok ? '✅' : '✗'} {r.nombre}
                </div>
                {r.ok ? (
                  <div style={{ fontSize: 12, color: C.gray700, marginTop: 4, lineHeight: 1.6 }}>
                    Usuario: <strong>{r.email}</strong><br />
                    Contraseña temporal: <strong style={{ fontFamily: 'monospace' }}>{r.temp_password}</strong>
                    <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
                      Compártela con el trabajador — no volverá a mostrarse.
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.red600, marginTop: 4 }}>{r.error}</div>
                )}
              </div>
            ))}
            <button onClick={onClose} style={{
              marginTop: 4, padding: '12px 0', borderRadius: R.button, cursor: 'pointer',
              border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
              color: C.white, fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
            }}>
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filas.map((f, i) => (
              <div key={i} style={{
                border: `1.5px solid ${C.gray200}`, borderRadius: 12, padding: 14,
                display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
              }}>
                {filas.length > 1 && (
                  <button type="button" onClick={() => removeFila(i)} style={{
                    position: 'absolute', top: 8, right: 8, width: 22, height: 22,
                    border: 'none', borderRadius: '50%', background: C.gray100, color: C.gray500,
                    cursor: 'pointer', fontSize: 13, lineHeight: 1,
                  }}>✕</button>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input required placeholder="Nombre completo" value={f.nombre}
                    onChange={e => setFila(i, 'nombre', e.target.value)} style={inputStyle()} />
                  <input required placeholder="DNI" value={f.dni}
                    onChange={e => setFila(i, 'dni', e.target.value)} style={inputStyle()} />
                </div>
                <input type="email" placeholder="Email (opcional)" value={f.email}
                  onChange={e => setFila(i, 'email', e.target.value)} style={inputStyle()} />
              </div>
            ))}

            <button type="button" onClick={addFila} style={{
              padding: '10px 0', borderRadius: R.button, cursor: 'pointer',
              border: `1.5px dashed ${C.gray300}`, background: C.white, color: C.gray600,
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            }}>
              + Agregar otra fila
            </button>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={onClose} disabled={enviando} style={{
                flex: 1, padding: '12px 0', borderRadius: R.button, cursor: 'pointer',
                border: `1.5px solid ${C.gray300}`, background: C.white, color: C.gray700,
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando} style={{
                flex: 1, padding: '12px 0', borderRadius: R.button, cursor: enviando ? 'default' : 'pointer',
                border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                color: C.white, fontSize: 13, fontWeight: 800, fontFamily: 'inherit', opacity: enviando ? 0.7 : 1,
              }}>
                {enviando ? 'Creando cuentas…' : 'Crear cuentas'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Pantalla principal ──────────────────────────────────────────
export default function AdminEmpresaDetalle() {
  const { planId } = useParams()
  const navigate    = useNavigate()

  const [plan,         setPlan]         = useState(null)
  const [trabajadores, setTrabajadores] = useState([])
  const [loading,       setLoading]     = useState(true)
  const [modalOpen,     setModalOpen]   = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [planRes, trabRes] = await Promise.all([
      supabase.from('planes_corporativos').select('*').eq('id', planId).single(),
      supabase
        .from('usuarios_corporativos')
        .select('id, rol, activo, email, consultas_usadas_mes, consultas_disponibles_mes, created_at, profile:profiles!profile_id(full_name, dni)')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false }),
    ])
    if (planRes.error) console.warn('[AdminEmpresaDetalle] plan:', planRes.error.message)
    if (trabRes.error) console.warn('[AdminEmpresaDetalle] trabajadores:', trabRes.error.message)
    setPlan(planRes.data ?? null)
    setTrabajadores(trabRes.data ?? [])
    setLoading(false)
  }, [planId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const resumen = useMemo(() => ({
    total:      trabajadores.length,
    usadas:     trabajadores.reduce((s, t) => s + (t.consultas_usadas_mes ?? 0), 0),
    disponibles: trabajadores.reduce((s, t) => s + (t.consultas_disponibles_mes ?? 0), 0),
  }), [trabajadores])

  const skeletonBar = (w = '60%', h = 13) => (
    <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
  )

  const tipoCfg   = TIPO_CFG[plan?.tipo] ?? TIPO_CFG.empresa
  const estadoCfg = ESTADO_CFG[estadoDisplay(plan)] ?? ESTADO_CFG.pendiente

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
            onClick={() => navigate('/admin/empresas')}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: C.white, borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← Volver
          </button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>EMPRESAS</span>
        </div>
        <button onClick={fetchAll} disabled={loading} style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: C.white, borderRadius: 8, padding: '6px 14px',
          fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
        }}>
          ↻ Actualizar
        </button>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* Header del contrato */}
        <div style={{
          background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`,
          padding: '22px 24px', marginBottom: 20, boxShadow: S.sm,
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skeletonBar('40%', 22)} {skeletonBar('60%', 13)}
            </div>
          ) : !plan ? (
            <div style={{ color: C.gray400, fontSize: 13 }}>No se encontró la empresa.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.white, fontWeight: 800, fontSize: 18,
                }}>
                  {(plan.nombre ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: C.gray900 }}>{plan.nombre}</div>
                  <div style={{ fontSize: 12, color: C.gray500 }}>RUC: {plan.ruc_empresa ?? '—'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: tipoCfg.bg, color: tipoCfg.color }}>
                  {tipoCfg.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color }}>
                  {estadoCfg.label}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.gray500 }}>
                Contrato: {fmtFecha(plan.fecha_inicio)} → {fmtFecha(plan.fecha_fin_contrato)}
              </div>
            </>
          )}
        </div>

        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {loading ? [1, 2, 3].map(i => (
            <div key={i} style={{ background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skeletonBar('40%', 26)} {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <StatCard icon="👷" label="Total de trabajadores" value={resumen.total} />
            <StatCard icon="🩺" label="Consultas usadas este mes" value={resumen.usadas} accent={C.blueText} />
            <StatCard icon="📋" label="Consultas disponibles" value={resumen.disponibles} accent={C.green700} />
          </>}
        </div>

        {/* Lista de trabajadores */}
        <div style={{
          background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`,
          boxShadow: S.sm, overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>Trabajadores</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!loading && (
                <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                  {trabajadores.length}
                </span>
              )}
              <button onClick={() => setModalOpen(true)} style={{
                background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`, border: 'none',
                color: C.white, borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                + Agregar trabajadores
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <TH>Nombre</TH>
                <TH>DNI</TH>
                <TH>Email</TH>
                <TH right>Consultas usadas / disponibles</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5].map(j => (
                      <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        {skeletonBar(j > 3 ? '50px' : '75%', 12)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : trabajadores.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                    Sin trabajadores todavía — usa "Agregar trabajadores" para cargar la lista
                  </td>
                </tr>
              ) : trabajadores.map(t => (
                <tr key={t.id}>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: C.white, fontWeight: 800, fontSize: 12,
                      }}>
                        {(t.profile?.full_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: C.gray900 }}>{t.profile?.full_name ?? '—'}</span>
                    </div>
                  </TD>
                  <TD muted>{t.profile?.dni ?? '—'}</TD>
                  <TD muted>{t.email ?? '—'}</TD>
                  <TD right>
                    <span style={{ fontWeight: 700, color: C.gray900 }}>
                      {t.consultas_usadas_mes ?? 0} / {t.consultas_disponibles_mes ?? 0}
                    </span>
                  </TD>
                  <TD>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: t.activo ? C.green50 : C.gray100,
                      color:      t.activo ? C.green700 : C.gray500,
                    }}>
                      {t.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {modalOpen && (
        <AgregarTrabajadoresModal
          planId={planId}
          onClose={() => setModalOpen(false)}
          onDone={fetchAll}
        />
      )}
    </div>
  )
}
