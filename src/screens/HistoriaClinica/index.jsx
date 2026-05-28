import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981',
  green200: '#A7F3D0', green100: '#D1FAE5', green50:  '#ECFDF5',
  amber:    '#F59E0B', amberBg:  '#FFFBEB', amberText: '#B45309',
  blue700:  '#1D4ED8', blueBg:   '#EFF6FF',
  purple:   '#7C3AED', purpleBg: '#F5F3FF',
  gray900:  '#111827', gray700:  '#374151', gray500:   '#6B7280',
  gray400:  '#9CA3AF', gray300:  '#D1D5DB', gray200:   '#E5E7EB',
  gray100:  '#F3F4F6', gray50:   '#F9FAFB', white:     '#FFFFFF',
}

// ─── Helpers ──────────────────────────────────────────────────

function parseSoap(raw) {
  try {
    const p = JSON.parse(raw)
    if (p && (p.s !== undefined || p.o !== undefined || p.a !== undefined || p.p !== undefined)) return p
  } catch {}
  return null
}

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
  })
}

function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()) || '?'
}

function fmtFechaLarga(iso) {
  const s = new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const SOAP_CFG = {
  s: { label: 'Subjetivo',  color: '#1D4ED8', bg: '#EFF6FF' },
  o: { label: 'Objetivo',   color: '#047857', bg: '#ECFDF5' },
  a: { label: 'Evaluación', color: '#B45309', bg: '#FFFBEB' },
  p: { label: 'Plan',       color: '#7C3AED', bg: '#F5F3FF' },
}

// ─── Subcomponentes ───────────────────────────────────────────

function Skeleton({ h = 13, w = '100%' }) {
  return <div style={{ height: h, width: w, background: C.gray100, borderRadius: 6 }} />
}

function ConsultaItem({ appt, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  const soap  = parseSoap(appt.notes_doctor)
  const raw   = appt.prescription
  const presc = Array.isArray(raw) ? (raw[0] ?? null) : raw

  const diagnosis = presc?.diagnosis || soap?.a || null
  const doc       = appt.doctor ?? {}
  const isCPsP    = (doc.cmp ?? '').startsWith('CPsP')
  const femenino  = (doc.nombres ?? '').trimEnd().endsWith('a')
  const titulo    = isCPsP ? 'Psic.' : femenino ? 'Dra.' : 'Dr.'
  const nombreDoc = [doc.nombres, doc.apellidos].filter(Boolean).join(' ') || 'Médico'

  const dia = new Date(appt.scheduled_at).toLocaleString('es-PE', {
    timeZone: 'America/Lima', day: 'numeric',
  })
  const mes = new Date(appt.scheduled_at).toLocaleString('es-PE', {
    timeZone: 'America/Lima', month: 'short',
  })

  return (
    <div style={{
      background: C.white, borderRadius: 14,
      border: `1.5px solid ${open ? C.green200 : C.gray200}`,
      overflow: 'hidden',
      boxShadow: open ? '0 4px 16px rgba(5,150,105,0.09)' : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'border-color 0.18s, box-shadow 0.18s',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        {/* Date chip */}
        <div style={{
          flexShrink: 0, width: 46, textAlign: 'center',
          background: C.green50, borderRadius: 10, padding: '5px 0',
          border: `1px solid ${C.green100}`,
        }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.green700, lineHeight: 1 }}>{dia}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.green600, textTransform: 'uppercase', marginTop: 2 }}>{mes}</div>
          <div style={{ fontSize: 9, color: C.gray400, marginTop: 2 }}>{fmtHora(appt.scheduled_at)}</div>
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gray900 }}>
            {titulo} {nombreDoc}
          </div>
          <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>
            {doc.especialidad ?? '—'}{doc.cmp ? ` · ${doc.cmp}` : ''}
          </div>
          {appt.chief_complaint && (
            <div style={{
              fontSize: 11, color: C.green700, marginTop: 5,
              background: C.green50, borderRadius: 6,
              padding: '2px 7px', display: 'inline-block',
            }}>
              🩺 {appt.chief_complaint}
            </div>
          )}
          {diagnosis && !open && (
            <div style={{ fontSize: 11, color: C.amberText, marginTop: 4 }}>
              Dx: {diagnosis}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0, paddingTop: 2 }}>
          {presc?.pdf_url && (
            <span style={{
              fontSize: 9, background: C.green100, color: C.green700,
              padding: '2px 6px', borderRadius: 10, fontWeight: 700,
            }}>
              RECETA
            </span>
          )}
          <span style={{
            fontSize: 14, color: C.gray400,
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}>▾</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Diagnóstico */}
          {diagnosis && (
            <div style={{
              background: C.amberBg, borderRadius: 10,
              padding: '8px 12px', border: '1px solid #FDE68A',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.amberText, marginBottom: 3, letterSpacing: 0.3 }}>
                DIAGNÓSTICO
              </div>
              <div style={{ fontSize: 13, color: C.gray900, lineHeight: 1.4 }}>{diagnosis}</div>
            </div>
          )}

          {/* SOAP */}
          {soap && (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.gray200}` }}>
              {['s', 'o', 'a', 'p'].map(key => {
                const val = soap[key]
                if (!val) return null
                const cfg = SOAP_CFG[key]
                return (
                  <div key={key} style={{
                    display: 'flex', gap: 10, padding: '8px 12px',
                    background: cfg.bg, borderBottom: `1px solid ${C.gray100}`,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: cfg.color,
                      background: 'rgba(0,0,0,0.07)', padding: '2px 6px',
                      borderRadius: 5, flexShrink: 0, alignSelf: 'flex-start', marginTop: 1,
                    }}>
                      {key.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: C.gray700, lineHeight: 1.55, flex: 1 }}>
                      {val}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Medicamentos */}
          {Array.isArray(presc?.medicines) && presc.medicines.length > 0 && (
            <div style={{
              background: C.gray50, borderRadius: 10,
              padding: '10px 12px', border: `1px solid ${C.gray200}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray500, marginBottom: 8, letterSpacing: 0.3 }}>
                MEDICAMENTOS RECETADOS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {presc.medicines.map((med, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, flexShrink: 0 }}>💊</span>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.gray900 }}>
                        {med.nombre}
                      </span>
                      {(med.dosis || med.frecuencia || med.duracion) && (
                        <span style={{ fontSize: 11, color: C.gray500, marginLeft: 5 }}>
                          {[med.dosis, med.frecuencia, med.duracion].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descargar receta */}
          {presc?.pdf_url && (
            <a
              href={presc.pdf_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: C.green700, color: C.white,
                borderRadius: 10, padding: '9px 14px',
                fontSize: 12, fontWeight: 700, textDecoration: 'none',
              }}
            >
              📄 Descargar receta
              {presc.verification_code && (
                <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 400, fontFamily: 'monospace' }}>
                  · {presc.verification_code}
                </span>
              )}
            </a>
          )}

          {!soap && !diagnosis && !presc && (
            <div style={{ fontSize: 12, color: C.gray400, textAlign: 'center', padding: '6px 0' }}>
              Sin notas clínicas registradas para esta consulta
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Pantalla principal ────────────────────────────────────────

export default function HistoriaClinica() {
  const { patientId } = useParams()
  const navigate      = useNavigate()

  const [patient, setPatient] = useState(null)
  const [appts,   setAppts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!patientId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const [
        { data: profileData, error: profileErr },
        { data: apptsData,   error: apptsErr   },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, phone, dni, created_at')
          .eq('id', patientId)
          .single(),
        supabase
          .from('appointments')
          .select(`
            id, scheduled_at, status, duration_minutes, notes_doctor, chief_complaint,
            doctor:doctors!doctor_id ( nombres, apellidos, especialidad, cmp ),
            prescription:prescriptions!appointment_id (
              diagnosis, medicines, pdf_url, verification_code
            )
          `)
          .eq('patient_id', patientId)
          .in('status', ['done', 'active', 'paid'])
          .order('scheduled_at', { ascending: false }),
      ])

      if (cancelled) return

      if (profileErr) {
        setError(profileErr.message)
        setLoading(false)
        return
      }

      setPatient(profileData)
      setAppts(apptsData ?? [])
      if (apptsErr) console.warn('[HistoriaClinica] appointments error:', apptsErr.message)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [patientId])

  const countDone   = appts.filter(a => a.status === 'done').length
  const countActive = appts.filter(a => a.status === 'active').length
  const countRecetas = appts.filter(a => {
    const raw = a.prescription
    const p   = Array.isArray(raw) ? (raw[0] ?? null) : raw
    return p?.pdf_url
  }).length

  return (
    <div style={{
      minHeight: '100vh', background: C.gray50,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`@keyframes hc-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }`}</style>

      {/* ── Cabecera ── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '16px 20px 22px', flexShrink: 0,
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(6,79,60,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontSize: 19, flexShrink: 0,
            }}
          >
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              Historia Clínica
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, color: C.white, marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {loading ? 'Cargando…' : (patient?.full_name ?? 'Paciente')}
            </div>
          </div>
          {!loading && (
            <div style={{
              background: 'rgba(255,255,255,0.15)', borderRadius: 12,
              padding: '7px 14px', textAlign: 'center', flexShrink: 0,
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.white, lineHeight: 1 }}>
                {countDone}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {countDone === 1 ? 'consulta' : 'consultas'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 16px 32px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {/* Cargando */}
        {loading && (
          <>
            <div style={{ background: C.white, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton h={18} w="55%" />
              <Skeleton h={12} w="38%" />
              <Skeleton h={12} w="60%" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: 14, display: 'flex', gap: 10 }}>
                <div style={{ width: 46, height: 56, background: C.gray100, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  <Skeleton h={13} w="55%" />
                  <Skeleton h={11} w="40%" />
                  <Skeleton h={11} w="70%" />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            background: '#FEF2F2', borderRadius: 14,
            border: '1px solid #FECACA',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>Error al cargar</div>
            <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {!loading && !error && patient && (
          <>
            {/* ── Datos del paciente ── */}
            <div style={{
              background: C.white, borderRadius: 14,
              border: `1.5px solid ${C.green100}`,
              padding: '14px 16px',
              animation: 'hc-fade 0.25s ease',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.white, fontWeight: 800, fontSize: 18,
                }}>
                  {getInitials(patient.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.gray900 }}>
                    {patient.full_name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 14px', marginTop: 5 }}>
                    {patient.dni && (
                      <span style={{ fontSize: 12, color: C.gray500 }}>
                        🪪 <strong style={{ color: C.gray700 }}>{patient.dni}</strong>
                      </span>
                    )}
                    {patient.phone && (
                      <span style={{ fontSize: 12, color: C.gray500 }}>
                        📱 {patient.phone}
                      </span>
                    )}
                  </div>
                  {patient.created_at && (
                    <div style={{ fontSize: 11, color: C.gray400, marginTop: 3 }}>
                      Paciente desde {fmtFechaLarga(patient.created_at)}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {[
                  { n: countDone,   label: 'Consultas',  color: C.green700, bg: C.green50,   border: C.green100 },
                  { n: countActive, label: 'En curso',   color: '#1D4ED8',  bg: '#EFF6FF',   border: '#BFDBFE'  },
                  { n: countRecetas, label: 'Recetas',   color: C.amberText, bg: C.amberBg,  border: '#FDE68A'  },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', borderRadius: 10,
                    padding: '8px 4px',
                    background: s.bg, border: `1px solid ${s.border}`,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.n}</div>
                    <div style={{ fontSize: 10, color: s.color, opacity: 0.85, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sección de consultas ── */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.gray400,
              letterSpacing: 0.8, paddingLeft: 2, marginTop: 4,
            }}>
              HISTORIAL DE CONSULTAS
            </div>

            {appts.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '40px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: C.green50, border: `2px solid ${C.green100}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>
                  📋
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gray700 }}>Sin consultas registradas</div>
                <div style={{ fontSize: 12, color: C.gray500 }}>
                  Las consultas de este paciente aparecerán aquí
                </div>
              </div>
            ) : (
              appts.map((appt, i) => (
                <div key={appt.id} style={{ animation: `hc-fade 0.2s ease ${i * 0.04}s both` }}>
                  <ConsultaItem appt={appt} defaultOpen={i === 0} />
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
