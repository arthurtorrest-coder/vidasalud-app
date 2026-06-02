import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C, S } from '../../lib/tokens'

const DIAS     = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_ABR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function parseTitulo(nombres, cmp) {
  const isCPsP = (cmp ?? '').startsWith('CPsP')
  const esFem  = (nombres ?? '').trimEnd().endsWith('a')
  return isCPsP ? 'Psic.' : esFem ? 'Dra.' : 'Dr.'
}

function getAvailableSlotsThisWeek(schedules) {
  const diaHoy = new Date().getDay()
  const result = []
  for (let i = 0; i < 7; i++) {
    const dia    = (diaHoy + i) % 7
    const bloques = schedules
      .filter(s => s.dia_semana === dia && s.activo !== false)
      .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
    if (bloques.length > 0) {
      result.push({
        dia:     DIAS_ABR[dia],
        hora:    (bloques[0].hora_inicio ?? '00:00').slice(0, 5),
        horaFin: (bloques[0].hora_fin   ?? '').slice(0, 5),
        esHoy:     i === 0,
        esMañana:  i === 1,
      })
    }
  }
  return result
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7)  return `hace ${days} días`
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`
  if (days < 365) return `hace ${Math.floor(days / 30)} mes.`
  return `hace ${Math.floor(days / 365)} año${Math.floor(days / 365) !== 1 ? 's' : ''}`
}

// ─── Subcomponentes ───────────────────────────────────────────

function Avatar({ initials, fotoUrl, size = 80 }) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={initials}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '3px solid rgba(255,255,255,0.85)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.green500}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 800, fontSize: size * 0.33,
      border: '3px solid rgba(255,255,255,0.85)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    }}>
      {initials}
    </div>
  )
}

function Stars({ rating, size = 15 }) {
  const filled = Math.round(rating)
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize: size, color: i < filled ? C.amber : C.gray300, lineHeight: 1 }}>
          ★
        </span>
      ))}
    </span>
  )
}

function ProfileSkeleton() {
  const bar = (w, h = 10) => (
    <div style={{ width: w, height: h, background: 'rgba(255,255,255,0.25)', borderRadius: 6 }} />
  )
  const gbar = (w, h = 10) => (
    <div style={{ width: w, height: h, background: C.gray100, borderRadius: 6 }} />
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: C.gray50 }}>
      <style>{`@keyframes shimmer{0%,100%{opacity:0.5}50%{opacity:1}}`}</style>
      <div style={{
        background: `linear-gradient(160deg, ${C.green800}, ${C.green600})`,
        padding: '16px 16px 24px', animation: 'shimmer 1.5s ease-in-out infinite',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bar('65%', 14)} {bar('50%', 10)} {bar('35%', 9)}
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.25)' }} />)}
            </div>
          </div>
          <div style={{ width: 64, height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
        </div>
      </div>
      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'shimmer 1.5s ease-in-out infinite' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ background: C.white, borderRadius: 16, padding: 16 }}>
            {gbar('40%', 12)} <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gbar('90%', 10)} {gbar('75%', 10)} {gbar('60%', 10)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NotFoundState({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
      <span style={{ fontSize: 52 }}>🔍</span>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.gray700 }}>Médico no encontrado</div>
      <p style={{ fontSize: 13, color: C.gray500, textAlign: 'center', margin: 0 }}>
        El perfil que buscas no existe o ya no está disponible.
      </p>
      <button
        onClick={onBack}
        style={{
          marginTop: 8, padding: '10px 28px',
          background: C.green700, color: C.white,
          border: 'none', borderRadius: 10,
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Volver
      </button>
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function PerfilMedico() {
  const { doctorId } = useParams()
  const navigate      = useNavigate()

  const [doctor,    setDoctor]    = useState(null)
  const [schedules, setSchedules] = useState([])
  const [reviews,   setReviews]   = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!doctorId) { setLoading(false); return }
    async function loadData() {
      const [
        { data: doc },
        { data: scheds },
        { data: revs },
      ] = await Promise.all([
        supabase.from('doctors').select('*').eq('id', doctorId).maybeSingle(),
        supabase
          .from('doctor_schedules')
          .select('dia_semana, hora_inicio, hora_fin, activo')
          .eq('doctor_id', doctorId),
        supabase
          .from('reviews')
          .select('id, rating, comentario, created_at, profiles:patient_id(full_name)')
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      setDoctor(doc ?? null)
      setSchedules(scheds ?? [])
      setReviews(revs ?? [])
      setLoading(false)
    }
    loadData()
  }, [doctorId])

  if (loading) return <ProfileSkeleton />

  if (!doctor) return <NotFoundState onBack={() => navigate(-1)} />

  const nombres   = doctor.nombres   ?? doctor.full_name ?? '?'
  const apellidos = doctor.apellidos ?? ''
  const cmp       = doctor.cmp       ?? doctor.cmp_code  ?? ''
  const spec      = doctor.especialidad ?? doctor.specialty ?? ''
  const titulo    = parseTitulo(nombres, cmp)
  const fullName  = `${titulo} ${nombres} ${apellidos}`.trim()
  const initials  = (nombres[0] ?? '?').toUpperCase() + (apellidos[0] ?? '?').toUpperCase()
  const rating    = Number(doctor.rating ?? 0)
  const revCount  = doctor.total_reviews ?? 0
  const price     = doctor.precio ?? 0
  const bio       = doctor.bio ?? doctor.descripcion ?? null

  const slots = getAvailableSlotsThisWeek(schedules)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: C.gray50 }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
        padding: '16px 16px 24px',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            width: 36, height: 36, borderRadius: 10, marginBottom: 16,
            background: 'rgba(255,255,255,0.2)', border: 'none',
            color: C.white, fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit', lineHeight: 1,
          }}
        >
          ←
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <Avatar initials={initials} fotoUrl={doctor.foto_url} size={80} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.white, lineHeight: 1.25 }}>
              {fullName}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 3 }}>
              {spec}
            </div>
            {cmp && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 2 }}>
                {cmp}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Stars rating={rating} size={13} />
              <span style={{ fontSize: 12, fontWeight: 800, color: C.white }}>
                {rating.toFixed(1)}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)' }}>
                ({revCount} reseñas)
              </span>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '10px 14px',
            textAlign: 'center', flexShrink: 0,
          }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: C.white }}>
              S/. {price}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: 600 }}>
              por consulta
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenido scrollable ─────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 16px' }}>

        {/* Badges de confianza */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap',
        }}>
          {[
            { icon: '✅', label: 'Médico verificado' },
            { icon: '🎓', label: 'CMP activo' },
            { icon: '📋', label: 'Receta digital' },
          ].map((b, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: C.green50, border: `1px solid ${C.green200}`,
              color: C.green800, fontSize: 10, fontWeight: 700,
              padding: '4px 10px', borderRadius: 20,
            }}>
              {b.icon} {b.label}
            </span>
          ))}
        </div>

        {/* Sobre el médico */}
        <div style={{
          background: C.white, borderRadius: 16, padding: '16px',
          boxShadow: S.sm, marginBottom: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: C.green50, border: `1px solid ${C.green200}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
            }}>📋</div>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.gray900 }}>
              Sobre el médico
            </span>
          </div>
          <p style={{
            fontSize: 13, color: C.gray600, margin: 0, lineHeight: 1.65,
          }}>
            {bio ?? `${titulo} ${nombres} ${apellidos} es especialista en ${spec}, comprometido con brindar atención médica de calidad a través de teleconsulta. Disponible para consultas virtuales en VIDASALUD.`}
          </p>
        </div>

        {/* Disponibilidad esta semana */}
        <div style={{
          background: C.white, borderRadius: 16, padding: '16px',
          boxShadow: S.sm, marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: C.green50, border: `1px solid ${C.green200}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
            }}>📅</div>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.gray900 }}>
              Disponibilidad esta semana
            </span>
          </div>

          {slots.length === 0 ? (
            <div style={{
              fontSize: 12, color: C.gray400, textAlign: 'center',
              padding: '12px 0', fontStyle: 'italic',
            }}>
              Sin horarios configurados — consulta disponibilidad al reservar
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {slots.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: s.esHoy ? C.green50 : C.gray50,
                    border: `1.5px solid ${s.esHoy ? C.green300 : C.gray200}`,
                    borderRadius: 12, padding: '8px 12px', minWidth: 60,
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: s.esHoy ? C.green700 : C.gray500,
                  }}>
                    {s.esHoy ? 'Hoy' : s.esMañana ? 'Mañana' : s.dia}
                  </span>
                  <span style={{
                    fontSize: 15, fontWeight: 800, marginTop: 3,
                    color: s.esHoy ? C.green800 : C.gray700,
                  }}>
                    {s.hora}
                  </span>
                </div>
              ))}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: C.gray50, border: `1.5px dashed ${C.gray200}`,
                borderRadius: 12, padding: '8px 12px', minWidth: 60,
              }}>
                <span style={{ fontSize: 10, color: C.green600, fontWeight: 700 }}>+más al</span>
                <span style={{ fontSize: 10, color: C.green600, fontWeight: 700 }}>reservar</span>
              </div>
            </div>
          )}
        </div>

        {/* Reseñas */}
        {reviews.length > 0 && (
          <div style={{
            background: C.white, borderRadius: 16, padding: '16px',
            boxShadow: S.sm, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: C.green50, border: `1px solid ${C.green200}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>💬</div>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.gray900 }}>
                  Reseñas de pacientes
                </span>
              </div>
              <div style={{
                background: C.green50, border: `1px solid ${C.green200}`,
                borderRadius: 20, padding: '3px 10px',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green700 }}>
                  ★ {rating.toFixed(1)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {reviews.map((rev, i) => {
                const name      = rev.profiles?.full_name ?? 'Paciente'
                const initial   = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                const isLast    = i === reviews.length - 1
                return (
                  <div
                    key={rev.id ?? i}
                    style={{
                      paddingBottom: isLast ? 0 : 14,
                      marginBottom: isLast ? 0 : 14,
                      borderBottom: isLast ? 'none' : `1px solid ${C.gray100}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${C.green500}, ${C.green800})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: C.white, fontWeight: 700, fontSize: 11,
                      }}>
                        {initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.gray800 }}>
                            {name}
                          </span>
                          <span style={{ fontSize: 10, color: C.gray400, flexShrink: 0 }}>
                            {timeAgo(rev.created_at)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <Stars rating={rev.rating} size={11} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.amber }}>
                            {rev.rating}.0
                          </span>
                        </div>
                        {rev.comentario && (
                          <p style={{
                            fontSize: 12, color: C.gray600, margin: '6px 0 0',
                            lineHeight: 1.55, fontStyle: 'italic',
                          }}>
                            "{rev.comentario}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sello RENIPRESS */}
        <div style={{
          background: C.green50, border: `1px solid ${C.green200}`,
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.green800 }}>
              Atención regulada · RENIPRESS registrado
            </div>
            <div style={{ fontSize: 10, color: C.green700, marginTop: 2, lineHeight: 1.5 }}>
              Médico colegiado · Receta electrónica válida · Ley 30421
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA sticky ──────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px 16px',
        background: C.white,
        borderTop: `1px solid ${C.gray100}`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.07)',
      }}>
        <button
          type="button"
          onClick={() => navigate(`/booking/${doctorId}`)}
          style={{
            width: '100%', padding: '16px 0',
            background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
            color: C.white, border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: S.greenMd,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            WebkitTapHighlightColor: 'transparent',
            transition: 'opacity 0.15s',
          }}
          onPointerDown={e => { e.currentTarget.style.opacity = '0.88' }}
          onPointerUp={e => { e.currentTarget.style.opacity = '1' }}
          onPointerLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          📅 Reservar consulta — S/. {price}
        </button>
      </div>

    </div>
  )
}
