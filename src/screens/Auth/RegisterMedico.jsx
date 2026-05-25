import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

const C = {
  green900: '#064E3B',
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green100: '#D1FAE5',
  green50:  '#ECFDF5',
  gray900:  '#111827',
  gray700:  '#374151',
  gray500:  '#6B7280',
  gray400:  '#9CA3AF',
  gray300:  '#D1D5DB',
  gray100:  '#F3F4F6',
  white:    '#FFFFFF',
  red:      '#EF4444',
  red50:    '#FEF2F2',
  amberBg:  '#FFFBEB',
  amberText: '#B45309',
}

const ESPECIALIDADES = [
  'Medicina general', 'Pediatría', 'Psicología', 'Nutrición',
  'Cardiología', 'Dermatología', 'Ginecología', 'Neurología',
  'Odontología', 'Oftalmología', 'Ortopedia', 'Psiquiatría',
  'Reumatología', 'Traumatología', 'Urología',
]

const schema = z.object({
  nombres:           z.string().min(2, 'Mínimo 2 caracteres'),
  apellidos:         z.string().min(2, 'Mínimo 2 caracteres'),
  email:             z.string().email('Correo no válido'),
  password:          z.string().min(6, 'Mínimo 6 caracteres'),
  confirm:           z.string(),
  especialidad:      z.string().min(1, 'Selecciona una especialidad'),
  tipoCertificado:   z.enum(['CMP', 'CPsP']),
  numeroCertificado: z.string().min(4, 'Número inválido').regex(/^\d+$/, 'Solo números'),
  anosExperiencia:   z.coerce.number().int().min(0, 'Mínimo 0').max(60, 'Máximo 60'),
  bio:               z.string().max(300, 'Máximo 300 caracteres').optional(),
  precio:            z.coerce.number().int().min(10, 'Mínimo S/. 10').max(500, 'Máximo S/. 500'),
}).refine(d => d.password === d.confirm, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm'],
})

function FieldError({ msg }) {
  if (!msg) return null
  return (
    <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: C.red, fontWeight: 600 }}>
      ⚠ {msg}
    </span>
  )
}

