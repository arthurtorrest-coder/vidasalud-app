import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { C } from '../../lib/tokens'

const LABELS = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente']

function doctorTitulo(doc) {
  if (doc.cmp?.startsWith('CPsP')) return 'Psic.'
  return doc.nombres?.trimEnd().endsWith('a') ? 'Dra.' : 'Dr.'
}

function StarButton({ n, active, hovered, onHover, onLeave, onClick }) {
  const lit = n <= (hovered || active)
  return (
    <button
      onPointerEnter={() => onHover(n)}
      onPointerLeave={onLeave}
      onClick={() => onClick(n)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
        fontSize: 44, lineHeight: 1,
        color: lit ? C.amber : C.gray300,
        transform: lit ? 'scale(1.12)' : 'scale(1)',
        transition: 'transform 0.1s, color 0.1s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      ★
    </button>
  )
}

export default function Calificacion() {
  const { appointmentId } = useParams()
  const navigate          = useNavigate()
  const { user }          = useAuthStore()

  const [appt,            setAppt]            = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [prevRating,      setPrevRating]      = useState(0)
  const [rating,          setRating]          = useState(0)
  const [hover,           setHover]           = useState(0)
  const [comentario,      setComentario]      = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [done,            setDone]            = useState(false)
  const [focused,         setFocused]         = useState(false)

  useEffect(() => {
    if (!appointmentId || !user?.id) return
    loadData()
  }, [appointmentId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const [apptRes, reviewRes] = await Promise.all([
      supabase
        .from('appointments')
        .select(`
          id, scheduled_at,
          doctor:doctors!doctor_id (
            id, nombres, apellidos, especialidad, cmp, foto_url
          )
        `)
        .eq('id', appointmentId)
        .eq('patient_id', user.id)
        .eq('status', 'done')
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('id, rating')
        .eq('appointment_id', appointmentId)
        .eq('patient_id', user.id)
        .maybeSingle(),
    ])

    if (!apptRes.data) {
      navigate('/citas', { replace: true })
      return
    }

    setAppt(apptRes.data)

    if (reviewRes.data) {
      setAlreadyReviewed(true)
      setPrevRating(reviewRes.data.rating)
    }

    setLoading(false)
  }

  async function handleSubmit() {
    if (rating === 0) { toast.error('Selecciona una calificación'); return }
    setSubmitting(true)

    const { error } = await supabase
      .from('reviews')
      .insert({
        appointment_id: appointmentId,
        patient_id:     user.id,
        doctor_id:      appt.doctor.id,
        rating,
        comentario: comentario.trim() || null,
      })

    setSubmitting(false)

    if (error) {
      toast.error(error.code === '23505'
        ? 'Ya calificaste esta consulta'
        : 'No se pudo enviar la calificación'
      )
      return
    }

    setDone(true)
    toast.success('¡Gracias por calificar!')
    setTimeout(() => navigate('/citas', { replace: true }), 2000)
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <style>{`@keyframes cl-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${C.green100}`, borderTopColor: C.green600,
          animation: 'cl-spin 0.75s linear infinite',
        }} />
      </div>
    )
  }

  const doc    = appt.doctor
  const titulo = doctorTitulo(doc)
  const nombre = `${titulo} ${doc.nombres} ${doc.apellidos}`.trim()
  const shown  = hover || rating
  const displayRating = alreadyReviewed ? prevRating : shown

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes cl-fade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      `}</style>

      <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800}, ${C.green600})`,
        padding: '20px 20px 28px', flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/citas')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: C.white,
            borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 6,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ← Volver
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.white, lineHeight: 1.2 }}>
          {alreadyReviewed ? 'Tu calificación' : '¿Cómo fue tu consulta?'}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 5 }}>
          {alreadyReviewed
            ? 'Ya calificaste esta consulta'
            : 'Tu opinión ayuda a mejorar el servicio'}
        </div>
      </div>

      {/* Doctor card */}
      <div style={{ margin: '-20px 20px 0', position: 'relative', zIndex: 2 }}>
        <div style={{
          background: C.white, borderRadius: 20,
          border: `1.5px solid ${C.gray200}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
          padding: '18px 18px',
          display: 'flex', alignItems: 'center', gap: 14,
          animation: 'cl-fade 0.3s ease',
        }}>
          {doc.foto_url ? (
            <img
              src={doc.foto_url} alt=""
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontWeight: 800, fontSize: 22,
            }}>
              {(doc.nombres?.[0] ?? '?').toUpperCase()}{(doc.apellidos?.[0] ?? '').toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.gray900 }}>{nombre}</div>
            <div style={{ fontSize: 12, color: C.gray500, marginTop: 3 }}>{doc.especialidad}</div>
            {doc.cmp && (
              <div style={{ fontSize: 11, color: C.gray400, marginTop: 2 }}>
                {doc.cmp.startsWith('CPsP') ? doc.cmp : `CMP ${doc.cmp}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating / success body */}
      <div style={{ flex: 1, padding: '28px 20px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {done ? (
          /* ── Success state ── */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 14, paddingTop: 20, animation: 'cl-fade 0.35s ease',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: C.green50, border: `3px solid ${C.green200}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
            }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.green800, textAlign: 'center' }}>
              ¡Calificación enviada!
            </div>
            <div style={{ fontSize: 13, color: C.gray500, textAlign: 'center', lineHeight: 1.6 }}>
              Gracias por tu opinión. Redirigiendo a tus citas…
            </div>
          </div>
        ) : alreadyReviewed ? (
          /* ── Already reviewed state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{
                  fontSize: 42, color: n <= prevRating ? C.amber : C.gray200,
                  lineHeight: 1,
                }}>★</span>
              ))}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.gray900 }}>
              {LABELS[prevRating]}
            </div>
            <div style={{
              background: C.green50, border: `1.5px solid ${C.green200}`,
              borderRadius: 14, padding: '14px 18px', textAlign: 'center', width: '100%',
            }}>
              <div style={{ fontSize: 13, color: C.green700, fontWeight: 600 }}>
                Ya calificaste esta consulta con {prevRating} estrella{prevRating !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={() => navigate('/citas')}
              style={{
                width: '100%', padding: '14px 0', background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                border: 'none', color: C.white, borderRadius: 14,
                fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(5,150,105,0.3)', marginTop: 8,
              }}
            >
              Ver mis citas
            </button>
          </div>
        ) : (
          /* ── Rating form ── */
          <>
            {/* Stars */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 0 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <StarButton
                    key={n}
                    n={n}
                    active={rating}
                    hovered={hover}
                    onHover={setHover}
                    onLeave={() => setHover(0)}
                    onClick={setRating}
                  />
                ))}
              </div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: shown ? C.green700 : C.gray400,
                minHeight: 24, transition: 'color 0.15s',
              }}>
                {shown ? LABELS[shown] : 'Toca para calificar'}
              </div>
            </div>

            {/* Comentario */}
            <div>
              <label style={{
                fontSize: 12, fontWeight: 700, color: C.gray700,
                display: 'block', marginBottom: 8,
              }}>
                Comentario <span style={{ fontWeight: 400, color: C.gray500 }}>· Opcional</span>
              </label>
              <textarea
                rows={3}
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                maxLength={300}
                placeholder="¿Cómo fue la atención? ¿Algún comentario para el médico?"
                style={{
                  width: '100%', padding: '12px 14px',
                  border: `1.5px solid ${focused ? C.green500 : C.gray300}`,
                  borderRadius: 12, fontSize: 13, color: C.gray900,
                  background: C.white, outline: 'none', resize: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5,
                  boxShadow: focused ? '0 0 0 3px rgba(16,185,129,0.1)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: 11, color: C.gray400, marginTop: 4 }}>
                {comentario.length}/300
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              style={{
                width: '100%', padding: '15px 0',
                background: submitting || rating === 0
                  ? C.gray200
                  : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                border: 'none', color: submitting || rating === 0 ? C.gray500 : C.white,
                borderRadius: 14, fontSize: 15, fontWeight: 800,
                cursor: submitting || rating === 0 ? 'not-allowed' : 'pointer',
                boxShadow: rating > 0 ? '0 4px 16px rgba(5,150,105,0.3)' : 'none',
                transition: 'all 0.2s', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>{submitting ? '⏳' : '⭐'}</span>
              {submitting ? 'Enviando…' : 'Enviar calificación'}
            </button>

            <button
              onClick={() => navigate('/citas')}
              style={{
                background: 'none', border: 'none', color: C.gray500,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                textAlign: 'center', fontFamily: 'inherit', marginTop: -12,
              }}
            >
              Omitir por ahora
            </button>
          </>
        )}
      </div>
    </div>
  )
}
