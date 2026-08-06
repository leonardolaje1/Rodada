import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePremium } from '../lib/usePremium'

const TABLAS = [
  'bicicletas',
  'componentes',
  'desgaste_componentes',
  'entrenamientos',
  'metricas_diarias',
  'mantenimientos',
  'objetivos',
  'competencias',
  'perfil_nutricional',
  'comidas',
  'hidratacion',
  'suplementos',
  'gimnasio'
]

export default function Configuracion() {
  const { plan, esPremium, cargando: cargandoPlan } = usePremium()
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [ultimaExportacion, setUltimaExportacion] = useState(null)

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
        app: 'rodada',
        version_schema: 1,
        datos: Object.fromEntries(TABLAS.map((tabla, i) => [tabla, resultados[i].data || []]))
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const fecha = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `BikeIQ-backup-${fecha}.json`
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
          Descarga un archivo JSON con absolutamente todo lo que cargaste en Rodada: bicicletas, componentes,
          desgaste, entrenamientos, recuperación, nutrición, mantenimiento, objetivos, competencias y gimnasio.
          Es una copia de seguridad — guardala donde quieras (Drive, email a vos mismo, etc.).
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
        <span className="label-eyebrow">Sobre este backup</span>
        <ul className="text-ink-muted text-xs mt-2 flex flex-col gap-1.5 list-disc pl-4">
          <li>Es de solo lectura: exportar no borra ni modifica nada en Supabase.</li>
          <li>No incluye fotos ni archivos subidos (todavía no hay esa función en la app).</li>
          <li>El archivo queda en tu dispositivo — Rodada no lo guarda en ningún lado.</li>
          <li>Para restaurarlo hoy hace falta cargar los datos a mano o pedir ayuda con un script de importación.</li>
        </ul>
      </div>
    </div>
  )
}
