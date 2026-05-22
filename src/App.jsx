import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute  from './components/layout/ProtectedRoute'
import AppShell        from './components/layout/AppShell'
import Login           from './screens/Auth/Login'
import Register        from './screens/Auth/Register'
import NuevaContrasena from './screens/Auth/NuevaContrasena'
import Home            from './pages/Home'
import Booking         from './pages/Booking'
import Payment         from './pages/Payment'
import Citas           from './pages/Citas'
import Historial       from './pages/Historial'
import Perfil          from './pages/Perfil'

function AuthInit() {
  useAuth()
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit />
      <Routes>

        {/* Rutas públicas — sin AppShell */}
        <Route path="/login"            element={<Login />}            />
        <Route path="/registro"         element={<Register />}         />
        <Route path="/nueva-contrasena" element={<NuevaContrasena />}  />

        {/* Rutas protegidas — redirigen a /login si no hay sesión */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/"                    element={<Home />}     />
            <Route path="/booking/:doctorId"   element={<Booking />}  />
            <Route path="/pago/:appointmentId" element={<Payment />}  />
            <Route path="/citas"               element={<Citas />}    />
            <Route path="/historial" element={<Historial />} />
            <Route path="/perfil"    element={<Perfil />}    />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  )
}
