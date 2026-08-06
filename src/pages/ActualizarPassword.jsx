import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ActualizarPassword({ onListo }) {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setCargando(false)

    if (error) {
      setError(error.message)
    } else {
      setListo(true)
    }
  }

  if (listo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <span className="font-display font-bold text-2xl text-hiviz"BikeIQ</span>
          <p className="text-ink mt-6">Contraseña actualizada.</p>
          <button
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
          <span className="font-display font-bold text-2xl text-hiviz">BikeIQ</span>
          <p className="text-ink-muted text-sm mt-2">Elegí tu nueva contraseña</p>
        </div>

        <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Nueva contraseña</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
              placeholder="Mínimo 6 caracteres"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Repetila</span>
            <input
              type="password"
              required
              minLength={6}
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              className="bg-asphalt-800 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
            />
          </label>

          {error && <p className="text-alert-red text-xs">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-2"
          >
            {cargando ? 'Guardando…' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
