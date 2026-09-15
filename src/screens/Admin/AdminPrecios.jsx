import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toFixed(2)}`
}

function FieldCard({ icon, label, hint, value, onChange, suffix = '', accent = C.green700, bg = C.green50, readOnly = false }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.gray900 }}>{label}</div>
          {hint && <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>{hint}</div>}
        </div>
      </div>

      {readOnly ? (
        <div style={{
          fontSize: 24, fontWeight: 900, color: accent,
          background: bg, borderRadius: 10, padding: '10px 14px',
        }}>
          {fmtSoles(value)}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.gray400 }}>S/.</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              flex: 1, padding: '10px 12px', boxSizing: 'border-box',
              border: `1.5px solid ${C.gray300}`, borderRadius: 10,
              fontSize: 18, fontWeight: 800, color: C.gray900,
              outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = accent }}
            onBlur={e  => { e.target.style.borderColor = C.gray300 }}
          />
          {suffix && <span style={{ fontSize: 12, color: C.gray400 }}>{suffix}</span>}
        </div>
      )}
    </div>
  )
}

export default function AdminPrecios() {
  const navigate = useNavigate()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  // Campos editables — "Precio de consulta" y "Tarifa del médico" son los
  // que el admin toca directamente; el margen se deriva de la resta entre
  // ambos (precio_total = tarifa_general + margen_total en la tabla real).
  const [precioTotal,        setPrecioTotal]        = useState('30')
  const [tarifaMedico,       setTarifaMedico]        = useState('15')
  const [comisionBotica,     setComisionBotica]      = useState('4')
  const [comisionCoordinador, setComisionCoordinador] = useState('2')

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('configuracion_precios')
      .select('tarifa_general, margen_total, comision_botica, comision_coordinador, updated_at')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      toast.error('No se pudo cargar la configuración: ' + error.message)
      setLoading(false)
      return
    }
    if (data) {
      const tarifa = Number(data.tarifa_general ?? 15)
      const margen = Number(data.margen_total   ?? 15)
      setTarifaMedico(String(tarifa))
      setPrecioTotal(String(tarifa + margen))
      setComisionBotica(String(Number(data.comision_botica ?? 4)))
      setComisionCoordinador(String(Number(data.comision_coordinador ?? 2)))
      setUpdatedAt(data.updated_at)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const nPrecioTotal        = Number(precioTotal) || 0
  const nTarifaMedico       = Number(tarifaMedico) || 0
  const nComisionBotica     = Number(comisionBotica) || 0
  const nComisionCoordinador = Number(comisionCoordinador) || 0
  const margenClinica       = nPrecioTotal - nTarifaMedico

  const errores = []
  if (nPrecioTotal <= 0)  errores.push('El precio de consulta debe ser mayor a 0')
  if (nTarifaMedico < 0)  errores.push('La tarifa del médico no puede ser negativa')
  if (margenClinica < 0)  errores.push('El precio total no puede ser menor que la tarifa del médico')
  if (nComisionBotica < 0 || nComisionCoordinador < 0) errores.push('Las comisiones no pueden ser negativas')
  if (nComisionBotica + nComisionCoordinador > margenClinica) {
    errores.push('La suma de comisiones no puede superar el margen de la clínica')
  }

  async function handleGuardar() {
    if (errores.length > 0) {
      toast.error(errores[0])
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('configuracion_precios')
      .update({
        tarifa_general:       nTarifaMedico,
        margen_total:         margenClinica,
        comision_botica:      nComisionBotica,
        comision_coordinador: nComisionCoordinador,
      })
      .eq('id', 1)
      .select('updated_at')
      .single()
    setSaving(false)
    if (error) {
      toast.error('No se pudo guardar: ' + error.message)
      return
    }
    setUpdatedAt(data?.updated_at ?? new Date().toISOString())
    toast.success('✅ Precios actualizados — ya están vigentes en toda la app')
  }

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
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
          }}>PRECIOS</span>
        </div>
        {updatedAt && !loading && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            Última actualización: {new Date(updatedAt).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        )}
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 48px' }}>

        <div style={{
          background: C.green50, border: `1.5px solid ${C.green200}`,
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          fontSize: 12, color: C.green800, lineHeight: 1.6,
        }}>
          💡 Estos valores aplican a <strong>Medicina General</strong>. Las comisiones de botica y coordinador
          también rigen para consultas con especialistas referidas por una botica. Los cambios se guardan
          en <code style={{ background: C.white, padding: '1px 5px', borderRadius: 4 }}>configuracion_precios</code>{' '}
          y se reflejan en toda la app en tiempo real (nuevas reservas y páginas que se abran después de guardar).
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 120, borderRadius: 16, background: C.gray200 }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FieldCard
                icon="💵" label="Precio de consulta — Medicina General"
                hint="Lo que paga el paciente"
                value={precioTotal} onChange={setPrecioTotal}
                accent={C.green700} bg={C.green50}
              />
              <FieldCard
                icon="👨‍⚕️" label="Tarifa del médico"
                hint="Pago fijo por consulta de guardia"
                value={tarifaMedico} onChange={setTarifaMedico}
                accent={C.blueText} bg={C.blueBg}
              />
              <FieldCard
                icon="🏪" label="Comisión de botica"
                hint="Por cada paciente referido"
                value={comisionBotica} onChange={setComisionBotica}
                accent={C.amberText} bg={C.amberBg}
              />
              <FieldCard
                icon="🧭" label="Comisión de coordinador"
                hint="Cuando la botica tiene coordinador"
                value={comisionCoordinador} onChange={setComisionCoordinador}
                accent="#6D28D9" bg="#F5F3FF"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <FieldCard
                icon="🏥" label="Margen de la clínica"
                hint="Calculado automáticamente — precio total menos tarifa del médico"
                value={margenClinica} readOnly
                accent={C.green800} bg={C.green100}
              />
            </div>

            {/* Reparto de ejemplo */}
            <div style={{
              marginTop: 16, background: C.white, border: `1.5px solid ${C.gray200}`,
              borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.gray700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Cómo se reparte el margen
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.gray600 }}>Sin botica — todo para la clínica</span>
                  <strong style={{ color: C.green700 }}>{fmtSoles(margenClinica)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.gray600 }}>Con botica (sin coordinador) — clínica</span>
                  <strong style={{ color: C.green700 }}>{fmtSoles(Math.max(0, margenClinica - nComisionBotica))}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.gray600 }}>Con botica + coordinador — clínica</span>
                  <strong style={{ color: C.green700 }}>{fmtSoles(Math.max(0, margenClinica - nComisionBotica - nComisionCoordinador))}</strong>
                </div>
              </div>
            </div>

            {errores.length > 0 && (
              <div style={{
                marginTop: 16, background: '#FEF2F2', border: '1.5px solid #FECACA',
                borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#DC2626',
              }}>
                ⚠ {errores[0]}
              </div>
            )}

            <button
              onClick={handleGuardar}
              disabled={saving || errores.length > 0}
              style={{
                marginTop: 20, width: '100%', padding: '15px 0', border: 'none', borderRadius: 12,
                background: saving || errores.length > 0
                  ? C.gray200
                  : `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                color: saving || errores.length > 0 ? C.gray400 : C.white,
                fontSize: 15, fontWeight: 800,
                cursor: saving || errores.length > 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: saving || errores.length > 0 ? 'none' : '0 4px 14px rgba(5,150,105,0.3)',
              }}
            >
              {saving ? 'Guardando…' : '💾 Guardar cambios'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
