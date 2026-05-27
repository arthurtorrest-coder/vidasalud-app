import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green200: '#A7F3D0',
  green100: '#D1FAE5', green50:  '#ECFDF5',
  red700:   '#B91C1C', red600:   '#DC2626', redBg:  '#FEF2F2', redBorder: '#FECACA',
  amber:    '#F59E0B', amberBg:  '#FFFBEB', amberText: '#B45309',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280',
  gray300: '#D1D5DB', gray200: '#E5E7EB', gray100: '#F3F4F6', gray50: '#F9FAFB',
  white: '#FFFFFF',
}

// Pasos del triaje para mostrar progreso
const STEPS = [
  { n: 1, label: 'Síntoma principal' },
  { n: 2, label: 'Intensidad'        },
  { n: 3, label: 'Síntomas adicionales' },
  { n: 4, label: 'Antecedentes'      },
]

function buildGreeting(firstName) {
  const nombre = firstName ? `, ${firstName}` : ''
  return {
    id: 'greeting',
    role: 'assistant',
    text: `¡Hola${nombre}! 👋 Soy la recepcionista virtual de VIDASALUD.\n\nEstoy aquí para ayudarte a preparar tu consulta con el médico. Te haré unas preguntas breves para que el médico conozca tu caso desde el primer momento.\n\n¿Cuál es el síntoma o molestia principal que tienes hoy?`,
    specialty: null,
    emergency: false,
    done: false,
    summary: null,
  }
}

function TypingDots() {
  return (
    <div style={{
      display: 'flex', gap: 5, padding: '12px 16px',
      background: C.white, border: `1.5px solid ${C.gray200}`,
      borderRadius: '18px 18px 18px 4px', alignSelf: 'flex-start',
    }}>
      <style>{`
        @keyframes tb-dot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: C.green500,
          display: 'inline-block',
          animation: `tb-dot 1.4s infinite ${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

function BotAvatar() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, alignSelf: 'flex-end',
    }}>
      🩺
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const lines  = msg.text.split('\n')

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 8, alignItems: 'flex-end',
    }}>
      {!isUser && <BotAvatar />}

      <div style={{ maxWidth: '78%' }}>
        <div style={{
          padding: '11px 15px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser
            ? `linear-gradient(135deg, ${C.green800}, ${C.green600})`
            : C.white,
          border: isUser ? 'none' : `1.5px solid ${C.gray200}`,
          color: isUser ? C.white : C.gray900,
          fontSize: 14, lineHeight: 1.55,
          boxShadow: isUser
            ? '0 2px 8px rgba(5,150,105,0.25)'
            : '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          {lines.map((line, i) => (
            <span key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmergencyBanner() {
  return (
    <div style={{
      background: C.redBg, border: `1px solid ${C.redBorder}`,
      padding: '14px 16px', flexShrink: 0,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>🚨</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.red700 }}>
          POSIBLE EMERGENCIA MÉDICA
        </div>
        <div style={{ fontSize: 12, color: C.red600, marginTop: 3, lineHeight: 1.6 }}>
          Ve a urgencias o llama ahora:
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { num: '106', label: 'SAMU' },
            { num: '117', label: 'SIS' },
            { num: '911', label: 'Emergencias' },
          ].map(({ num, label }) => (
            <a
              key={num}
              href={`tel:${num}`}
              style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                background: C.red600, color: C.white,
                borderRadius: 10, padding: '6px 14px',
                textDecoration: 'none', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 900 }}>{num}</span>
              <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.9 }}>{label}</span>
            </a>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.red700, marginTop: 8, fontWeight: 600 }}>
          No esperes consulta virtual — acude de inmediato a urgencias.
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ summary, onBook }) {
  // Parsear líneas del resumen para mostrarlas con íconos
  const lines = summary
    .split('·')
    .map(s => s.trim())
    .filter(Boolean)

  const icons = ['🤒', '📊', '➕', '📋']

  return (
    <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
      {/* Tarjeta de resumen */}
      <div style={{
        background: C.green50,
        border: `1.5px solid ${C.green200}`,
        borderRadius: 16,
        padding: '14px 16px',
        marginBottom: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          paddingBottom: 10, borderBottom: `1px solid ${C.green200}`,
        }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.green800 }}>
              Resumen de tu consulta
            </div>
            <div style={{ fontSize: 11, color: C.green700, marginTop: 1 }}>
              El médico verá esta información al iniciar tu cita
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>
                {icons[i] ?? '•'}
              </span>
              <span style={{ fontSize: 12, color: C.gray700, lineHeight: 1.5 }}>
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onBook}
        style={{
          width: '100%', padding: '15px 0',
          background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
          color: C.white, border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 18 }}>🩺</span>
        Consultar con médico general
        <span style={{ opacity: 0.8 }}>→</span>
      </button>

      <div style={{
        textAlign: 'center', marginTop: 10,
        fontSize: 11, color: C.gray500, lineHeight: 1.5,
      }}>
        Tu resumen se enviará automáticamente al médico
      </div>
    </div>
  )
}

