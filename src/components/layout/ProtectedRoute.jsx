import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const C = { green600: '#059669', green100: '#D1FAE5', gray100: '#F3F4F6', white: '#FFFFFF' }

export default function ProtectedRoute() {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: C.gray100,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{
          fontSize: 28, fontWeight: 900, color: C.green600,
          fontFamily: "'DM Sans', sans-serif", letterSpacing: -0.5,
        }}>
          VIDASALUD
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `3px solid ${C.green100}`,
          borderTopColor: C.green600,
          animation: 'spin 0.75s linear infinite',
        }} />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
