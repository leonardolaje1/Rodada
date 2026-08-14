import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import IconoInsignia from '../components/IconoInsignia'
import EstadoVacio from '../components/EstadoVacio'
import { Bike } from 'lucide-react'

// Marcas comunes para sugerir con autocompletado — no restringe, el campo
// sigue siendo de texto libre, esto solo ahorra tipeo.
const MARCAS_COMUNES = [
  'Trek', 'Specialized', 'Giant', 'Cannondale', 'Scott', 'Cervélo', 'Cube',
  'Merida', 'Bianchi', 'Orbea', 'Canyon', 'BMC', 'Colnago', 'Pinarello', 'Wilier'
]

const RODADOS_COMUNES = ['700c', '650b', '29"', '27.5"', '26"']

export default function Bicicletas() {
  const [bicicletas, setBicicletas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('bicicletas').select('*').order('nombre')
    setBicicletas(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function crear(nueva) {
    await supabase.from('bicicletas').insert(nueva)
    setMostrarForm(false)
    cargar()
  }

  async function eliminar(id, nombre, e) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`¿Eliminar "${nombre}"? Se borrarán también sus componentes, desgaste, mantenimiento y bike fitting registrados. Los entrenamientos históricos quedan, pero sin bici asociada.`)) return
    await supabase.from('bicicletas').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconoInsignia Icono={Bike} />
          <div>
            <h1 className="text-2xl font-bold">Bicicletas</h1>
            <p className="text-ink-muted text-sm mt-1">Tu flota</p>
          </div>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg hover:brightness-95"
        >
          + Agregar bici
        </button>
      </div>

      {mostrarForm && <FormBicicleta onGuardar={crear} onCancelar={() => setMostrarForm(false)} />}

      {cargando ? (
        <p className="text-ink-muted text-sm">Cargando…</p>
      ) : bicicletas.length === 0 ? (
        <EstadoVacio
          Icono={Bike}
          titulo="Todavía no cargaste ninguna bici"
          descripcion="Agregá tu primera bicicleta para empezar a llevar su kilometraje, mantenimiento y desgaste."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bicicletas.map((b) => (
            <Link key={b.id} to={`/bicicletas/${b.id}`} className="card hover:border-hiviz transition-colors relative">
              <button
                onClick={(e) => eliminar(b.id, b.nombre, e)}
                className="absolute top-3 right-3 text-ink-faint hover:text-alert-red text-xs border border-asphalt-700 rounded-lg px-2 py-1"
              >
                Eliminar
              </button>
              <p className="font-display font-semibold text-lg pr-16">{b.nombre}</p>
              <p className="text-ink-muted text-sm">{b.marca} {b.modelo} · {b.año}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="readout text-xl font-bold text-hiviz">
                  {(b.km_totales || 0).toLocaleString('es-AR')}
                </span>
                <span className="text-ink-muted text-xs">km totales</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FormBicicleta({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    nombre: '',
    marca: '',
    modelo: '',
    año: new Date().getFullYear(),
    rodado: RODADOS_COMUNES[0],
    peso: '',
    nro_cuadro: '',
    valor: ''
  })
  const [masDatos, setMasDatos] = useState(false)

  function campo(k) {
    return {
      value: form[k],
      onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
    }
  }

  return (
    <form
      className="card grid grid-cols-1 sm:grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar({
          ...form,
          año: form.año ? Number(form.año) : null,
          peso: form.peso ? Number(form.peso) : null,
          valor: form.valor ? Number(form.valor) : null
        })
      }}
    >
      <Campo label="Nombre" {...campo('nombre')} required placeholder="Ej: La naranja" />
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Marca</span>
        <input
          {...campo('marca')}
          list="marcas-comunes"
          placeholder="Empezá a escribir…"
          className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
        />
        <datalist id="marcas-comunes">
          {MARCAS_COMUNES.map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>
      <Campo label="Año" type="number" {...campo('año')} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted text-xs">Rodado</span>
        <select {...campo('rodado')} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink">
          {RODADOS_COMUNES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>

      <div className="sm:col-span-2">
        <button type="button" onClick={() => setMasDatos((v) => !v)} className="text-hiviz text-xs font-semibold">
          {masDatos ? 'Ocultar más datos ▲' : 'Más datos (opcional) ▼'}
        </button>
      </div>

      {masDatos && (
        <>
          <Campo label="Modelo" {...campo('modelo')} />
          <Campo label="Peso (kg)" type="number" step="0.1" {...campo('peso')} />
          <Campo label="Número de cuadro" {...campo('nro_cuadro')} />
          <Campo label="Valor" type="number" {...campo('valor')} />
        </>
      )}

      <div className="sm:col-span-2 flex gap-2 justify-end mt-2">
        <button type="button" onClick={onCancelar} className="text-ink-muted text-sm px-4 py-2">
          Cancelar
        </button>
        <button type="submit" className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2 rounded-lg">
          Guardar
        </button>
      </div>
    </form>
  )
}

function Campo({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted text-xs">{label}</span>
      <input
        {...props}
        className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink focus:border-hiviz outline-none"
      />
    </label>
  )
}
