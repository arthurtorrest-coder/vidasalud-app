import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green500: '#10B981',
  green100: '#D1FAE5',
  green50:  '#ECFDF5',
  red600:   '#DC2626',
  red50:    '#FEF2F2',
  gray900:  '#111827',
  gray700:  '#374151',
  gray500:  '#6B7280',
  gray400:  '#9CA3AF',
  gray300:  '#D1D5DB',
  gray200:  '#E5E7EB',
  gray100:  '#F3F4F6',
  white:    '#FFFFFF',
}

function getInitials(fullName, email) {
  if (fullName?.trim()) {
    return fullName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }
  return (email?.[0] ?? 'U').toUpperCase()
}

function Field({ label, value, icon, readOnly, inputProps }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: readOnly ? C.gray100 : C.white,
        border: `1.5px solid ${focused && !readOnly ? C.green500 : C.gray200}`,
        borderRadius: 12, padding: '11px 14px',
        boxShadow: focused && !readOnly ? '0 0 0 3px rgba(16,185,129,0.1)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        {readOnly ? (
          <span style={{ fontSize: 14, color: C.gray500, flex: 1 }}>{value || '—'}</span>
        ) : (
          <input
            {...inputProps}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: C.gray900, fontFamily: 'inherit',
            }}
          />
        )}
        {readOnly && (
          <span style={{ fontSize: 12, color: C.gray400, fontWeight: 600, flexShrink: 0 }}>No editable</span>
        )}
      </div>
    </div>
  )
}

function LogoutModal({ onConfirm, onClose, loading }) {
  return (
    <div
      onClick={() => !loading && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 390, background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ width: 40, height: 4, background: C.gray200, borderRadius: 2, margin: '0 auto -4px' }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: C.gray900, textAlign: 'center' }}>Cerrar sesión</div>
        <div style={{ fontSize: 13, color: C.gray500, textAlign: 'center', lineHeight: 1.6 }}>
          ¿Confirmas que deseas cerrar tu sesión en VIDASALUD?
        </div>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            background: C.red600, border: 'none', color: C.white,
            borderRadius: 12, padding: '14px 0', width: '100%',
            fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Cerrando sesión...' : 'Sí, cerrar sesión'}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          style={{
            background: 'none', border: `1.5px solid ${C.gray300}`, color: C.gray700,
            borderRadius: 12, padding: '13px 0', width: '100%',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function Perfil() {
  const navigate                      = useNavigate()
  const { user, profile, setProfile } = useAuthStore()

  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [showLogout,    setShowLogout]    = useState(false)
  const [loggingOut,    setLoggingOut]    = useState(false)
  const [form,          setForm]          = useState({
    full_name: '',
    dni:       '',
    phone:     '',
  })

  function startEdit() {
    setForm({
      full_name: profile?.full_name ?? '',
      dni:       profile?.dni       ?? '',
      phone:     profile?.phone     ?? '',
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  function setField(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSave() {
    const payload = {
      full_name: form.full_name.trim(),
      dni:       form.dni.trim(),
      phone:     form.phone.trim(),
    }

    if (!payload.full_name) { toast.error('El nombre completo es requerido'); return }
    if (payload.dni && !/^\d{8}$/.test(payload.dni)) { toast.error('DNI debe tener exactamente 8 dígitos'); return }
    if (payload.phone && !/^\d{9}$/.test(payload.phone)) { toast.error('Teléfono debe tener exactamente 9 dígitos'); return }

    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      toast.error('No se pudo guardar los cambios')
    } else {
      setProfile(data)
      setEditing(false)
      toast.success('Perfil actualizado')
    }
    setSaving(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const displayName = profile?.full_name?.trim() || user?.email || 'Usuario'
  const avatarInitials = getInitials(profile?.full_name, user?.email)
  const email = user?.email ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      <Toaster position="top-center" />

      {/* Avatar header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green800} 0%, ${C.green600} 100%)`,
        padding: '32px 20px 36px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          border: '3px solid rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: C.white,
        }}>
          {avatarInitials}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{displayName}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{email}</div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.green100,
          background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 14px',
        }}>
          Paciente · VIDASALUD
        </div>
      </div>

      {/* Data section */}
      <div style={{ padding: '24px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>Datos personales</span>
          {!editing && (
            <button
              onClick={startEdit}
              style={{
                background: C.green50, border: `1px solid ${C.green100}`,
                color: C.green700, borderRadius: 8, padding: '6px 14px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              ✏️ Editar
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="Nombre completo"
            icon="👤"
            value={profile?.full_name}
            readOnly={!editing}
            inputProps={{
              placeholder: 'Ej: María López Quispe',
              value: form.full_name,
              onChange: setField('full_name'),
              maxLength: 80,
            }}
          />
          <Field
            label="DNI"
            icon="🪪"
            value={profile?.dni}
            readOnly={!editing}
            inputProps={{
              placeholder: '12345678',
              value: form.dni,
              onChange: setField('dni'),
              maxLength: 8,
              inputMode: 'numeric',
            }}
          />
          <Field
            label="Teléfono"
            icon="📱"
            value={profile?.phone}
            readOnly={!editing}
            inputProps={{
              placeholder: '987654321',
              value: form.phone,
              onChange: setField('phone'),
              maxLength: 9,
              inputMode: 'numeric',
              type: 'tel',
            }}
          />
          <Field
            label="Correo electrónico"
            icon="📧"
            value={email}
            readOnly
          />
        </div>

        {editing && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={cancelEdit}
              disabled={saving}
              style={{
                flex: 1, background: 'none', border: `1.5px solid ${C.gray300}`,
                color: C.gray700, borderRadius: 12, padding: '13px 0',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 2, background: C.green700, border: 'none', color: C.white,
                borderRadius: 12, padding: '13px 0',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {/* Account section */}
      <div style={{ padding: '28px 20px 32px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900, marginBottom: 4 }}>Cuenta</div>

        <div style={{
          background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${C.gray100}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🛡️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.gray700 }}>Regulado · RENIPRESS</span>
            </div>
            <span style={{ fontSize: 11, color: C.gray400 }}>Ley 30421</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>📱</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.gray700 }}>VIDASALUD</span>
            </div>
            <span style={{ fontSize: 11, color: C.gray400 }}>v1.0.0</span>
          </div>
        </div>

        {/* Botón "Ver tutorial" */}
        <button
          onClick={() => {
            localStorage.removeItem('vidasalud_tour_v1')
            navigate('/inicio')
          }}
          style={{
            width: '100%', background: C.green50, border: `1.5px solid ${C.green100}`,
            color: C.green700, borderRadius: 14, padding: '14px 0',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span>🎓</span> Ver tutorial de la app
        </button>

        <button
          onClick={() => setShowLogout(true)}
          style={{
            width: '100%', background: C.red50, border: `1.5px solid #FECACA`,
            color: C.red600, borderRadius: 14, padding: '14px 0',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>

      {showLogout && (
        <LogoutModal
          loading={loggingOut}
          onConfirm={handleLogout}
          onClose={() => !loggingOut && setShowLogout(false)}
        />
      )}
    </div>
  )
}
