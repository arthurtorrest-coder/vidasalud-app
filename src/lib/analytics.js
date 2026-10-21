import { supabase } from './supabase'

export async function trackEvent(eventType, metadata = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_events').insert({
      user_id: user?.id ?? null,
      event_type: eventType,
      metadata
    })
  } catch (e) {
    // silencioso
  }
}
