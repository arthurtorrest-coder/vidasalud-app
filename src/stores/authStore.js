import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user:        null,
  profile:     null,
  doctor:      null,
  farmacia:    null,
  coordinador: null,
  loading:     true,
  setUser:        (user)        => set({ user }),
  setProfile:     (profile)     => set({ profile }),
  setDoctor:      (doctor)      => set({ doctor }),
  setFarmacia:    (farmacia)    => set({ farmacia }),
  setCoordinador: (coordinador) => set({ coordinador }),
  setLoading:     (loading)     => set({ loading }),
}))
