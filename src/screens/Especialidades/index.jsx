import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green200: '#A7F3D0',
  green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B',
  gray900:  '#111827', gray700:  '#374151', gray600: '#4B5563', gray500:  '#6B7280',
  gray400:  '#9CA3AF', gray300:  '#D1D5DB', gray200:  '#E5E7EB',
  gray100:  '#F3F4F6', gray50:   '#F9FAFB', white:    '#FFFFFF',
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getLimaDateTime() {
  const now = new Date()
  const lima = new Date(now.getTime() + (now.getTimezoneOffset() - 300) * 60000)
  return {
    diaSemana: lima.getDay(),
    horaActual: `${String(lima.getHours()).padStart(2,'0')}:${String(lima.getMinutes()).padStart(2,'0')}`,
  }
}

function computeAvailableNowIds(schedules) {
  const { diaSemana, horaActual } = getLimaDateTime()
  const ids = new Set()
  for (const s of schedules) {
    if (
      s.activo !== false &&
      s.dia_semana === diaSemana &&
      (s.hora_inicio ?? '') <= horaActual &&
      (s.hora_fin ?? '') > horaActual
    ) {
      ids.add(s.doctor_id)
    }
  }
  return ids
}

function formatHora12(hhmm) {
  const [h, m] = (hhmm ?? '00:00').split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

function getNextAvailabilityText(doctorId, allSchedules) {
  const { diaSemana: diaHoy, horaActual } = getLimaDateTime()
  const scheds = allSchedules.filter(s => s.doctor_id === doctorId && s.activo !== false)
  const todayLater = scheds
    .filter(s => s.dia_semana === diaHoy && (s.hora_inicio ?? '') > horaActual)
    .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
  if (todayLater.length > 0) {
    return `🕐 Hoy ${formatHora12(todayLater[0].hora_inicio)}`
  }
  for (let i = 1; i <= 6; i++) {
    const dia = (diaHoy + i) % 7
    const blocks = scheds
      .filter(s => s.dia_semana === dia)
      .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
    if (blocks.length > 0) {
      return `🕐 ${i === 1 ? 'Mañana' : `El ${DIAS_FULL[dia]}`} ${formatHora12(blocks[0].hora_inicio)}`
    }
  }
  return null
}

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
    (b.includes('general') && a.includes('general')) ||
    (b.includes('psicolog') && a.includes('psicolog'))
}

function getProximosSlots(doctorId, allSchedules) {
  const { diaSemana: diaHoy } = getLimaDateTime()
  const scheds = allSchedules.filter(s => s.doctor_id === doctorId && s.activo !== false)
  const result = []
  for (let i = 0; i < 7 && result.length < 3; i++) {
    const dia = (diaHoy + i) % 7
    const bloques = scheds
      .filter(s => s.dia_semana === dia)
      .sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
    if (bloques.length > 0) {
      result.push({ dia: DIAS[dia], hora: (bloques[0].hora_inicio ?? '00:00').slice(0, 5), esHoy: i === 0 })
    }
  }
  return result
}

// ─── Sub-componentes ──────────────────────────────────────────

function Avatar({ initials, fotoUrl, size = 48 }) {
  if (fotoUrl) {
    return (
      <img src={fotoUrl} alt={initials}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
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
      onPointerDown={() => setHov(true)}
      onPointerUp={() => setHov(false)}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '18px 8px 14px', borderRadius: 18, cursor: 'pointer',
        background: hov ? esp.bg : C.white,
        border: `1.5px solid ${hov ? esp.accent : C.gray200}`,
        transition: 'all 0.16s ease',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 8px 24px ${esp.accent}22` : 'none',
        gap: 7, WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 14, flexShrink: 0,
        background: esp.bg, border: `1.5px solid ${esp.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
      }}>
        {esp.icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: C.gray700, textAlign: 'center', lineHeight: 1.3 }}>
        {esp.label}
      </span>
      <span style={{ fontSize: 10, color: esp.accent, fontWeight: 700 }}>S/. {esp.precioBase}+</span>
    </div>
  )
}

