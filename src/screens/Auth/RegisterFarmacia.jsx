import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green100: '#D1FAE5', green50: '#ECFDF5',
  gray900: '#111827', gray700: '#374151', gray500: '#6B7280',
  gray300: '#D1D5DB', gray100: '#F3F4F6', white: '#FFFFFF',
  red: '#EF4444', red50: '#FEF2F2',
  amberBg: '#FFFBEB', amberText: '#B45309',
}

const CIUDADES = [
  'Huaraz', 'Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura',
  'Iquitos', 'Cusco', 'Chimbote', 'Tacna', 'Huancayo', 'Juliaca',
  'Pucallpa', 'Ayacucho', 'Cajamarca', 'Ica', 'Sullana', 'Tarapoto',
]

const schema = z.object({
  nombre:            z.string().min(3, 'Mínimo 3 caracteres'),
  codigo_digemid:    z.string().min(4, 'Código inválido'),
  ciudad:            z.string().min(1, 'Selecciona una ciudad'),
  distrito:          z.string().min(2, 'Ingresa el distrito'),
  direccion:         z.string().min(5, 'Dirección muy corta'),
  telefono:          z.string().regex(/^\d{7,9}$/, 'Ingresa 7-9 dígitos'),
  propietario_nombre:z.string().min(3, 'Mínimo 3 caracteres'),
  email:             z.email({ error: 'Correo no válido' }),
  password:          z.string().min(6, 'Mínimo 6 caracteres'),
  confirm:           z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Las contraseñas no coinciden', path: ['confirm'],
})

function generarCodigoReferido(ciudad) {
  const tag = ciudad
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  const rnd = Date.now().toString(36).toUpperCase().slice(-4)
  return `BFARM-${tag}-${rnd}`
}

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
    width: '100%', padding: '12px 14px',
    border: `1.5px solid ${hasError ? C.red : C.gray300}`,
    borderRadius: 12, fontSize: 14, color: C.gray900,
    background: hasError ? C.red50 : C.white,
    outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
  }
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.green700,
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

