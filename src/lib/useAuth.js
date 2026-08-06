import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [modoRecuperacion, setModoRecuperacion] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((evento, nuevaSession) => {
      setSession(nuevaSession)
      if (evento === 'PASSWORD_RECOVERY') {
        setModoRecuperacion(true)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { session, usuario: session?.user ?? null, cargando, modoRecuperacion, setModoRecuperacion }
}
