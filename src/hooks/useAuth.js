import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export function useAuth() {
  const { setUser, setProfile, setDoctor, setFarmacia, setLoading } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        fetchProfile(session.user)
      } else {
        setProfile(null)
        setDoctor(null)
        setFarmacia(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(authUser) {
    const userId = authUser.id
    const email  = authUser.email

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) console.error('[useAuth] fetchProfile:', error.message)
    setProfile(profileData ?? null)

    if (profileData?.role === 'doctor') {
      let { data: d } = await supabase
        .from('doctors')
        .select('id, aprobado, nombres, apellidos, especialidad, cmp')
        .eq('id', userId)
        .maybeSingle()
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

    if (profileData?.role === 'farmacia' && email) {
      const { data: f } = await supabase
        .from('farmacias')
        .select('id, nombre, codigo_digemid, ciudad, distrito, codigo_referido, aprobado')
        .eq('email', email)
        .maybeSingle()
      setFarmacia(f ?? null)
    }

    setLoading(false)
  }
}
