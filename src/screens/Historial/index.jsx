import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

// ─── Paleta ───────────────────────────────────────────────────
const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green400: '#34D399',
  green200: '#A7F3D0', green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B', amberBg:  '#FFFBEB', amberText: '#B45309',
  gray900:  '#111827', gray700:  '#374151', gray500:   '#6B7280',
  gray400:  '#9CA3AF', gray300:  '#D1D5DB', gray200:   '#E5E7EB',
  gray100:  '#F3F4F6', gray50:   '#F9FAFB', white:     '#FFFFFF',
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
  })
}


function fmtAnio(iso) {
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', year: 'numeric',
  })
}

function parseSoap(raw) {
  try { const p = JSON.parse(raw); if (p?.s !== undefined) return p } catch {}
  return null
}

function getInitials(nombres = '', apellidos = '') {
  return ((nombres[0] ?? '').toUpperCase() + (apellidos[0] ?? '').toUpperCase()) || '?'
}

// ─── Subcomponentes ───────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ height: 12, width: '45%', background: C.gray100, borderRadius: 6 }} />
        <div style={{ height: 20, width: 80, background: C.gray100, borderRadius: 20 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.gray100, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 13, width: '70%', background: C.gray100, borderRadius: 6 }} />
          <div style={{ height: 11, width: '50%', background: C.gray100, borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ height: 11, width: '85%', background: C.gray100, borderRadius: 6 }} />
      <div style={{ height: 11, width: '60%', background: C.gray100, borderRadius: 6 }} />
    </div>
  )
}

const SOAP_LABELS = {
  s: { label: 'Subjetivo',  color: '#1D4ED8', bg: '#EFF6FF' },
  o: { label: 'Objetivo',   color: '#065F46', bg: C.green50  },
  a: { label: 'Evaluación', color: '#B45309', bg: '#FFFBEB'  },
  p: { label: 'Plan',       color: '#7C3AED', bg: '#F5F3FF'  },
}

