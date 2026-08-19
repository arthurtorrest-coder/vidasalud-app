import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { C, R, S } from '../../lib/tokens'
import { COMISION_COORDINADOR } from '../../lib/finanzas'

function getMesRango() {
  const lima = new Date(Date.now() - 5 * 3_600_000)
  const y = lima.getUTCFullYear(), m = lima.getUTCMonth()
  return {
    inicio: new Date(Date.UTC(y, m,     1,  5,  0,  0)).toISOString(),
    fin:    new Date(Date.UTC(y, m + 1, 1,  4, 59, 59)).toISOString(),
    label:  new Date(Date.UTC(y, m, 15)).toLocaleDateString('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatCard({ icon, label, value, accent = C.green700 }) {
  return (
    <div style={{
      background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: S.sm,
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
    </div>
  )
}

export default function PanelCoordinador() {
  const navigate = useNavigate()
  const { coordinador } = useAuthStore()

  const [boticas,  setBoticas]  = useState([])
  const [conteos,  setConteos]  = useState({}) // boticaId -> { atenciones, comision }
  const [loading,  setLoading]  = useState(true)
  const { label: mesLabel } = useMemo(getMesRango, [])

  const fetchAll = useCallback(async () => {
    if (!coordinador?.id) return
    setLoading(true)
    const { inicio, fin } = getMesRango()

    const { data: farms, error: farmErr } = await supabase
      .from('farmacias')
      .select('id, nombre, ciudad, distrito, activo, aprobado')
      .eq('coordinador_id', coordinador.id)
      .order('nombre', { ascending: true })
    if (farmErr) console.warn('[PanelCoordinador] farmacias:', farmErr.message)

    const boticaIds = (farms ?? []).map(f => f.id)
    const nuevoConteo = {}
    if (boticaIds.length > 0) {
      const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('id, farmacia_referente_id, scheduled_at')
        .in('farmacia_referente_id', boticaIds)
        .eq('status', 'done')
        .gte('scheduled_at', inicio)
        .lte('scheduled_at', fin)
      if (apptErr) console.warn('[PanelCoordinador] appointments:', apptErr.message)
      for (const a of appts ?? []) {
        if (!nuevoConteo[a.farmacia_referente_id]) nuevoConteo[a.farmacia_referente_id] = 0
        nuevoConteo[a.farmacia_referente_id]++
      }
    }

    setBoticas(farms ?? [])
    setConteos(nuevoConteo)
    setLoading(false)
  }, [coordinador?.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const boticasConDatos = useMemo(() => boticas.map(b => {
    const atenciones = conteos[b.id] ?? 0
    return { ...b, atenciones, comision: atenciones * COMISION_COORDINADOR }
  }).sort((a, b) => b.comision - a.comision), [boticas, conteos])

  const resumen = useMemo(() => ({
    boticasActivas: boticas.filter(b => b.activo).length,
    atenciones:     boticasConDatos.reduce((s, b) => s + b.atenciones, 0),
    comision:       boticasConDatos.reduce((s, b) => s + b.comision, 0),
  }), [boticas, boticasConDatos])

  const skeletonBar = (w = '60%', h = 13) => (
    <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
  )

  if (!coordinador) return null

  const nombreCompleto = `${coordinador.nombres} ${coordinador.apellidos}`

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
          <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>COORDINADOR</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{mesLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${C.green500}, ${C.green700})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.white }}>
              {nombreCompleto.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>{nombreCompleto}</span>
          </div>
          <button onClick={handleLogout} style={{
            background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', color: '#FCA5A5',
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* Encabezado con zona */}
        <div style={{
          background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
          borderRadius: R.card, padding: '20px 24px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, color: C.white }}>Hola, {coordinador.nombres} 👋</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
              📍 Zona: {coordinador.zona_principal ?? 'Sin zona asignada'}
            </div>
          </div>
          <button
            onClick={() => navigate(`/registro-farmacia?coordinador_id=${coordinador.id}`)}
            style={{
              padding: '12px 20px', border: 'none', borderRadius: 12,
              background: C.white, color: C.green800, fontSize: 13, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
          >
            + Registrar nueva botica
          </button>
        </div>

        {/* Stats del mes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {loading ? [1, 2, 3].map(i => (
            <div key={i} style={{ background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skeletonBar('40%', 24)} {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <StatCard icon="🏪" label="Boticas activas" value={resumen.boticasActivas} />
            <StatCard icon="🩺" label="Atenciones este mes" value={resumen.atenciones} accent={C.blueText} />
            <StatCard icon="💰" label="Comisión ganada" value={fmtSoles(resumen.comision)} accent={C.green700} />
          </>}
        </div>

        {/* Ranking de boticas */}
        <div style={{
          background: C.white, borderRadius: R.card, border: `1.5px solid ${C.gray200}`,
          boxShadow: S.sm, overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>
              Mis boticas — ranking por rendimiento
            </h2>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                {boticas.length}
              </span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.gray500, background: C.gray50, borderBottom: `1.5px solid ${C.gray200}` }}>#</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.gray500, background: C.gray50, borderBottom: `1.5px solid ${C.gray200}` }}>Botica</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.gray500, background: C.gray50, borderBottom: `1.5px solid ${C.gray200}` }}>Ciudad</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.gray500, background: C.gray50, borderBottom: `1.5px solid ${C.gray200}` }}>Atenciones/mes</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.gray500, background: C.gray50, borderBottom: `1.5px solid ${C.gray200}` }}>Comisión</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.gray500, background: C.gray50, borderBottom: `1.5px solid ${C.gray200}` }}>Estado</th>
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
              ) : boticasConDatos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: C.gray400, fontSize: 13 }}>
                    Todavía no tienes boticas registradas — usa "Registrar nueva botica" para empezar
                  </td>
                </tr>
              ) : boticasConDatos.map((b, i) => (
                <tr key={b.id}>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray400, borderBottom: `1px solid ${C.gray100}` }}>
                    {i === 0 && b.comision > 0 ? '🥇' : i === 1 && b.comision > 0 ? '🥈' : i === 2 && b.comision > 0 ? '🥉' : i + 1}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.gray900, borderBottom: `1px solid ${C.gray100}` }}>
                    {b.nombre}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: C.gray500, borderBottom: `1px solid ${C.gray100}` }}>
                    {b.ciudad}{b.distrito ? `, ${b.distrito}` : ''}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: C.gray900, textAlign: 'right', borderBottom: `1px solid ${C.gray100}` }}>
                    {b.atenciones}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', borderBottom: `1px solid ${C.gray100}` }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.green700, background: C.green50, padding: '3px 10px', borderRadius: 20 }}>
                      {fmtSoles(b.comision)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.gray100}` }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: !b.aprobado ? C.amberBg : b.activo ? C.green50 : C.gray100,
                      color:      !b.aprobado ? C.amberText : b.activo ? C.green700 : C.gray500,
                    }}>
                      {!b.aprobado ? '⏳ Pendiente' : b.activo ? '● Activa' : '○ Inactiva'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
