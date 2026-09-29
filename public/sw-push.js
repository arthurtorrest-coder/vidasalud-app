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

  // Cada función que envía push (notificar-turno-medicos, futuras, etc.)
  // manda su propio title/icon/badge/tag/etc. en el payload — este handler
  // solo aplica defaults si algún campo viene vacío, nunca los pisa.
  const title = data.title ?? TITLE
  const url   = data.url   ?? TARGET

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body:               data.body   ?? 'Un paciente está esperando en Medicina General.',
        icon:               data.icon   ?? ICON,
        badge:              data.badge  ?? BADGE,
        tag:                data.tag    ?? 'turno-guardia',
        renotify:           data.renotify ?? true,
        requireInteraction: data.requireInteraction ?? true,
        vibrate:            data.vibrate ?? [200, 100, 200, 100, 200],
        data:               { url },
        actions: [
          { action: 'tomar',  title: '✅ Tomar turno' },
          { action: 'cerrar', title: 'Cerrar'          },
        ],
      })

      // Badge del ícono de la PWA instalada (solo Chromium/Android/desktop —
      // Firefox y Safari no implementan esta API, por eso el guard).
      if ('setAppBadge' in self.navigator) {
        try {
          await self.navigator.setAppBadge(1)
        } catch (e) {
          console.warn('[sw-push] setAppBadge falló:', e)
        }
      }
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch((e) => console.warn('[sw-push] clearAppBadge falló:', e))
  }

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
