// Fuerza el idioma español en las salas de videollamada de Daily.co.
// Daily.co detecta el idioma por el navegador del usuario, y para algunos
// pacientes eso resulta en inglés — el parámetro ?lang=es lo fuerza siempre.
export function withSpanish(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.set('lang', 'es')
    return u.toString()
  } catch {
    // URL relativa o malformada — fallback simple por si acaso
    return url + (url.includes('?') ? '&' : '?') + 'lang=es'
  }
}
