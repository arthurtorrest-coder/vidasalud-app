import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export function useAuth() {
  const { setUser, setProfile, setDoctor, setLoading } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setDoctor(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) console.error('[useAuth] fetchProfile:', error.message)
    setProfile(profileData ?? null)

    if (profileData?.role === 'doctor') {
      // schema.sql: doctors.id = auth.uid()
      let { data: d } = await supabase
        .from('doctors')
        .select('id, aprobado, nombres, apellidos, especialidad, cmp')
        .eq('id', userId)
        .maybeSingle()
      // doctors_seed.sql: doctors.profile_id = auth.uid()
      if (!d) {
        const res = await supabase
          .from('doctors')
          .select('id, aprobado, nombres, apellidos, especialidad, cmp')
          .eq('profile_id', userId)
          .maybeSingle()
        d = res.data
      }
      setDoctor(d ?? null)
    }

    setLoading(false)
  }
}
