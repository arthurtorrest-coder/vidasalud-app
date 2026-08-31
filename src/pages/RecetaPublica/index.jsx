import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green200: '#A7F3D0',
  green100: '#D1FAE5', green50:  '#ECFDF5',
  gray900:  '#111827', gray700:  '#374151', gray500:  '#6B7280',
  gray300:  '#D1D5DB', gray200:  '#E5E7EB', gray100:  '#F3F4F6',
  white:    '#FFFFFF',
}

function doctorTitle(cmp, nombres) {
  if ((cmp ?? '').startsWith('CPsP')) return 'Psic.'
  return (nombres ?? '').trimEnd().endsWith('a') ? 'Dra.' : 'Dr.'
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'long', year: 'numeric',
  })
}

export default function RecetaPublica() {
  const { accessToken } = useParams()
  const [receta,  setReceta]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase.functions
      .invoke('receta-publica', { body: { access_token: accessToken } })
      .then(({ data, error: fnError }) => {
        if (cancelled) return
        if (fnError || !data?.ok) {
          setError(data?.error ?? fnError?.message ?? 'No se pudo cargar la receta')
        } else {
          setReceta(data.receta)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [accessToken])

  const doc     = receta?.doctor ?? {}
  const docName = [doc.nombres, doc.apellidos].filter(Boolean).join(' ')
  const titulo  = doctorTitle(doc.cmp, doc.nombres)
  const medicamentos = Array.isArray(receta?.medicines) ? receta.medicines : []

  return (
    <div style={{
      minHeight: '100vh', background: C.gray100,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes rp-spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Header */}
      <div style={{
        width: '100%', background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '20px 20px 26px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
          VIDA<span style={{ color: '#34D399' }}>SALUD</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
          Receta electrónica · Ley 30421
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 480, padding: '24px 18px 48px', flex: 1 }}>

        {/* Cargando */}
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            padding: '60px 0',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              border: `3px solid ${C.green100}`, borderTopColor: C.green600,
              animation: 'rp-spin 0.75s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: C.gray500 }}>Cargando receta…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            background: C.white, border: '1.5px solid #FECACA',
            borderRadius: 20, padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 44 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.gray900, marginTop: 12 }}>
              Receta no encontrada
            </div>
            <div style={{ fontSize: 13, color: C.gray500, marginTop: 6, lineHeight: 1.5 }}>
              El enlace puede estar incompleto o la receta ya no está disponible.
            </div>
          </div>
        )}

        {/* Receta */}
        {!loading && !error && receta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Médico */}
            <div style={{
              background: C.white, border: `1.5px solid ${C.gray200}`,
              borderRadius: 16, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.white, fontWeight: 800, fontSize: 16,
              }}>
                {(doc.nombres?.[0] ?? '?') + (doc.apellidos?.[0] ?? '')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>
                  {titulo} {docName}
                </div>
                <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
                  {doc.especialidad}{doc.cmp ? ` · ${doc.cmp}` : ''}
                </div>
              </div>
            </div>

            {/* Datos generales */}
            <div style={{
              background: C.white, border: `1.5px solid ${C.gray200}`,
              borderRadius: 16, overflow: 'hidden',
            }}>
              {[
                ['👤 Paciente', receta.patient?.full_name ?? '—'],
                ['📅 Fecha',    fmtFecha(receta.created_at)],
                ['🩺 Diagnóstico', receta.diagnosis || 'No especificado'],
              ].map(([label, value], i, arr) => (
                <div key={label} style={{
                  padding: '12px 16px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.gray100}` : 'none',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.gray900, marginTop: 3 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Medicamentos */}
            <div style={{
              background: C.white, border: `1.5px solid ${C.gray200}`,
              borderRadius: 16, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gray900, marginBottom: 12 }}>
                💊 Medicamentos
              </div>
              {medicamentos.length === 0 ? (
                <div style={{ fontSize: 13, color: C.gray500 }}>Sin medicamentos registrados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {medicamentos.map((m, i) => (
                    <div key={i} style={{
                      background: C.green50, border: `1px solid ${C.green100}`,
                      borderRadius: 12, padding: '10px 14px',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.green800 }}>
                        {m.nombre || 'Medicamento'}
                      </div>
                      <div style={{ fontSize: 12, color: C.green700, marginTop: 2 }}>
                        {[m.dosis, m.frecuencia, m.duracion].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {receta.indications && (
                <div style={{ marginTop: 12, fontSize: 12, color: C.gray700, lineHeight: 1.5 }}>
                  <strong>Indicaciones:</strong> {receta.indications}
                </div>
              )}
            </div>

            {/* Descargar PDF */}
            {receta.pdf_url ? (
              <a
                href={receta.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%', padding: '15px 0', border: 'none', borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                  color: C.white, fontSize: 14, fontWeight: 800, textAlign: 'center',
                  textDecoration: 'none', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                }}
              >
                📄 Descargar receta en PDF
              </a>
            ) : (
              <div style={{ fontSize: 12, color: C.gray500, textAlign: 'center' }}>
                El PDF de esta receta no está disponible.
              </div>
            )}

            {receta.verification_code && (
              <div style={{ textAlign: 'center', fontSize: 11, color: C.gray500 }}>
                Código de verificación: <strong style={{ color: C.gray700 }}>{receta.verification_code}</strong>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link to="/" style={{ fontSize: 12, color: C.green700, fontWeight: 700, textDecoration: 'none' }}>
            ← Ir a VIDASALUD
          </Link>
        </div>
      </div>
    </div>
  )
}
