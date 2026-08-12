import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ActualizarPassword({ onListo }) {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setCargando(false)

    if (err) {
      setError(traducirError(err.message))
      return
    }

    onListo()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display font-bold text-2xl text-hiviz">HELU</span>
          <p className="text-ink-muted text-sm mt-2">Actualizá tu contraseña</p>
        </div>

        <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Nueva contraseña</span>
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

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Repetí la contraseña</span>
            <input
              type={mostrarPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
            />
          </label>

          {error && <p className="text-alert-red text-xs">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-2"
          >
            {cargando ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

function traducirError(msg) {
  const mapa = {
    'New password should be different from the old password.': 'La nueva contraseña tiene que ser distinta de la anterior.',
    'Password should be at least 6 characters.': 'La contraseña tiene que tener al menos 6 caracteres.'
  }
  return mapa[msg] || msg
}
