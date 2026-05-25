import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const C = { green50: '#ECFDF5', green600: '#059669', gray900: '#111827', gray500: '#6B7280' }

export default function AdminRoute() {
  const { profile, loading } = useAuthStore()

  if (loading) return null

  if (profile?.role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: C.green50, gap: 12, padding: 32, textAlign: 'center',
      }}>
        <span style={{ fontSize: 48 }}>🔒</span>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.gray900 }}>Acceso restringido</div>
        <p style={{ fontSize: 13, color: C.gray500, margin: 0 }}>
          Esta sección es exclusiva para administradores de VIDASALUD.
        </p>
        <Navigate to="/inicio" replace />
      </div>
    )
  }

  return <Outlet />
}
