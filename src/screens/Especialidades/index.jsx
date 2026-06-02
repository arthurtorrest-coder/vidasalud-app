import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green200: '#A7F3D0',
  green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B',
  gray900:  '#111827', gray700:  '#374151', gray500:  '#6B7280',
  gray400:  '#9CA3AF', gray300:  '#D1D5DB', gray200:  '#E5E7EB',
  gray100:  '#F3F4F6', gray50:   '#F9FAFB', white:    '#FFFFFF',
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const ESPECIALIDADES = [
  { icon: '🩺', label: 'Medicina General',  precioBase: 35, bg: '#ECFDF5', accent: '#059669', border: '#A7F3D0' },
  { icon: '👶', label: 'Pediatría',          precioBase: 45, bg: '#EFF6FF', accent: '#2563EB', border: '#BFDBFE' },
  { icon: '🧠', label: 'Psicología',         precioBase: 50, bg: '#F5F3FF', accent: '#7C3AED', border: '#DDD6FE' },
  { icon: '🥗', label: 'Nutrición',          precioBase: 40, bg: '#FFF7ED', accent: '#EA580C', border: '#FED7AA' },
  { icon: '❤️', label: 'Cardiología',        precioBase: 70, bg: '#FEF2F2', accent: '#DC2626', border: '#FECACA' },
  { icon: '🦷', label: 'Odontología',        precioBase: 60, bg: '#FFFBEB', accent: '#D97706', border: '#FDE68A' },
  { icon: '👁️', label: 'Oftalmología',       precioBase: 65, bg: '#F0FDF4', accent: '#15803D', border: '#BBF7D0' },
  { icon: '🦴', label: 'Traumatología',      precioBase: 75, bg: '#FFF1F2', accent: '#BE123C', border: '#FECDD3' },
  { icon: '🌿', label: 'Dermatología',       precioBase: 60, bg: '#F0FDFA', accent: '#0D9488', border: '#99F6E4' },
  { icon: '💊', label: 'Endocrinología',     precioBase: 70, bg: '#FDF4FF', accent: '#9333EA', border: '#E9D5FF' },
  { icon: '🫁', label: 'Neumología',         precioBase: 65, bg: '#F0F9FF', accent: '#0284C7', border: '#BAE6FD' },
  { icon: '🧪', label: 'Gastroenterología', precioBase: 75, bg: '#FEFCE8', accent: '#CA8A04', border: '#FEF08A' },
]

// ─── Helpers ──────────────────────────────────────────────────

function formatDoc(row) {
  const nombres   = row.nombres   ?? row.full_name ?? '?'
  const apellidos = row.apellidos ?? ''
  const spec      = row.especialidad ?? row.specialty ?? ''
  const cmp       = row.cmp ?? row.cmp_code ?? ''
  const precio    = row.precio ?? (row.consultation_fee ? Math.round(row.consultation_fee / 100) : 0)
  const isCPsP    = cmp.startsWith('CPsP')
  const femenino  = nombres.trimEnd().endsWith('a')
  const titulo    = isCPsP ? 'Psic.' : femenino ? 'Dra.' : 'Dr.'
  return {
    id:      row.id,
    initials:(nombres[0] ?? '?').toUpperCase() + (apellidos[0] ?? '?').toUpperCase(),
    name:    `${titulo} ${nombres} ${apellidos}`.trim(),
    spec,
    cmp,
    rating:  Number(row.rating ?? 0),
    reviews: row.total_reviews ?? row.review_count ?? 0,
    price:   precio,
    fotoUrl: row.foto_url ?? null,
  }
}

function matchesSpec(docSpec, espLabel) {
  const a = (docSpec ?? '').toLowerCase()
  const b = espLabel.toLowerCase()
  return a.includes(b) || b.includes(a) ||
    // Aliases comunes
    (b.includes('general') && a.includes('general')) ||
    (b.includes('psicolog') && a.includes('psicolog'))
}

function getProximosSlots(doctorId, allSchedules) {
  const diaHoy = new Date().getDay()
  const scheds = allSchedules.filter(s => s.doctor_id === doctorId && s.activo !== false)
  const result = []
  for (let i = 0; i < 7 && result.length < 3; i++) {
    const dia = (diaHoy + i) % 7
    const bloques = scheds
      .filter(s => s.dia_semana === dia)
      .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
    if (bloques.length > 0) {
      result.push({
        dia:    DIAS[dia],
        hora:   (bloques[0].hora_inicio ?? '00:00').slice(0, 5),
        esHoy:  i === 0,
      })
    }
  }
  return result
}

// ─── Sub-componentes ──────────────────────────────────────────