function DoctorCardWithSlots({ doc, slots, isAvailableNow, nextAvailability, onBook }) {
  const [hov, setHov] = useState(false)
  const hasSlots = slots.length > 0
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isAvailableNow ? C.white : C.gray50,
        border: `1.5px solid ${hov ? C.green500 : C.gray200}`,
        borderRadius: 16, padding: '14px 14px 12px',
        transition: 'all 0.16s',
        boxShadow: hov ? '0 6px 20px rgba(16,185,129,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
        transform: hov ? 'translateY(-2px)' : 'none',
        opacity: isAvailableNow ? 1 : 0.82,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar initials={doc.initials} fotoUrl={doc.fotoUrl} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900, lineHeight: 1.2 }}>{doc.name}</div>
          <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
            {doc.spec}{doc.cmp ? ` · ${doc.cmp}` : ''}
          </div>
          {doc.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
              <span style={{ color: C.amber, fontSize: 11, fontWeight: 700 }}>★ {doc.rating.toFixed(1)}</span>
              {doc.reviews > 0 && (
                <span style={{ fontSize: 10, color: C.gray400 }}>({doc.reviews} reseñas)</span>
              )}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            {isAvailableNow ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: C.green50, color: C.green700,
                fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                border: `1px solid ${C.green200}`,
              }}>
                🟢 Disponible ahora
              </span>
            ) : nextAvailability ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: C.gray100, color: C.gray500,
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                border: `1px solid ${C.gray200}`,
              }}>
                {nextAvailability}
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.green700 }}>S/. {doc.price || '—'}</div>
          <button
            type="button"
            onClick={() => onBook(doc.id)}
            style={{
              marginTop: 6,
              background: isAvailableNow
                ? `linear-gradient(135deg, ${C.green700}, ${C.green500})`
                : C.gray300,
              color: C.white, border: 'none', borderRadius: 8,
              padding: '6px 12px', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: isAvailableNow ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isAvailableNow ? 'Reservar ahora' : '📅 Agendar cita'}
          </button>
        </div>
      </div>
      {hasSlots && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px solid ${C.gray100}`,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, color: C.gray400, fontWeight: 600, flexShrink: 0 }}>📅 Próximos:</span>
          {slots.map((s, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center',
              background: s.esHoy ? C.green50 : C.gray50,
              border: `1px solid ${s.esHoy ? C.green200 : C.gray200}`,
              color: s.esHoy ? C.green700 : C.gray500,
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
            }}>
              {s.esHoy ? 'Hoy' : s.dia} {s.hora}
            </span>
          ))}
          <span style={{ fontSize: 10, color: C.green600, fontWeight: 600 }}>· más al reservar</span>
        </div>
      )}
    </div>
  )
}

function DoctorSkeleton() {
  const bar = (w, h = 10) => (
    <div style={{ width: w, height: h, background: C.gray100, borderRadius: 6 }} />
  )
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 16, padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.gray100, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {bar('55%', 12)} {bar('75%')} {bar('30%')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {bar(44, 14)} {bar(56, 26)}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>{bar(60)} {bar(60)} {bar(60)}</div>
    </div>
  )
}

function SpecialtyGridSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 18, background: C.gray50, border: `1.5px solid ${C.gray100}`,
          padding: '18px 8px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: C.gray100 }} />
          <div style={{ width: '70%', height: 10, background: C.gray100, borderRadius: 6 }} />
          <div style={{ width: '50%', height: 9, background: C.gray100, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  )
}

// ─── Filtros ──────────────────────────────────────────────────

function FilterChip({ label, active, onPress, icon }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onPress() }}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: '5px 11px', borderRadius: 20,
        border: `1.5px solid ${active ? C.green600 : pressed ? C.green200 : C.gray300}`,
        background: active ? C.green600 : pressed ? C.green50 : C.white,
        color: active ? C.white : C.gray700,
        fontSize: 11, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.12s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
      {label}
    </button>
  )
}

function FilterBar({
  filterPrecio, setFilterPrecio,
  filterRating, setFilterRating,
  filterDisponible, setFilterDisponible,
  sortBy, setSortBy,
  open, setOpen,
  activeCount,
  totalCount, shownCount,
}) {
  return (
    <div style={{
      background: open ? C.green50 : C.white,
      border: `1.5px solid ${open ? C.green200 : C.gray200}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 14px',
          background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 8,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: 15 }}>🎛</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.gray700, flex: 1, textAlign: 'left' }}>
          Filtros y orden
        </span>
        {/* Resultado visible */}
        <span style={{ fontSize: 10, color: C.gray500 }}>
          {shownCount}{shownCount !== totalCount ? ` de ${totalCount}` : ''} médico{shownCount !== 1 ? 's' : ''}
        </span>
        {activeCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: C.green700,
            background: C.green100, padding: '2px 7px', borderRadius: 10,
          }}>
            {activeCount}
          </span>
        )}
        <span style={{
          fontSize: 11, color: C.gray400, display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>▼</span>
      </button>

      {/* Cuerpo expandido */}
      {open && (
        <div style={{
          borderTop: `1px solid ${C.green100}`,
          padding: '12px 14px 14px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>

          {/* Ordenar por */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.gray500,
              marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Ordenar por
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <FilterChip
                label="★ Mejor rating"
                active={sortBy === 'rating'}
                onPress={() => setSortBy('rating')}
              />
              <FilterChip
                label="S/. ↑ Menor precio"
                active={sortBy === 'price_asc'}
                onPress={() => setSortBy('price_asc')}
              />
              <FilterChip
                label="S/. ↓ Mayor precio"
                active={sortBy === 'price_desc'}
                onPress={() => setSortBy('price_desc')}
              />
            </div>
          </div>

          {/* Precio */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.gray500,
              marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Precio por consulta
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <FilterChip
                label="< S/. 40"
                active={filterPrecio === 'low'}
                onPress={() => setFilterPrecio(p => p === 'low' ? null : 'low')}
              />
              <FilterChip
                label="S/. 40 – 60"
                active={filterPrecio === 'mid'}
                onPress={() => setFilterPrecio(p => p === 'mid' ? null : 'mid')}
              />
              <FilterChip
                label="> S/. 60"
                active={filterPrecio === 'high'}
                onPress={() => setFilterPrecio(p => p === 'high' ? null : 'high')}
              />
            </div>
          </div>

          {/* Rating */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.gray500,
              marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Calificación mínima
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <FilterChip
                icon="⭐"
                label="4+ estrellas"
                active={filterRating === 4}
                onPress={() => setFilterRating(r => r === 4 ? null : 4)}
              />
              <FilterChip
                icon="⭐"
                label="3+ estrellas"
                active={filterRating === 3}
                onPress={() => setFilterRating(r => r === 3 ? null : 3)}
              />
              <FilterChip
                label="Todas"
                active={filterRating === null}
                onPress={() => setFilterRating(null)}
              />
            </div>
          </div>

          {/* Disponibilidad */}
          <div
            onClick={() => setFilterDisponible(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10,
              background: filterDisponible ? C.green50 : C.gray50,
              border: `1.5px solid ${filterDisponible ? C.green200 : C.gray200}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              border: `2px solid ${filterDisponible ? C.green600 : C.gray300}`,
              background: filterDisponible ? C.green600 : C.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {filterDisponible && (
                <span style={{ color: C.white, fontSize: 11, lineHeight: 1, fontWeight: 900 }}>✓</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: filterDisponible ? C.green800 : C.gray700 }}>
                Solo disponibles hoy
              </div>
              <div style={{ fontSize: 10, color: C.gray400, marginTop: 1 }}>
                Médicos con horario para {DIAS[new Date().getDay()]}
              </div>
            </div>
            {filterDisponible && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: C.green700,
                background: C.green100, padding: '2px 7px', borderRadius: 10,
              }}>
                Activo
              </span>
            )}
          </div>

          {/* Limpiar filtros */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilterPrecio(null)
                setFilterRating(null)
                setFilterDisponible(false)
                setSortBy('rating')
              }}
              style={{
                background: 'none',
                border: `1px solid ${C.gray200}`,
                borderRadius: 9, padding: '7px 0',
                width: '100%', fontSize: 11, fontWeight: 700,
                color: C.gray500, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
            >
              ✕ Limpiar {activeCount} filtro{activeCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function Especialidades() {
  const navigate = useNavigate()

  const [selectedSpec,     setSelectedSpec]     = useState(null)
  const [doctors,          setDoctors]          = useState([])
  const [schedules,        setSchedules]        = useState([])
  const [loading,          setLoading]          = useState(true)

  // Filtros
  const [filterPrecio,     setFilterPrecio]     = useState(null)
  const [filterRating,     setFilterRating]     = useState(null)
  const [filterDisponible, setFilterDisponible] = useState(false)
  const [sortBy,           setSortBy]           = useState('rating')
  const [filtersOpen,      setFiltersOpen]      = useState(false)

  useEffect(() => {
    async function loadData() {
      const [{ data: docs }, { data: scheds }] = await Promise.all([
        supabase.from('doctors').select('*'),
        supabase.from('doctor_schedules')
          .select('doctor_id, dia_semana, hora_inicio, hora_fin, activo'),
      ])
      const activos = (docs ?? []).filter(d => d.activo !== false && d.aprobado !== false)
      setDoctors(activos.map(formatDoc))
      setSchedules(scheds ?? [])
      setLoading(false)
    }
    loadData()
  }, [])

  // Resetear filtros al cambiar de especialidad
  useEffect(() => {
    setFilterPrecio(null)
    setFilterRating(null)
    setFilterDisponible(false)
    setSortBy('rating')
    setFiltersOpen(false)
  }, [selectedSpec?.label])

  // Médicos de la especialidad seleccionada (sin filtros)
  const doctorsForSpec = useMemo(() =>
    selectedSpec
      ? doctors.filter(d => matchesSpec(d.spec, selectedSpec.label))
      : [],
    [doctors, selectedSpec]
  )

  // IDs de médicos con horario hoy (para filtro disponible hoy)
  const todayDocIds = useMemo(() => {
    const { diaSemana: diaHoy } = getLimaDateTime()
    return new Set(
      schedules
        .filter(s => s.dia_semana === diaHoy && s.activo !== false)
        .map(s => s.doctor_id)
    )
  }, [schedules])

  // IDs de médicos disponibles ahora mismo (hora actual en Lima)
  const availableNowIds = useMemo(() => computeAvailableNowIds(schedules), [schedules])

  // Lista final con filtros + ordenamiento aplicados
  const filteredDoctors = useMemo(() => {
    let docs = [...doctorsForSpec]

    if (filterPrecio === 'low')  docs = docs.filter(d => d.price > 0 && d.price < 40)
    if (filterPrecio === 'mid')  docs = docs.filter(d => d.price >= 40 && d.price <= 60)
    if (filterPrecio === 'high') docs = docs.filter(d => d.price > 60)

    if (filterRating === 4) docs = docs.filter(d => d.rating >= 4)
    if (filterRating === 3) docs = docs.filter(d => d.rating >= 3)

    if (filterDisponible) docs = docs.filter(d => todayDocIds.has(d.id))

    if (sortBy === 'rating')     docs.sort((a, b) => {
      const aNow = availableNowIds.has(a.id) ? 0 : 1
      const bNow = availableNowIds.has(b.id) ? 0 : 1
      return aNow - bNow || b.rating - a.rating
    })
    if (sortBy === 'price_asc')  docs.sort((a, b) => {
      const aNow = availableNowIds.has(a.id) ? 0 : 1
      const bNow = availableNowIds.has(b.id) ? 0 : 1
      return aNow - bNow || a.price - b.price
    })
    if (sortBy === 'price_desc') docs.sort((a, b) => {
      const aNow = availableNowIds.has(a.id) ? 0 : 1
      const bNow = availableNowIds.has(b.id) ? 0 : 1
      return aNow - bNow || b.price - a.price
    })

    return docs
  }, [doctorsForSpec, filterPrecio, filterRating, filterDisponible, sortBy, todayDocIds, availableNowIds])

  const activeFilterCount = [
    filterPrecio !== null,
    filterRating !== null,
    filterDisponible,
    sortBy !== 'rating',
  ].filter(Boolean).length

  function handleBack() {
    if (selectedSpec) setSelectedSpec(null)
    else navigate(-1)
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
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 12px', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>
                {filteredDoctors.length}
                {filteredDoctors.length !== doctorsForSpec.length && (
                  <span style={{ opacity: 0.7 }}> de {doctorsForSpec.length}</span>
                )}
                {' '}médico{filteredDoctors.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Stats (solo sin especialidad seleccionada) */}
        {!selectedSpec && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {[
              { n: String(ESPECIALIDADES.length), label: 'Especialidades' },
              { n: loading ? '…' : String(doctors.length), label: 'Médicos activos' },
              { n: 'S/. 35+', label: 'Desde' },
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
          selectedSpec ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DoctorSkeleton /> <DoctorSkeleton /> <DoctorSkeleton />
            </div>
          ) : (
            <SpecialtyGridSkeleton />
          )
        ) : selectedSpec ? (

          /* ── Vista de médicos con filtros ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Info de especialidad */}
            <div style={{
              background: selectedSpec.bg, border: `1px solid ${selectedSpec.border}`,
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

            {/* ── Barra de filtros ── */}
            {doctorsForSpec.length > 0 && (
              <FilterBar
                filterPrecio={filterPrecio}     setFilterPrecio={setFilterPrecio}
                filterRating={filterRating}     setFilterRating={setFilterRating}
                filterDisponible={filterDisponible} setFilterDisponible={setFilterDisponible}
                sortBy={sortBy}                 setSortBy={setSortBy}
                open={filtersOpen}              setOpen={setFiltersOpen}
                activeCount={activeFilterCount}
                totalCount={doctorsForSpec.length}
                shownCount={filteredDoctors.length}
              />
            )}

            {/* ── Lista de médicos (vacía o filtrada) ── */}
            {filteredDoctors.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '32px 16px', gap: 12, textAlign: 'center',
                background: C.white, border: `1.5px solid ${C.gray200}`,
                borderRadius: 16,
              }}>
                <span style={{ fontSize: 40 }}>
                  {activeFilterCount > 0 ? '🔍' : selectedSpec.icon}
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gray700 }}>
                  {activeFilterCount > 0 ? 'Sin resultados con estos filtros' : 'Sin médicos disponibles'}
                </div>
                <p style={{ fontSize: 12, color: C.gray500, margin: 0, lineHeight: 1.6 }}>
                  {activeFilterCount > 0
                    ? 'Prueba ajustando los filtros o eliminando algunos.'
                    : `No hay especialistas en ${selectedSpec.label} activos por el momento.`}
                </p>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterPrecio(null)
                      setFilterRating(null)
                      setFilterDisponible(false)
                      setSortBy('rating')
                    }}
                    style={{
                      marginTop: 4, padding: '9px 20px',
                      background: C.green700, color: C.white,
                      border: 'none', borderRadius: 10,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    ✕ Limpiar filtros
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedSpec(null)}
                    style={{
                      marginTop: 4, padding: '9px 20px',
                      background: C.green700, color: C.white,
                      border: 'none', borderRadius: 10,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Ver otras especialidades
                  </button>
                )}
              </div>
            ) : (
              filteredDoctors.map(doc => (
                <DoctorCardWithSlots
                  key={doc.id}
                  doc={doc}
                  slots={getProximosSlots(doc.id, schedules)}
                  isAvailableNow={availableNowIds.has(doc.id)}
                  nextAvailability={availableNowIds.has(doc.id) ? null : getNextAvailabilityText(doc.id, schedules)}
                  onBook={id => navigate(`/medico/${id}`)}
                />
              ))
            )}

            {/* Sello regulatorio */}
            {filteredDoctors.length > 0 && (
              <div style={{
                background: C.green50, border: `1px solid ${C.green100}`,
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', gap: 10, alignItems: 'center', marginTop: 4,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
                <span style={{ fontSize: 10, color: C.green700, lineHeight: 1.5 }}>
                  Médicos verificados · CMP/CPsP activo · Receta electrónica válida bajo la Ley 30421
                </span>
              </div>
            )}
          </div>

        ) : (

          /* ── Grilla de especialidades ── */
          <div>
            <div style={{ fontSize: 12, color: C.gray500, marginBottom: 14, fontWeight: 600 }}>
              Selecciona una especialidad para ver médicos disponibles
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {ESPECIALIDADES.map((esp, i) => (
                <SpecialtyCard key={i} esp={esp} onClick={() => setSelectedSpec(esp)} />
              ))}
            </div>
            <div
              style={{
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
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                🔍
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.green800 }}>Ver todos los médicos</div>
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
