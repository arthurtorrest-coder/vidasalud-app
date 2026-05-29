import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useAuthStore } from './stores/authStore'
import ProtectedRoute  from './components/layout/ProtectedRoute'
import AppShell        from './components/layout/AppShell'
import Login           from './screens/Auth/Login'
import Register        from './screens/Auth/Register'
import RegisterMedico  from './screens/Auth/RegisterMedico'
import NuevaContrasena    from './screens/Auth/NuevaContrasena'
import EsperaAprobacion  from './screens/Auth/EsperaAprobacion'
import DoctorRoute     from './components/layout/DoctorRoute'
import AdminRoute      from './components/layout/AdminRoute'
import PanelMedico      from './screens/Doctor/PanelMedico'
import PanelAdmin       from './screens/Admin/PanelAdmin'
import HistoriaClinica  from './screens/HistoriaClinica'
import Landing         from './screens/Landing'
import Home            from './pages/Home'
import Booking         from './pages/Booking'
import Payment         from './pages/Payment'
import Citas           from './pages/Citas'
import Historial       from './screens/Historial'
import Perfil          from './pages/Perfil'

const C = { green100: '#D1FAE5', green600: '#059669', gray100: '#F3F4F6' }

function AuthInit() {
  useAuth()
  return null
}

// "/" pública: Landing para invitados, redirige a /inicio si ya hay sesión
function PublicRoot() {
  const { user, loading } = useAuthStore()
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: C.gray100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `3px solid ${C.green100}`, borderTopColor: C.green600,
          animation: 'spin 0.75s linear infinite',
        }} />
      </div>
    )
  }
  if (user) return <Navigate to="/inicio" replace />
  return <Landing />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit />
      <Routes>

        {/* Raíz pública — Landing o redirect a /inicio */}
        <Route path="/" element={<PublicRoot />} />

        {/* Rutas públicas — sin AppShell */}
        <Route path="/login"            element={<Login />}            />
        <Route path="/registro"          element={<Register />}         />
        <Route path="/registro-medico"  element={<RegisterMedico />}   />
        <Route path="/nueva-contrasena" element={<NuevaContrasena />}  />

        {/* Rutas protegidas — redirigen a /login si no hay sesión */}
        <Route element={<ProtectedRoute />}>

          {/* Médico pendiente de aprobación */}
          <Route path="/espera-aprobacion" element={<EsperaAprobacion />} />

          {/* Solo médicos */}
          <Route element={<DoctorRoute />}>
            <Route path="/medico/panel"                    element={<PanelMedico />}     />
            <Route path="/historia-clinica/:patientId"     element={<HistoriaClinica />} />
          </Route>

          {/* Solo admins */}
          <Route element={<AdminRoute />}>
            <Route path="/admin/panel" element={<PanelAdmin />} />
          </Route>

          <Route element={<AppShell />}>
            <Route path="/inicio"              element={<Home />}     />
            <Route path="/booking/:doctorId"   element={<Booking />}  />
            <Route path="/pago/:appointmentId" element={<Payment />}  />
            <Route path="/citas"               element={<Citas />}    />
            <Route path="/historial"           element={<Historial />} />
            <Route path="/perfil"              element={<Perfil />}    />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  )
}
