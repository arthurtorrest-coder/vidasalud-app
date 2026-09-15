import { Link, useNavigate } from 'react-router-dom'

const C = {
  green900: '#064E3B', green800: '#065F46', green700: '#047857',
  green600: '#059669', green400: '#34D399', green200: '#A7F3D0',
  green100: '#D1FAE5', green50: '#ECFDF5',
  gray900: '#111827', gray700: '#374151', gray600: '#4B5563', gray500: '#6B7280',
  gray200: '#E5E7EB', gray100: '#F3F4F6', white: '#FFFFFF',
}

export function LegalSection({ title, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.green800, marginBottom: 10 }}>
        {title}
      </h2>
      <div style={{ fontSize: 13.5, color: C.gray700, lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  )
}

export default function LegalPage({ title, updatedLabel, children }) {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: C.gray100, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        a { color: inherit; }
        ul, ol { padding-left: 20px; margin: 8px 0; }
        li { margin-bottom: 4px; }
      `}</style>

      <header style={{
        background: `linear-gradient(160deg, ${C.green900}, ${C.green700})`,
        padding: '18px 20px 26px',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: C.white,
            borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit',
          }}
        >
          ← Volver
        </button>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.white, letterSpacing: -0.5, marginBottom: 6 }}>
          VIDA<span style={{ color: C.green400 }}>SALUD</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.white, margin: 0, letterSpacing: -0.3 }}>
          {title}
        </h1>
        {updatedLabel && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
            {updatedLabel}
          </div>
        )}
      </header>

      <main style={{
        maxWidth: 720, margin: '20px auto 0', padding: '28px 24px 40px',
        background: C.white, borderRadius: 16, border: `1.5px solid ${C.gray200}`,
      }}>
        {children}
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 20px 32px', fontSize: 12, color: C.gray500 }}>
        <Link to="/" style={{ color: C.green700, fontWeight: 700 }}>← Volver al inicio</Link>
      </footer>
    </div>
  )
}
