import { useState, useEffect } from 'react'
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
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm:  z.string(),
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

function ToggleBtn({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      style={{
        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 18, color: C.gray400, padding: 0, lineHeight: 1,
      }}
    >
      {show ? '🙈' : '👁️'}
    </button>
  )
}

// ─── Estado: detectando token ─────────────────────────────────
function LoadingState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: `4px solid ${C.green100}`,
        borderTopColor: C.green600,
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: 14, color: C.gray500, textAlign: 'center', margin: 0 }}>
        Verificando enlace de recuperación…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Estado: token inválido o expirado ────────────────────────
function InvalidState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, textAlign: 'center' }}>
      <span style={{ fontSize: 52 }}>⏰</span>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.gray900, marginBottom: 8 }}>
          Enlace expirado o inválido
        </div>
        <p style={{ fontSize: 13, color: C.gray500, lineHeight: 1.6, margin: 0 }}>
          El enlace de recuperación ya fue usado o expiró. Los enlaces tienen una duración limitada por seguridad.
        </p>
      </div>
      <Link to="/login" style={{ textDecoration: 'none', width: '100%', maxWidth: 280 }}>
        <button style={{
          width: '100%', padding: '14px 0',
          background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
          color: C.white, border: 'none', borderRadius: 12,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
          fontFamily: 'inherit',
        }}>
          Solicitar nuevo enlace
        </button>
      </Link>
    </div>
  )
}

// ─── Estado: contraseña cambiada con éxito ────────────────────
function SuccessState() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/login', { replace: true }), 3500)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: C.green50, border: `3px solid ${C.green200}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>
        ✅
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.gray900, marginBottom: 8 }}>
          ¡Contraseña actualizada!
        </div>
        <p style={{ fontSize: 13, color: C.gray500, lineHeight: 1.6, margin: 0 }}>
          Tu nueva contraseña ha sido guardada. Redirigiendo al inicio de sesión…
        </p>
      </div>
      <div style={{ fontSize: 12, color: C.green700, fontWeight: 600 }}>
        Redirigiendo en 3 segundos
      </div>
    </div>
  )
}

// ─── Pantalla principal ───────────────────────────────────────
export default function NuevaContrasena() {
  // 'loading' | 'ready' | 'invalid' | 'done'
  const [status,      setStatus]      = useState('loading')
  const [saving,      setSaving]      = useState(false)
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    // Caso A: Supabase ya procesó el hash antes de montar este componente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus(s => s === 'loading' ? 'ready' : s)
    })

    // Caso B: el evento PASSWORD_RECOVERY llega justo al montar
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })

    // Fallback: si tras 5 s no hubo sesión, el enlace es inválido/expirado
    const timer = setTimeout(() => {
      setStatus(s => s === 'loading' ? 'invalid' : s)
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function onSubmit({ password }) {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      toast.error('No se pudo guardar la contraseña. Intenta solicitar un nuevo enlace.')
      return
    }

    // Cerrar sesión de recuperación para que el usuario inicie con la nueva contraseña
    await supabase.auth.signOut()
    setStatus('done')
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
            background: `linear-gradient(135deg, ${C.green900}, ${C.green700})`,
            padding: '44px 24px 28px',
            flexShrink: 0,
          }}>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: 20, padding: '6px 14px',
                color: C.white, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
              }}>
                ← Volver al inicio
              </button>
            </Link>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
              Nueva contraseña
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: 500 }}>
              Elige una contraseña segura para tu cuenta
            </div>
          </div>

          {/* Contenido dinámico */}
          {status === 'loading' && <LoadingState />}
          {status === 'invalid' && <InvalidState />}
          {status === 'done'    && <SuccessState />}

          {status === 'ready' && (
            <div style={{ flex: 1, padding: '32px 24px 28px', display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 13, color: C.gray500, margin: '0 0 28px', lineHeight: 1.6 }}>
                Crea una nueva contraseña para tu cuenta VIDASALUD. Usa al menos 8 caracteres.
              </p>

              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                {/* Nueva contraseña */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                    Nueva contraseña
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      {...register('password')}
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      style={{ ...inputStyle(!!errors.password), paddingRight: 48 }}
                    />
                    <ToggleBtn show={showPass} onToggle={() => setShowPass(s => !s)} />
                  </div>
                  <FieldError msg={errors.password?.message} />
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                    Confirmar contraseña
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      {...register('confirm')}
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repite la contraseña"
                      style={{ ...inputStyle(!!errors.confirm), paddingRight: 48 }}
                    />
                    <ToggleBtn show={showConfirm} onToggle={() => setShowConfirm(s => !s)} />
                  </div>
                  <FieldError msg={errors.confirm?.message} />
                </div>

                {/* Tip de seguridad */}
                <div style={{
                  background: C.green50, border: `1px solid ${C.green100}`,
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 11, color: C.green700, lineHeight: 1.6,
                }}>
                  💡 Usa letras, números y símbolos para una contraseña más segura.
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    marginTop: 4, width: '100%', padding: '15px 0',
                    background: saving
                      ? C.green100
                      : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
                    color: saving ? C.green700 : C.white,
                    border: 'none', borderRadius: 12,
                    fontSize: 15, fontWeight: 800,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {saving ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