function Avatar({ initials, fotoUrl, size = 48 }) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={initials}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 800, fontSize: size * 0.34,
    }}>
      {initials}
    </div>
  )
}

function SpecialtyCard({ esp, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '18px 8px 14px', borderRadius: 18, cursor: 'pointer',
        background: hov ? esp.bg : C.white,
        border: `1.5px solid ${hov ? esp.accent : C.gray200}`,
        transition: 'all 0.16s ease',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 8px 24px ${esp.accent}22` : 'none',
        gap: 7,
      }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 14, flexShrink: 0,
        background: esp.bg,
        border: `1.5px solid ${esp.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>
        {esp.icon}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 800, color: C.gray700,
        textAlign: 'center', lineHeight: 1.3,
      }}>
        {esp.label}
      </span>
      <span style={{ fontSize: 10, color: esp.accent, fontWeight: 700 }}>
        S/. {esp.precioBase}+
      </span>
    </div>
  )
}

function DoctorCardWithSlots({ doc, slots, onBook }) {
  const [hov, setHov] = useState(false)
  const hasSlots = slots.length > 0

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.white,
        border: `1.5px solid ${hov ? C.green500 : C.gray200}`,
        borderRadius: 16, padding: '14px 14px 12px',
        transition: 'all 0.16s',
        boxShadow: hov ? '0 6px 20px rgba(16,185,129,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar initials={doc.initials} fotoUrl={doc.fotoUrl} size={48} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900, lineHeight: 1.2 }}>
            {doc.name}
          </div>
          <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
            {doc.spec}{doc.cmp ? ` · ${doc.cmp}` : ''}
          </div>
          {doc.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
              <span style={{ color: C.amber, fontSize: 11, fontWeight: 700 }}>
                ★ {doc.rating.toFixed(1)}
              </span>
              {doc.reviews > 0 && (
                <span style={{ fontSize: 10, color: C.gray400 }}>({doc.reviews} reseñas)</span>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.green700 }}>
            S/. {doc.price || '—'}
          </div>
          <button
            type="button"
            onClick={() => onBook(doc.id)}
            style={{
              marginTop: 6,
              background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
              color: C.white, border: 'none', borderRadius: 8,
              padding: '6px 12px', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
            }}
          >
            Reservar
          </button>
        </div>
      </div>

      {/* Próximos horarios */}
      <div style={{
        marginTop: 10, paddingTop: 10,
        borderTop: `1px solid ${C.gray100}`,
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, color: C.gray400, fontWeight: 600, flexShrink: 0 }}>
          📅 Próximos:
        </span>
        {hasSlots ? (
          <>
            {slots.map((s, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: s.esHoy ? C.green50 : C.gray50,
                  border: `1px solid ${s.esHoy ? C.green200 : C.gray200}`,
                  color: s.esHoy ? C.green700 : C.gray500,
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                }}
              >
                {s.esHoy ? 'Hoy' : s.dia} {s.hora}
              </span>
            ))}
            <span style={{ fontSize: 10, color: C.green600, fontWeight: 600 }}>
              · más al reservar
            </span>
          </>
        ) : (
          <span style={{ fontSize: 10, color: C.gray400 }}>
            Ver disponibilidad al reservar
          </span>
        )}
      </div>
    </div>
  )
}