function ProgressBar({ step }) {
  if (!step || step < 1 || step > 4) return null
  const pct = Math.round((step / 4) * 100)
  return (
    <div style={{
      padding: '8px 16px 0',
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        flex: 1, height: 4, background: C.gray200, borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${C.green600}, ${C.green500})`,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 10, color: C.gray500, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
        Paso {step} de 4
      </span>
    </div>
  )
}

export default function TriajeBot({ onClose, onSelectSpecialty, onBookNow }) {
  const { profile } = useAuthStore()
  const firstName   = profile?.full_name?.split(' ')[0] ?? ''

  const [messages,      setMessages]      = useState(() => [buildGreeting(firstName)])
  const [input,         setInput]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [emergency,     setEmergency]     = useState(false)
  const [triageDone,    setTriageDone]    = useState(false)
  const [triageSummary, setTriageSummary] = useState(null)
  const [currentStep,   setCurrentStep]   = useState(1)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, triageDone])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || triageDone) return

    const userMsg = { id: Date.now(), role: 'user', text, specialty: null, emergency: false, done: false }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    const apiMessages = updated
      .filter(m => m.id !== 'greeting')
      .map(m => ({ role: m.role, content: m.text }))

    try {
      const { data: rawData, error } = await supabase.functions.invoke('triage-ai', {
        body: { messages: apiMessages, patientName: firstName },
      })

      if (error) throw new Error(error.message ?? 'Sin respuesta de la IA')

      // Edge Function fallback may return raw JSON string inside message field — unwrap it
      let data = rawData
      if (typeof rawData?.message === 'string' && rawData.message.trimStart().startsWith('{')) {
        try {
          const inner = JSON.parse(rawData.message)
          if (typeof inner?.message === 'string') data = inner
        } catch { /* not JSON, keep rawData */ }
      }

      if (!data?.message) throw new Error('Sin respuesta de la IA')

      if (data.emergency) setEmergency(true)

      if (data.done) {
        setTriageDone(true)
        const summary = data.summary ?? null
        setTriageSummary(summary)
        if (summary) sessionStorage.setItem('vidasalud_triaje', summary)
      } else if (data.step >= 1 && data.step <= 4) {
        setCurrentStep(data.step)
      }

      setMessages(prev => [...prev, {
        id:        Date.now() + 1,
        role:      'assistant',
        text:      data.message,
        specialty: data.specialty ?? null,
        emergency: data.emergency ?? false,
        done:      data.done ?? false,
        summary:   data.summary ?? null,
      }])
    } catch (err) {
      console.error('[TriajeBot] Error:', err)
      setMessages(prev => [...prev, {
        id:        Date.now() + 1,
        role:      'assistant',
        text:      'Lo siento, hubo un problema de conexión. Verifica que el servicio esté disponible e inténtalo de nuevo.',
        specialty: null,
        emergency: false,
        done:      false,
        summary:   null,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, loading, messages, triageDone, firstName])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleBook() {
    if (onBookNow) {
      onBookNow()
    } else {
      onSelectSpecialty?.('Medicina general')
      onClose()
    }
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes tb-slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes tb-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 480,
        height: '92vh',
        background: C.gray50,
        borderRadius: '24px 24px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'tb-slideUp 0.28s ease',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
          padding: '16px 20px',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            🩺
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>
              Recepcionista Virtual
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: triageDone ? C.green200 : '#4ade80',
                display: 'inline-block',
                animation: triageDone ? 'none' : 'tb-pulse 2s infinite',
              }} />
              {triageDone ? 'Triaje completado · VIDASALUD' : 'En línea · VIDASALUD'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: C.white, fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, fontFamily: 'inherit',
            }}
            aria-label="Cerrar asistente"
          >
            ×
          </button>
        </div>

        {/* ── Barra de progreso ── */}
        {!triageDone && !emergency && (
          <ProgressBar step={currentStep} />
        )}

        {/* ── Banner de emergencia ── */}
        {emergency && <EmergencyBanner />}

        {/* ── Área de chat ── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>

          {/* Píldoras de pasos (solo al inicio, antes de respuestas) */}
          {!triageDone && messages.length <= 2 && (
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap',
              padding: '0 0 4px',
              justifyContent: 'center',
            }}>
              {STEPS.map(s => (
                <span key={s.n} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 10px',
                  borderRadius: 20,
                  background: s.n === currentStep ? C.green100 : C.gray100,
                  color: s.n === currentStep ? C.green800 : C.gray500,
                  border: `1px solid ${s.n === currentStep ? C.green200 : C.gray200}`,
                }}>
                  {s.n}. {s.label}
                </span>
              ))}
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <BotAvatar />
              <TypingDots />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Aviso legal ── */}
        {!triageDone && (
          <div style={{
            padding: '4px 16px 2px',
            fontSize: 10, color: C.gray500, textAlign: 'center',
            flexShrink: 0,
          }}>
            Este asistente orienta pero no reemplaza la consulta médica profesional.
          </div>
        )}

        {/* ── Área inferior: resumen + CTA o input ── */}
        {triageDone ? (
          <SummaryCard summary={triageSummary ?? ''} onBook={handleBook} />
        ) : (
          <div style={{
            padding: '10px 16px 16px',
            background: C.white,
            borderTop: `1.5px solid ${C.gray200}`,
            flexShrink: 0,
            display: 'flex', gap: 10, alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={emergency ? 'Llama al 106 (SAMU) si es una emergencia…' : 'Escribe tu respuesta aquí…'}
              rows={2}
              disabled={loading}
              style={{
                flex: 1, padding: '10px 14px',
                border: `1.5px solid ${C.gray300}`,
                borderRadius: 12, fontSize: 14, color: C.gray900,
                background: loading ? C.gray50 : C.white,
                outline: 'none', resize: 'none',
                fontFamily: 'inherit', lineHeight: 1.5,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = C.green500}
              onBlur={e  => e.target.style.borderColor = C.gray300}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 44, height: 44,
                borderRadius: 12, border: 'none',
                background: loading || !input.trim()
                  ? C.gray200
                  : `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                color: loading || !input.trim() ? C.gray500 : C.white,
                fontSize: 20, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s', fontFamily: 'inherit',
                boxShadow: loading || !input.trim() ? 'none' : '0 3px 10px rgba(5,150,105,0.3)',
              }}
              aria-label="Enviar"
            >
              {loading ? '…' : '↑'}
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body
  )
}
