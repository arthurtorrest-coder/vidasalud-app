import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'

const C = { red50: '#FEF2F2', red600: '#DC2626', gray900: '#111827', gray500: '#6B7280' }

export default function DoctorRoute() {
  const { profile, loading, user } = useAuthStore()
  const [aprobado, setAprobado] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user?.id) { setChecking(false); return }
    supabase
      .from('doctors')
      .select('aprobado')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAprobado(data?.aprobado ?? false)
        setChecking(false)
      })
  }, [user?.id])

  if ((loading && !profile) || checking) return null

  if (profile?.role !== 'doctor') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: C.red50, gap: 12, padding: 32, textAlign: 'center',
      }}>
        <span style={{ fontSize: 48 }}>🚫</span>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.gray900 }}>
          Acceso restringido
        </div>
        <p style={{ fontSize: 13, color: C.gray500, margin: 0 }}>
          Esta sección es exclusiva para médicos de VIDASALUD.
        </p>
        <Navigate to="/inicio" replace />
      </div>
    )
  }

  // Médico registrado pero aún no aprobado por el admin
  if (aprobado === false) {
    return <Navigate to="/espera-aprobacion" replace />
  }

  return <Outlet />
}
