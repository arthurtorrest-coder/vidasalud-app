import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

// ─── Modal de detalle ─────────────────────────────────────────

function BoticaModal({ f, onClose, onConsultar }) {
  const initials = (f.nombre ?? 'B').slice(0, 2).toUpperCase()

  function abrirMaps() {
    const q = encodeURIComponent([f.direccion, f.distrito, f.ciudad].filter(Boolean).join(', '))
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank', 'noopener')
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.50)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: C.white,
          borderRadius: '20px 20px 0 0',
          maxHeight: '88vh', overflowY: 'auto',
          paddingBottom: 28,
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.gray200 }} />
        </div>

        {/* Cabecera: logo + nombre */}
        <div style={{ padding: '12px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {f.logo_url ? (
            <img
              src={f.logo_url} alt={f.nombre}
              style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 14, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: C.white,
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.gray900, lineHeight: 1.2 }}>{f.nombre}</div>
            <span style={{
              display: 'inline-block', marginTop: 5,
              fontSize: 10, fontWeight: 700, color: C.green700,
              background: C.green50, border: `1px solid ${C.green200}`,
              padding: '2px 8px', borderRadius: 8,
            }}>
              Botica aliada VIDASALUD
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: C.gray100, border: 'none', borderRadius: '50%',
              width: 30, height: 30, cursor: 'pointer', fontSize: 14,
              color: C.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >✕</button>
        </div>

        <div style={{ height: 1, background: C.gray100, margin: '0 20px' }} />

        {/* Info rows */}
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Dirección */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>📍</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.6 }}>Dirección</div>
              <div style={{ fontSize: 13, color: C.gray900, marginTop: 2 }}>{f.direccion || '—'}</div>
              {(f.distrito || f.ciudad) && (
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                  {[f.distrito, f.ciudad].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Teléfono */}
          {f.telefono && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>📞</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.6 }}>Teléfono</div>
                <a
                  href={`tel:${f.telefono}`}
                  style={{ fontSize: 13, color: C.green700, fontWeight: 700, textDecoration: 'none', marginTop: 2, display: 'block' }}
                >
                  {f.telefono}
                </a>
              </div>
              <a
                href={`tel:${f.telefono}`}
                style={{
                  background: C.green50, border: `1.5px solid ${C.green200}`,
                  borderRadius: 8, padding: '7px 14px',
                  fontSize: 12, fontWeight: 700, color: C.green700,
                  textDecoration: 'none', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                📲 Llamar
              </a>
            </div>
          )}

          {/* Código DIGEMID */}
          {f.codigo_digemid && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>🏷️</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.6 }}>Código DIGEMID</div>
                <div style={{ fontSize: 13, color: C.gray900, marginTop: 2, fontFamily: 'monospace', letterSpacing: 0.5 }}>{f.codigo_digemid}</div>
              </div>
            </div>
          )}

          {/* Horario */}
          {f.horario && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>🕐</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.6 }}>Horario</div>
                <div style={{ fontSize: 13, color: C.gray900, marginTop: 2 }}>{f.horario}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: C.gray100, margin: '0 20px 16px' }} />

        {/* Botones de acción */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={abrirMaps}
            style={{
              width: '100%', padding: '13px 0',
              background: C.green50, border: `1.5px solid ${C.green200}`,
              borderRadius: 12, fontSize: 14, fontWeight: 700, color: C.green700,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            📍 Cómo llegar
          </button>
          <button
            onClick={() => { onConsultar(f); onClose() }}
            style={{
              width: '100%', padding: '14px 0',
              background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
              border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 800, color: C.white,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            💊 Consultar aquí
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta de botica ────────────────────────────────────────

function FarmaciaCard({ f, onSelect }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onSelect(f)}
      style={{
        background: hov ? C.green50 : C.white,
        border: `1.5px solid ${hov ? C.green200 : C.gray200}`,
        borderRadius: 16, padding: '14px 16px',
        transition: 'all 0.15s',
        boxShadow: hov ? '0 4px 16px rgba(5,150,105,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {f.logo_url ? (
          <img
            src={f.logo_url} alt={f.nombre}
            style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: C.white,
          }}>
            {(f.nombre ?? 'B').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900, lineHeight: 1.2 }}>{f.nombre}</div>
          <div style={{
            display: 'inline-block', marginTop: 4,
            fontSize: 10, fontWeight: 700, color: C.green700,
            background: C.green50, border: `1px solid ${C.green200}`,
            padding: '2px 8px', borderRadius: 8,
          }}>
            Botica aliada VIDASALUD
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.gray600 }}>
              <span>📍</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.direccion}, {f.distrito}
              </span>
            </div>
            {f.telefono && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.gray600 }}>
                <span>📞</span>
                <span>{f.telefono}</span>
              </div>
            )}
          </div>
        </div>
        <span style={{ color: C.gray300, fontSize: 20, flexShrink: 0 }}>›</span>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: C.gray100, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 14, width: '55%', background: C.gray100, borderRadius: 6 }} />
          <div style={{ height: 10, width: '75%', background: C.gray100, borderRadius: 6 }} />
          <div style={{ height: 10, width: '60%', background: C.gray100, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────

export default function Farmacias() {
  const navigate = useNavigate()

  const [busqueda,         setBusqueda]         = useState('')
  const [farmacias,        setFarmacias]        = useState([])
  const [loading,          setLoading]          = useState(false)
  const [buscado,          setBuscado]          = useState(false)
  const [selectedFarmacia, setSelectedFarmacia] = useState(null)

  const buscar = useCallback(async (termino) => {
    if (!termino.trim()) { setFarmacias([]); setBuscado(false); return }
    setLoading(true)
    setBuscado(true)

    const q = termino.trim().toLowerCase()
    const { data, error } = await supabase
      .from('farmacias')
      .select('id, nombre, logo_url, ciudad, distrito, direccion, telefono, codigo_referido, codigo_digemid, horario')
      .eq('aprobado', true)
      .eq('activo', true)
      .or(`ciudad.ilike.%${q}%,distrito.ilike.%${q}%,nombre.ilike.%${q}%`)
      .order('nombre', { ascending: true })
      .limit(20)

    if (!error) setFarmacias(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => buscar(busqueda), 400)
    return () => clearTimeout(t)
  }, [busqueda, buscar])

  function handleConsultar(f) {
    localStorage.setItem('vs_farmacia_ref', f.codigo_referido)
    navigate('/inicio')
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.gray50,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '18px 20px 28px', flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/inicio')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: C.white, borderRadius: 20, padding: '5px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
            fontFamily: 'inherit',
          }}
        >
          ← Inicio
        </button>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 }}>
          💊 Boticas aliadas
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
          Farmacias que aceptan recetas electrónicas de VIDASALUD en tu zona
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', marginTop: 16 }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 16, pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            placeholder="Busca por ciudad o distrito… (ej: Huaraz, Independencia)"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              width: '100%', padding: '12px 12px 12px 42px',
              background: C.white, border: 'none', borderRadius: 12,
              fontSize: 13, color: C.gray900, outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => { setBusqueda(''); setBuscado(false); setFarmacias([]) }}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: C.gray200, border: 'none', borderRadius: '50%',
                width: 20, height: 20, cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: C.gray500, lineHeight: 1,
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {!buscado && !loading && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 48 }}>🏪</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.gray700 }}>¿Dónde estás?</div>
            <p style={{ fontSize: 13, color: C.gray500, margin: 0, lineHeight: 1.6, maxWidth: 280 }}>
              Escribe tu ciudad o distrito para encontrar boticas aliadas que aceptan recetas electrónicas de VIDASALUD.
            </p>
          </div>
        )}

        {loading && <><Skeleton /><Skeleton /><Skeleton /></>}

        {!loading && buscado && farmacias.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '36px 20px',
            background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          }}>
            <span style={{ fontSize: 40 }}>😔</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.gray700, marginTop: 12 }}>
              Sin boticas aliadas en esa zona
            </div>
            <p style={{ fontSize: 12, color: C.gray500, margin: '8px 0 16px', lineHeight: 1.6 }}>
              Aún no tenemos boticas aliadas en "{busqueda}". ¿Tienes una botica? ¡Únete!
            </p>
            <button
              onClick={() => navigate('/registro-farmacia')}
              style={{
                padding: '10px 22px',
                background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                color: C.white, border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Registrar mi botica
            </button>
          </div>
        )}

        {!loading && farmacias.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.gray500 }}>
              {farmacias.length} botica{farmacias.length !== 1 ? 's' : ''} encontrada{farmacias.length !== 1 ? 's' : ''}
            </div>
            {farmacias.map(f => (
              <FarmaciaCard key={f.id} f={f} onSelect={setSelectedFarmacia} />
            ))}
          </>
        )}

        {!loading && (
          <div style={{
            background: C.green50, border: `1.5px solid ${C.green200}`,
            borderRadius: 14, padding: '14px 16px',
            display: 'flex', gap: 12, alignItems: 'center', marginTop: 4,
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>💊</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.green800 }}>¿Tienes una botica?</div>
              <div style={{ fontSize: 11, color: C.green700, marginTop: 2 }}>
                Únete a nuestra red y recibe pacientes con recetas electrónicas.
              </div>
            </div>
            <button
              onClick={() => navigate('/registro-farmacia')}
              style={{
                background: C.green700, color: C.white,
                border: 'none', borderRadius: 10, padding: '8px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              Registrarme
            </button>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {selectedFarmacia && (
        <BoticaModal
          f={selectedFarmacia}
          onClose={() => setSelectedFarmacia(null)}
          onConsultar={handleConsultar}
        />
      )}
    </div>
  )
}
