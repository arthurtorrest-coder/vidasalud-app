import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C, R, S } from '../../lib/tokens'

const TIPOS = [
  { id: 'empresa', label: 'Empresa' },
  { id: 'mineria',  label: 'Minería' },
]

const ESTADOS = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'activo',    label: 'Activo'    },
  { id: 'inactivo',  label: 'Inactivo'  },
]

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Un contrato vigente cuya fecha_fin_contrato ya pasó se muestra como "vencido"
// sin necesidad de una columna extra en la base de datos.
function estadoDisplay(plan) {
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

// ── Modal: Nueva empresa ──────────────────────────────────────
function NuevaEmpresaModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    nombre: '', tipo: 'empresa', ruc_empresa: '',
    consultas_por_usuario_mes: 5, max_usuarios: 20, precio_mensual: '',
    estado: 'pendiente', fecha_inicio: '', fecha_fin_contrato: '',
  })
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.ruc_empresa.trim()) {
      toast.error('Nombre y RUC son obligatorios')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('planes_corporativos')
      .insert({
        nombre:                     form.nombre.trim(),
        tipo:                       form.tipo,
        ruc_empresa:                form.ruc_empresa.trim(),
        consultas_por_usuario_mes:  Number(form.consultas_por_usuario_mes) || 1,
        max_usuarios:               Number(form.max_usuarios) || 1,
        precio_mensual:             Number(form.precio_mensual) || 0,
        estado:                     form.estado,
        fecha_inicio:               form.fecha_inicio || null,
        fecha_fin_contrato:         form.fecha_fin_contrato || null,
      })
      .select()
      .single()
    setSaving(false)
    if (error) {
      toast.error('Error al crear la empresa: ' + error.message)
      return
    }
    toast.success(`${data.nombre} creada`)
    onCreated(data)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(17,24,39,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto',
          background: C.white, borderRadius: R.modal, boxShadow: S.lg,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{
          background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
          padding: '20px 24px', borderRadius: `${R.modal}px ${R.modal}px 0 0`,
        }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.white }}>Nueva empresa</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Crea un contrato corporativo (empresa o minería)
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nombre de la empresa">
            <input required value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Minera Los Andes S.A." style={inputStyle()} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tipo">
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={{ ...inputStyle(), cursor: 'pointer' }}>
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="RUC">
              <input required value={form.ruc_empresa} onChange={e => set('ruc_empresa', e.target.value)}
                placeholder="20123456789" style={inputStyle()} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Consultas / trabajador / mes">
              <input type="number" min={1} value={form.consultas_por_usuario_mes}
                onChange={e => set('consultas_por_usuario_mes', e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="Máx. usuarios">
              <input type="number" min={1} value={form.max_usuarios}
                onChange={e => set('max_usuarios', e.target.value)} style={inputStyle()} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Precio mensual (S/.)">
              <input type="number" min={0} step="0.01" value={form.precio_mensual}
                onChange={e => set('precio_mensual', e.target.value)} placeholder="0.00" style={inputStyle()} />
            </Field>
            <Field label="Estado">
              <select value={form.estado} onChange={e => set('estado', e.target.value)} style={{ ...inputStyle(), cursor: 'pointer' }}>
                {ESTADOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Fecha de inicio">
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="Fin de contrato">
              <input type="date" value={form.fecha_fin_contrato} onChange={e => set('fecha_fin_contrato', e.target.value)} style={inputStyle()} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
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
              {saving ? 'Creando…' : 'Crear empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Pantalla principal ──────────────────────────────────────────
export default function AdminEmpresas() {
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState([])
  const [conteos,  setConteos]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: planes, error } = await supabase
      .from('planes_corporativos')
      .select('*')
      .in('tipo', ['empresa', 'mineria'])
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[AdminEmpresas] planes:', error.message)
      setEmpresas([])
      setLoading(false)
      return
    }

    const planIds = (planes ?? []).map(p => p.id)
    const conteoMap = {}
    if (planIds.length) {
      const { data: usuarios } = await supabase
        .from('usuarios_corporativos')
        .select('plan_id, activo')
        .in('plan_id', planIds)
      for (const u of usuarios ?? []) {
        if (!conteoMap[u.plan_id]) conteoMap[u.plan_id] = 0
        if (u.activo) conteoMap[u.plan_id]++
      }
    }

    setEmpresas(planes ?? [])
    setConteos(conteoMap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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
            }}
          >
            ← Panel
          </button>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>EMPRESAS</span>
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
            + Nueva empresa
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>
        <div style={{
          background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`,
          boxShadow: S.sm, overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>Contratos corporativos</h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                {empresas.length}
              </span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <TH>Empresa</TH>
                <TH>RUC</TH>
                <TH>Tipo</TH>
                <TH right>Trabajadores activos</TH>
                <TH right>Consultas / trab. / mes</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                        {skeletonBar(j > 3 ? '50px' : '75%', 12)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : empresas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                    Sin empresas registradas — crea la primera con "Nueva empresa"
                  </td>
                </tr>
              ) : empresas.map(plan => {
                const tipoCfg   = TIPO_CFG[plan.tipo] ?? TIPO_CFG.empresa
                const estadoCfg = ESTADO_CFG[estadoDisplay(plan)] ?? ESTADO_CFG.pendiente
                return (
                  <tr key={plan.id} onClick={() => navigate(`/admin/empresas/${plan.id}`)} style={{ cursor: 'pointer' }}>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: C.white, fontWeight: 800, fontSize: 12,
                        }}>
                          {(plan.nombre ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: C.gray900 }}>{plan.nombre}</span>
                      </div>
                    </TD>
                    <TD muted>{plan.ruc_empresa ?? '—'}</TD>
                    <TD>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: tipoCfg.bg, color: tipoCfg.color }}>
                        {tipoCfg.label}
                      </span>
                    </TD>
                    <TD right>
                      <span style={{ fontWeight: 700, color: C.gray900 }}>
                        {conteos[plan.id] ?? 0} / {plan.max_usuarios}
                      </span>
                    </TD>
                    <TD right muted>{plan.consultas_por_usuario_mes}</TD>
                    <TD>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color, whiteSpace: 'nowrap' }}>
                        {estadoCfg.label}
                      </span>
                    </TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>

      {modalOpen && (
        <NuevaEmpresaModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); fetchAll() }}
        />
      )}
    </div>
  )
}
