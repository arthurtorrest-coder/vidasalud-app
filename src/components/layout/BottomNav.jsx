import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B',
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green500: '#10B981',
  green400: '#34D399',
  green50:  '#ECFDF5',
  gray600:  '#4B5563',
  gray500:  '#6B7280',
  gray200:  '#E5E7EB',
  white:    '#FFFFFF',
}

// ─── Iconos ───────────────────────────────────────────────────

const ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  ),
  pharmacy: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8"  x2="12" y2="16" />
      <line x1="8"  y1="12" x2="16" y2="12" />
    </svg>
  ),
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
}

const HAMBURGER = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"  />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const VIDEO_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14" />
    <rect x="1" y="6" width="14" height="12" rx="2" ry="2" />
  </svg>
)

// ─── Items de navegación ──────────────────────────────────────

const NAV_ITEMS = [
  { to: '/inicio',    icon: ICONS.home,     label: 'Inicio',    roots: ['/inicio', '/booking', '/pago', '/medico'] },
  { to: '/citas',     icon: ICONS.calendar, label: 'Citas',     roots: ['/citas'],                                  isCitas: true },
  { to: '/farmacias', icon: ICONS.pharmacy, label: 'Farmacias', roots: ['/farmacias', '/registro-farmacia']         },
  { to: '/perfil',    icon: ICONS.user,     label: 'Perfil',    roots: ['/perfil']                                  },
]

function isActive(roots, pathname) {
  return roots.some(r => pathname === r || pathname.startsWith(r + '/'))
}

// ─── Hook: mensajes no leídos ─────────────────────────────────

function useUnread(userId) {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .neq('sender_id', userId)
      .eq('leido', false)
      .then(({ count }) => setN(count ?? 0))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const ch = supabase
      .channel(`topbar-unread-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, p => {
        if (p.new.sender_id !== userId) setN(v => v + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes' }, p => {
        if (p.new.leido && !p.old?.leido && p.new.sender_id !== userId)
          setN(v => Math.max(0, v - 1))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  return n
}

// ─── Item del drawer ──────────────────────────────────────────

function DrawerItem({ icon, label, to, roots, badge, navigate, pathname, onClose }) {
  const active = isActive(roots, pathname)
  return (
    <button
      onClick={() => { onClose(); navigate(to) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '13px 14px', border: 'none',
        background: active ? C.green50 : 'transparent',
        borderRadius: 12, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ color: active ? C.green700 : C.gray500, display: 'flex', flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{
        fontSize: 15, fontWeight: active ? 700 : 500,
        color: active ? C.green900 : C.gray600, flex: 1, textAlign: 'left',
      }}>
        {label}
      </span>
      {badge > 0 && (
        <span style={{
          background: '#EF4444', color: C.white,
          fontSize: 10, fontWeight: 800,
          padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {active && <span style={{ color: C.green500, fontSize: 18 }}>›</span>}
    </button>
  )
}

// ─── TopBar — exported, renderizado en AppShell ───────────────

export function TopBar() {
  const navigate        = useNavigate()
  const { pathname }    = useLocation()
  const { user, profile } = useAuthStore()
  const unread          = useUnread(user?.id)
  const [open, setOpen] = useState(false)

  const firstName = profile?.full_name?.toUpperCase() ?? ''

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <>
      {/* Barra superior */}
      <div style={{
        background: `linear-gradient(135deg, ${C.green900}, ${C.green800})`,
        padding: '11px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Izquierda: hamburger + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 8, padding: '7px 9px', cursor: 'pointer', color: C.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Menú"
          >
            {HAMBURGER}
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5,
                width: 16, height: 16, borderRadius: 8,
                background: '#EF4444', color: C.white,
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${C.green900}`,
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {firstName && (
            <span style={{ fontSize: 13, fontWeight: 800, color: C.white, letterSpacing: 0.8 }}>
              {firstName}
            </span>
          )}
        </div>

        {/* Derecha: logo */}
        <div style={{ fontSize: 16, fontWeight: 900, color: C.white, letterSpacing: -0.3, userSelect: 'none' }}>
          VIDA<span style={{ color: C.green400 }}>SALUD</span>
        </div>
      </div>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.46)' }}
        />
      )}

      {/* Drawer lateral */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: '76%', zIndex: 201,
        background: C.white,
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.15)',
      }}>
        {/* Cabecera del drawer */}
        <div style={{
          background: `linear-gradient(135deg, ${C.green900}, ${C.green800})`,
          padding: '16px 18px 22px',
        }}>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.16)', border: 'none',
              borderRadius: '50%', width: 30, height: 30, cursor: 'pointer',
              color: C.white, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16, marginBottom: 14,
              WebkitTapHighlightColor: 'transparent',
            }}
          >✕</button>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.white, userSelect: 'none' }}>
            VIDA<span style={{ color: C.green400 }}>SALUD</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>
            Telemedicina · Perú
          </div>
        </div>

        {/* Items de navegación */}
        <div style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <DrawerItem
              key={item.to}
              {...item}
              badge={item.isCitas ? unread : 0}
              navigate={navigate}
              pathname={pathname}
              onClose={() => setOpen(false)}
            />
          ))}
        </div>

        {/* Cerrar sesión */}
        <div style={{ padding: '4px 8px 0', borderTop: `1px solid ${C.gray200}` }}>
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              width: '100%', padding: '13px 14px', border: 'none',
              background: 'transparent', borderRadius: 12, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>🚪</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#DC2626' }}>Cerrar sesión</span>
          </button>
        </div>

        {/* Pie del drawer */}
        <div style={{
          padding: '8px 18px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${C.gray200}`,
        }}>
          <div style={{ fontSize: 10, color: C.gray500, textAlign: 'center', lineHeight: 1.5 }}>
            VIDASALUD · RENIPRESS · Ley 30421
          </div>
        </div>
      </div>
    </>
  )
}

// ─── BottomNav — solo botón Consultar ────────────────────────

export default function BottomNav() {
  const navigate        = useNavigate()
  const [pressed, setPressed] = useState(false)

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      borderTop: `1px solid ${C.gray200}`,
      background: C.white, flexShrink: 0,
      padding: '6px 0',
      paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
    }}>
      <button
        data-tour="nav-consultar"
        onClick={() => navigate('/especialidades')}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Consultar"
      >
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: `linear-gradient(145deg, ${C.green900}, ${C.green700})`,
          border: `3px solid ${C.white}`,
          boxShadow: pressed
            ? '0 2px 8px rgba(5,150,105,0.3)'
            : '0 4px 16px rgba(5,150,105,0.45), 0 0 0 1px rgba(5,150,105,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: pressed ? 'scale(0.91)' : 'scale(1)',
          transition: 'transform 0.12s, box-shadow 0.12s',
        }}>
          {VIDEO_ICON}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.green700, fontFamily: "'DM Sans', sans-serif" }}>
          Consultar
        </span>
      </button>
    </div>
  )
}
