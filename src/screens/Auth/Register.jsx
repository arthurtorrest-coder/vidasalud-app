import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B',
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green200: '#A7F3D0',
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
}

const schema = z.object({
  nombre:    z.string().min(2, 'Mínimo 2 caracteres'),
  apellidos: z.string().min(2, 'Mínimo 2 caracteres'),
  dni:       z.string()
               .length(8, 'El DNI tiene exactamente 8 dígitos')
               .regex(/^\d+$/, 'Solo números'),
  telefono:  z.string()
               .min(9, 'Mínimo 9 dígitos')
               .regex(/^\d+$/, 'Solo números'),
  email:     z.string().email('Ingresa un correo válido'),
  password:  z.string().min(6, 'Mínimo 6 caracteres'),
  confirm:   z.string(),
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

export default function Register() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  if (user) return <Navigate to="/inicio" replace />

  async function onSubmit({ nombre, apellidos, dni, telefono, email, password }) {
    setLoading(true)
    const fullName = `${nombre} ${apellidos}`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'patient' },
      },
    })

    if (error) {
      setLoading(false)
      if (error.message.toLowerCase().includes('already registered')) {
        toast.error('Este correo ya tiene una cuenta. Inicia sesión.')
      } else {
        toast.error('Error al crear la cuenta. Inténtalo de nuevo.')
      }
      return
    }

    // Si el email confirmation está desactivado en Supabase, obtenemos session directamente
    if (data.session) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        role: 'patient',
        full_name: fullName,
        phone: telefono,
        dni,
      })
      toast.success(`¡Bienvenido/a, ${nombre}! 🎉`)
      navigate('/inicio', { replace: true })
    } else {
      setLoading(false)
      toast.success('Revisa tu correo para confirmar tu cuenta', { duration: 6000 })
      navigate('/login')
    }
  }

  const pwToggleBtn = (show, setShow) => (
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
      <Toaster
        position="bottom-center"
        toastOptions={{ style: { fontFamily: 'inherit', fontSize: 13 } }}
      />

      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: C.gray100 }}>
        <div style={{
          width: '100%', maxWidth: 390, minHeight: '100vh',
          background: C.white, display: 'flex', flexDirection: 'column',
          boxShadow: '0 0 40px rgba(0,0,0,0.08)',
        }}>

          {/* Header compacto con botón atrás */}
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
            <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
              Crea tu cuenta
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: 500 }}>
              Solo toma 1 minuto · Es gratis
            </div>
          </div>

          {/* Formulario scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 32px' }}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column' }}>

              {/* ─── Datos personales ─── */}
              <SectionLabel>👤 Datos personales</SectionLabel>

              {/* Nombre */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Nombre(s)
                </label>
                <input
                  {...register('nombre')}
                  type="text"
                  autoComplete="given-name"
                  placeholder="Ej: María Elena"
                  style={inputStyle(!!errors.nombre)}
                />
                <FieldError msg={errors.nombre?.message} />
              </div>

              {/* Apellidos */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Apellidos
                </label>
                <input
                  {...register('apellidos')}
                  type="text"
                  autoComplete="family-name"
                  placeholder="Ej: Quispe Flores"
                  style={inputStyle(!!errors.apellidos)}
                />
                <FieldError msg={errors.apellidos?.message} />
              </div>

              {/* DNI y Teléfono en fila */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                    DNI
                  </label>
                  <input
                    {...register('dni')}
                    type="tel"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="12345678"
                    style={inputStyle(!!errors.dni)}
                  />
                  <FieldError msg={errors.dni?.message} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                    Teléfono
                  </label>
                  <input
                    {...register('telefono')}
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="987654321"
                    style={inputStyle(!!errors.telefono)}
                  />
                  <FieldError msg={errors.telefono?.message} />
                </div>
              </div>

              {/* ─── Datos de cuenta ─── */}
              <SectionLabel>🔐 Datos de acceso</SectionLabel>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Correo electrónico
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="ejemplo@correo.com"
                  style={inputStyle(!!errors.email)}
                />
                <FieldError msg={errors.email?.message} />
              </div>

              {/* Contraseña */}
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
                  {pwToggleBtn(showPass, setShowPass)}
                </div>
                <FieldError msg={errors.password?.message} />
              </div>

              {/* Confirmar contraseña */}
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
                  {pwToggleBtn(showConfirm, setShowConfirm)}
                </div>
                <FieldError msg={errors.confirm?.message} />
              </div>

              {/* Nota de términos */}
              <div style={{
                background: C.green50, border: `1px solid ${C.green100}`,
                borderRadius: 10, padding: '10px 14px',
                fontSize: 11, color: C.green700, lineHeight: 1.6,
                marginBottom: 20,
              }}>
                Al crear tu cuenta aceptas que tus datos sean usados para brindarte atención médica
                en cumplimiento de la Ley 29733 de Protección de Datos Personales.
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
                {loading ? 'Creando cuenta…' : 'Crear cuenta gratis'}
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
