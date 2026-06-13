import { supabase } from './supabase'

// Clave pública VAPID — generar con: npx web-push generate-vapid-keys
// Agregar VITE_VAPID_PUBLIC_KEY al archivo .env
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/**
 * Pide permiso al navegador para mostrar notificaciones.
 * @returns {'granted'|'denied'|'default'|'unsupported'}
 */
export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

/**
 * Suscribe al usuario al servicio Web Push usando el SW activo.
 * @returns {PushSubscription|null}
 */
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
    return null
  }
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return existing
    return reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  } catch {
    return null
  }
}

/**
 * Persiste la suscripción push en profiles.push_token del usuario actual.
 * @param {PushSubscription} subscription
 */
export async function saveTokenToSupabase(subscription) {
  if (!subscription) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('profiles')
    .update({ push_token: JSON.stringify(subscription) })
    .eq('id', user.id)
}
