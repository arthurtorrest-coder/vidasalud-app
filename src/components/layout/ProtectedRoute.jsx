import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const C = { green600: '#059669', green100: '#D1FAE5', gray100: '#F3F4F6', white: '#FFFFFF' }

export default function ProtectedRoute() {
  const { user, profile, doctor, farmacia, loading } = useAuthStore()
  const location = useLocation()

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

  console.log('[ProtectedRoute] evaluando —', {
    role:             profile?.role     ?? null,
    doctorAprobado:   doctor?.aprobado  ?? 'n/a',
    farmaciaAprobado: farmacia?.aprobado ?? 'n/a (farmacia null)',
    pathname:         location.pathname,
  })

  // Médico con aprobación pendiente → pantalla de espera
  if (
    profile?.role === 'doctor' &&
    doctor?.aprobado === false &&
    location.pathname !== '/espera-aprobacion'
  ) {
    console.log('[ProtectedRoute] → redirigiendo médico a /espera-aprobacion')
    return <Navigate to="/espera-aprobacion" replace />
  }

  // Farmacia pendiente O sin registro cargado → pantalla de espera
  // farmacia===null significa que el registro no se encontró en la tabla farmacias
  if (
    profile?.role === 'farmacia' &&
    location.pathname !== '/espera-aprobacion-farmacia' &&
    (farmacia === null || farmacia?.aprobado === false)
  ) {
    console.log('[ProtectedRoute] → redirigiendo farmacia a /espera-aprobacion-farmacia', {
      farmacia_null: farmacia === null,
      aprobado: farmacia?.aprobado ?? null,
    })
    return <Navigate to="/espera-aprobacion-farmacia" replace />
  }

  // Farmacia aprobada fuera de su área → panel farmacia
  if (
    profile?.role === 'farmacia' &&
    farmacia?.aprobado === true &&
    !location.pathname.startsWith('/farmacia')
  ) {
    console.log('[ProtectedRoute] → redirigiendo farmacia aprobada a /farmacia/panel')
    return <Navigate to="/farmacia/panel" replace />
  }

  return <Outlet />
}
