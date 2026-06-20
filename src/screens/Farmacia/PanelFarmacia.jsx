import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { C } from '../../lib/tokens'

// ─── Helpers ──────────────────────────────────────────────────

function getLimaMonthBounds() {
  const now  = new Date()
  const lima = new Date(now.getTime() - 5 * 3_600_000)
  const y    = lima.getUTCFullYear()
  const m    = lima.getUTCMonth()
  return {
    start: new Date(Date.UTC(y, m,     1,  5, 0, 0)).toISOString(),
    end:   new Date(Date.UTC(y, m + 1, 0, 28, 59, 59)).toISOString(),
  }
}

function fmtSoles(n) {
  return `S/. ${Number(n ?? 0).toFixed(2)}`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric',
  })
}

function codigoCopy(codigo) {
  navigator.clipboard?.writeText(codigo).catch(() => null)
  toast.success('Código copiado')
}

// ─── Sub-componentes ──────────────────────────────────────────

function StatCard({ icon, value, label, color = C.green700 }) {
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${C.gray200}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.gray500, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

function TabBtn({ id, active, label, onPress }) {
  return (
    <button
      onClick={() => onPress(id)}
      style={{
        flex: 1, padding: '9px 4px', border: 'none',
        background: active ? C.green700 : C.white,
        color: active ? C.white : C.gray500,
        fontSize: 11, fontWeight: 800, cursor: 'pointer',
        fontFamily: 'inherit',
        borderBottom: active ? `2px solid ${C.green700}` : `2px solid ${C.gray200}`,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function FieldRow({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.gray600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', inputMode }) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '11px 13px',
        border: `1.5px solid ${C.gray300}`, borderRadius: 10,
        fontSize: 14, color: C.gray900, background: C.white,
        outline: 'none', fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = C.green500 }}
      onBlur={e => { e.target.style.borderColor = C.gray300 }}
    />
  )
}

// ─── Panel principal ──────────────────────────────────────────

export default function PanelFarmacia() {
  const navigate      = useNavigate()
  const { profile, farmacia } = useAuthStore()

  const [tab,         setTab]         = useState('registrar')
  const [loading,     setLoading]     = useState(true)
  const [patients,    setPatients]    = useState([])
  const [comisiones,  setComisiones]  = useState([])
  const [stats,       setStats]       = useState({ pacientes: 0, consultas: 0, comisionMes: 0, pacientesMes: 0 })

  // Form: registrar paciente
  const [form,           setForm]           = useState({ nombre: '', dni: '', telefono: '', email: '' })
  const [registering,    setRegistering]    = useState(false)
  const [lastRegistered, setLastRegistered] = useState(null)

  // Modal: reservar consulta en nombre de un paciente
  const [bookingState,      setBookingState]      = useState(null)   // null | { patientId, patientName }
  const [bookingDoctors,    setBookingDoctors]     = useState([])
  const [bookingDoctor,     setBookingDoctor]      = useState(null)
  const [doctorSearch,      setDoctorSearch]       = useState('')
  const [bookingDatetime,   setBookingDatetime]    = useState('')
  const [bookingStep,       setBookingStep]        = useState(1)      // 1=médico 2=fecha/hora
  const [bookingSubmitting, setBookingSubmitting]  = useState(false)

  const loadData = useCallback(async () => {
    if (!farmacia?.id) return
    setLoading(true)

    // 1. Todos los pacientes referidos
    const { data: pats } = await supabase
      .from('profiles')
      .select('id, full_name, dni, phone, created_at')
      .eq('farmacia_referente_id', farmacia.id)
      .order('created_at', { ascending: false })

    const patIds = (pats ?? []).map(p => p.id)
    setPatients(pats ?? [])

    if (patIds.length === 0) {
      setComisiones([])
      setStats({ pacientes: 0, consultas: 0, comisionMes: 0, pacientesMes: 0 })
      setLoading(false)
      return
    }

    // 2. Citas de esos pacientes (completadas)
    const { data: appts } = await supabase
      .from('appointments')
      .select('id, scheduled_at, precio_total, comision_pagada, patient_id, doctor:doctors(nombres, apellidos)')
      .in('patient_id', patIds)
      .eq('status', 'done')
      .order('scheduled_at', { ascending: false })

    const pct    = Number(farmacia.comision_porcentaje ?? 5)
    const patMap = Object.fromEntries((pats ?? []).map(p => [p.id, p.full_name]))

    const rows = (appts ?? []).map(a => ({
      id:         a.id,
      fecha:      a.scheduled_at,
      paciente:   patMap[a.patient_id] ?? '—',
      medico:     a.doctor ? `${a.doctor.nombres ?? ''} ${a.doctor.apellidos ?? ''}`.trim() : '—',
      monto:      Number(a.precio_total ?? 0),
      comision:   Number(a.precio_total ?? 0) * pct / 100,
      pagada:     a.comision_pagada ?? false,
    }))
    setComisiones(rows)

    // 3. Stats del mes
    const { start, end } = getLimaMonthBounds()
    const patsEsteMes     = (pats ?? []).filter(p => p.created_at >= start && p.created_at <= end).length
    const apptsMes        = rows.filter(r => r.fecha >= start && r.fecha <= end)
    const comisionMes     = apptsMes.reduce((s, r) => s + r.comision, 0)

    setStats({
      pacientes:    pats?.length ?? 0,
      consultas:    appts?.length ?? 0,
      comisionMes,
      pacientesMes: patsEsteMes,
    })
    setLoading(false)
  }, [farmacia?.id, farmacia?.comision_porcentaje])

  useEffect(() => { loadData() }, [loadData])

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleRegistrar() {
    if (!form.nombre.trim() || !form.dni.trim() || !form.telefono.trim()) {
      toast.error('Nombre, DNI y teléfono son obligatorios')
      return
    }
    if (!/^\d{8}$/.test(form.dni.trim())) {
      toast.error('El DNI debe tener exactamente 8 dígitos')
      return
    }
    setRegistering(true)
    setLastRegistered(null)
    try {
      const { data, error } = await supabase.functions.invoke('registrar-paciente-farmacia', {
        body: {
          nombre:      form.nombre.trim(),
          dni:         form.dni.trim(),
          telefono:    form.telefono.trim(),
          email:       form.email.trim() || null,
          farmacia_id: farmacia.id,
        },
      })
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? 'Error desconocido')

      setLastRegistered({ ...data, nombre: form.nombre.trim() })
      setForm({ nombre: '', dni: '', telefono: '', email: '' })
      toast.success(`Paciente registrado correctamente`)
      loadData()
    } catch (err) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setRegistering(false)
    }
  }

  async function openBooking(patientId, patientName) {
    setBookingState({ patientId, patientName })
    setBookingStep(1)
    setBookingDoctor(null)
    setBookingDatetime('')
    setDoctorSearch('')
    if (bookingDoctors.length === 0) {
      const { data } = await supabase
        .from('doctors')
        .select('id, nombres, apellidos, especialidad, precio')
        .eq('aprobado', true)
        .eq('activo', true)
        .order('nombres')
      setBookingDoctors(data ?? [])
    }
  }

  function closeBooking() {
    setBookingState(null)
    setBookingDoctor(null)
    setBookingDatetime('')
    setDoctorSearch('')
    setBookingStep(1)
  }

  async function handleCreateCita() {
    if (!bookingDoctor || !bookingDatetime) {
      toast.error('Selecciona médico y fecha/hora')
      return
    }
    setBookingSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('crear-cita-farmacia', {
        body: {
          patient_id:   bookingState.patientId,
          doctor_id:    bookingDoctor.id,
          scheduled_at: new Date(bookingDatetime).toISOString(),
        },
      })
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? 'Error al crear cita')
      toast.success('Cita registrada correctamente')
      closeBooking()
      loadData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBookingSubmitting(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  if (!farmacia) return null

  return (
    <div style={{
      minHeight: '100vh', background: C.gray100,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <Toaster position="top-center" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');
        @keyframes pf-spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '18px 18px 22px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.white, letterSpacing: -0.3 }}>
            VIDA<span style={{ color: C.green400 }}>SALUD</span>
            <span style={{ fontSize: 10, marginLeft: 8, color: C.green300, fontWeight: 600 }}>· Botica</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
              color: '#FCA5A5', borderRadius: 8, padding: '5px 12px',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Salir
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: farmacia.logo_url ? 'transparent' : 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            overflow: 'hidden',
          }}>
            {farmacia.logo_url
              ? <img src={farmacia.logo_url} alt={farmacia.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '💊'}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.white, lineHeight: 1.2 }}>
              {farmacia.nombre}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              {farmacia.ciudad}{farmacia.distrito ? ` · ${farmacia.distrito}` : ''}
            </div>
          </div>
        </div>

        {/* Código referido */}
        <div
          onClick={() => codigoCopy(farmacia.codigo_referido)}
          style={{
            marginTop: 14,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Tu código de referido
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.white, letterSpacing: 2, fontFamily: 'monospace', marginTop: 2 }}>
              {farmacia.codigo_referido}
            </div>
          </div>
          <span style={{ fontSize: 18, opacity: 0.7 }}>📋</span>
        </div>
      </div>

      {/* ── Stats del mes ── */}
      <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <StatCard icon="👥" value={loading ? '…' : stats.pacientesMes} label="Pacientes este mes" />
        <StatCard icon="🏥" value={loading ? '…' : stats.consultas}    label="Consultas totales" />
        <StatCard icon="💰" value={loading ? '…' : fmtSoles(stats.comisionMes)} label="Comisión del mes" color={C.green600} />
        <StatCard icon="👤" value={loading ? '…' : stats.pacientes}    label="Total referidos" />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', margin: '14px 16px 0', background: C.white, borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${C.gray200}` }}>
        <TabBtn id="registrar"  active={tab === 'registrar'}  label="➕ Registrar" onPress={setTab} />
        <TabBtn id="pacientes"  active={tab === 'pacientes'}  label="👥 Pacientes" onPress={setTab} />
        <TabBtn id="comisiones" active={tab === 'comisiones'} label="💰 Comisiones" onPress={setTab} />
      </div>

      {/* ── Contenido de tabs ── */}
      <div style={{ padding: '14px 16px 40px' }}>

        {/* ── Tab: Registrar paciente ── */}
        {tab === 'registrar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: C.green50, border: `1.5px solid ${C.green200}`,
              borderRadius: 12, padding: '10px 14px',
              fontSize: 12, color: C.green800, lineHeight: 1.5,
            }}>
              📋 Registra al paciente que viene a tu botica con receta electrónica de VIDASALUD.
              Cumplimiento Ley 30421 — identificación obligatoria por DNI.
            </div>

            <div style={{
              background: C.white, border: `1.5px solid ${C.gray200}`,
              borderRadius: 16, padding: '16px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <FieldRow label="Nombre completo *">
                <Input value={form.nombre} onChange={v => setField('nombre', v)} placeholder="Ej: María García López" />
              </FieldRow>

              <FieldRow label="DNI *">
                <Input value={form.dni} onChange={v => setField('dni', v.replace(/\D/g, '').slice(0, 8))} placeholder="12345678" inputMode="numeric" />
              </FieldRow>

              <FieldRow label="Teléfono *">
                <Input value={form.telefono} onChange={v => setField('telefono', v.replace(/\D/g, '').slice(0, 9))} placeholder="987654321" inputMode="numeric" />
              </FieldRow>

              <FieldRow label="Correo electrónico (opcional)">
                <Input value={form.email} onChange={v => setField('email', v)} placeholder="paciente@correo.com" type="email" />
              </FieldRow>

              <button
                onClick={handleRegistrar}
                disabled={registering}
                style={{
                  width: '100%', padding: '13px 0', border: 'none', borderRadius: 12,
                  background: registering
                    ? C.gray200
                    : `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                  color: registering ? C.gray400 : C.white,
                  fontSize: 14, fontWeight: 800, cursor: registering ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: registering ? 'none' : '0 4px 12px rgba(5,150,105,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {registering ? (
                  <>
                    <div style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${C.gray300}`, borderTopColor: C.gray500, animation: 'pf-spin 0.7s linear infinite' }} />
                    Registrando…
                  </>
                ) : '✅ Registrar paciente'}
              </button>
            </div>

            {/* Resultado del último registro */}
            {lastRegistered && (
              <div style={{
                background: C.green50, border: `1.5px solid ${C.green200}`,
                borderRadius: 14, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.green800, marginBottom: 8 }}>
                  ✅ Paciente registrado exitosamente
                </div>
                <div style={{ fontSize: 12, color: C.green700, lineHeight: 1.8 }}>
                  <strong>Email de acceso:</strong> {lastRegistered.email}<br />
                  <strong>Contraseña temporal:</strong>{' '}
                  <code style={{ background: C.green100, padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                    {lastRegistered.temp_password}
                  </code>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: C.gray500, lineHeight: 1.5 }}>
                  Entrega estos datos al paciente para que pueda acceder a VIDASALUD y gestionar sus citas.
                </div>
                {lastRegistered.patient_id && (
                  <button
                    onClick={() => openBooking(lastRegistered.patient_id, lastRegistered.nombre)}
                    style={{
                      marginTop: 12, width: '100%', padding: '11px 0', border: 'none', borderRadius: 10,
                      background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                      color: C.white, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    🩺 Reservar consulta para este paciente
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Pacientes referidos ── */}
        {tab === 'pacientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ background: C.white, borderRadius: 12, padding: 14, border: `1.5px solid ${C.gray200}` }}>
                  <div style={{ height: 13, width: '50%', background: C.gray100, borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 10, width: '70%', background: C.gray100, borderRadius: 6 }} />
                </div>
              ))
            ) : patients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: C.gray500 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Sin pacientes registrados</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Los pacientes que registres aparecerán aquí.</div>
              </div>
            ) : (
              patients.map(p => {
                const apptCount = comisiones.filter(c => c.paciente === p.full_name).length
                return (
                  <div key={p.id} style={{
                    background: C.white, border: `1.5px solid ${C.gray200}`,
                    borderRadius: 14, padding: '13px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: C.white, fontWeight: 800, fontSize: 15,
                    }}>
                      {(p.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.full_name ?? 'Sin nombre'}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
                        DNI: {p.dni ?? '—'} · {p.phone ?? '—'}
                      </div>
                      <div style={{ fontSize: 10, color: C.gray400, marginTop: 2 }}>
                        Registrado: {fmtDate(p.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: C.green700, textAlign: 'right' }}>{apptCount}</div>
                        <div style={{ fontSize: 9, color: C.gray400, fontWeight: 600 }}>CONSULTAS</div>
                      </div>
                      <button
                        onClick={() => openBooking(p.id, p.full_name)}
                        style={{
                          padding: '6px 10px', border: 'none', borderRadius: 8,
                          background: `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                          color: C.white, fontSize: 11, fontWeight: 800,
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >
                        🩺 Reservar
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Tab: Comisiones ── */}
        {tab === 'comisiones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Resumen */}
            <div style={{
              background: `linear-gradient(135deg, ${C.green800}, ${C.green600})`,
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                  Comisión total acumulada
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.white, marginTop: 2 }}>
                  {fmtSoles(comisiones.reduce((s, c) => s + c.comision, 0))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                  Comisión aplicada
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.green300 }}>
                  {farmacia.comision_porcentaje ?? 5}%
                </div>
              </div>
            </div>

            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ background: C.white, borderRadius: 12, padding: 14, border: `1.5px solid ${C.gray200}` }}>
                  <div style={{ height: 12, width: '60%', background: C.gray100, borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 10, width: '80%', background: C.gray100, borderRadius: 6 }} />
                </div>
              ))
            ) : comisiones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: C.gray500 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Sin comisiones aún</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Las comisiones aparecerán cuando tus pacientes completen consultas.</div>
              </div>
            ) : (
              comisiones.map(c => (
                <div key={c.id} style={{
                  background: C.white, border: `1.5px solid ${C.gray200}`,
                  borderRadius: 14, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.paciente}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>
                        {c.medico}
                      </div>
                      <div style={{ fontSize: 10, color: C.gray400, marginTop: 1 }}>
                        {fmtDate(c.fecha)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: C.green700 }}>
                        {fmtSoles(c.comision)}
                      </div>
                      <div style={{ fontSize: 10, color: C.gray400 }}>
                        de {fmtSoles(c.monto)}
                      </div>
                      <span style={{
                        display: 'inline-block', marginTop: 4,
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                        background: c.pagada ? C.green50 : '#FFFBEB',
                        color: c.pagada ? C.green700 : '#B45309',
                        border: `1px solid ${c.pagada ? C.green200 : '#FDE68A'}`,
                      }}>
                        {c.pagada ? '✅ Pagada' : '⏳ Pendiente'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Reservar consulta ── */}
      {bookingState && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={closeBooking}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: C.white,
              borderRadius: '20px 20px 0 0',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Cabecera del modal */}
            <div style={{
              padding: '16px 18px 14px',
              borderBottom: `1px solid ${C.gray100}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.gray900 }}>🩺 Reservar consulta</div>
                <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
                  Para: <strong>{bookingState.patientName}</strong>
                </div>
              </div>
              <button
                onClick={closeBooking}
                style={{
                  background: C.gray100, border: 'none', borderRadius: '50%',
                  width: 30, height: 30, cursor: 'pointer', fontSize: 14,
                  color: C.gray600, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>

            {/* Indicador de pasos */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 18px', flexShrink: 0 }}>
              {['1. Médico', '2. Fecha y hora'].map((label, i) => (
                <div key={i} style={{
                  flex: 1, padding: '5px 0', textAlign: 'center', borderRadius: 20,
                  fontSize: 11, fontWeight: 700,
                  background: bookingStep === i + 1 ? C.green700 : C.gray100,
                  color:      bookingStep === i + 1 ? C.white    : C.gray400,
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Paso 1 — Seleccionar médico */}
            {bookingStep === 1 && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0 18px 10px', flexShrink: 0 }}>
                  <input
                    placeholder="Buscar por nombre o especialidad…"
                    value={doctorSearch}
                    onChange={e => setDoctorSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 13px', boxSizing: 'border-box',
                      border: `1.5px solid ${C.gray300}`, borderRadius: 10,
                      fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.gray900,
                    }}
                    onFocus={e  => { e.target.style.borderColor = C.green500 }}
                    onBlur={e   => { e.target.style.borderColor = C.gray300  }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 24px' }}>
                  {bookingDoctors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: C.gray400 }}>
                      <div style={{ fontSize: 32 }}>👨‍⚕️</div>
                      <div style={{ fontSize: 12, marginTop: 8 }}>Cargando médicos…</div>
                    </div>
                  ) : (
                    bookingDoctors
                      .filter(d => {
                        const q = doctorSearch.toLowerCase()
                        return !q ||
                          `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) ||
                          (d.especialidad ?? '').toLowerCase().includes(q)
                      })
                      .map(d => (
                        <div
                          key={d.id}
                          onClick={() => { setBookingDoctor(d); setBookingStep(2) }}
                          style={{
                            padding: '11px 13px', borderRadius: 12, marginBottom: 8,
                            border: `1.5px solid ${C.gray200}`,
                            background: C.white, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12,
                          }}
                        >
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${C.green600}, ${C.green800})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: C.white, fontWeight: 800, fontSize: 14,
                          }}>
                            {(d.nombres ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.gray900 }}>
                              {d.nombres} {d.apellidos}
                            </div>
                            <div style={{ fontSize: 11, color: C.gray500, marginTop: 1 }}>
                              {d.especialidad ?? '—'}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.green700, flexShrink: 0 }}>
                            S/. {d.precio ?? '—'}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* Paso 2 — Fecha y hora */}
            {bookingStep === 2 && (
              <div style={{ padding: '16px 18px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Resumen del médico seleccionado */}
                <div style={{
                  background: C.green50, border: `1.5px solid ${C.green200}`,
                  borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green800 }}>
                      {bookingDoctor?.nombres} {bookingDoctor?.apellidos}
                    </div>
                    <div style={{ fontSize: 11, color: C.green700 }}>
                      {bookingDoctor?.especialidad} · S/. {bookingDoctor?.precio}
                    </div>
                  </div>
                  <button
                    onClick={() => { setBookingStep(1); setBookingDoctor(null) }}
                    style={{
                      background: 'none', border: 'none', color: C.green700,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cambiar
                  </button>
                </div>

                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700, color: C.gray600,
                    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    Fecha y hora de la cita
                  </label>
                  <input
                    type="datetime-local"
                    value={bookingDatetime}
                    onChange={e => setBookingDatetime(e.target.value)}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    style={{
                      width: '100%', padding: '11px 13px', boxSizing: 'border-box',
                      border: `1.5px solid ${C.gray300}`, borderRadius: 10,
                      fontSize: 14, fontFamily: 'inherit', outline: 'none', color: C.gray900,
                    }}
                    onFocus={e => { e.target.style.borderColor = C.green500 }}
                    onBlur={e  => { e.target.style.borderColor = C.gray300  }}
                  />
                </div>

                <button
                  onClick={handleCreateCita}
                  disabled={!bookingDatetime || bookingSubmitting}
                  style={{
                    width: '100%', padding: '13px 0', border: 'none', borderRadius: 12,
                    background: !bookingDatetime || bookingSubmitting
                      ? C.gray200
                      : `linear-gradient(135deg, ${C.green700}, ${C.green500})`,
                    color: !bookingDatetime || bookingSubmitting ? C.gray400 : C.white,
                    fontSize: 14, fontWeight: 800,
                    cursor: !bookingDatetime || bookingSubmitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {bookingSubmitting ? (
                    <>
                      <div style={{
                        width: 15, height: 15, borderRadius: '50%',
                        border: `2px solid ${C.gray300}`, borderTopColor: C.gray500,
                        animation: 'pf-spin 0.7s linear infinite',
                      }} />
                      Creando cita…
                    </>
                  ) : '✅ Confirmar cita'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
