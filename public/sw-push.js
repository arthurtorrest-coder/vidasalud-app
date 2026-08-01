// ── VIDASALUD · Push Notification Handler ────────────────────
// Importado por el SW generado por Workbox
// (vite.config.js → workbox.importScripts: ['/sw-push.js'])

const TITLE  = 'VIDASALUD - Turno solicitado'
const ICON   = '/icon-192.png'
const BADGE  = '/icon-192.png'
const TARGET = '/medico/panel'

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch { data = {} }

  event.waitUntil(
    self.registration.showNotification(TITLE, {
      body:               data.body ?? 'Un paciente está esperando en Medicina General.',
      icon:               ICON,
      badge:              BADGE,
      tag:                'turno-guardia',
      renotify:           true,
      requireInteraction: true,
      vibrate:            [200, 100, 200, 100, 200],
      data:               { url: TARGET },
      actions: [
        { action: 'tomar',  title: '✅ Tomar turno' },
        { action: 'cerrar', title: 'Cerrar'          },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'cerrar') return

  const url = event.notification.data?.url ?? TARGET

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        const existing = list.find((c) => c.url.startsWith(self.location.origin))
        if (existing) return existing.focus().then((w) => w.navigate(url))
        return clients.openWindow(url)
      })
  )
})
