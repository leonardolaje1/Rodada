import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MIN_PASSWORD_LENGTH = 10

export default function ActualizarPassword({ onListo }) {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')

    const validacionPassword = validarPassword(password)

    if (!validacionPassword.valida) {
      setError(validacionPassword.mensaje)
      return
    }

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password
      })

      if (error) {
        setError(traducirError(error.message))
        return
      }

      setListo(true)
    } catch {
      setError(
        'No pudimos actualizar la contraseña. Intentá nuevamente.'
      )
    } finally {
      setCargando(false)
    }
  }

  if (listo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <span className="font-display font-bold text-2xl text-hiviz">
            bikeiq
          </span>

          <p className="text-ink mt-6">
            Contraseña actualizada correctamente.
          </p>

          <button
            type="button"
            onClick={onListo}
            className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg mt-4"
          >
            Ir a la app
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display font-bold text-2xl text-hiviz">
            bikeiq
          </span>

          <p className="text-ink-muted text-sm mt-2">
            Elegí tu nueva contraseña
          </p>
        </div>

        <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">
              Nueva contraseña
            </span>

            <div className="relative">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 pr-10 text-ink focus:border-hiviz outline-none w-full"
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute right-0 top-0 bottom-0 px-3 text-ink-muted text-xs"
                tabIndex={-1}
                aria-label={
                  mostrarPassword
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >
                {mostrarPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>

            <span className="text-ink-muted text-[11px] mt-1">
              Al menos 10 caracteres, con mayúscula, minúscula y número.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">
              Repetí la contraseña
            </span>

            <div className="relative">
              <input
                type={mostrarConfirmacion ? 'text' : 'password'}
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={128}
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 pr-10 text-ink focus:border-hiviz outline-none w-full"
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() => setMostrarConfirmacion((v) => !v)}
                className="absolute right-0 top-0 bottom-0 px-3 text-ink-muted text-xs"
                tabIndex={-1}
                aria-label={
                  mostrarConfirmacion
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >
                {mostrarConfirmacion ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </label>

          {error && (
            <p
              className="text-alert-red text-xs"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-2"
          >
            {cargando
              ? 'Guardando…'
              : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

function validarPassword(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valida: false,
      mensaje: `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    }
  }

  if (password.length > 128) {
    return {
      valida: false,
      mensaje: 'La contraseña no puede superar los 128 caracteres.'
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      valida: false,
      mensaje: 'La contraseña debe incluir al menos una letra minúscula.'
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valida: false,
      mensaje: 'La contraseña debe incluir al menos una letra mayúscula.'
    }
  }

  if (!/[0-9]/.test(password)) {
    return {
      valida: false,
      mensaje: 'La contraseña debe incluir al menos un número.'
    }
  }

  return {
    valida: true,
    mensaje: ''
  }
}

function traducirError(msg) {
  const mapa = {
    'Password should be at least 6 characters':
      'La contraseña no cumple los requisitos mínimos.',
    'Password should be at least 8 characters':
      'La contraseña no cumple los requisitos mínimos.',
    'Password is too weak':
      'La contraseña no cumple los requisitos mínimos.'
  }

  for (const [clave, traduccion] of Object.entries(mapa)) {
    if (msg.includes(clave)) {
      return traduccion
    }
  }

  return 'No pudimos actualizar la contraseña. Intentá nuevamente.'
}
