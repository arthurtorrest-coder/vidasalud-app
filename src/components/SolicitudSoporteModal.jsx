import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

const C = {
  green800: '#065F46', green700: '#047857', green600: '#059669', green200: '#A7F3D0',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280', gray300: '#D1D5DB', gray200: '#E5E7EB',
  white: '#FFFFFF',
}

const TIPO_CFG = {
  reembolso:       { icon: '↩️', titulo: 'Solicitar reembolso',       motivoPlaceholder: 'Ej: La consulta no se realizó por falla técnica' },
  reprogramacion:  { icon: '📅', titulo: 'Solicitar reprogramación',  motivoPlaceholder: 'Ej: Tengo un imprevisto y no podré conectarme' },
  reclamo:         { icon: '📢', titulo: 'Nuevo reclamo',              motivoPlaceholder: 'Ej: Problema con el cobro de mi consulta' },
}

/* Modal compartido para crear una solicitud de soporte (reembolso,
   reprogramación o reclamo general) — usado desde Mis citas (con
   appointmentId) y desde Mis reclamos (reclamo general, sin cita). */
export default function SolicitudSoporteModal({ tipo, appointmentId = null, onClose, onCreated }) {
  const { user } = useAuthStore()
  const [motivo,      setMotivo]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [sending,     setSending]     = useState(false)

  const cfg = TIPO_CFG[tipo] ?? TIPO_CFG.reclamo

  async function handleSubmit() {
    if (!motivo.trim()) {
      toast.error('Indica el motivo de tu solicitud')
      return
    }
    setSending(true)
    const { error } = await supabase
      .from('solicitudes_soporte')
      .insert({
        patient_id:     user.id,
        appointment_id: appointmentId,
        tipo,
        motivo:      motivo.trim(),
        descripcion: descripcion.trim() || null,
      })
    setSending(false)
    if (error) {
      toast.error('No se pudo enviar tu solicitud: ' + error.message)
      return
    }
    toast.success('Solicitud enviada — te avisaremos cuando la revisemos')
    onCreated?.()
    onClose()
  }

  return (
    <div
      onClick={() => !sending && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 22px 32px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '88vh', overflowY: 'auto' }}
      >
        <div style={{ width: 40, height: 4, background: C.gray200, borderRadius: 2, margin: '0 auto 2px' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>{cfg.icon}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.gray900, marginTop: 4 }}>{cfg.titulo}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.gray700 }}>Motivo *</label>
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder={cfg.motivoPlaceholder}
            maxLength={120}
            style={{
              padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.gray200}`,
              fontSize: 14, color: C.gray900, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.gray700 }}>Descripción (opcional)</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Cuéntanos con más detalle qué pasó"
            rows={4}
            maxLength={1000}
            style={{
              padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.gray200}`,
              fontSize: 14, color: C.gray900, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={sending}
          style={{
            width: '100%', padding: '14px 0', marginTop: 4,
            background: sending ? C.gray300 : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            border: 'none', color: C.white, borderRadius: 12,
            fontSize: 14, fontWeight: 800, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {sending ? 'Enviando…' : 'Enviar solicitud'}
        </button>
        <button
          onClick={onClose}
          disabled={sending}
          style={{
            width: '100%', padding: '12px 0',
            background: 'none', border: `1.5px solid ${C.gray300}`, color: C.gray700,
            borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
