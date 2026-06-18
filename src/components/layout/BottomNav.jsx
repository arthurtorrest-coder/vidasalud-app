import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

const C = {
  green900: '#064E3B',
  green800: '#065F46',
  green700: '#047857',
  green600: '#059669',
  green50:  '#ECFDF5',
  gray500:  '#6B7280',
  gray200:  '#E5E7EB',
  white:    '#FFFFFF',
}

const ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  clipboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  pharmacy: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8"  y1="12" x2="16" y2="12" />
    </svg>
  ),
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
}

const VIDEO_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14" />
    <rect x="1" y="6" width="14" height="12" rx="2" ry="2" />
  </svg>
)

const LEFT_ITEMS = [
  { path: '/inicio',    icon: ICONS.home,     label: 'Inicio',    roots: ['/inicio', '/booking', '/pago'] },
  { path: '/citas',     icon: ICONS.calendar, label: 'Citas',     roots: ['/citas'] },
]
const RIGHT_ITEMS = [
  { path: '/farmacias', icon: ICONS.pharmacy, label: 'Boticas', roots: ['/farmacias', '/registro-farmacia'] },
  { path: '/perfil',    icon: ICONS.user,     label: 'Perfil',  roots: ['/perfil'] },
]

function isActive(roots, pathname) {
  return roots.some(r => pathname === r || pathname.startsWith(r + '/'))
}

function NavItem({ path, icon, label, roots, navigate, pathname, badge = 0, dataTour }) {
  const active     = isActive(roots, pathname)
  const prevActive = useRef(false)
  const [bounce, setBounce] = useState(false)

  useEffect(() => {
    if (active && !prevActive.current) {
      setBounce(true)
      prevActive.current = true
      const t = setTimeout(() => setBounce(false), 420)
      return () => clearTimeout(t)
    }
    if (!active) prevActive.current = false
  }, [active])

  return (
    <button
      onClick={() => navigate(path)}
      data-tour={dataTour}
      style={{
        flex: 1, background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4, padding: '10px 0 12px',
        transition: 'opacity 0.1s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={e => { e.currentTarget.style.opacity = '0.6' }}
      onPointerUp={e => { e.currentTarget.style.opacity = '1' }}
      onPointerLeave={e => { e.currentTarget.style.opacity = '1' }}
      aria-label={label}
    >
      <div style={{
        position: 'relative',
        width: 44, height: 30, borderRadius: 15,
        background: active ? C.green50 : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.2s',
      }}>
        <div style={{
          color: active ? C.green600 : C.gray500, display: 'flex',
          transition: 'color 0.2s',
          animation: bounce ? 'navBounce 0.42s ease' : 'none',
        }}>
          {icon}
        </div>
        {badge > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 16, height: 16, borderRadius: 8,
            background: '#EF4444', color: '#FFFFFF',
            fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            border: '1.5px solid #FFFFFF',
            boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
            letterSpacing: 0,
            lineHeight: 1,
          }}>
            {badge > 9 ? '9+' : badge}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 12, fontWeight: active ? 700 : 500,
        color: active ? C.green700 : C.gray500,
        fontFamily: "'DM Sans', sans-serif",
        transition: 'color 0.2s',
      }}>
        {label}
      </span>
    </button>
  )
}

export default function BottomNav() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const { user }     = useAuthStore()
  const [unreadMsgs, setUnreadMsgs] = useState(0)

  // Carga inicial de mensajes no leídos
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .neq('sender_id', user.id)
      .eq('leido', false)
      .then(({ count }) => setUnreadMsgs(count ?? 0))
  }, [user?.id])

  // Realtime: +1 al llegar mensaje nuevo, -1 al marcarse como leído
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel(`bottomnav-unread-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        payload => {
          if (payload.new.sender_id !== user.id) {
            setUnreadMsgs(n => n + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mensajes' },
        payload => {
          if (payload.new.leido && !payload.old?.leido && payload.new.sender_id !== user.id) {
            setUnreadMsgs(n => Math.max(0, n - 1))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      borderTop: `1px solid ${C.gray200}`,
      background: C.white,
      flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {LEFT_ITEMS.map(item => (
        <NavItem
          key={item.path}
          {...item}
          navigate={navigate}
          pathname={pathname}
          badge={item.path === '/citas' ? unreadMsgs : 0}
          dataTour={item.path === '/citas' ? 'nav-citas' : undefined}
        />
      ))}

      {/* CTA central — sube visualmente sobre los íconos laterales */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 4, paddingBottom: 12,
      }}>
        <button
          data-tour="nav-consultar"
          onClick={() => navigate('/especialidades')}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: `linear-gradient(145deg, ${C.green900}, ${C.green700})`,
            border: `3px solid ${C.white}`,
            boxShadow: '0 4px 16px rgba(5,150,105,0.45), 0 0 0 1px rgba(5,150,105,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
            transition: 'transform 0.12s, box-shadow 0.12s',
          }}
          onPointerDown={e => {
            e.currentTarget.style.transform = 'scale(0.91)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(5,150,105,0.3)'
          }}
          onPointerUp={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(5,150,105,0.45), 0 0 0 1px rgba(5,150,105,0.15)'
          }}
          onPointerLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(5,150,105,0.45), 0 0 0 1px rgba(5,150,105,0.15)'
          }}
          aria-label="Consultar"
        >
          {VIDEO_ICON}
        </button>
        <span style={{
          fontSize: 12, fontWeight: 700, color: C.green700,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Consultar
        </span>
      </div>

      {RIGHT_ITEMS.map(item => (
        <NavItem key={item.path} {...item} navigate={navigate} pathname={pathname} />
      ))}
    </div>
  )
}
