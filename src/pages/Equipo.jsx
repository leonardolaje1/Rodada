import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import IconoInsignia from '../components/IconoInsignia'
import EstadoVacio from '../components/EstadoVacio'
import Avatar from '../components/Avatar'
import { Users } from 'lucide-react'

const ROLES = [
  { id: 'entrenador', label: 'Entrenador' },
  { id: 'nutricionista', label: 'Nutricionista' }
]

const DATOS_POR_ROL = {
  entrenador: [
    'Tus entrenamientos y su historial completo (potencia, FC, TSS, comentarios)',
    'Tus rutinas y mesociclos de gimnasio, con resultados',
    'Tus objetivos y tu adherencia al plan'
  ],
  nutricionista: [
    'Tu perfil (peso, altura, edad) y tus necesidades calóricas',
    'Tus comidas, hidratación y suplementos registrados',
    'Tu peso histórico y tu antropometría',
    'Los documentos de nutrición que subas'
  ]
}

function diasDesde(fecha) {
  if (!fecha) return null
  const ms = new Date().setHours(0, 0, 0, 0) - new Date(fecha + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}

export default function Equipo() {
  const [vinculos, setVinculos] = useState([])
  const [emails, setEmails] = useState({})
  const [resumenAtletas, setResumenAtletas] = useState({})
  const [miId, setMiId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [compartirCopiado, setCompartirCopiado] = useState(false)
  const [error, setError] = useState('')
  const [vinculoConfirmando, setVinculoConfirmando] = useState(null)
  const [miEmail, setMiEmail] = useState('')
  const [invitacionesPendientes, setInvitacionesPendientes] = useState([])

  async function cargar() {
    const { data: userData } = await supabase.auth.getUser()
    setMiId(userData.user.id)
    setMiEmail(userData.user.email || '')

    const { data } = await supabase
      .from('vinculos')
      .select('*')
      .order('created_at', { ascending: false })
    setVinculos(data || [])

    const { data: invitPend } = await supabase
      .from('invitaciones_pendientes')
      .select('*')
      .eq('invitado_por', userData.user.id)
      .order('created_at', { ascending: false })
    setInvitacionesPendientes(invitPend || [])

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

    const misAtletasIds = (data || [])
      .filter((v) => v.estado === 'aceptado' && v.profesional_id === userData.user.id)
      .map((v) => v.atleta_id)

    if (misAtletasIds.length > 0) {
      const desde7 = new Date()
      desde7.setDate(desde7.getDate() - 7)
      const fecha7 = desde7.toISOString().slice(0, 10)

      const nuevoResumen = {}
      await Promise.all(
        misAtletasIds.map(async (atletaId) => {
          const { data: ents } = await supabase
            .from('entrenamientos')
            .select('fecha, tss')
            .eq('user_id', atletaId)
            .order('fecha', { ascending: false })
            .limit(30)
          const ultimaFecha = ents && ents.length > 0 ? ents[0].fecha : null
          const tssSemana = (ents || [])
            .filter((e) => e.fecha >= fecha7)
            .reduce((a, e) => a + (Number(e.tss) || 0), 0)
          nuevoResumen[atletaId] = { ultimaFecha, tssSemana }
        })
      )
      setResumenAtletas(nuevoResumen)
    }
  }

  useEffect(() => { cargar() }, [])

  async function compartirApp() {
    const datos = {
      title: 'HELU',
      text: 'Te invito a usar HELU, la app que uso para llevar mi entrenamiento de ciclismo, nutrición y recuperación.',
      url: 'https://rodada-rose.vercel.app'
    }
    if (navigator.share) {
      try { await navigator.share(datos) } catch { /* usuario canceló, no hacemos nada */ }
    } else {
      await navigator.clipboard.writeText(`${datos.text} ${datos.url}`)
      setCompartirCopiado(true)
      setTimeout(() => setCompartirCopiado(false), 3000)
    }
  }

  async function invitar({ email, rol, direccion }) {
    setError('')
    if (email.trim().toLowerCase() === miEmail.trim().toLowerCase()) {
      setError('No podés invitarte a vos mismo.')
      return
    }

    const { error: err } = await supabase.rpc('enviar_invitacion', { p_email: email, p_rol: rol, p_direccion: direccion })
    if (err) {
      setError('No se pudo enviar la invitación. ' + err.message)
      return
    }
    setFormOpen(false)
    cargar()
  }

  async function cancelarInvitacionPendiente(id) {
    await supabase.from('invitaciones_pendientes').delete().eq('id', id)
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
  const enviadasCombinadas = [
    ...pendientesEnviadas.map((v) => ({
      id: v.id, origen: 'vinculo', rol: v.rol,
      email: emails[v.profesional_id === miId ? v.atleta_id : v.profesional_id] || '…'
    })),
    ...invitacionesPendientes.map((i) => ({ id: i.id, origen: 'invitacion', rol: i.rol, email: i.email }))
  ]
  const misAtletas = vinculos.filter((v) => v.estado === 'aceptado' && v.profesional_id === miId)
  const misProfesionales = vinculos.filter((v) => v.estado === 'aceptado' && v.atleta_id === miId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconoInsignia Icono={Users} />
          <div>
            <h1 className="text-2xl font-bold">Equipo</h1>
            <p className="text-ink-muted text-sm mt-1">Tus atletas y profesionales</p>
          </div>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
        >
          + Invitar
        </button>
      </div>

      {formOpen && <FormInvitar onGuardar={invitar} onCancelar={() => setFormOpen(false)} error={error} />}

      {misProfesionales.length > 0 && (
        <div className="card">
          <span className="label-eyebrow">Tu equipo</span>
          <div className="flex flex-col gap-2.5 mt-2.5">
            {ROLES.map((rol) => {
              const vinculo = misProfesionales.find((v) => v.rol === rol.id)
              return (
                <div key={rol.id} className="flex items-center gap-2.5">
                  <Avatar url={null} nombre={vinculo ? emails[vinculo.profesional_id] : '?'} size={32} />
                  <div>
                    {vinculo ? (
                      <>
                        <p className="text-sm font-medium">{emails[vinculo.profesional_id] || '…'}</p>
                        <p className="text-ink-faint text-xs">Tu {rol.label.toLowerCase()}</p>
                      </>
                    ) : (
                      <p className="text-ink-faint text-sm">Todavía no tenés {rol.label.toLowerCase()}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card">
        <span className="label-eyebrow">¿Todavía no tiene HELU?</span>
        <p className="text-ink-muted text-sm mt-1.5">
          Compartí la app por WhatsApp, mail, mensaje de texto o cualquier medio, y una vez que se registre lo invitás normalmente con el botón de arriba.
        </p>
        <button onClick={compartirApp} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg mt-3">
          Compartir HELU
        </button>
        {compartirCopiado && <p className="text-hiviz text-xs mt-2">Link copiado al portapapeles.</p>}
      </div>

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
                  </p>
                  <p className="text-ink-muted text-xs mt-1">
                    {soyElProfesional ? 'Vos serías el profesional de esta persona.' : 'Esta persona sería tu profesional.'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => (soyElProfesional ? responder(v.id, 'aceptado') : setVinculoConfirmando(v))}
                      className="bg-hiviz text-asphalt-950 font-semibold text-xs px-3 py-1.5 rounded-lg"
                    >
                      Aceptar
                    </button>
                    <button onClick={() => responder(v.id, 'rechazado')} className="text-alert-red text-xs border border-asphalt-700 rounded-lg px-3 py-1.5">Rechazar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {enviadasCombinadas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Invitaciones enviadas</h2>
          <div className="flex flex-col gap-2">
            {enviadasCombinadas.map((item) => (
              <div key={`${item.origen}-${item.id}`} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm">{item.email} · <span className="text-ink-muted">{item.rol}</span></p>
                  <p className="text-ink-faint text-xs">Esperando respuesta</p>
                </div>
                <button
                  onClick={() => (item.origen === 'vinculo' ? cortarVinculo(item.id) : cancelarInvitacionPendiente(item.id))}
                  className="text-ink-muted text-xs border border-asphalt-700 rounded-lg px-3 py-1.5"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Mis atletas</h2>
          {misAtletas.length > 0 && (
            <div className="flex gap-3 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-hiviz inline-block" /> Entrenó hoy</span>
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-alert-amber inline-block" /> 3+ días sin entrenar</span>
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-alert-red inline-block" /> 7+ días sin entrenar</span>
            </div>
          )}
        </div>
        {misAtletas.length === 0 ? (
          <EstadoVacio
            Icono={Users}
            titulo="Sin atletas a cargo"
            descripcion="Invitá a alguien con el botón '+ Invitar' de arriba."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {misAtletas.map((v) => {
              const resumen = resumenAtletas[v.atleta_id]
              const dias = resumen ? diasDesde(resumen.ultimaFecha) : null
              const color = dias == null ? 'rgb(var(--color-state-neutral))' : dias === 0 ? 'rgb(var(--color-state-success))' : dias >= 7 ? 'rgb(var(--color-state-critical))' : dias >= 3 ? 'rgb(var(--color-state-warning))' : 'rgb(var(--color-state-success))'
              const textoEstado = dias == null
                ? 'Sin entrenamientos registrados'
                : dias === 0
                  ? 'Entrenó hoy'
                  : `Hace ${dias} día${dias === 1 ? '' : 's'}`

              return (
                <Link key={v.id} to={`/equipo/${v.atleta_id}?rol=${v.rol}`} className="card flex items-center justify-between hover:border-hiviz">
                  <div className="flex items-center gap-2.5">
                    <i className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
                    <div>
                      <p className="text-sm font-medium">{emails[v.atleta_id] || '…'}</p>
                      <p className="text-ink-muted text-xs">Sos su {v.rol} · {textoEstado}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {resumen && (
                      <p className="readout text-xs text-hiviz font-semibold">{resumen.tssSemana.toFixed(0)} TSS <span className="text-ink-faint font-normal">/ 7d</span></p>
                    )}
                    <span className="text-hiviz text-xs">Ver →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Mis profesionales</h2>
        {misProfesionales.length === 0 ? (
          <EstadoVacio
            Icono={Users}
            titulo="Sin profesionales vinculados"
            descripcion="Invitá a tu entrenador o nutricionista con el botón '+ Invitar' de arriba."
          />
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

      {vinculoConfirmando && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setVinculoConfirmando(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <span className="label-eyebrow">Antes de aceptar</span>
            <p className="text-sm font-semibold mt-1.5">
              {emails[vinculoConfirmando.profesional_id === miId ? vinculoConfirmando.atleta_id : vinculoConfirmando.profesional_id] || 'Esta persona'} va a poder ver:
            </p>
            <ul className="text-ink-muted text-xs mt-2.5 flex flex-col gap-1.5 list-disc pl-4">
              {(DATOS_POR_ROL[vinculoConfirmando.rol] || []).map((d, i) => <li key={i}>{d}</li>)}
            </ul>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setVinculoConfirmando(null)} className="text-ink-muted text-sm px-4 py-2">Cancelar</button>
              <button
                onClick={() => { responder(vinculoConfirmando.id, 'aceptado'); setVinculoConfirmando(null) }}
                className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg"
              >
                Aceptar y dar acceso
              </button>
            </div>
          </div>
        </div>
      )}
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
