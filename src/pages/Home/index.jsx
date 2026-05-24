import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import TriajeBot from '../../components/TriajeBot'

const C = {
  green900: '#064E3B',
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green500: '#10B981',
  green200: '#A7F3D0',
  green100: '#D1FAE5',
  green50:  '#ECFDF5',
  amber:    '#F59E0B',
  gray900:  '#111827',
  gray700:  '#374151',
  gray500:  '#6B7280',
  gray300:  '#D1D5DB',
  gray100:  '#F3F4F6',
  white:    '#FFFFFF',
}

const SPECIALTIES = [
  { icon: '🩺', label: 'General',     price: 35 },
  { icon: '👶', label: 'Pediatría',   price: 45 },
  { icon: '🧠', label: 'Psicología',  price: 50 },
  { icon: '🥗', label: 'Nutrición',   price: 40 },
  { icon: '❤️', label: 'Cardiología', price: 70 },
  { icon: '🦷', label: 'Odontología', price: 60 },
]

const STATUS_COLORS = {
  now:   { dot: C.green600, label: C.green700, bg: C.green50 },
  soon:  { dot: C.amber,    label: '#B45309',  bg: '#FFFBEB' },
  later: { dot: C.gray500,  label: C.gray500,  bg: C.gray100 },
}

// Transforma fila de Supabase al shape que usa la UI
function formatDoc(row) {
  const isCPsP     = row.cmp.startsWith('CPsP')
  const esFemenino = row.nombres.trimEnd().endsWith('a')
  const titulo     = isCPsP ? 'Psic.' : esFemenino ? 'Dra.' : 'Dr.'
  return {
    id:          row.id,
    initials:    row.nombres[0].toUpperCase() + row.apellidos[0].toUpperCase(),
    name:        `${titulo} ${row.nombres} ${row.apellidos}`,
    spec:        row.especialidad,
    cmp:         row.cmp,
    rating:      Number(row.rating),
    reviews:     row.total_reviews,
    price:       row.precio,
    fotoUrl:     row.foto_url ?? null,
    status:      'now',
    statusLabel: 'Disponible ahora',
  }
}

// ─── Subcomponentes ───────────────────────────────────────────

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
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: 700, fontSize: size * 0.33, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function StarRating({ rating }) {
  return (
    <span style={{ color: C.amber, fontWeight: 700, fontSize: 12 }}>
      ★ {rating.toFixed(1)}
    </span>
  )
}

function StatusBadge({ status, label }) {
  const s = STATUS_COLORS[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.label,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.dot,
        ...(status === 'now' ? { animation: 'pulse 2s infinite' } : {}),
      }} />
      {label}
    </span>
  )
}

function DoctorCard({ doc, onBook }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onBook(doc)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: C.white,
        border: `1.5px solid ${hovered ? C.green500 : C.gray300}`,
        borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
        transition: 'all 0.18s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(16,185,129,0.12)' : 'none',
      }}
    >
      <Avatar initials={doc.initials} fotoUrl={doc.fotoUrl} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.gray900 }}>{doc.name}</div>
        <div style={{ fontSize: 12, color: C.gray500, marginTop: 1 }}>
          {doc.spec} · {doc.cmp}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <StarRating rating={doc.rating} />
          <span style={{ fontSize: 11, color: C.gray500 }}>({doc.reviews} reseñas)</span>
          <StatusBadge status={doc.status} label={doc.statusLabel} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.green700 }}>S/. {doc.price}</div>
        <div style={{
          marginTop: 6, background: C.green700, color: C.white,
          fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8,
          opacity: hovered ? 1 : 0.85, transition: 'opacity 0.15s',
        }}>
          Reservar
        </div>
      </div>
    </div>
  )
}

function DoctorSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: C.white, border: `1.5px solid ${C.gray300}`,
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.gray100, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 14, width: '60%', background: C.gray100, borderRadius: 6 }} />
        <div style={{ height: 12, width: '80%', background: C.gray100, borderRadius: 6 }} />
        <div style={{ height: 12, width: '40%', background: C.gray100, borderRadius: 6 }} />
      </div>
      <div style={{ width: 56, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ height: 16, width: 48, background: C.gray100, borderRadius: 6 }} />
        <div style={{ height: 24, width: 56, background: C.gray100, borderRadius: 8 }} />
      </div>
    </div>
  )
}

function SpecialtyChip({ icon, label, price, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
      background: selected ? C.green700 : C.white,
      border: `1.5px solid ${selected ? C.green700 : C.gray300}`,
      transition: 'all 0.15s ease', minWidth: 72, flexShrink: 0,
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: selected ? C.white : C.gray700 }}>{label}</span>
      <span style={{ fontSize: 10, color: selected ? C.green100 : C.gray500 }}>S/. {price}</span>
    </div>
  )
}

function PromoStrip() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div style={{
      background: `linear-gradient(90deg, ${C.green800}, ${C.green600})`,
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎉</span>
        <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>
          Primera consulta a S/. 20 — solo hoy
        </span>
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}
        aria-label="Cerrar promoción"
      >×</button>
    </div>
  )
}

function SearchBar({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative', margin: '16px 20px 0' }}>
      <span style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: focused ? C.green600 : C.gray500, fontSize: 18, pointerEvents: 'none',
      }}>🔍</span>
      <input
        type="text"
        placeholder="Buscar médico, síntoma o especialidad..."
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 16px 12px 44px',
          border: `1.5px solid ${focused ? C.green500 : C.gray300}`,
          borderRadius: 12, fontSize: 13, outline: 'none',
          background: C.white, color: C.gray900,
          boxShadow: focused ? '0 0 0 3px rgba(16,185,129,0.12)' : 'none',
          transition: 'border-color 0.15s',
        }}
      />
    </div>
  )
}

function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 10px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gray900, margin: 0 }}>{title}</h2>
      {actionLabel && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', color: C.green700, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {actionLabel} →
        </button>
      )}
    </div>
  )
}

