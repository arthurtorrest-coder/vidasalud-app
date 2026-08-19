import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const C = { red50: '#FEF2F2', red600: '#DC2626', gray900: '#111827', gray500: '#6B7280' }

export default function CoordinadorRoute() {
  const { profile, loading } = useAuthStore()

  // ProtectedRoute maneja el spinner inicial (loading && !user).
  // Aquí solo bloqueamos si aún no hay profile (primera carga).
  if (loading && !profile) return null

  if (profile?.role !== 'coordinador') {
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
          Esta sección es exclusiva para coordinadores de zona de VIDASALUD.
        </p>
        <Navigate to="/inicio" replace />
      </div>
    )
  }

  return <Outlet />
}
