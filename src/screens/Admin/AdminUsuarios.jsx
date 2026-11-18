import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/tokens'

const PAGE_SIZE = 25

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric',
  })
}

function Avatar({ name }) {
  const initials = (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const colors = [C.green600, '#7C3AED', '#DB2777', '#D97706', '#2563EB', '#059669']
  const color = colors[(name ?? '').charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function AdminUsuarios() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let q = supabase
      .from('profiles')
      .select(`id, full_name, email, phone, created_at`, { count: 'exact' })
      .neq('role', 'doctor')

    if (debouncedSearch.trim()) {
      q = q.or(`full_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
    }

    q = q.order(sortBy, { ascending: sortAsc }).range(from, to)

    const { data, count, error } = await q
    if (!error) { setUsers(data ?? []); setTotal(count ?? 0) }
    setLoading(false)
  }, [page, debouncedSearch, sortBy, sortAsc])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handleSort(col) {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(true) }
    setPage(0)
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span style={{ color: C.gray300, fontSize: 10 }}> ↕</span>
    return <span style={{ color: C.green500, fontSize: 10 }}> {sortAsc ? '↑' : '↓'}</span>
  }

  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <header style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin/panel')} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>← Panel</button>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>VIDASALUD</div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.green400,
            background: 'rgba(52,211,153,0.15)', padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5,
          }}>USUARIOS</span>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
          {total > 0 && `${total.toLocaleString('es-PE')} pacientes registrados`}
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div style={{
          background: '#fff', borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          padding: '16px 20px', marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <input
            type="text" placeholder="🔍  Buscar por nombre o email…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex: '1 1 260px', padding: '10px 14px', borderRadius: 10, fontSize: 14,
              border: `1.5px solid ${C.gray200}`, fontFamily: 'inherit', outline: 'none',
              color: C.gray900, background: C.gray50,
            }}
            onFocus={e => e.target.style.borderColor = C.green500}
            onBlur={e => e.target.style.borderColor = C.gray200}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: C.gray100, border: 'none', color: C.gray500,
              borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>✕ Limpiar</button>
          )}
          <button onClick={fetchUsers} style={{
            background: C.green600, border: 'none', color: '#fff',
            borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>↻ Actualizar</button>
        </div>

        <div style={{
          background: '#fff', borderRadius: 16, border: `1.5px solid ${C.gray200}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.gray50, borderBottom: `2px solid ${C.gray200}` }}>
                  {[
                    { label: 'Paciente', col: 'full_name' },
                    { label: 'Email', col: 'email' },
                    { label: 'Teléfono', col: null },
                    { label: 'Registro', col: 'created_at' },
                    { label: 'Citas', col: null },
                  ].map(({ label, col }) => (
                    <th key={label} onClick={col ? () => handleSort(col) : undefined}
                      style={{
                        padding: '12px 16px', textAlign: 'left', fontWeight: 800,
                        color: C.gray500, fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: 0.6, whiteSpace: 'nowrap',
                        cursor: col ? 'pointer' : 'default', userSelect: 'none',
                      }}>
                      {label}{col && <SortIcon col={col} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                      {[180, 220, 100, 110, 60].map((w, j) => (
                        <td key={j} style={{ padding: '14px 16px' }}>
                          <div style={{ height: 12, width: w, background: C.gray200, borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: C.gray400, fontSize: 14 }}>
                      {debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'No hay pacientes registrados'}
                    </td>
                  </tr>
                ) : users.map(u => {
                  const appts = u.appointments ?? []
                  const done = appts.filter(a => a.status === 'done').length
                  return (
                    <tr key={u.id}
                      style={{ borderBottom: `1px solid ${C.gray100}`, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.gray50}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={u.full_name} />
                          <span style={{ fontWeight: 700, color: C.gray900 }}>
                            {u.full_name ?? <span style={{ color: C.gray400, fontStyle: 'italic' }}>Sin nombre</span>}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: C.gray600 }}>{u.email ?? '—'}</td>
                      <td style={{ padding: '12px 16px', color: C.gray600 }}>{u.phone ?? <span style={{ color: C.gray300 }}>—</span>}</td>
                      <td style={{ padding: '12px 16px', color: C.gray500, whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {appts.length === 0 ? (
                          <span style={{ color: C.gray300, fontSize: 12 }}>Sin citas</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 700, color: C.gray900 }}>{appts.length} cita{appts.length !== 1 ? 's' : ''}</span>
                            {done > 0 && <span style={{ fontSize: 11, color: C.green600 }}>{done} completada{done !== 1 ? 's' : ''}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{
              padding: '14px 20px', borderTop: `1px solid ${C.gray100}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span style={{ fontSize: 12, color: C.gray400, fontWeight: 500 }}>
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString('es-PE')}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.gray200}`, background: page === 0 ? C.gray100 : '#fff', color: page === 0 ? C.gray300 : C.gray700, fontSize: 12, fontWeight: 700, cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>← Ant.</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.gray200}`, background: page >= totalPages - 1 ? C.gray100 : '#fff', color: page >= totalPages - 1 ? C.gray300 : C.gray700, fontSize: 12, fontWeight: 700, cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>Sig. →</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
