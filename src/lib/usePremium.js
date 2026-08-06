import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function usePremium() {
  const [plan, setPlan] = useState('free')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data } = await supabase.from('cuenta').select('plan').maybeSingle()
      if (activo) {
        setPlan(data?.plan || 'free')
        setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [])

  return { plan, esPremium: plan === 'premium', cargando }
}
