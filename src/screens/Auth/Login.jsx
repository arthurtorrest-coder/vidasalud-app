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
  gray300:  '#D1D5DB',
  gray100:  '#F3F4F6',
  white:    '#FFFFFF',
  red:      '#EF4444',
  red50:    '#FEF2F2',
}

const schema = z.object({
  email:    z.string().email('Ingresa un correo válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
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
    padding: '13px 16px',
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

export default function Login() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading,       setLoading]       = useState(false)
  const [showPass,      setShowPass]      = useState(false)
  const [resetSent,     setResetSent]     = useState(false)
  const [resetLoading,  setResetLoading]  = useState(false)

  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  if (user) return <Navigate to="/" replace />

  async function handleForgotPassword() {
    const email = getValues('email')?.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Escribe tu correo arriba antes de continuar')
      return
    }
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })
    setResetLoading(false)
    if (error) {
      toast.error('No se pudo enviar el correo. Inténtalo de nuevo.')
    } else {
      setResetSent(true)
    }
  }

  async function onSubmit({ email, password }) {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error('Correo o contraseña incorrectos')
    } else {
      navigate('/', { replace: true })
    }
  }

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

          {/* Header */}
          <div style={{
            background: `linear-gradient(160deg, ${C.green900} 0%, ${C.green600} 100%)`,
            padding: '56px 28px 48px',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 3,
              color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', marginBottom: 10,
            }}>
              🏥 Telemedicina Perú
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, color: C.white, letterSpacing: -1, lineHeight: 1 }}>
              VIDA<span style={{ color: C.green200 }}>SALUD</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 10, fontWeight: 500 }}>
              Tu salud, donde estés
            </div>
          </div>

          {/* Formulario */}
          <div style={{ flex: 1, padding: '32px 24px 28px', display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.gray900, margin: '0 0 4px' }}>
              Bienvenido de nuevo
            </h1>
            <p style={{ fontSize: 13, color: C.gray500, margin: '0 0 28px' }}>
              Ingresa tus datos para acceder a tu cuenta
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Email */}
              <div>
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
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register('password')}
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    style={{ ...inputStyle(!!errors.password), paddingRight: 48 }}
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
                <FieldError msg={errors.password?.message} />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 6, width: '100%', padding: '15px 0',
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
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </button>

              {/* Olvidé mi contraseña */}
              {resetSent ? (
                <div style={{
                  marginTop: 12, padding: '12px 16px',
                  background: C.green50, border: `1px solid ${C.green200}`,
                  borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📧</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.green800 }}>
                      Correo enviado
                    </div>
                    <div style={{ fontSize: 12, color: C.green700, marginTop: 2, lineHeight: 1.5 }}>
                      Revisa tu bandeja de entrada y sigue el enlace para crear una nueva contraseña.
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  style={{
                    marginTop: 4, background: 'none', border: 'none',
                    color: resetLoading ? C.gray500 : C.green700,
                    fontSize: 13, fontWeight: 600, cursor: resetLoading ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline', textDecorationStyle: 'dotted',
                    fontFamily: 'inherit', padding: '4px 0', alignSelf: 'center',
                    width: '100%', textAlign: 'center',
                  }}
                >
                  {resetLoading ? 'Enviando correo…' : '¿Olvidaste tu contraseña?'}
                </button>
              )}
            </form>

            {/* Separador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: C.gray300 }} />
              <span style={{ fontSize: 12, color: C.gray500, fontWeight: 600, whiteSpace: 'nowrap' }}>
                ¿No tienes cuenta?
              </span>
              <div style={{ flex: 1, height: 1, background: C.gray300 }} />
            </div>

            <Link to="/registro" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', padding: '14px 0',
                border: `1.5px solid ${C.green600}`, borderRadius: 12,
                background: C.white, color: C.green700,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                Crear cuenta gratis
              </button>
            </Link>

            {/* Sello de confianza */}
            <div style={{ marginTop: 'auto', paddingTop: 32, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
              <span style={{ fontSize: 11, color: C.gray500, lineHeight: 1.6 }}>
                Datos protegidos · Médicos colegiados CMP/CPsP · Receta electrónica válida · Ley 30421
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
