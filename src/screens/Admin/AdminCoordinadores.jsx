import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C, R, S } from '../../lib/tokens'
import { COMISION_COORDINADOR } from '../../lib/finanzas'

function getMesRango() {
  const lima = new Date(Date.now() - 5 * 3_600_000)
  const y = lima.getUTCFullYear(), m = lima.getUTCMonth()
  return {
    inicio: new Date(Date.UTC(y, m,     1,  5,  0,  0)).toISOString(),
    fin:    new Date(Date.UTC(y, m + 1, 1,  4, 59, 59)).toISOString(),
  }
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function inputStyle() {
  return {
    width: '100%', padding: '10px 12px', borderRadius: R.input,
    border: `1.5px solid ${C.gray300}`, fontSize: 13, color: C.gray900,
    background: C.white, outline: 'none', fontFamily: 'inherit',
  }
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Modal: Nuevo coordinador ──────────────────────────────────
function NuevoCoordinadorModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ nombres: '', apellidos: '', email: '', zona_principal: '' })
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState(null)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.email.trim()) {
      toast.error('Nombres, apellidos y email son obligatorios')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.functions.invoke('crear-coordinador', {
      body: {
        nombres:        form.nombres.trim(),
        apellidos:      form.apellidos.trim(),
        email:          form.email.trim(),
        zona_principal: form.zona_principal.trim(),
      },
    })
    setSaving(false)
    if (error || !data?.ok) {
      toast.error('Error al crear coordinador: ' + (data?.error ?? error?.message ?? 'desconocido'))
      return
    }
    toast.success(`${form.nombres} creado como coordinador`)
    setResultado(data)
  }

  function handleClose() {
    if (resultado) onCreated()
    onClose()
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(17,24,39,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
          background: C.white, borderRadius: R.modal, boxShadow: S.lg,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{
          background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
          padding: '20px 24px', borderRadius: `${R.modal}px ${R.modal}px 0 0`,
        }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.white }}>Nuevo coordinador</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Se crea una cuenta VIDASALUD para el coordinador
          </div>
        </div>

        {resultado ? (
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              border: `1.5px solid ${C.green200}`, background: C.green50,
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gray900 }}>✅ Coordinador creado</div>
              <div style={{ fontSize: 12, color: C.gray700, marginTop: 4, lineHeight: 1.6 }}>
                Usuario: <strong>{resultado.email}</strong><br />
                Contraseña temporal: <strong style={{ fontFamily: 'monospace' }}>{resultado.temp_password}</strong>
                <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
                  Compártela con el coordinador — no volverá a mostrarse.
                </div>
              </div>
            </div>
            <button onClick={handleClose} style={{
              padding: '12px 0', borderRadius: R.button, cursor: 'pointer',
              border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
              color: C.white, fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
            }}>
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Nombres">
                <input required value={form.nombres} onChange={e => set('nombres', e.target.value)} style={inputStyle()} />
              </Field>
              <Field label="Apellidos">
                <input required value={form.apellidos} onChange={e => set('apellidos', e.target.value)} style={inputStyle()} />
              </Field>
            </div>
            <Field label="Email">
              <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="coordinador@correo.com" style={inputStyle()} />
            </Field>
            <Field label="Zona principal">
              <input value={form.zona_principal} onChange={e => set('zona_principal', e.target.value)}
                placeholder="Ej: Huaraz y Callejón de Huaylas" style={inputStyle()} />
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, padding: '12px 0', borderRadius: R.button, cursor: 'pointer',
                border: `1.5px solid ${C.gray300}`, background: C.white, color: C.gray700,
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{
                flex: 1, padding: '12px 0', borderRadius: R.button, cursor: saving ? 'default' : 'pointer',
                border: 'none', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                color: C.white, fontSize: 13, fontWeight: 800, fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'Creando…' : 'Crear coordinador'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Pantalla principal ──────────────────────────────────────────
export default function AdminCoordinadores() {
  const navigate = useNavigate()
  const [coordinadores, setCoordinadores] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { inicio, fin } = getMesRango()

    const { data: coords, error: coordErr } = await supabase
      .from('coordinadores')
      .select('*')
      .order('created_at', { ascending: false })
    if (coordErr) console.warn('[AdminCoordinadores] coordinadores:', coordErr.message)

    const coordIds = (coords ?? []).map(c => c.id)
    const statsMap = {}
    if (coordIds.length > 0) {
      const { data: farms } = await supabase
        .from('farmacias')
        .select('id, coordinador_id')
        .in('coordinador_id', coordIds)

      const farmToCoord = Object.fromEntries((farms ?? []).map(f => [f.id, f.coordinador_id]))
      const farmIds = (farms ?? []).map(f => f.id)

      if (farmIds.length > 0) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('farmacia_referente_id')
          .in('farmacia_referente_id', farmIds)
          .eq('status', 'done')
          .gte('scheduled_at', inicio)
          .lte('scheduled_at', fin)

        for (const a of appts ?? []) {
          const coordId = farmToCoord[a.farmacia_referente_id]
          if (!coordId) continue
          if (!statsMap[coordId]) statsMap[coordId] = { boticas: new Set(), atenciones: 0 }
          statsMap[coordId].atenciones++
        }
      }
      for (const f of farms ?? []) {
        if (!f.coordinador_id) continue
        if (!statsMap[f.coordinador_id]) statsMap[f.coordinador_id] = { boticas: new Set(), atenciones: 0 }
        statsMap[f.coordinador_id].boticas.add(f.id)
      }
    }

    setCoordinadores((coords ?? []).map(c => ({
      ...c,
      boticas:    statsMap[c.id]?.boticas.size ?? 0,
      atenciones: statsMap[c.id]?.atenciones ?? 0,
      comision:   (statsMap[c.id]?.atenciones ?? 0) * COMISION_COORDINADOR,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const totales = useMemo(() => ({
    atenciones: coordinadores.reduce((s, c) => s + c.atenciones, 0),
    comision:   coordinadores.reduce((s, c) => s + c.comision, 0),
  }), [coordinadores])

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
          <button onClick={() => navigate('/admin/panel')} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: C.white, borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ← Panel
          </button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>COORDINADORES</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={fetchAll} disabled={loading} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: C.white, borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
          }}>
            ↻ Actualizar
          </button>
          <button onClick={() => setModalOpen(true)} style={{
            background: C.white, border: 'none', color: C.green800,
            borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            + Nuevo coordinador
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* Stats del mes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {loading ? [1, 2, 3].map(i => (
            <div key={i} style={{ background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skeletonBar('40%', 24)} {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <div style={{ background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', boxShadow: S.sm }}>
              <span style={{ fontSize: 24 }}>🧭</span>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.gray900, marginTop: 8 }}>{coordinadores.length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500, marginTop: 4 }}>Coordinadores</div>
            </div>
            <div style={{ background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', boxShadow: S.sm }}>
              <span style={{ fontSize: 24 }}>🩺</span>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.blueText, marginTop: 8 }}>{totales.atenciones}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500, marginTop: 4 }}>Atenciones este mes</div>
            </div>
            <div style={{ background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', boxShadow: S.sm }}>
              <span style={{ fontSize: 24 }}>💰</span>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.green700, marginTop: 8 }}>{fmtSoles(totales.comision)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500, marginTop: 4 }}>Comisión del mes</div>
            </div>
          </>}
        </div>

        <div style={{
          background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`,
          boxShadow: S.sm, overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>Coordinadores de zona</h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                {coordinadores.length}
              </span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <TH>Coordinador</TH>
                <TH>Zona</TH>
                <TH right>Boticas</TH>
                <TH right>Atenciones / mes</TH>
                <TH right>Comisión / mes</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        {skeletonBar(j > 2 ? '50px' : '75%', 12)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : coordinadores.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                    Sin coordinadores registrados — crea el primero con "Nuevo coordinador"
                  </td>
                </tr>
              ) : coordinadores.map(c => (
                <tr key={c.id}>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: C.white, fontWeight: 800, fontSize: 12,
                      }}>
                        {(c.nombres ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: C.gray900 }}>{c.nombres} {c.apellidos}</span>
                    </div>
                  </TD>
                  <TD muted>{c.zona_principal ?? '—'}</TD>
                  <TD right>{c.boticas}</TD>
                  <TD right>{c.atenciones}</TD>
                  <TD right>
                    <span style={{ fontWeight: 800, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                      {fmtSoles(c.comision)}
                    </span>
                  </TD>
                  <TD>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: c.activo ? C.green50 : C.gray100,
                      color:      c.activo ? C.green700 : C.gray500,
                    }}>
                      {c.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {modalOpen && (
        <NuevoCoordinadorModal
          onClose={() => setModalOpen(false)}
          onCreated={fetchAll}
        />
      )}
    </div>
  )
}