function SoapBlock({ soap }) {
  return (
    <div style={{
      marginTop: 10, borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${C.gray200}`,
    }}>
      {['s', 'o', 'a', 'p'].map(key => {
        const val = soap[key]
        if (!val) return null
        const cfg = SOAP_LABELS[key]
        return (
          <div key={key} style={{
            display: 'flex', gap: 10, padding: '9px 12px',
            background: cfg.bg, borderBottom: `1px solid ${C.gray200}`,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: cfg.color,
              background: 'rgba(0,0,0,0.06)', padding: '2px 7px',
              borderRadius: 6, flexShrink: 0, alignSelf: 'flex-start', marginTop: 1,
              letterSpacing: 0.3,
            }}>
              {key.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: C.gray700, lineHeight: 1.5, flex: 1 }}>
              {val}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function YearDivider({ year }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '4px 0 2px',
    }}>
      <div style={{ flex: 1, height: 1, background: C.gray200 }} />
      <span style={{
        fontSize: 11, fontWeight: 700, color: C.gray400,
        background: C.gray100, padding: '3px 10px', borderRadius: 20,
      }}>
        {year}
      </span>
      <div style={{ flex: 1, height: 1, background: C.gray200 }} />
    </div>
  )
}

function ConsultaCard({ appt, expandedId, onToggle }) {
  const isOpen   = expandedId === appt.id
  const soap     = parseSoap(appt.notes_doctor)
  const doc      = appt.doctor ?? {}
  const raw      = appt.prescription
  const presc    = Array.isArray(raw) ? (raw[0] ?? null) : raw
  const isCPsP   = (doc.cmp ?? '').startsWith('CPsP')
  const titulo   = isCPsP ? 'Psic.' : (doc.nombres ?? '').trimEnd().endsWith('a') ? 'Dra.' : 'Dr.'
  const nombreDoc = [doc.nombres, doc.apellidos].filter(Boolean).join(' ') || 'Médico'
  const diagnosis = presc?.diagnosis || soap?.a || null

  return (
    <div style={{
      background: C.white, borderRadius: 16,
      border: `1.5px solid ${isOpen ? C.green400 : C.gray200}`,
      overflow: 'hidden',
      boxShadow: isOpen ? '0 4px 16px rgba(5,150,105,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'border-color 0.18s, box-shadow 0.18s',
    }}>

      {/* ── Franja de fecha ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: C.green50, borderBottom: `1px solid ${C.green100}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🗓</span>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.green800 }}>
              {fmtFecha(appt.scheduled_at)}
            </span>
            <span style={{ fontSize: 11, color: C.green700, marginLeft: 6 }}>
              {fmtHora(appt.scheduled_at)}
            </span>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: C.gray500,
          background: C.gray100, padding: '3px 9px', borderRadius: 20,
          letterSpacing: 0.3,
        }}>
          ✓ COMPLETADA
        </span>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ padding: '14px 16px 16px' }}>

        {/* Doctor */}
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.white, fontWeight: 800, fontSize: 14,
          }}>
            {getInitials(doc.nombres, doc.apellidos)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.gray900 }}>
              {titulo} {nombreDoc}
            </div>
            <div style={{ fontSize: 12, color: C.gray500, marginTop: 1 }}>
              {doc.especialidad ?? '—'}{doc.cmp ? ` · ${doc.cmp}` : ''}
            </div>
          </div>
          {appt.duration_minutes && (
            <span style={{ fontSize: 11, color: C.gray400, flexShrink: 0 }}>
              {appt.duration_minutes} min
            </span>
          )}
        </div>

        {/* Diagnóstico */}
        {diagnosis && (
          <div style={{
            background: C.green50, border: `1px solid ${C.green100}`,
            borderRadius: 10, padding: '8px 12px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.green700, marginBottom: 3, letterSpacing: 0.3 }}>
              DIAGNÓSTICO
            </div>
            <div style={{ fontSize: 13, color: C.gray900, lineHeight: 1.4 }}>
              {diagnosis}
            </div>
          </div>
        )}

        {/* SOAP expandible */}
        {soap && (
          <>
            <button
              onClick={() => onToggle(appt.id)}
              style={{
                width: '100%', background: 'none', border: `1px solid ${C.gray200}`,
                borderRadius: 9, padding: '7px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: 'inherit',
                color: C.gray500, fontSize: 12, fontWeight: 600,
              }}
            >
              <span>📋 Nota clínica completa</span>
              <span style={{
                display: 'inline-block',
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
                fontSize: 14,
              }}>▾</span>
            </button>
            {isOpen && <SoapBlock soap={soap} />}
          </>
        )}

        {/* Fila inferior: código + botón receta */}
        {presc && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.gray100}`,
          }}>
            {presc?.verification_code && (
              <span style={{ fontSize: 10, color: C.gray400, fontFamily: 'monospace' }}>
                {presc.verification_code}
              </span>
            )}
            {presc?.pdf_url && (
              <a
                href={presc.pdf_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: C.green700, color: C.white,
                  fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 9,
                  textDecoration: 'none', marginLeft: 'auto',
                  boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
                }}
              >
                <span>📄</span> Descargar receta
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pantalla principal ────────────────────────────────────────

export default function Historial() {
  const { profile } = useAuthStore()

  const [consultas,   setConsultas]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [expandedId,  setExpandedId]  = useState(null)
  const [searchFocus,  setSearchFocus]  = useState(false)
  const location                        = useLocation()
  const [soloRecetas,  setSoloRecetas]  = useState(location.state?.filtro === 'recetas')

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, scheduled_at, duration_minutes, notes_doctor,
          doctor:doctors!doctor_id ( nombres, apellidos, especialidad, cmp ),
          prescription:prescriptions!appointment_id ( appointment_id, diagnosis, pdf_url, verification_code )
        `)
        .eq('patient_id', profile.id)
        .eq('status', 'done')
        .order('scheduled_at', { ascending: false })

      if (cancelled) return

      if (error) {
        console.error('[Historial] appointments:', error.message)
        setError(error.message)
      } else {
        setConsultas(data ?? [])
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [profile?.id])

  const filtered = useMemo(() => {
    let items = consultas
    if (soloRecetas) {
      items = items.filter(c => {
        const raw = c.prescription
        return Array.isArray(raw) ? raw.length > 0 : raw !== null
      })
    }
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(c => {
      const d    = c.doctor ?? {}
      const soap = parseSoap(c.notes_doctor)
      const text = [
        d.nombres, d.apellidos, d.especialidad, d.cmp,
        soap?.a, soap?.s, c.prescription?.diagnosis,
      ].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [consultas, search, soloRecetas])

  function handleToggle(id) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  // Agrupa por año para mostrar divisores
  const grouped = useMemo(() => {
    const out = []
    let lastYear = null
    filtered.forEach(c => {
      const yr = fmtAnio(c.scheduled_at)
      if (yr !== lastYear) { out.push({ type: 'year', year: yr }); lastYear = yr }
      out.push({ type: 'card', data: c })
    })
    return out
  }, [filtered])

  return (
    <>
      <style>{`
        @keyframes hs-fade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      `}</style>

      {/* ── Cabecera de página ── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800}, ${C.green600})`,
        padding: '20px 20px 24px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              Historial clínico
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginTop: 2 }}>
              Mis consultas
            </div>
          </div>
          {!loading && (
            <div style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: 12,
              padding: '8px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.white, lineHeight: 1 }}>
                {consultas.length}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                {consultas.length === 1 ? 'consulta' : 'consultas'}
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginTop: 16 }}>
          <span style={{
            position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
            color: searchFocus ? C.green600 : 'rgba(255,255,255,0.5)',
            fontSize: 16, pointerEvents: 'none',
            transition: 'color 0.15s',
          }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por médico, especialidad o diagnóstico..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            style={{
              width: '100%', padding: '11px 14px 11px 40px',
              background: searchFocus ? C.white : 'rgba(255,255,255,0.18)',
              border: `1.5px solid ${searchFocus ? C.green400 : 'rgba(255,255,255,0.3)'}`,
              borderRadius: 12, fontSize: 13, outline: 'none',
              color: searchFocus ? C.gray900 : C.white,
              fontFamily: 'inherit',
              transition: 'all 0.18s',
            }}
          />
        </div>

        {/* Chip de filtro activo */}
        {soloRecetas && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.18)',
              border: '1.5px solid rgba(255,255,255,0.35)',
              borderRadius: 20, padding: '5px 10px 5px 12px',
            }}>
              <span style={{ fontSize: 13 }}>💊</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>
                Solo con receta
              </span>
              <button
                type="button"
                onClick={() => setSoloRecetas(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  color: C.white, cursor: 'pointer',
                  width: 18, height: 18, borderRadius: '50%',
                  fontSize: 13, lineHeight: 1, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, marginLeft: 2, fontFamily: 'inherit',
                }}
                aria-label="Quitar filtro recetas"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Contenido ── */}
      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Cargando */}
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            background: '#FEF2F2', borderRadius: 16, border: '1px solid #FECACA',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
              Error al cargar el historial
            </div>
            <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {/* Sin resultados del filtro */}
        {!loading && !error && consultas.length > 0 && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            background: C.gray50, borderRadius: 16,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.gray700 }}>
              Sin resultados
            </div>
            <div style={{ fontSize: 12, color: C.gray500, marginTop: 4 }}>
              {soloRecetas && !search.trim()
                ? 'Ninguna consulta tiene receta digital aún'
                : `No hay consultas que coincidan con "${search}"`}
            </div>
          </div>
        )}

        {/* Sin consultas */}
        {!loading && !error && consultas.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: C.green50, border: `2px solid ${C.green100}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.gray900 }}>
              Sin consultas aún
            </div>
            <div style={{ fontSize: 13, color: C.gray500, maxWidth: 240, textAlign: 'center', lineHeight: 1.5 }}>
              Aquí aparecerán tus consultas completadas con diagnóstico y notas clínicas.
            </div>
          </div>
        )}

        {/* Lista */}
        {!loading && !error && grouped.map((item) => {
          if (item.type === 'year') {
            return <YearDivider key={`yr-${item.year}`} year={item.year} />
          }
          return (
            <div key={item.data.id} style={{ animation: 'hs-fade 0.25s ease' }}>
              <ConsultaCard
                appt={item.data}
                expandedId={expandedId}
                onToggle={handleToggle}
              />
            </div>
          )
        })}
      </div>

      <div style={{ height: 8 }} />
    </>
  )
}
