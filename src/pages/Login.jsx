import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
    setCargando(true)

    if (modo === 'ingresar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(traducirError(error.message))
    } else if (modo === 'registrarse') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre, apellido } }
      })
      if (error) {
        setError(traducirError(error.message))
      } else {
        setMensaje('Cuenta creada. Revisá tu email para confirmar y después iniciá sesión.')
      }
    } else if (modo === 'recuperar') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })
      if (error) {
        setError(traducirError(error.message))
      } else {
        setMensaje('Si ese email tiene una cuenta, te llegó un link para restablecer la contraseña.')
      }
    }
    setCargando(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display font-bold text-2xl text-hiviz">BikeIQ</span>
          <p className="text-ink-muted text-sm mt-2">Tu gestión integral de ciclismo</p>
        </div>

        {modo !== 'recuperar' && (
          <div className="flex bg-asphalt-800 rounded-lg p-1 mb-5">
            <button
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                modo === 'ingresar' ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'
              }`}
              onClick={() => { setModo('ingresar'); setError(''); setMensaje('') }}
            >
              Ingresar
            </button>
            <button
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                modo === 'registrarse' ? 'bg-hiviz text-asphalt-950' : 'text-ink-muted'
              }`}
              onClick={() => { setModo('registrarse'); setError(''); setMensaje('') }}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {modo === 'recuperar' && (
          <div className="mb-5">
            <button
              onClick={() => { setModo('ingresar'); setError(''); setMensaje('') }}
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
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
                  placeholder="Tu nombre"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted text-xs">Apellido</span>
                <input
                  type="text"
                  required
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
                  placeholder="Tu apellido"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
              placeholder="vos@email.com"
            />
          </label>

          {modo !== 'recuperar' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted text-xs">Contraseña</span>
              <div className="relative">
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 pr-10 text-ink focus:border-hiviz outline-none w-full"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  className="absolute right-0 top-0 bottom-0 px-3 text-ink-muted text-xs"
                  tabIndex={-1}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </label>
          )}

          {modo === 'ingresar' && (
            <button
              type="button"
              onClick={() => { setModo('recuperar'); setError(''); setMensaje('') }}
              className="text-ink-muted text-xs text-left"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {error && <p className="text-alert-red text-xs">{error}</p>}
          {mensaje && <p className="text-hiviz text-xs">{mensaje}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-2"
          >
            {cargando
              ? 'Un momento…'
              : modo === 'ingresar' ? 'Ingresar'
              : modo === 'registrarse' ? 'Crear cuenta'
              : 'Enviar link de recuperación'}
          </button>
        </form>
      </div>
    </div>
  )
}

function traducirError(msg) {
  const mapa = {
    'Invalid login credentials': 'Email o contraseña incorrectos.',
    'User already registered': 'Ya existe una cuenta con ese email.',
    'Email not confirmed': 'Confirmá tu email antes de ingresar.'
  }
  return mapa[msg] || msg
}
