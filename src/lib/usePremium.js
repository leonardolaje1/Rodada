import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function usePremium() {
  const [plan, setPlan] = useState('free')
  const [esAdmin, setEsAdmin] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const [{ data: cuenta }, { data: admin }] = await Promise.all([
        supabase.from('cuenta').select('plan').maybeSingle(),
        supabase.from('admins').select('user_id').maybeSingle()
      ])
      if (activo) {
        setPlan(cuenta?.plan || 'free')
        setEsAdmin(!!admin)
        setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [])

  return { plan, esPremium: esAdmin || plan === 'premium', cargando }
}
