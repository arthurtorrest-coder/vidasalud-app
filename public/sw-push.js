// VIDASALUD — Push notification handler
// Importado por el service worker generado por VitePWA

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'VIDASALUD', {
      body:               data.body ?? 'Tienes una notificación',
      icon:               '/icons/icon.svg',
      badge:              '/icons/icon.svg',
      tag:                data.tag  ?? 'vidasalud',
      renotify:           true,
      requireInteraction: false,
      data:               { url: data.url ?? '/citas' },
      actions: [
        { action: 'open',    title: 'Ver cita' },
        { action: 'dismiss', title: 'Cerrar'   },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url ?? '/citas'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        const existing = list.find((c) => c.url.startsWith(self.location.origin))
        return existing
          ? existing.focus().then((w) => w.navigate(url))
          : clients.openWindow(url)
      })
  )
})
