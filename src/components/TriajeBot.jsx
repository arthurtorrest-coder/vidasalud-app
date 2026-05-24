import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green500: '#10B981', green200: '#A7F3D0',
  green100: '#D1FAE5', green50:  '#ECFDF5',
  red700:   '#B91C1C', red600:   '#DC2626', redBg:  '#FEF2F2', redBorder: '#FECACA',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280',
  gray300: '#D1D5DB', gray200: '#E5E7EB', gray100: '#F3F4F6', gray50: '#F9FAFB',
  white: '#FFFFFF',
}

const GREETING = {
  id: 'greeting',
  role: 'assistant',
  text: '¡Hola! 👋 Soy el asistente de triaje de VIDASALUD.\n\nCuéntame qué síntomas tienes o cómo te sientes, y te diré qué especialista necesitas. Escribe en español con la mayor cantidad de detalle posible.',
  specialty: null,
  emergency: false,
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

function MessageBubble({ msg, onSelectSpecialty }) {
  const isUser = msg.role === 'user'
  const lines  = msg.text.split('\n')

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 8, alignItems: 'flex-end',
    }}>
      {!isUser && <BotAvatar />}

      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 6 }}>
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

        {/* Botón de especialidad */}
        {!isUser && msg.specialty && (
          <button
            onClick={() => onSelectSpecialty(msg.specialty)}
            style={{
              alignSelf: 'flex-start',
              padding: '9px 16px',
              background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
              border: 'none', borderRadius: 12, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, color: C.white,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 16 }}>🔍</span>
            Buscar médicos de {msg.specialty}
            <span style={{ opacity: 0.8 }}>→</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function TriajeBot({ onClose, onSelectSpecialty }) {
  const [messages,  setMessages]  = useState([GREETING])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [emergency, setEmergency] = useState(false)
  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { id: Date.now(), role: 'user', text, specialty: null, emergency: false }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    // Build conversation for the API (exclude the hardcoded greeting)
    const apiMessages = updated
      .filter(m => m.id !== 'greeting')
      .map(m => ({ role: m.role, content: m.text }))

    try {
      const { data, error } = await supabase.functions.invoke('triage-ai', {
        body: { messages: apiMessages },
      })

      if (error || !data?.message) throw new Error(error?.message ?? 'Sin respuesta de la IA')

      if (data.emergency) setEmergency(true)

      setMessages(prev => [...prev, {
        id:        Date.now() + 1,
        role:      'assistant',
        text:      data.message,
        specialty: data.specialty ?? null,
        emergency: data.emergency ?? false,
      }])
    } catch (err) {
      console.error('[TriajeBot] Error:', err)
      setMessages(prev => [...prev, {
        id:        Date.now() + 1,
        role:      'assistant',
        text:      'Lo siento, hubo un problema de conexión. Verifica que el servicio esté disponible e intenta de nuevo.',
        specialty: null,
        emergency: false,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, loading, messages])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSelectSpecialty = (spec) => {
    onSelectSpecialty(spec)
    onClose()
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
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            🩺
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>
              Asistente de Triaje
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#4ade80', display: 'inline-block',
                animation: 'tb-pulse 2s infinite',
              }} />
              IA · VIDASALUD
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

        {/* ── Banner de emergencia ── */}
        {emergency && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.redBorder}`,
            padding: '12px 16px', flexShrink: 0,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.red700 }}>
                POSIBLE EMERGENCIA MÉDICA
              </div>
              <div style={{ fontSize: 12, color: C.red600, marginTop: 2, lineHeight: 1.5 }}>
                Ve inmediatamente a urgencias o llama al{' '}
                <strong>106</strong> (SAMU) ·{' '}
                <strong>117</strong> (SIS) · No esperes consulta virtual.
              </div>
            </div>
          </div>
        )}

        {/* ── Área de chat ── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onSelectSpecialty={handleSelectSpecialty}
            />
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
        <div style={{
          padding: '4px 16px 0',
          fontSize: 10, color: C.gray500, textAlign: 'center',
          flexShrink: 0,
        }}>
          Este asistente orienta pero no reemplaza la consulta médica profesional.
        </div>

        {/* ── Input ── */}
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
            placeholder="Describe tus síntomas aquí…"
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

      </div>
    </div>,
    document.body
  )
}
