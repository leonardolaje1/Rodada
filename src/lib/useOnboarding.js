import { useState } from 'react'
import { supabase } from './supabaseClient'

// No existe tabla de "perfil deportivo" ni flag de onboarding en el schema actual
// (ver TABLAS en Configuracion.jsx). Para no requerir una migración antes del
// lanzamiento, el estado vive en user_metadata — mismo mecanismo que ya usa
// avatar_url en Configuracion.jsx. Si más adelante se agrega una tabla de
// perfiles, migrar esto ahí es directo (misma forma: { onboarding_completado, onboarding_paso }).
export function useOnboarding(usuario) {
  const [guardando, setGuardando] = useState(false)

  const completado = Boolean(usuario?.user_metadata?.onboarding_completado)
  const pasoGuardado = Number(usuario?.user_metadata?.onboarding_paso ?? 0)

  async function guardarPaso(paso) {
    // Fire-and-forget: no bloquea la animación de paso por un round-trip de red
    supabase.auth.updateUser({ data: { onboarding_paso: paso } }).catch(() => {})
  }

  async function completar() {
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({
      data: { onboarding_completado: true, onboarding_paso: null },
    })
    setGuardando(false)
    return { error }
  }

  return { completado, pasoGuardado, guardarPaso, completar, guardando }
}
