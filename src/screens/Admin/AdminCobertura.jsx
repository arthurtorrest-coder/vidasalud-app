import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

// ─── Helpers ──────────────────────────────────────────────────

function getLimaDateTime() {
  const now  = new Date()
  const lima = new Date(now.getTime() + (now.getTimezoneOffset() - 300) * 60000)
  return {
    diaSemana:  lima.getDay(),
    horaActual: `${String(lima.getHours()).padStart(2,'0')}:${String(lima.getMinutes()).padStart(2,'0')}`,
    horaNum:    lima.getHours(),
  }
}

function fmt12(h) {
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12    = h % 12 || 12
  return `${h12}${suffix}`
}

// Horas del timeline: 7am–10pm (bloques horarios 07:00–21:59)
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // [7,8,...,21]

// ─── Paleta de cobertura ──────────────────────────────────────

function coverageColor(count) {
  if (count === 0) return { bg: C.redBg,  border: C.red600,  text: C.red600,  label: 'Sin cobertura' }
  if (count === 1) return { bg: C.amberBg, border: C.amber,  text: C.amberText, label: '1 médico' }
  return                   { bg: C.green50, border: C.green500, text: C.green700,  label: `${count} médicos` }
}

// ─── Sub-componentes ──────────────────────────────────────────

function StatCard({ icon, value, label, sub, accent = C.green700, bg = C.green50, alert = false }) {
  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${alert ? C.red600 : C.gray200}`,
      borderRadius: 16, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: alert ? `0 2px 12px rgba(220,38,38,0.12)` : '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 26 }}>{icon}</span>
        {alert && (
          <span style={{ fontSize: 10, fontWeight: 700, color: C.red600, background: C.redBg, padding: '3px 8px', borderRadius: 20 }}>
            ALERTA
          </span>
        )}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: alert ? C.red600 : accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray400, marginTop: -2 }}>{sub}</div>}
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function AdminCobertura() {
  const navigate = useNavigate()

  const [doctors,   setDoctors]   = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [now,       setNow]       = useState(getLimaDateTime())

  // Actualiza el reloj Lima cada 60s para que "activo ahora" sea dinámico
  useEffect(() => {
    const t = setInterval(() => setNow(getLimaDateTime()), 60_000)
    return () => clearInterval(t)
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const safe = q => Promise.resolve(q).catch(err => ({ data: null, error: err }))

    const [docRes, schedRes] = await Promise.all([
      safe(supabase
        .from('doctors')
        .select('id, nombres, apellidos, cmp, foto_url, activo, aprobado')
        .eq('aprobado', true)
        .ilike('especialidad', '%General%')
        .order('nombres')),
      safe(supabase
        .from('doctor_schedules')
        .select('doctor_id, dia_semana, hora_inicio, hora_fin, activo')),
    ])

    if (docRes.error)   console.warn('[AdminCobertura] doctors:',   docRes.error.message)
    if (schedRes.error) console.warn('[AdminCobertura] schedules:', schedRes.error.message)

    setDoctors(docRes.data ?? [])
    setSchedules((schedRes.data ?? []).filter(s => s.activo !== false))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Schedules del día actual (Lima)
  const todayScheds = schedules.filter(s => s.dia_semana === now.diaSemana)

  // Doctores que cubren la hora H (07:00, 08:00, …)
  function doctorsAtHour(h) {
    const hStr = String(h).padStart(2, '0') + ':00'
    return doctors.filter(d =>
      todayScheds.some(s =>
        s.doctor_id === d.id &&
        (s.hora_inicio ?? '') <= hStr &&
        (s.hora_fin    ?? '') >  hStr
      )
    )
  }

  // Activos en este momento exacto
  const activeNow = doctors.filter(d =>
    todayScheds.some(s =>
      s.doctor_id === d.id &&
      (s.hora_inicio ?? '') <= now.horaActual &&
      (s.hora_fin    ?? '') >  now.horaActual
    )
  )

  const horasConCobertura    = HOURS.filter(h => doctorsAtHour(h).length > 0).length
  const horasSinCobertura    = HOURS.filter(h => doctorsAtHour(h).length === 0).length
  const currentHourInRange   = now.horaNum >= 7 && now.horaNum <= 21

  // Schedules de hoy agrupados por doctor
  function schedToday(doctorId) {
    return todayScheds
      .filter(s => s.doctor_id === doctorId)
      .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
  }

  // Cubre el doctor la hora H?
  function coversHour(doctorId, h) {
    const hStr = String(h).padStart(2, '0') + ':00'
    return todayScheds.some(s =>
      s.doctor_id === doctorId &&
      (s.hora_inicio ?? '') <= hStr &&
      (s.hora_fin    ?? '') >  hStr
    )
  }

  function fmt(hhmm) {
    if (!hhmm) return '—'
    const [h, m] = hhmm.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2,'0')}${h >= 12 ? 'pm' : 'am'}`
  }

  const skeletonBar = (w = '60%', h = 13) => (
    <div style={{ height: h, width: w, background: C.gray200, borderRadius: 6 }} />
  )

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

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
          }}>COBERTURA</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
            Medicina General · {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][now.diaSemana]} {now.horaActual} Lima
          </span>
        </div>
        <button
          onClick={fetchAll} disabled={loading}
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

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {loading ? [1,2,3,4].map(i => (
            <div key={i} style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skeletonBar('40%', 28)} {skeletonBar('55%', 12)}
            </div>
          )) : <>
            <StatCard
              icon="👨‍⚕️"
              value={doctors.length}
              label="Médicos Medicina General"
              sub="Aprobados y registrados"
            />
            <StatCard
              icon="🟢"
              value={activeNow.length}
              label="Activos en este momento"
              sub={activeNow.length === 0 && currentHourInRange ? 'Fuera de horario configurado' : `${now.horaActual} Lima`}
              accent={activeNow.length > 0 ? C.green700 : C.gray500}
            />
            <StatCard
              icon="✅"
              value={`${horasConCobertura}/15`}
              label="Horas con cobertura hoy"
              sub="7am–10pm"
              accent={horasConCobertura >= 12 ? C.green700 : C.amberText}
            />
            <StatCard
              icon="🚨"
              value={horasSinCobertura}
              label="Horas sin cobertura"
              sub="Franjas sin ningún médico disponible"
              accent={C.red600}
              alert={horasSinCobertura > 0}
            />
          </>}
        </div>

        {/* ── Timeline master ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, marginBottom: 16 }}>
            Cobertura horaria — hoy
          </h2>

          {loading ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {HOURS.map(h => (
                <div key={h} style={{ flex: 1, height: 72, background: C.gray100, borderRadius: 10 }} />
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 6, minWidth: 700 }}>
                {HOURS.map(h => {
                  const docs      = doctorsAtHour(h)
                  const cfg       = coverageColor(docs.length)
                  const isCurrent = now.horaNum === h
                  return (
                    <div
                      key={h}
                      style={{
                        flex: 1, minWidth: 60,
                        background: cfg.bg,
                        border: `2px solid ${isCurrent ? C.gray900 : cfg.border}`,
                        borderRadius: 10,
                        padding: '10px 6px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        position: 'relative',
                        boxShadow: isCurrent ? '0 0 0 3px rgba(0,0,0,0.15)' : 'none',
                      }}
                    >
                      {isCurrent && (
                        <div style={{
                          position: 'absolute', top: -8,
                          fontSize: 9, fontWeight: 800, color: C.gray900,
                          background: C.white, border: `1px solid ${C.gray300}`,
                          padding: '1px 5px', borderRadius: 8,
                        }}>
                          AHORA
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 800, color: cfg.text }}>
                        {fmt12(h)}
                      </div>
                      <div style={{
                        fontSize: 22, fontWeight: 900,
                        color: docs.length === 0 ? C.red600 : docs.length === 1 ? C.amberText : C.green700,
                      }}>
                        {docs.length}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: cfg.text, textAlign: 'center', lineHeight: 1.3 }}>
                        {docs.length === 0 ? 'Sin cob.' : docs.length === 1 ? 'mínimo' : 'médico' + (docs.length !== 1 ? 's' : '')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 20, marginTop: 14, justifyContent: 'center' }}>
            {[
              { color: C.green500,  bg: C.green50,  label: '≥ 2 médicos (óptimo)' },
              { color: C.amber,     bg: C.amberBg,  label: '1 médico (mínimo)'    },
              { color: C.red600,    bg: C.redBg,    label: 'Sin cobertura'         },
            ].map(({ color, bg, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: bg, border: `2px solid ${color}` }} />
                <span style={{ fontSize: 11, color: C.gray500, fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Grid de disponibilidad por médico ── */}
        <div style={{
          background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, marginBottom: 16 }}>
            Disponibilidad por médico — hoy
          </h2>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 200, flexShrink: 0 }}>
                    {skeletonBar('80%', 14)}
                    <div style={{ marginTop: 6 }}>{skeletonBar('55%', 10)}</div>
                  </div>
                  <div style={{ flex: 1, height: 36, background: C.gray100, borderRadius: 8 }} />
                </div>
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.gray400 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍⚕️</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No hay médicos de Medicina General registrados</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {/* Cabecera de horas */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 8, minWidth: 900 }}>
                <div style={{ width: 220, flexShrink: 0 }} />
                {HOURS.map(h => (
                  <div
                    key={h}
                    style={{
                      flex: 1, textAlign: 'center',
                      fontSize: 10, fontWeight: now.horaNum === h ? 800 : 600,
                      color: now.horaNum === h ? C.green700 : C.gray400,
                      paddingBottom: 6,
                    }}
                  >
                    {fmt12(h)}
                  </div>
                ))}
                <div style={{ width: 120, flexShrink: 0 }} />
              </div>

              {/* Filas de médicos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {doctors.map(doc => {
                  const isActiveNow = activeNow.some(d => d.id === doc.id)
                  const todayBlocks = schedToday(doc.id)
                  const isCPsP     = doc.cmp?.startsWith('CPsP')
                  const fullName   = [doc.nombres, doc.apellidos].filter(Boolean).join(' ') || 'Médico'

                  return (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 900 }}>
                      {/* Info médico */}
                      <div style={{ width: 220, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, paddingRight: 12 }}>
                        {doc.foto_url ? (
                          <img src={doc.foto_url} alt={fullName}
                            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: C.white, fontWeight: 800, fontSize: 13,
                          }}>
                            {fullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 700, color: C.gray900,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {isCPsP ? 'Psic.' : 'Dr(a).'} {fullName}
                          </div>
                          <div style={{ fontSize: 10, color: C.gray400, marginTop: 2 }}>
                            {doc.cmp ?? '—'}
                          </div>
                        </div>
                      </div>

                      {/* Bloques de disponibilidad */}
                      {HOURS.map(h => {
                        const available  = coversHour(doc.id, h)
                        const isCurrent  = now.horaNum === h
                        return (
                          <div
                            key={h}
                            style={{
                              flex: 1, height: 36,
                              background: available
                                ? (isCurrent ? C.green600 : C.green100)
                                : (isCurrent ? C.gray200 : 'transparent'),
                              border: isCurrent
                                ? `2px solid ${available ? C.green700 : C.gray300}`
                                : `1px solid ${available ? C.green200 : C.gray100}`,
                              borderRadius: 6,
                              margin: '0 2px',
                            }}
                          />
                        )
                      })}

                      {/* Estado actual + horarios */}
                      <div style={{ width: 120, flexShrink: 0, paddingLeft: 14 }}>
                        {isActiveNow ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                            background: C.green50, color: C.green700, border: `1px solid ${C.green200}`,
                            whiteSpace: 'nowrap',
                          }}>
                            🟢 Activo
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                            background: C.gray100, color: C.gray500, border: `1px solid ${C.gray200}`,
                            whiteSpace: 'nowrap',
                          }}>
                            ○ Fuera
                          </span>
                        )}
                        {todayBlocks.length > 0 && (
                          <div style={{ fontSize: 9, color: C.gray400, marginTop: 4, lineHeight: 1.5 }}>
                            {todayBlocks.map(s => `${fmt(s.hora_inicio)}–${fmt(s.hora_fin)}`).join(', ')}
                          </div>
                        )}
                        {todayBlocks.length === 0 && (
                          <div style={{ fontSize: 9, color: C.gray400, marginTop: 4 }}>
                            Sin horario hoy
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
