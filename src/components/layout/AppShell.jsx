import { Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import BottomNav from './BottomNav'

const now = new Date().toLocaleTimeString('es-PE', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
})

export default function AppShell() {
  const { pathname } = useLocation()
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.6; transform:scale(1.3); }
        }
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes toastIn {
          from { opacity:0; transform:translateY(20px) scale(0.95); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        /* ── Transición de página ──────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Tarjetas escalonadas ─────────────────────── */
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Shimmer para skeletons ───────────────────── */
        @keyframes shimmer-move {
          from { background-position: -400% 0; }
          to   { background-position:  400% 0; }
        }
        .vs-shimmer {
          background: linear-gradient(90deg, #F3F4F6 25%, #EAECEF 50%, #F3F4F6 75%);
          background-size: 400% 100%;
          animation: shimmer-move 1.5s ease-in-out infinite;
        }

        /* ── Rebote del ícono de nav ───────────────────── */
        @keyframes navBounce {
          0%,100% { transform: scale(1); }
          35%     { transform: scale(1.22); }
          70%     { transform: scale(0.93); }
        }

        /* ── Efecto de presión en botones de acción ─────── */
        .vs-press {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          cursor: pointer;
          transition: transform 0.1s ease, opacity 0.1s ease;
        }
        .vs-press:active { transform: scale(0.97); opacity: 0.88; }

        /* ── Respeta prefers-reduced-motion ──────────────── */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          .vs-shimmer { animation: none; background: #F3F4F6; }
          .vs-press:active { transform: none; opacity: 1; }
        }

        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:0; height:0; }
        body { margin: 0; background: #F3F4F6; font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div style={{
        display: 'flex', justifyContent: 'center',
        minHeight: '100vh', padding: '20px 0',
      }}>
        <div style={{
          width: 390,
          background: '#FFFFFF',
          borderRadius: 32,
          overflow: 'hidden',
          border: '1.5px solid #D1D5DB',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 780,
          animation: 'slideDown 0.4s ease',
          position: 'relative',
        }}>
          {/* Status bar */}
          <div style={{
            background: '#065F46', color: '#FFFFFF',
            padding: '10px 20px 8px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{now}</span>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>VIDASALUD</span>
            <span style={{ fontSize: 12 }}>▲ ● ■</span>
          </div>

          {/* Page content — key fuerza remount en cada ruta, disparando fadeUp */}
          <div
            key={pathname}
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.28s ease' }}
          >
            <Outlet />
          </div>

          <BottomNav />
        </div>
      </div>

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            maxWidth: 350,
          },
        }}
      />
    </>
  )
}
