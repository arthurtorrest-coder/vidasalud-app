const C = { green800: '#065F46', green50: '#ECFDF5', gray500: '#6B7280', gray900: '#111827' }

export default function Historial() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <span style={{ fontSize: 48 }}>📋</span>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: C.gray900, margin: 0 }}>Historial clínico</h2>
      <p style={{ fontSize: 13, color: C.gray500, textAlign: 'center', margin: 0 }}>
        Aquí encontrarás tus recetas electrónicas, diagnósticos e informes médicos.
      </p>
      <div style={{
        marginTop: 8, background: C.green50, borderRadius: 12,
        padding: '12px 20px', fontSize: 12, color: C.green800, fontWeight: 600,
      }}>
        Próximamente — conectando con Supabase
      </div>
    </div>
  )
}
