import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function FarmaciaRoute() {
  const { profile, farmacia, loading } = useAuthStore()
  if (loading) return null

  if (profile?.role !== 'farmacia' || !farmacia?.aprobado) {
    return <Navigate to="/inicio" replace />
  }

  return <Outlet />
}
