import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user:    null,
  profile: null,
  doctor:  null,
  loading: true,
  setUser:    (user)    => set({ user }),
  setProfile: (profile) => set({ profile }),
  setDoctor:  (doctor)  => set({ doctor }),
  setLoading: (loading) => set({ loading }),
}))