function DoctorSkeleton() {
  const bar = (w, h = 10) => (
    <div style={{ width: w, height: h, background: C.gray100, borderRadius: 6 }} />
  )
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.gray200}`,
      borderRadius: 16, padding: '14px 14px 12px',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.gray100, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {bar('55%', 12)}
          {bar('75%')}
          {bar('30%')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {bar(44, 14)}
          {bar(56, 26)}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        {bar(60)} {bar(60)} {bar(60)}
      </div>
    </div>
  )
}

function SpecialtyGridSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: 18, background: C.gray50,
            border: `1.5px solid ${C.gray100}`,
            padding: '18px 8px 14px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}
        >
          <div style={{ width: 50, height: 50, borderRadius: 14, background: C.gray100 }} />
          <div style={{ width: '70%', height: 10, background: C.gray100, borderRadius: 6 }} />
          <div style={{ width: '50%', height: 9, background: C.gray100, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function Especialidades() {
  const navigate = useNavigate()

  const [selectedSpec, setSelectedSpec] = useState(null)
  const [doctors,      setDoctors]      = useState([])
  const [schedules,    setSchedules]    = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    async function loadData() {
      const [{ data: docs }, { data: scheds }] = await Promise.all([
        supabase.from('doctors').select('*'),
        supabase.from('doctor_schedules')
          .select('doctor_id, dia_semana, hora_inicio, activo'),
      ])
      const activos = (docs ?? []).filter(d => d.activo !== false && d.aprobado !== false)
      setDoctors(activos.map(formatDoc))
      setSchedules(scheds ?? [])
      setLoading(false)
    }
    loadData()
  }, [])

  const doctorsForSpec = selectedSpec
    ? doctors.filter(d => matchesSpec(d.spec, selectedSpec.label))
    : []

  function handleBack() {
    if (selectedSpec) {
      setSelectedSpec(null)
    } else {
      navigate(-1)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
        padding: '18px 16px 22px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: C.white, fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            ←
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedSpec ? (
              <>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Especialidades
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.white, lineHeight: 1.2, marginTop: 1 }}>
                  {selectedSpec.icon} {selectedSpec.label}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  VIDASALUD
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, color: C.white, marginTop: 1 }}>
                  Especialidades
                </div>
              </>
            )}
          </div>

          {selectedSpec && !loading && (
            <div style={{
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 20, padding: '4px 12px', flexShrink: 0,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>
                {doctorsForSpec.length} médico{doctorsForSpec.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Sub-header stats (solo cuando no hay especialidad seleccionada) */}
        {!selectedSpec && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {[
              { n: String(ESPECIALIDADES.length), label: 'Especialidades' },
              { n: loading ? '…' : String(doctors.length), label: 'Médicos activos' },
              { n: 'S/. 35+',                              label: 'Desde' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, background: 'rgba(255,255,255,0.14)',
                borderRadius: 10, padding: '7px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{s.n}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.68)', marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Contenido ───────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '16px 14px 24px', overflowY: 'auto' }}>

        {loading ? (
          /* Estado de carga */
          selectedSpec ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DoctorSkeleton />
              <DoctorSkeleton />
              <DoctorSkeleton />
            </div>
          ) : (
            <SpecialtyGridSkeleton />
          )
        ) : selectedSpec ? (
          /* Lista de médicos para la especialidad seleccionada */
          doctorsForSpec.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '40px 20px', gap: 12, textAlign: 'center',
            }}>
              <span style={{ fontSize: 44 }}>{selectedSpec.icon}</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gray700 }}>
                Sin médicos disponibles
              </div>
              <p style={{ fontSize: 13, color: C.gray500, margin: 0, lineHeight: 1.6 }}>
                No hay especialistas en {selectedSpec.label} activos por el momento.
                Pronto agregaremos más médicos.
              </p>
              <button
                type="button"
                onClick={() => setSelectedSpec(null)}
                style={{
                  marginTop: 8, padding: '10px 24px',
                  background: C.green700, color: C.white,
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Ver otras especialidades
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Nota informativa */}
              <div style={{
                background: selectedSpec.bg,
                border: `1px solid ${selectedSpec.border}`,
                borderRadius: 12, padding: '10px 14px',
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{selectedSpec.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: selectedSpec.accent }}>
                    {selectedSpec.label}
                  </div>
                  <div style={{ fontSize: 10, color: selectedSpec.accent, opacity: 0.8, marginTop: 1 }}>
                    Consulta desde S/. {selectedSpec.precioBase} · Médicos colegiados CMP
                  </div>
                </div>
              </div>

              {/* Tarjetas de médicos */}
              {doctorsForSpec.map(doc => (
                <DoctorCardWithSlots
                  key={doc.id}
                  doc={doc}
                  slots={getProximosSlots(doc.id, schedules)}
                  onBook={id => navigate(`/medico/${id}`)}
                />
              ))}

              {/* Sello regulatorio */}
              <div style={{
                background: C.green50, border: `1px solid ${C.green100}`,
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', gap: 10, alignItems: 'center',
                marginTop: 4,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
                <span style={{ fontSize: 10, color: C.green700, lineHeight: 1.5 }}>
                  Médicos verificados · CMP/CPsP activo · Receta electrónica válida bajo la Ley 30421
                </span>
              </div>
            </div>
          )
        ) : (
          /* Grilla de especialidades */
          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 14, fontWeight: 600 }}>
              Selecciona una especialidad para ver médicos disponibles
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {ESPECIALIDADES.map((esp, i) => (
                <SpecialtyCard
                  key={i}
                  esp={esp}
                  onClick={() => setSelectedSpec(esp)}
                />
              ))}
            </div>

            {/* Acceso rápido a todos los médicos */}
            <div style={{
              marginTop: 20, background: C.green50,
              border: `1.5px solid ${C.green200}`,
              borderRadius: 16, padding: '16px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/inicio')}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                🔍
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.green800 }}>
                  Ver todos los médicos
                </div>
                <div style={{ fontSize: 11, color: C.green700, marginTop: 2 }}>
                  Busca por nombre, síntoma o especialidad
                </div>
              </div>
              <span style={{ color: C.green600, fontSize: 20 }}>›</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
