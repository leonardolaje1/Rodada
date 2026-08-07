import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePremium } from '../lib/usePremium'

const TABLAS = [
  'bicicletas',
  'componentes',
  'desgaste_componentes',
  'bike_fitting',
  'entrenamientos',
  'planes_entrenamiento',
  'metricas_diarias',
  'mantenimientos',
  'objetivos',
  'competencias',
  'perfil_nutricional',
  'comidas',
  'hidratacion',
  'suplementos',
  'gimnasio',
  'planes_gimnasio'
]

// Orden de restauración: las tablas que otras referencian van primero,
// para que las relaciones (ej. componentes.bicicleta_id) encuentren su fila ya creada.
const ORDEN_RESTAURAR = [
  'bicicletas',
  'planes_entrenamiento',
  'planes_gimnasio',
  'componentes',
  'desgaste_componentes',
  'bike_fitting',
  'entrenamientos',
  'gimnasio',
  'mantenimientos',
  'metricas_diarias',
  'comidas',
  'hidratacion',
  'suplementos',
  'perfil_nutricional',
  'objetivos',
  'competencias'
]

export default function Configuracion() {
  const { plan, esPremium, cargando: cargandoPlan } = usePremium()
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [ultimaExportacion, setUltimaExportacion] = useState(null)

  const [archivoBackup, setArchivoBackup] = useState(null)
  const [resumenBackup, setResumenBackup] = useState(null)
  const [errorRestaurar, setErrorRestaurar] = useState('')
  const [restaurando, setRestaurando] = useState(false)
  const [resultadoRestaurar, setResultadoRestaurar] = useState(null)

  const [confirmacionBorrado, setConfirmacionBorrado] = useState('')
  const [borrandoCuenta, setBorrandoCuenta] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState('')

  async function exportarBackup() {
    setExportando(true)
    setError('')
    try {
      const resultados = await Promise.all(
        TABLAS.map((tabla) => supabase.from(tabla).select('*'))
      )

      const errorTabla = resultados.find((r) => r.error)
      if (errorTabla) throw errorTabla.error

      const backup = {
        generado_el: new Date().toISOString(),
        app: 'bikeiq',
        version_schema: 2,
        datos: Object.fromEntries(TABLAS.map((tabla, i) => [tabla, resultados[i].data || []]))
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const fecha = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `bikeiq-backup-${fecha}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setUltimaExportacion(new Date())
    } catch (err) {
      console.error(err)
      setError('No se pudo generar el backup. ' + (err.message || ''))
    } finally {
      setExportando(false)
    }
  }

  async function manejarArchivoBackup(e) {
    const file = e.target.files[0]
    e.target.value = ''
    setErrorRestaurar('')
    setResultadoRestaurar(null)
    setResumenBackup(null)
    setArchivoBackup(null)
    if (!file) return

    try {
      const texto = await file.text()
      const json = JSON.parse(texto)

      if (!json.datos || typeof json.datos !== 'object') {
        setErrorRestaurar('Este archivo no tiene el formato de un backup de BikeIQ.')
        return
      }

      const resumen = ORDEN_RESTAURAR
        .map((tabla) => ({ tabla, cantidad: (json.datos[tabla] || []).length }))
        .filter((r) => r.cantidad > 0)

      if (resumen.length === 0) {
        setErrorRestaurar('El backup no tiene ningún dato para restaurar.')
        return
      }

      setArchivoBackup(json)
      setResumenBackup(resumen)
    } catch (err) {
      setErrorRestaurar('No se pudo leer el archivo. ¿Es un backup de BikeIQ en formato JSON?')
    }
  }

  async function restaurarBackup() {
    if (!archivoBackup) return
    if (!confirm('Esto va a agregar a tu cuenta todo lo que tenga el backup. Los datos que ya tenés no se van a tocar ni duplicar. ¿Continuar?')) return

    setRestaurando(true)
    setErrorRestaurar('')
    const resultadoPorTabla = []

    try {
      const { data: userData } = await supabase.auth.getUser()
      const miId = userData.user.id

      for (const tabla of ORDEN_RESTAURAR) {
        const filas = archivoBackup.datos[tabla] || []
        if (filas.length === 0) continue

        const filasConMiId = filas.map((fila) => ({ ...fila, user_id: miId }))
        const columnaConflicto = tabla === 'perfil_nutricional' ? 'user_id' : 'id'

        const { error: err, count } = await supabase
          .from(tabla)
          .upsert(filasConMiId, { onConflict: columnaConflicto, ignoreDuplicates: true, count: 'exact' })

        if (err) {
          resultadoPorTabla.push({ tabla, ok: false, mensaje: err.message })
        } else {
          resultadoPorTabla.push({ tabla, ok: true, insertadas: count ?? filas.length })
        }
      }

      setResultadoRestaurar(resultadoPorTabla)
      setArchivoBackup(null)
      setResumenBackup(null)
    } catch (err) {
      setErrorRestaurar('Algo falló durante la restauración. ' + (err.message || ''))
    } finally {
      setRestaurando(false)
    }
  }

  async function eliminarCuenta() {
    if (confirmacionBorrado !== 'ELIMINAR') return
    setBorrandoCuenta(true)
    setErrorBorrado('')
    try {
      const { error } = await supabase.rpc('eliminar_mi_cuenta')
      if (error) throw error
      await supabase.auth.signOut()
      window.location.reload()
    } catch (err) {
      setErrorBorrado('No se pudo eliminar la cuenta. ' + (err.message || ''))
      setBorrandoCuenta(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-ink-muted text-sm mt-1">Cuenta y datos</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <span className="label-eyebrow">Tu plan</span>
            <p className="text-lg font-semibold mt-1">
              {cargandoPlan ? '—' : esPremium ? 'Premium' : 'Free'}
            </p>
          </div>
          {!cargandoPlan && (
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                esPremium ? 'bg-hiviz text-asphalt-950' : 'border border-asphalt-700 text-ink-muted'
              }`}
            >
              {esPremium ? 'PREMIUM' : 'FREE'}
            </span>
          )}
        </div>
      </div>

      <div className="card opacity-70">
        <div className="flex items-start justify-between">
          <div>
            <span className="label-eyebrow">Asistente de IA — recuperación y carga</span>
            <p className="text-ink-muted text-sm mt-2">
              Analiza tus tendencias de CTL/ATL/TSB, sueño, Body Battery y stress, y te sugiere si conviene
              mantener el plan de entrenamiento o priorizar el descanso.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-asphalt-700 text-ink-muted whitespace-nowrap ml-3">
            🔒 PREMIUM
          </span>
        </div>
        <button
          disabled
          className="border border-asphalt-700 text-ink-faint text-sm px-4 py-2 rounded-lg mt-4 cursor-not-allowed"
        >
          Disponible próximamente
        </button>
      </div>

      <div className="card">
        <span className="label-eyebrow">Backup completo</span>
        <p className="text-ink-muted text-sm mt-2">
          Descarga un archivo JSON con absolutamente todo lo que cargaste en BikeIQ. Es una copia de
          seguridad — guardala donde quieras (Drive, email a vos mismo, etc.).
        </p>

        <button
          onClick={exportarBackup}
          disabled={exportando}
          className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-4"
        >
          {exportando ? 'Generando…' : 'Descargar backup (JSON)'}
        </button>

        {ultimaExportacion && (
          <p className="text-hiviz text-xs mt-3">
            Backup descargado a las {ultimaExportacion.toLocaleTimeString('es-AR')}.
          </p>
        )}
        {error && <p className="text-alert-red text-xs mt-3">{error}</p>}
      </div>

      <div className="card">
        <span className="label-eyebrow">Restaurar desde backup</span>
        <p className="text-ink-muted text-sm mt-2">
          Subí un archivo de backup para recuperar datos. Es seguro: <b className="text-ink">solo agrega lo que falta</b>,
          nunca sobreescribe ni duplica lo que ya tenés cargado.
        </p>

        <label className="inline-block mt-4">
          <span className="border border-asphalt-700 text-ink-muted font-semibold text-sm px-4 py-2.5 rounded-lg inline-block cursor-pointer hover:text-ink hover:border-hiviz">
            Elegir archivo de backup
          </span>
          <input type="file" accept=".json" className="hidden" onChange={manejarArchivoBackup} />
        </label>

        {errorRestaurar && <p className="text-alert-red text-xs mt-3">{errorRestaurar}</p>}

        {resumenBackup && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-ink-muted text-xs">Este backup contiene:</p>
            <ul className="text-xs text-ink flex flex-col gap-1">
              {resumenBackup.map((r) => (
                <li key={r.tabla} className="flex justify-between">
                  <span className="capitalize">{r.tabla.replaceAll('_', ' ')}</span>
                  <span className="readout text-hiviz font-semibold">{r.cantidad}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={restaurarBackup}
              disabled={restaurando}
              className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-2 self-start"
            >
              {restaurando ? 'Restaurando…' : 'Restaurar este backup'}
            </button>
          </div>
        )}

        {resultadoRestaurar && (
          <div className="mt-4 flex flex-col gap-1.5 pt-4 border-t border-asphalt-700">
            <p className="text-hiviz text-xs font-semibold">Restauración completa.</p>
            {resultadoRestaurar.map((r) => (
              <p key={r.tabla} className="text-xs text-ink-muted">
                <span className="capitalize">{r.tabla.replaceAll('_', ' ')}</span>:{' '}
                {r.ok ? <span className="text-ink">procesado</span> : <span className="text-alert-red">error — {r.mensaje}</span>}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <span className="label-eyebrow">Sobre backup y restauración</span>
        <ul className="text-ink-muted text-xs mt-2 flex flex-col gap-1.5 list-disc pl-4">
          <li>Exportar es de solo lectura: no borra ni modifica nada en Supabase.</li>
          <li>Restaurar es seguro por diseño: usa tu backup solo para completar filas que falten (por su ID original), nunca pisa datos existentes ni te los duplica si lo hacés dos veces.</li>
          <li>No incluye fotos ni archivos subidos (todavía no hay esa función en la app).</li>
          <li>El archivo de backup solo sirve para restaurar en la misma cuenta desde la que se exportó, o en otra cuenta tuya — los datos siempre quedan asociados a la cuenta que hace la restauración.</li>
        </ul>
      </div>
      <div className="card border-alert-red">
        <span className="label-eyebrow text-alert-red">Zona de peligro</span>
        <p className="text-ink-muted text-sm mt-2">
          Eliminar tu cuenta borra permanentemente todos tus datos de BikeIQ: bicicletas, entrenamientos,
          nutrición, recuperación, vínculos de Equipo y todo lo demás. Esta acción no se puede deshacer.
        </p>
        <label className="flex flex-col gap-1 text-sm mt-4">
          <span className="text-ink-muted text-xs">Escribí ELIMINAR para confirmar</span>
          <input
            value={confirmacionBorrado}
            onChange={(e) => setConfirmacionBorrado(e.target.value)}
            className="bg-asphalt-900 border border-alert-red rounded-lg px-3 py-2 text-ink"
          />
        </label>
        <button
          onClick={eliminarCuenta}
          disabled={confirmacionBorrado !== 'ELIMINAR' || borrandoCuenta}
          className="bg-alert-red text-white font-semibold text-sm px-4 py-2.5 rounded-lg disabled:opacity-40 mt-3"
        >
          {borrandoCuenta ? 'Eliminando…' : 'Eliminar mi cuenta para siempre'}
        </button>
        {errorBorrado && <p className="text-alert-red text-xs mt-3">{errorBorrado}</p>}
      </div>

    </div>
  )
}
