import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import LegalPage, { LegalSection } from '../../components/legal/LegalPage'

const C = {
  green700: '#047857', green600: '#059669', green50: '#ECFDF5', green200: '#A7F3D0',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280', gray300: '#D1D5DB',
  red: '#EF4444', red50: '#FEF2F2', white: '#FFFFFF',
}

function inputStyle(hasError) {
  return {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    border: `1.5px solid ${hasError ? C.red : C.gray300}`,
    borderRadius: 10, fontSize: 14, color: C.gray900,
    background: hasError ? C.red50 : C.white,
    outline: 'none', fontFamily: 'inherit',
  }
}

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
      {children}
    </label>
  )
}

function Err({ msg }) {
  if (!msg) return null
  return (
    <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, color: C.red, fontWeight: 600 }}>
      ⚠ {msg}
    </span>
  )
}

const CAMPOS_INICIALES = {
  nombre: '', dni: '', correo: '', telefono: '',
  tipo: 'reclamo', descripcion: '', pedido: '',
}

export default function Reclamaciones() {
  const [form,      setForm]      = useState(CAMPOS_INICIALES)
  const [errors,    setErrors]    = useState({})
  const [enviando,  setEnviando]  = useState(false)
  const [enviado,   setEnviado]   = useState(null) // { id, created_at, ...form }

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: null }))
  }

  function validar() {
    const e = {}
    if (!form.nombre.trim() || form.nombre.trim().length < 3) e.nombre = 'Ingresa tu nombre completo'
    if (!/^\d{8}$/.test(form.dni.trim())) e.dni = 'El DNI debe tener 8 dígitos'
    if (!/^\S+@\S+\.\S+$/.test(form.correo.trim())) e.correo = 'Correo electrónico no válido'
    if (!/^\d{9}$/.test(form.telefono.trim())) e.telefono = 'El teléfono debe tener 9 dígitos'
    if (!form.descripcion.trim() || form.descripcion.trim().length < 10) e.descripcion = 'Describe los hechos (mínimo 10 caracteres)'
    if (!form.pedido.trim() || form.pedido.trim().length < 5) e.pedido = 'Indica qué solicitas (mínimo 5 caracteres)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validar()) {
      toast.error('Revisa los campos marcados en rojo')
      return
    }
    setEnviando(true)
    const payload = {
      nombre:      form.nombre.trim(),
      dni:         form.dni.trim(),
      correo:      form.correo.trim(),
      telefono:    form.telefono.trim(),
      tipo:        form.tipo,
      descripcion: form.descripcion.trim(),
      pedido:      form.pedido.trim(),
    }
    const { data, error } = await supabase
      .from('libro_reclamaciones')
      .insert(payload)
      .select('id, created_at')
      .single()
    setEnviando(false)
    if (error) {
      console.error('[Reclamaciones] insert error:', error)
      toast.error('No se pudo registrar tu ' + (form.tipo === 'queja' ? 'queja' : 'reclamo') + '. Inténtalo de nuevo.')
      return
    }
    setEnviado({ ...payload, id: data.id, created_at: data.created_at })
    toast.success('✅ Registrado correctamente')
  }

  return (
    <LegalPage title="Libro de Reclamaciones" updatedLabel="Conforme al Código de Protección y Defensa del Consumidor — INDECOPI">
      <Toaster position="bottom-center" toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }} />

      {enviado ? (
        /* ── Confirmación ── */
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 44 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.gray900, marginTop: 8 }}>
              {enviado.tipo === 'queja' ? 'Queja' : 'Reclamo'} registrado correctamente
            </div>
            <div style={{ fontSize: 13, color: C.gray500, marginTop: 4 }}>
              Folio: <strong style={{ color: C.green700 }}>{enviado.id.slice(0, 8).toUpperCase()}</strong>
            </div>
          </div>

          <div style={{
            background: C.green50, border: `1.5px solid ${C.green200}`,
            borderRadius: 14, padding: '16px 18px', marginBottom: 20,
            fontSize: 13, color: '#065F46', lineHeight: 1.7,
          }}>
            Hemos recibido tu {enviado.tipo === 'queja' ? 'queja' : 'reclamo'} el{' '}
            {new Date(enviado.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' })}.
            Conforme al Código de Protección y Defensa del Consumidor, te responderemos en un plazo
            máximo de <strong>30 días calendario</strong> al correo <strong>{enviado.correo}</strong>.
            La formulación del reclamo no impide acudir a otras vías de solución de controversias ni
            es requisito previo para interponer una denuncia ante INDECOPI.
          </div>

          <div style={{
            background: '#F9FAFB', border: `1px solid ${C.gray300}`,
            borderRadius: 12, padding: '14px 16px', fontSize: 12.5, color: C.gray700, lineHeight: 1.9,
          }}>
            <strong>Nombre:</strong> {enviado.nombre}<br />
            <strong>DNI:</strong> {enviado.dni}<br />
            <strong>Correo:</strong> {enviado.correo}<br />
            <strong>Teléfono:</strong> {enviado.telefono}<br />
            <strong>Tipo:</strong> {enviado.tipo === 'queja' ? 'Queja' : 'Reclamo'}<br />
            <strong>Descripción:</strong> {enviado.descripcion}<br />
            <strong>Pedido:</strong> {enviado.pedido}
          </div>

          <button
            type="button"
            onClick={() => { setEnviado(null); setForm(CAMPOS_INICIALES) }}
            style={{
              marginTop: 20, width: '100%', padding: '13px 0', border: `1.5px solid ${C.green600}`,
              background: C.white, color: C.green700, borderRadius: 12,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Registrar otro caso
          </button>
        </div>
      ) : (
        <>
          <LegalSection title="Antes de continuar">
            <p>
              <strong>Reclamo:</strong> disconformidad relacionada a los productos o servicios
              contratados. <strong>Queja:</strong> disconformidad no relacionada a los productos o
              servicios, sino a la atención al público. Completa el formulario con datos verídicos —
              usaremos tu correo para responderte.
            </p>
          </LegalSection>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <Label>Nombre completo</Label>
                <input
                  value={form.nombre} onChange={e => setField('nombre', e.target.value)}
                  placeholder="Nombres y apellidos" style={inputStyle(!!errors.nombre)}
                />
                <Err msg={errors.nombre} />
              </div>
              <div>
                <Label>DNI</Label>
                <input
                  value={form.dni} inputMode="numeric" maxLength={8}
                  onChange={e => setField('dni', e.target.value.replace(/\D/g, ''))}
                  placeholder="12345678" style={inputStyle(!!errors.dni)}
                />
                <Err msg={errors.dni} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <Label>Correo electrónico</Label>
                <input
                  type="email" value={form.correo} onChange={e => setField('correo', e.target.value)}
                  placeholder="correo@ejemplo.com" style={inputStyle(!!errors.correo)}
                />
                <Err msg={errors.correo} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <input
                  value={form.telefono} inputMode="numeric" maxLength={9}
                  onChange={e => setField('telefono', e.target.value.replace(/\D/g, ''))}
                  placeholder="987654321" style={inputStyle(!!errors.telefono)}
                />
                <Err msg={errors.telefono} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Label>Tipo</Label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { v: 'reclamo', label: '📄 Reclamo' },
                  { v: 'queja',   label: '💬 Queja' },
                ].map(opt => (
                  <button
                    key={opt.v} type="button"
                    onClick={() => setField('tipo', opt.v)}
                    style={{
                      flex: 1, padding: '11px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${form.tipo === opt.v ? C.green600 : C.gray300}`,
                      background: form.tipo === opt.v ? C.green50 : C.white,
                      color: form.tipo === opt.v ? C.green700 : C.gray700,
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Label>Descripción de los hechos</Label>
              <textarea
                value={form.descripcion} onChange={e => setField('descripcion', e.target.value)}
                placeholder="Describe con detalle lo ocurrido: fecha, servicio contratado, y el problema encontrado."
                rows={4} maxLength={1000}
                style={{ ...inputStyle(!!errors.descripcion), resize: 'vertical', lineHeight: 1.5 }}
              />
              <Err msg={errors.descripcion} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <Label>Pedido</Label>
              <textarea
                value={form.pedido} onChange={e => setField('pedido', e.target.value)}
                placeholder="¿Qué solicitas? Ej: reembolso, reprogramación, una explicación, etc."
                rows={2} maxLength={500}
                style={{ ...inputStyle(!!errors.pedido), resize: 'vertical', lineHeight: 1.5 }}
              />
              <Err msg={errors.pedido} />
            </div>

            <button
              type="submit"
              disabled={enviando}
              style={{
                width: '100%', padding: '15px 0', border: 'none', borderRadius: 12,
                background: enviando ? C.green50 : `linear-gradient(135deg, #065F46, ${C.green600})`,
                color: enviando ? C.green700 : C.white,
                fontSize: 15, fontWeight: 800, cursor: enviando ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
        </>
      )}
    </LegalPage>
  )
}
