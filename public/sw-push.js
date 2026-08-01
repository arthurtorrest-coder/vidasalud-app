// ── VIDASALUD · Push Notification Handler ────────────────────
// Importado por el SW generado por Workbox
// (vite.config.js → workbox.importScripts: ['/sw-push.js'])

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch { data = {} }

  // Configuración según tipo de notificación
  const esTurno = data.tag === 'turno-guardia'

  const options = {
    body:               data.body ?? 'Tienes una notificación en VIDASALUD',
    icon:               '/icons/icon.svg',
    badge:              '/icons/icon.svg',
    tag:                data.tag ?? 'vidasalud',
    renotify:           true,
    requireInteraction: esTurno,   // turno requiere interacción, no se cierra sola
    vibrate:            esTurno ? [200, 100, 200, 100, 200] : [200],
    data:               { url: data.url ?? '/medico/panel' },
    actions: esTurno
      ? [
          { action: 'tomar',  title: '✅ Tomar turno' },
          { action: 'cerrar', title: 'Cerrar'          },
        ]
      : [
          { action: 'open',    title: 'Ver' },
          { action: 'dismiss', title: 'Cerrar' },
        ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? '🔔 VIDASALUD', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'cerrar' || event.action === 'dismiss') return

  const url = event.notification.data?.url ?? '/medico/panel'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        // Reusar pestaña existente de la app si la hay
        const existing = list.find((c) => c.url.startsWith(self.location.origin))
        if (existing) return existing.focus().then((w) => w.navigate(url))
        return clients.openWindow(url)
      })
  )
})