function QuickActions() {
  const navigate = useNavigate()
  const actions = [
    { icon: '⚡', label: 'Consulta\nahora',    color: C.green50,  border: C.green200, to: '/citas'     },
    { icon: '📅', label: 'Agendar\ncita',       color: '#EFF6FF',  border: '#BFDBFE', to: '/citas'     },
    { icon: '💊', label: 'Receta\nelectrónica', color: '#FFF7ED',  border: '#FED7AA', to: '/historial' },
    { icon: '📋', label: 'Mi\nhistorial',       color: '#F5F3FF',  border: '#DDD6FE', to: '/historial' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 20px' }}>
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => navigate(a.to)}
          style={{
            background: a.color, border: `1.5px solid ${a.border}`,
            borderRadius: 14, padding: '12px 8px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'transform 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span style={{ fontSize: 22 }}>{a.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.gray700, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
            {a.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function Home() {
  const navigate   = useNavigate()
  const { profile } = useAuthStore()
  const firstName  = profile?.full_name?.split(' ')[0] ?? ''

  const [search,       setSearch]       = useState('')
  const [selectedSpec, setSelectedSpec] = useState(null)
  const [doctors,      setDoctors]      = useState([])
  const [loadingDocs,  setLoadingDocs]  = useState(true)
  const [errorDocs,    setErrorDocs]    = useState(null)
  const [showTriaje,   setShowTriaje]   = useState(false)

  useEffect(() => {
    supabase
      .from('doctors')
      .select('*')
      .eq('activo', true)
      .order('rating', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setErrorDocs('No se pudo cargar la lista de médicos.')
        } else {
          setDoctors((data ?? []).map(formatDoc))
        }
        setLoadingDocs(false)
      })
  }, [])

  const handleBook = (doc) => {
    navigate(`/booking/${doc.id}`)
  }

  const filteredDocs = doctors.filter(d => {
    const q         = search.toLowerCase()
    const specMatch = !selectedSpec || d.spec.toLowerCase().includes(selectedSpec.toLowerCase())
    const txtMatch  = !q || d.name.toLowerCase().includes(q) || d.spec.toLowerCase().includes(q)
    return specMatch && txtMatch
  })

  return (
    <>
      {showTriaje && (
        <TriajeBot
          onClose={() => setShowTriaje(false)}
          onSelectSpecialty={(spec) => {
            setSelectedSpec(spec)
            setSearch('')
            setShowTriaje(false)
          }}
        />
      )}

      <PromoStrip />

      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
        padding: '20px 20px 28px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              {firstName ? `Hola, ${firstName} 👋` : 'Bienvenido 👋'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginTop: 2 }}>
              ¿Cómo te sientes hoy?
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
              📍 Perú · Médicos disponibles ahora
            </div>
          </div>
          <button
            onClick={() => toast('Sin notificaciones nuevas')}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 20 }}>🔔</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[
            { n: loadingDocs ? '…' : String(doctors.length), label: 'Médicos online'  },
            { n: '< 5 min',                                   label: 'Espera promedio' },
            { n: 'S/. 20',                                    label: 'Promo hoy'       },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, background: 'rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '8px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{s.n}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      {/* Asistente de triaje IA */}
      <button
        onClick={() => setShowTriaje(true)}
        style={{
          margin: '12px 20px 0',
          width: 'calc(100% - 40px)',
          padding: '13px 16px',
          background: `linear-gradient(135deg, ${C.green900}, ${C.green700})`,
          border: 'none', borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 16px rgba(5,150,105,0.28)',
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>🤖</span>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>
            ¿Qué médico necesito?
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Describe tus síntomas · La IA te orienta en segundos
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, flexShrink: 0 }}>›</span>
      </button>

      <SectionHeader title="Acciones rápidas" />
      <QuickActions />

      <SectionHeader title="Especialidades" actionLabel="Ver todas" onAction={() => {}} />
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 4px', overflowX: 'auto' }}>
        {SPECIALTIES.map((s, i) => (
          <SpecialtyChip
            key={i}
            {...s}
            selected={selectedSpec === s.label}
            onClick={() => setSelectedSpec(selectedSpec === s.label ? null : s.label)}
          />
        ))}
      </div>

      <SectionHeader
        title={selectedSpec ?? 'Disponibles ahora'}
        actionLabel="Ver todos"
        onAction={() => {}}
      />

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Estado: cargando */}
        {loadingDocs && (
          <>
            <DoctorSkeleton />
            <DoctorSkeleton />
            <DoctorSkeleton />
          </>
        )}

        {/* Estado: error */}
        {!loadingDocs && errorDocs && (
          <div style={{
            textAlign: 'center', padding: 24, color: C.gray500, fontSize: 13,
            background: C.gray100, borderRadius: 12,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            {errorDocs}
            <button
              onClick={() => { setLoadingDocs(true); setErrorDocs(null); }}
              style={{
                display: 'block', margin: '12px auto 0',
                background: 'none', border: `1px solid ${C.green600}`,
                color: C.green700, borderRadius: 8, padding: '6px 16px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Estado: sin resultados del filtro */}
        {!loadingDocs && !errorDocs && filteredDocs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: C.gray500, fontSize: 13 }}>
            No se encontraron médicos
            {search && ` para "${search}"`}
          </div>
        )}

        {/* Lista de médicos */}
        {!loadingDocs && !errorDocs && filteredDocs.map(d => (
          <DoctorCard key={d.id} doc={d} onBook={handleBook} />
        ))}
      </div>

      {/* Sello de confianza */}
      <div style={{
        margin: '20px 20px 8px',
        background: C.green50, border: `1px solid ${C.green100}`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green800 }}>
            Atención regulada · RENIPRESS registrado
          </div>
          <div style={{ fontSize: 11, color: C.green700, marginTop: 2 }}>
            Médicos colegiados · Receta electrónica válida · Ley 30421
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />
    </>
  )
}
