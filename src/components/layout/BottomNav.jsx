import { useNavigate, useLocation } from 'react-router-dom'

const C = {
  green700: '#047857',
  green600: '#059669',
  green100: '#D1FAE5',
  green50:  '#ECFDF5',
  gray500:  '#6B7280',
  gray200:  '#E5E7EB',
  white:    '#FFFFFF',
}

// SVG icons — viewBox 0 0 24 24, stroke-based
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
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
}

const ITEMS = [
  { path: '/',          icon: ICONS.home,      label: 'Inicio',    roots: ['/', '/booking', '/pago'] },
  { path: '/citas',     icon: ICONS.calendar,  label: 'Citas',     roots: ['/citas'] },
  { path: '/historial', icon: ICONS.clipboard, label: 'Historial', roots: ['/historial'] },
  { path: '/perfil',    icon: ICONS.user,      label: 'Perfil',    roots: ['/perfil'] },
]

function isActive(roots, pathname) {
  return roots.some(r => r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(r + '/'))
}

export default function BottomNav() {
  const navigate      = useNavigate()
  const { pathname }  = useLocation()

  return (
    <div style={{
      display: 'flex',
      borderTop: `1px solid ${C.gray200}`,
      background: C.white,
      flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {ITEMS.map(({ path, icon, label, roots }) => {
        const active = isActive(roots, pathname)
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '10px 0 12px',
              transition: 'opacity 0.1s',
            }}
            onMouseDown={e => e.currentTarget.style.opacity = '0.7'}
            onMouseUp={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            onTouchStart={e => e.currentTarget.style.opacity = '0.7'}
            onTouchEnd={e => e.currentTarget.style.opacity = '1'}
            aria-label={label}
          >
            <div style={{
              width: 44, height: 30,
              borderRadius: 15,
              background: active ? C.green50 : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}>
              <div style={{ color: active ? C.green600 : C.gray500, display: 'flex', transition: 'color 0.2s' }}>
                {icon}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? C.green700 : C.gray500,
              fontFamily: "'DM Sans', sans-serif",
              transition: 'color 0.2s, font-weight 0.1s',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