export default function RegisterFarmacia() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { ciudad: '' },
  })

  async function onSubmit(data) {
    setSubmitting(true)
    try {
      const codigoReferido = generarCodigoReferido(data.ciudad)
      console.log('[RegisterFarmacia] iniciando registro —', data.email, '| código:', codigoReferido)

      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    data.email,
        password: data.password,
        options:  { data: { role: 'farmacia' } },
      })
      console.log('[RegisterFarmacia] signUp resultado —', {
        userId:  authData?.user?.id ?? null,
        session: authData?.session ? 'activa' : 'nula (requiere confirmación de email)',
        error:   authErr?.message ?? null,
      })
      if (authErr) throw new Error(authErr.message)
      if (!authData?.user?.id) throw new Error('signUp no devolvió un usuario')

      // 2. Establecer role='farmacia' en profiles
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id:        authData.user.id,
        role:      'farmacia',
        full_name: data.propietario_nombre,
      }, { onConflict: 'id' })
      console.log('[RegisterFarmacia] profiles.upsert —', profileErr?.message ?? 'OK')
      if (profileErr) console.warn('[RegisterFarmacia] profile upsert falló — role puede quedar como "patient"')

      // 3. Insertar en tabla farmacias (incluye profile_id para RLS por UID)
      const { error: dbErr } = await supabase.from('farmacias').insert({
        profile_id:         authData.user.id,
        nombre:             data.nombre,
        codigo_digemid:     data.codigo_digemid,
        ciudad:             data.ciudad,
        distrito:           data.distrito,
        direccion:          data.direccion,
        telefono:           data.telefono,
        propietario_nombre: data.propietario_nombre,
        email:              data.email,
        codigo_referido:    codigoReferido,
        aprobado:           false,
        activo:             false,
      })
      console.log('[RegisterFarmacia] farmacias.insert —', dbErr?.message ?? 'OK')
      if (dbErr) {
        await supabase.auth.admin?.deleteUser(authData.user.id).catch(() => null)
        throw new Error(dbErr.message)
      }

      // 4. Redirigir a pantalla de espera
      console.log('[RegisterFarmacia] registro completo → /espera-aprobacion-farmacia')
      toast.success('¡Botica registrada! Estamos verificando tus datos.', { duration: 4000 })
      navigate('/espera-aprobacion-farmacia', { replace: true })
    } catch (err) {
      console.error('[RegisterFarmacia] error —', err.message)
      toast.error(err.message ?? 'Error al registrar la botica')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.gray100,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <Toaster position="top-center" />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '18px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: -0.5 }}>
          VIDA<span style={{ color: '#34D399' }}>SALUD</span>
        </div>
        <Link to="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
          ← Volver
        </Link>
      </div>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '24px 20px 32px',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💊</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.white, margin: '0 0 6px', letterSpacing: -0.3 }}>
          Registra tu botica
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: 0, lineHeight: 1.5 }}>
          Conéctate con pacientes que reciben recetas electrónicas de VIDASALUD y aumenta tus ventas.
        </p>
      </div>

      {/* Aviso */}
      <div style={{
        margin: '16px 18px 0',
        background: C.amberBg, border: `1.5px solid #FDE68A`,
        borderRadius: 12, padding: '12px 14px',
        fontSize: 12, color: C.amberText, fontWeight: 600, lineHeight: 1.5,
      }}>
        ⏳ Tu solicitud será revisada por nuestro equipo. Aprobación en 1-2 días hábiles.
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          margin: '16px 18px 40px',
          background: C.white, borderRadius: 20,
          border: `1.5px solid ${C.gray300}`,
          padding: '22px 20px',
          display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900, borderBottom: `1px solid ${C.gray100}`, paddingBottom: 12 }}>
          💊 Datos de la botica
        </div>

        <div>
          <Label>Nombre de la botica</Label>
          <input {...register('nombre')} placeholder="Ej: Botica San Juan" style={inputStyle(!!errors.nombre)} />
          <FieldError msg={errors.nombre?.message} />
        </div>

        <div>
          <Label>Código DIGEMID</Label>
          <input {...register('codigo_digemid')} placeholder="Ej: 14-012345" style={inputStyle(!!errors.codigo_digemid)} />
          <FieldError msg={errors.codigo_digemid?.message} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Ciudad</Label>
            <select {...register('ciudad')} style={{ ...inputStyle(!!errors.ciudad), cursor: 'pointer' }}>
              <option value="">Selecciona…</option>
              {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <FieldError msg={errors.ciudad?.message} />
          </div>
          <div>
            <Label>Distrito</Label>
            <input {...register('distrito')} placeholder="Ej: Independencia" style={inputStyle(!!errors.distrito)} />
            <FieldError msg={errors.distrito?.message} />
          </div>
        </div>

        <div>
          <Label>Dirección</Label>
          <input {...register('direccion')} placeholder="Ej: Jr. Luzuriaga 450" style={inputStyle(!!errors.direccion)} />
          <FieldError msg={errors.direccion?.message} />
        </div>

        <div>
          <Label>Teléfono</Label>
          <input {...register('telefono')} placeholder="043123456" inputMode="numeric" style={inputStyle(!!errors.telefono)} />
          <FieldError msg={errors.telefono?.message} />
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900, borderBottom: `1px solid ${C.gray100}`, paddingBottom: 12, marginTop: 4 }}>
          👤 Datos del propietario
        </div>

        <div>
          <Label>Nombre del propietario</Label>
          <input {...register('propietario_nombre')} placeholder="Nombres y apellidos" style={inputStyle(!!errors.propietario_nombre)} />
          <FieldError msg={errors.propietario_nombre?.message} />
        </div>

        <div>
          <Label>Correo electrónico</Label>
          <input {...register('email')} type="email" placeholder="correo@botica.com" style={inputStyle(!!errors.email)} />
          <FieldError msg={errors.email?.message} />
        </div>

        <div>
          <Label>Contraseña</Label>
          <input {...register('password')} type="password" placeholder="Mínimo 6 caracteres" style={inputStyle(!!errors.password)} />
          <FieldError msg={errors.password?.message} />
        </div>

        <div>
          <Label>Confirmar contraseña</Label>
          <input {...register('confirm')} type="password" placeholder="Repite la contraseña" style={inputStyle(!!errors.confirm)} />
          <FieldError msg={errors.confirm?.message} />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '15px 0', border: 'none', borderRadius: 12,
            background: submitting
              ? C.gray100
              : `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
            color: submitting ? C.gray500 : C.white,
            fontSize: 15, fontWeight: 800,
            cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            boxShadow: submitting ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
            transition: 'all 0.2s',
          }}
        >
          {submitting ? 'Registrando…' : '💊 Registrar mi botica'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: C.gray500, margin: 0 }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: C.green700, fontWeight: 700, textDecoration: 'none' }}>
            Iniciar sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