function inputStyle(hasError) {
  return {
    width: '100%',
    padding: '12px 16px',
    border: `1.5px solid ${hasError ? C.red : C.gray300}`,
    borderRadius: 12,
    fontSize: 14,
    color: C.gray900,
    background: hasError ? C.red50 : C.white,
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  }
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.green700,
      textTransform: 'uppercase', letterSpacing: 1,
      padding: '14px 0 6px',
      borderBottom: `1px solid ${C.green100}`,
      marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

export default function RegisterMedico() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { tipoCertificado: 'CMP' },
  })

  const tipoCertificado = watch('tipoCertificado')
  const bio = watch('bio') ?? ''

  async function onSubmit({ nombres, apellidos, email, password, especialidad, tipoCertificado: tipo, numeroCertificado, anosExperiencia, bio: bioVal, precio }) {
    setLoading(true)
    const fullName = `${nombres} ${apellidos}`
    const cmp = `${tipo}-${numeroCertificado}`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'doctor' } },
    })

    if (error) {
      setLoading(false)
      if (error.message.toLowerCase().includes('already registered')) {
        toast.error('Este correo ya tiene una cuenta.')
      } else {
        toast.error('Error al crear la cuenta. Inténtalo de nuevo.')
      }
      return
    }

    if (data.session) {
      const userId = data.user.id
      await supabase.from('profiles').upsert({ id: userId, role: 'doctor', full_name: fullName })
      await supabase.from('doctors').insert({
        nombres, apellidos, especialidad, cmp, precio,
        anos_experiencia: anosExperiencia,
        bio: bioVal || null,
        profile_id: userId,
        aprobado: false,
        activo: false,
        rating: 0,
        total_reviews: 0,
      })
      toast.success('¡Solicitud enviada! El equipo VIDASALUD revisará tu perfil pronto.')
      navigate('/login')
    } else {
      setLoading(false)
      toast.success('Revisa tu correo para confirmar tu cuenta.', { duration: 6000 })
      navigate('/login')
    }
  }

  const pwToggle = (show, setShow) => (
    <button
      type="button"
      onClick={() => setShow(s => !s)}
      aria-label={show ? 'Ocultar' : 'Mostrar'}
      style={{
        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 18, color: C.gray400, padding: 0, lineHeight: 1,
      }}
    >
      {show ? '🙈' : '👁️'}
    </button>
  )

  return (
    <>
      <Toaster position="bottom-center" toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }} />

      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: C.gray100 }}>
        <div style={{
          width: '100%', maxWidth: 390, minHeight: '100vh',
          background: C.white, display: 'flex', flexDirection: 'column',
          boxShadow: '0 0 40px rgba(0,0,0,0.08)',
        }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${C.green900}, ${C.green700})`,
            padding: '44px 24px 28px',
            flexShrink: 0,
          }}>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: 20, padding: '6px 14px',
                color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', marginBottom: 16,
              }}>
                ← Volver
              </button>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 28 }}>🩺</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
                Registro médico
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
              Tu perfil será revisado y activado por el equipo VIDASALUD
            </div>
          </div>

          {/* Aviso proceso de revisión */}
          <div style={{
            margin: '16px 24px 0',
            background: C.amberBg, border: '1px solid #FDE68A',
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⏳</span>
            <div style={{ fontSize: 12, color: C.amberText, lineHeight: 1.55 }}>
              <strong>Proceso de verificación:</strong> revisamos tu número CMP/CPsP con el Colegio Médico del Perú antes de activar tu cuenta. Plazo estimado: 1–2 días hábiles.
            </div>
          </div>

          {/* Formulario scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column' }}>

              <SectionLabel>👤 Datos personales</SectionLabel>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Nombres
                </label>
                <input
                  {...register('nombres')}
                  type="text"
                  autoComplete="given-name"
                  placeholder="Ej: Carlos Alberto"
                  style={inputStyle(!!errors.nombres)}
                />
                <FieldError msg={errors.nombres?.message} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Apellidos
                </label>
                <input
                  {...register('apellidos')}
                  type="text"
                  autoComplete="family-name"
                  placeholder="Ej: Huamán Torres"
                  style={inputStyle(!!errors.apellidos)}
                />
                <FieldError msg={errors.apellidos?.message} />
              </div>

              <SectionLabel>🎓 Credenciales médicas</SectionLabel>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Especialidad
                </label>
                <select
                  {...register('especialidad')}
                  style={{ ...inputStyle(!!errors.especialidad), cursor: 'pointer' }}
                >
                  <option value="">Selecciona tu especialidad</option>
                  {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <FieldError msg={errors.especialidad?.message} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 8 }}>
                  Tipo de colegiatura
                </label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  {['CMP', 'CPsP'].map(tipo => (
                    <label key={tipo} style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${tipoCertificado === tipo ? C.green600 : C.gray300}`,
                      background: tipoCertificado === tipo ? C.green50 : C.white,
                    }}>
                      <input
                        {...register('tipoCertificado')}
                        type="radio"
                        value={tipo}
                        style={{ accentColor: C.green600 }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: tipoCertificado === tipo ? C.green700 : C.gray700 }}>
                        {tipo}
                      </span>
                      <span style={{ fontSize: 11, color: C.gray500 }}>
                        {tipo === 'CMP' ? '(médicos)' : '(psicólogos)'}
                      </span>
                    </label>
                  ))}
                </div>
                <input
                  {...register('numeroCertificado')}
                  type="tel"
                  inputMode="numeric"
                  placeholder={`Número de ${tipoCertificado}`}
                  style={inputStyle(!!errors.numeroCertificado)}
                />
                <FieldError msg={errors.numeroCertificado?.message} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                    Años de experiencia
                  </label>
                  <input
                    {...register('anosExperiencia')}
                    type="number"
                    min={0}
                    max={60}
                    placeholder="Ej: 5"
                    style={inputStyle(!!errors.anosExperiencia)}
                  />
                  <FieldError msg={errors.anosExperiencia?.message} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                    Tarifa (S/.)
                  </label>
                  <input
                    {...register('precio')}
                    type="number"
                    min={10}
                    max={500}
                    placeholder="Ej: 50"
                    style={inputStyle(!!errors.precio)}
                  />
                  <FieldError msg={errors.precio?.message} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Presentación breve
                  <span style={{ fontWeight: 400, color: C.gray500 }}> (opcional)</span>
                </label>
                <textarea
                  {...register('bio')}
                  rows={3}
                  maxLength={300}
                  placeholder="Describe brevemente tu experiencia y enfoque clínico…"
                  style={{ ...inputStyle(!!errors.bio), resize: 'vertical', minHeight: 80 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 11, color: C.gray400, marginTop: 4 }}>
                    {bio.length}/300
                  </span>
                </div>
                <FieldError msg={errors.bio?.message} />
              </div>

              <SectionLabel>🔐 Datos de acceso</SectionLabel>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Correo electrónico
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  style={inputStyle(!!errors.email)}
                />
                <FieldError msg={errors.email?.message} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register('password')}
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    style={{ ...inputStyle(!!errors.password), paddingRight: 48 }}
                  />
                  {pwToggle(showPass, setShowPass)}
                </div>
                <FieldError msg={errors.password?.message} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Confirmar contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register('confirm')}
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repite tu contraseña"
                    style={{ ...inputStyle(!!errors.confirm), paddingRight: 48 }}
                  />
                  {pwToggle(showConfirm, setShowConfirm)}
                </div>
                <FieldError msg={errors.confirm?.message} />
              </div>

              <div style={{
                background: C.green50, border: `1px solid ${C.green100}`,
                borderRadius: 10, padding: '10px 14px',
                fontSize: 11, color: C.green700, lineHeight: 1.6,
                marginBottom: 20,
              }}>
                Al registrarte aceptas que tus credenciales sean verificadas con el CMP/CPsP y tus datos tratados conforme a la Ley 29733.
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '15px 0',
                  background: loading
                    ? C.green100
                    : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                  color: loading ? C.green700 : C.white,
                  border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {loading ? 'Enviando solicitud…' : 'Enviar solicitud de registro'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: C.gray500 }}>
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" style={{ color: C.green700, fontWeight: 700, textDecoration: 'none' }}>
                  Inicia sesión
                </Link>
              </div>

            </form>
          </div>

        </div>
      </div>
    </>
  )
}
