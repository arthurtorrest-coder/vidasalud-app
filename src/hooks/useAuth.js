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
    console.log('[useAuth] fetchProfile START — userId:', userId, '| email:', email)

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    console.log('[useAuth] profile obtenido —', {
      role:  profileData?.role ?? null,
      id:    profileData?.id   ?? null,
      error: error?.message    ?? null,
    })
    if (error) console.error('[useAuth] fetchProfile error:', error.message)
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
      console.log('[useAuth] doctor —', { id: d?.id ?? null, aprobado: d?.aprobado ?? null })
      setDoctor(d ?? null)
    }

    if (profileData?.role === 'farmacia') {
      console.log('[useAuth] role=farmacia detectado — buscando en farmacias por email:', email)
      if (!email) {
        console.warn('[useAuth] email undefined — no se puede buscar la farmacia')
      } else {
        const { data: f, error: fErr } = await supabase
          .from('farmacias')
          .select('id, nombre, codigo_digemid, ciudad, distrito, codigo_referido, aprobado')
          .eq('email', email)
          .maybeSingle()
        console.log('[useAuth] farmacia obtenida —', {
          encontrada: !!f,
          aprobado:   f?.aprobado ?? null,
          error:      fErr?.message ?? null,
        })
        setFarmacia(f ?? null)
      }
    }

    console.log('[useAuth] fetchProfile DONE — loading → false')
    setLoading(false)
  }
}
