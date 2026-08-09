import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MIN_PASSWORD_LENGTH = 10

export default function Login() {
  const [modo, setModo] = useState('ingresar')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')
    setMensaje('')

    const emailNormalizado = email.trim().toLowerCase()

    if (!emailNormalizado) {
      setError('Ingresá tu email.')
      return
    }

    if (modo !== 'recuperar') {
      const validacionPassword = validarPassword(password)

      if (!validacionPassword.valida) {
        setError(validacionPassword.mensaje)
        return
      }
    }

    setCargando(true)

    try {
      if (modo === 'ingresar') {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailNormalizado,
          password
        })

        if (error) {
          setError(traducirError(error.message))
        }
      } else if (modo === 'registrarse') {
        const { error } = await supabase.auth.signUp({
          email: emailNormalizado,
          password,
          options: {
            data: {
              nombre: nombre.trim(),
              apellido: apellido.trim()
            }
          }
        })

        if (error) {
          setError(traducirError(error.message))
        } else {
          setMensaje(
            'Cuenta creada. Revisá tu email para confirmar la cuenta y después iniciá sesión.'
          )
        }
      } else if (modo === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          emailNormalizado,
          {
            redirectTo: window.location.origin
          }
        )

        if (error) {
          setError(traducirError(error.message))
        } else {
          setMensaje(
            'Si ese email tiene una cuenta, te llegó un link para restablecer la contraseña.'
          )
        }
      }
    } catch {
      setError(
        'No pudimos completar la operación. Revisá tu conexión e intentá nuevamente.'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display font-bold text-2xl text-hiviz">
            HELU
          </span>
          <p className="text-ink-muted text-sm mt-2">
            Tu gestión integral de ciclismo
          </p>
        </div>

        {modo !== 'recuperar' && (
          <div className="flex bg-asphalt-800 rounded-lg p-1 mb-5">
            <button
              type="button"
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                modo === 'ingresar'
                  ? 'bg-hiviz text-asphalt-950'
                  : 'text-ink-muted'
              }`}
              onClick={() => {
                setModo('ingresar')
                setError('')
                setMensaje('')
              }}
            >
              Ingresar
            </button>

            <button
              type="button"
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                modo === 'registrarse'
                  ? 'bg-hiviz text-asphalt-950'
                  : 'text-ink-muted'
              }`}
              onClick={() => {
                setModo('registrarse')
                setError('')
                setMensaje('')
              }}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {modo === 'recuperar' && (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setModo('ingresar')
                setError('')
                setMensaje('')
              }}
              className="text-ink-muted text-sm"
            >
              ← Volver a ingresar
            </button>
          </div>
        )}

        <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
          {modo === 'registrarse' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted text-xs">Nombre</span>

                <input
                  type="text"
                  required
                  maxLength={60}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
                  placeholder="Tu nombre"
                  autoComplete="given-name"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted text-xs">Apellido</span>

                <input
                  type="text"
                  required
                  maxLength={60}
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
                  placeholder="Tu apellido"
                  autoComplete="family-name"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Email</span>

            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
              placeholder="vos@email.com"
              autoComplete={
                modo === 'registrarse'
                  ? 'email'
                  : modo === 'recuperar'
                    ? 'email'
                    : 'username'
              }
            />
          </label>

          {modo !== 'recuperar' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted text-xs">Contraseña</span>

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
                  autoComplete={
                    modo === 'registrarse'
                      ? 'new-password'
                      : 'current-password'
                  }
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

              {modo === 'registrarse' && (
                <span className="text-ink-muted text-[11px] mt-1">
                  Usá al menos 10 caracteres, incluyendo mayúscula, minúscula y número.
                </span>
              )}
            </label>
          )}

          {modo === 'ingresar' && (
            <button
              type="button"
              onClick={() => {
                setModo('recuperar')
                setError('')
                setMensaje('')
                setPassword('')
              }}
              className="text-ink-muted text-xs text-left"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {error && (
            <p
              className="text-alert-red text-xs"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}

          {mensaje && (
            <p
              className="text-hiviz text-xs"
              role="status"
              aria-live="polite"
            >
              {mensaje}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-2"
          >
            {cargando
              ? 'Un momento…'
              : modo === 'ingresar'
                ? 'Ingresar'
                : modo === 'registrarse'
                  ? 'Crear cuenta'
                  : 'Enviar link de recuperación'}
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
    'Invalid login credentials': 'Email o contraseña incorrectos.',
    'Email not confirmed': 'Confirmá tu email antes de ingresar.',
    'Email rate limit exceeded':
      'Demasiados intentos. Esperá unos minutos y probá nuevamente.',
    'For security purposes, you can only request this after':
      'Esperá unos minutos antes de solicitar otro enlace.',
    'Password should be at least 6 characters':
      'La contraseña no cumple los requisitos mínimos.',
    'Password should be at least 8 characters':
      'La contraseña no cumple los requisitos mínimos.'
  }

  for (const [clave, traduccion] of Object.entries(mapa)) {
    if (msg.includes(clave)) {
      return traduccion
    }
  }

  return 'No pudimos completar la operación. Revisá los datos e intentá nuevamente.'
}
