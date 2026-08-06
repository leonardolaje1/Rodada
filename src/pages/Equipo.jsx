import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const ROLES = [
  { id: 'entrenador', label: 'Entrenador' },
  { id: 'nutricionista', label: 'Nutricionista' }
]

export default function Equipo() {
  const [vinculos, setVinculos] = useState([])
  const [emails, setEmails] = useState({})
  const [miId, setMiId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    const { data: userData } = await supabase.auth.getUser()
    setMiId(userData.user.id)

    const { data } = await supabase
      .from('vinculos')
      .select('*')
      .order('created_at', { ascending: false })
    setVinculos(data || [])

    const idsAMostrar = new Set()
    for (const v of data || []) {
      idsAMostrar.add(v.profesional_id === userData.user.id ? v.atleta_id : v.profesional_id)
    }
    const nuevosEmails = {}
    await Promise.all(
      [...idsAMostrar].map(async (id) => {
        const { data: email } = await supabase.rpc('email_de_vinculado', { p_user_id: id })
        nuevosEmails[id] = email
      })
    )
    setEmails(nuevosEmails)
  }

  useEffect(() => { cargar() }, [])

  async function invitar({ email, rol, direccion }) {
    setError('')
    const { data: otroId } = await supabase.rpc('buscar_usuario_por_email', { p_email: email })
    if (!otroId) {
      setError('No encontramos ninguna cuenta con ese email en BikeIQ.')
      return
    }
    if (otroId === miId) {
      setError('No podés invitarte a vos mismo.')
      return
    }

    const payload = direccion === 'yo_profesional'
      ? { profesional_id: miId, atleta_id: otroId, rol, iniciado_por: miId }
      : { profesional_id: otroId, atleta_id: miId, rol, iniciado_por: miId }

    const { error: err } = await supabase.from('vinculos').insert(payload)
    if (err) {
      setError(err.code === '23505' ? 'Ya existe una invitación o vínculo con esa persona para ese rol.' : err.message)
      return
    }
    setFormOpen(false)
    cargar()
  }

  async function responder(id, estado) {
    await supabase.from('vinculos').update({ estado }).eq('id', id)
    cargar()
  }

  async function cortarVinculo(id) {
    if (!confirm('¿Cortar este vínculo?')) return
    await supabase.from('vinculos').delete().eq('id', id)
    cargar()
  }

  if (!miId) return <p className="text-ink-muted text-sm">Cargando…</p>

  const pendientesParaMi = vinculos.filter((v) => v.estado === 'pendiente' && v.iniciado_por !== miId)
  const pendientesEnviadas = vinculos.filter((v) => v.estado === 'pendiente' && v.iniciado_por === miId)
  const misAtletas = vinculos.filter((v) => v.estado === 'aceptado' && v.profesional_id === miId)
  const misProfesionales = vinculos.filter((v) => v.estado === 'aceptado' && v.atleta_id === miId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-ink-muted text-sm mt-1">Tus atletas y profesionales</p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
        >
          + Invitar
        </button>
      </div>

      {formOpen && <FormInvitar onGuardar={invitar} onCancelar={() => setFormOpen(false)} error={error} />}

      {pendientesParaMi.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Invitaciones para vos</h2>
          <div className="flex flex-col gap-2">
            {pendientesParaMi.map((v) => {
              const otroId = v.profesional_id === miId ? v.atleta_id : v.profesional_id
              const soyElProfesional = v.profesional_id === miId
              return (
                <div key={v.id} className="card">
                  <p className="text-sm">
                    <span className="font-medium">{emails[otroId] || '…'}</span>
                    {' '}te invitó a ser {soyElProfesional ? 'su' : 'tu'} <b className="text-hiviz">{v.rol}</b>
                    {soyElProfesional ? '' : ''}
                  </p>
                  <p className="text-ink-muted text-xs mt-1">
                    {soyElProfesional ? 'Vos serías el profesional de esta persona.' : 'Esta persona sería tu profesional.'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => responder(v.id, 'aceptado')} className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg">Aceptar</button>
                    <button onClick={() => responder(v.id, 'rechazado')} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-3 py-1.5">Rechazar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pendientesEnviadas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Invitaciones enviadas</h2>
          <div className="flex flex-col gap-2">
            {pendientesEnviadas.map((v) => {
              const otroId = v.profesional_id === miId ? v.atleta_id : v.profesional_id
              return (
                <div key={v.id} className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm">{emails[otroId] || '…'} · <span className="text-ink-muted">{v.rol}</span></p>
                    <p className="text-ink-faint text-xs">Esperando respuesta</p>
                  </div>
                  <button onClick={() => cortarVinculo(v.id)} className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-3 py-1.5">Cancelar</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-2">Mis atletas</h2>
        {misAtletas.length === 0 ? (
          <p className="text-ink-muted text-sm">Todavía no tenés atletas a cargo.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {misAtletas.map((v) => (
              <Link key={v.id} to={`/equipo/${v.atleta_id}?rol=${v.rol}`} className="card flex items-center justify-between hover:border-hiviz">
                <div>
                  <p className="text-sm font-medium">{emails[v.atleta_id] || '…'}</p>
                  <p className="text-ink-muted text-xs">Sos su {v.rol}</p>
                </div>
                <span className="text-hiviz text-xs">Ver →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Mis profesionales</h2>
        {misProfesionales.length === 0 ? (
          <p className="text-ink-muted text-sm">Todavía no tenés profesionales vinculados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {misProfesionales.map((v) => (
              <div key={v.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{emails[v.profesional_id] || '…'}</p>
                  <p className="text-ink-muted text-xs">Tu {v.rol}</p>
                </div>
                <button onClick={() => cortarVinculo(v.id)} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-3 py-1.5">
                  Cortar vínculo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FormInvitar({ onGuardar, onCancelar, error }) {
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('entrenador')
  const [direccion, setDireccion] = useState('yo_profesional')

  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => { e.preventDefault(); onGuardar({ email, rol, direccion }) }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Email de la persona</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@email.com"
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
        />
      </label>

      <div>
        <span className="text-ink-muted text-xs">Rol</span>
        <div className="flex gap-2 mt-1.5">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRol(r.id)}
              className={`flex-1 py-1.5 rounded-lg text-sm border ${rol === r.id ? 'bg-hiviz text-asphalt-950 border-hiviz font-semibold' : 'border-asphalt-700 text-ink-muted'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-ink-muted text-xs">Tipo de vínculo</span>
        <div className="flex flex-col gap-1.5 mt-1.5">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={direccion === 'yo_profesional'} onChange={() => setDireccion('yo_profesional')} />
            Yo voy a ser su {rol}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={direccion === 'yo_atleta'} onChange={() => setDireccion('yo_atleta')} />
            Quiero que sea mi {rol}
          </label>
        </div>
      </div>

      {error && <p className="text-alert-red text-xs">{error}</p>}

      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">Enviar invitación</button>
      </div>
    </form>
  )
}
