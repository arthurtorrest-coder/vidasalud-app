import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green200: '#A7F3D0', green100: '#D1FAE5', green50: '#ECFDF5',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280', gray300: '#D1D5DB',
  gray100: '#F3F4F6', white: '#FFFFFF',
  red: '#EF4444', red50: '#FEF2F2',
}

const schema = z.object({
  nombre_completo: z.string().min(3, 'Ingresa al menos 3 caracteres').trim(),
  email:           z.string().email('Correo electrónico no válido'),
  password:        z.string().min(6, 'Mínimo 6 caracteres'),
})

function inputStyle(hasError) {
  return {
    width: '100%', padding: '14px 16px',
    border: `1.5px solid ${hasError ? C.red : C.gray300}`,
    borderRadius: 12, fontSize: 15, color: C.gray900,
    background: hasError ? C.red50 : C.white,
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }
}

export default function Register() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  if (user) return <Navigate to="/inicio" replace />

  async function onSubmit({ nombre_completo, email, password }) {
    setLoading(true)
    const fullName = nombre_completo.trim()
    const firstName = fullName.split(' ')[0]

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'patient' } },
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

    if (data.session) {
      await supabase.from('profiles').upsert({
        id:                   data.user.id,
        role:                 'patient',
        full_name:            fullName,
        onboarding_completado: true,   // el tour del Home se encarga de la bienvenida
      })
      toast.success(`¡Bienvenido/a, ${firstName}! 🎉`)
      navigate('/inicio', { replace: true })
    } else {
      setLoading(false)
      toast.success('Revisa tu correo para confirmar tu cuenta', { duration: 6000 })
      navigate('/login')
    }
  }

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
            padding: '48px 24px 32px', flexShrink: 0,
          }}>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: 20, padding: '6px 14px',
                color: C.white, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20,
              }}>
                ← Volver
              </button>
            </Link>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
              Crear cuenta
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, fontWeight: 500 }}>
              Gratis · Solo 30 segundos · Médicos disponibles ahora
            </div>
          </div>

          {/* Formulario */}
          <div style={{ flex: 1, padding: '28px 24px 32px' }}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Nombre completo */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 7 }}>
                  Nombre completo
                </label>
                <input
                  {...register('nombre_completo')}
                  type="text"
                  autoComplete="name"
                  placeholder="Ej: María Elena Quispe"
                  autoFocus
                  style={inputStyle(!!errors.nombre_completo)}
                />
                {errors.nombre_completo && (
                  <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: C.red, fontWeight: 600 }}>
                    ⚠ {errors.nombre_completo.message}
                  </span>
                )}
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 7 }}>
                  Correo electrónico
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="ejemplo@correo.com"
                  style={inputStyle(!!errors.email)}
                />
                {errors.email && (
                  <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: C.red, fontWeight: 600 }}>
                    ⚠ {errors.email.message}
                  </span>
                )}
              </div>

              {/* Contraseña */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 7 }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register('password')}
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    style={{ ...inputStyle(!!errors.password), paddingRight: 50 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 18, color: C.gray500, padding: 0, lineHeight: 1,
                    }}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password && (
                  <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: C.red, fontWeight: 600 }}>
                    ⚠ {errors.password.message}
                  </span>
                )}
              </div>

              {/* Términos */}
              <div style={{
                background: C.green50, border: `1px solid ${C.green100}`,
                borderRadius: 10, padding: '10px 14px',
                fontSize: 11, color: C.green700, lineHeight: 1.6,
              }}>
                Al crear tu cuenta aceptas el uso de tus datos para atención médica
                según la Ley 29733 de Protección de Datos Personales.
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '16px 0',
                  background: loading ? C.green100 : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                  color: loading ? C.green700 : C.white,
                  border: 'none', borderRadius: 13,
                  fontSize: 16, fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {loading ? 'Creando cuenta…' : 'Crear cuenta gratis →'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 13, color: C.gray500 }}>
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
