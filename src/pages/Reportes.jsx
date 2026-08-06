import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'

const ATAJOS = [
  { dias: 1, label: 'Hoy' },
  { dias: 7, label: '7 días' },
  { dias: 14, label: '14 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' }
]

function fechaHace(dias) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

export default function Reportes() {
  const [desde, setDesde] = useState(fechaHace(7))
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')

  function aplicarAtajo(dias) {
    setDesde(fechaHace(dias - 1))
    setHasta(new Date().toISOString().slice(0, 10))
  }

  async function generarPDF() {
    setGenerando(true)
    setError('')
    try {
      const [{ data: entrenamientos }, { data: metricas }, { data: comidas }, { data: gimnasio }, { data: bicicletas }] = await Promise.all([
        supabase.from('entrenamientos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('metricas_diarias').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('comidas').select('*').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('gimnasio').select('*').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('bicicletas').select('id, nombre')
      ])

      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF()
      const verdeHiviz = [196, 241, 53]
      const grisTexto = [90, 95, 108]
      const negro = [20, 22, 26]

      let y = 20

      doc.setFontSize(20)
      doc.setTextColor(...negro)
      doc.text('bikeiq', 14, y)
      doc.setFontSize(10)
      doc.setTextColor(...grisTexto)
      doc.text('Reporte de actividad', 14, y + 6)

      doc.setFontSize(10)
      doc.text(`Período: ${desde} a ${hasta}`, 14, y + 14)
      doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, 14, y + 19)
      y += 32

      const ents = entrenamientos || []
      const kmTotal = ents.reduce((a, e) => a + (Number(e.km) || 0), 0)
      const horasTotal = ents.reduce((a, e) => a + (Number(e.duracion_min) || 0), 0) / 60
      const tssTotal = ents.reduce((a, e) => a + calcularTSS(e), 0)
      const desnivelTotal = ents.reduce((a, e) => a + (Number(e.desnivel) || 0), 0)

      doc.setFontSize(13)
      doc.setTextColor(...negro)
      doc.text('Resumen de entrenamiento', 14, y)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [['Km', 'Horas', 'TSS acumulado', 'Desnivel (m)', 'Salidas']],
        body: [[
          kmTotal.toFixed(0),
          horasTotal.toFixed(1),
          tssTotal.toFixed(0),
          desnivelTotal.toFixed(0),
          String(ents.length)
        ]],
        theme: 'grid',
        headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      })
      y = doc.lastAutoTable.finalY + 10

      if (ents.length > 0) {
        const nombreBici = (id) => (bicicletas || []).find((b) => b.id === id)?.nombre || '—'
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Tipo', 'Bici', 'Km', 'Min', 'TSS']],
          body: ents.map((e) => [
            e.fecha,
            e.tipo || '—',
            nombreBici(e.bicicleta_id),
            e.km ?? '—',
            e.duracion_min ?? '—',
            calcularTSS(e).toFixed(0)
          ]),
          theme: 'striped',
          headStyles: { fillColor: [38, 42, 51], textColor: 255 },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      }

      if (y > 250) { doc.addPage(); y = 20 }

      const met = metricas || []
      if (met.length > 0) {
        const prom = (campo) => {
          const vals = met.map((m) => Number(m[campo])).filter((v) => !isNaN(v) && v != null)
          return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null
        }
        const sueñoProm = prom('sueño_horas')
        const bbProm = prom('body_battery_manana')
        const estresProm = prom('estres_score')

        doc.setFontSize(13)
        doc.setTextColor(...negro)
        doc.text('Recuperación', 14, y)
        y += 8

        autoTable(doc, {
          startY: y,
          head: [['Sueño promedio (h)', 'Body Battery promedio', 'Stress score promedio']],
          body: [[
            sueñoProm != null ? sueñoProm.toFixed(1) : '—',
            bbProm != null ? bbProm.toFixed(0) : '—',
            estresProm != null ? estresProm.toFixed(0) : '—'
          ]],
          theme: 'grid',
          headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' },
          margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      }

      if (y > 250) { doc.addPage(); y = 20 }

      const cms = comidas || []
      if (cms.length > 0) {
        const dias = new Set(cms.map((c) => c.fecha)).size || 1
        const kcalTotal = cms.reduce((a, c) => a + (Number(c.kcal) || 0), 0)
        const proteinasTotal = cms.reduce((a, c) => a + (Number(c.proteinas) || 0), 0)

        doc.setFontSize(13)
        doc.setTextColor(...negro)
        doc.text('Nutrición', 14, y)
        y += 8

        autoTable(doc, {
          startY: y,
          head: [['Kcal promedio/día', 'Proteínas promedio/día (g)', 'Comidas registradas']],
          body: [[
            (kcalTotal / dias).toFixed(0),
            (proteinasTotal / dias).toFixed(0),
            String(cms.length)
          ]],
          theme: 'grid',
          headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' },
          margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      }

      if (y > 250) { doc.addPage(); y = 20 }

      const gym = gimnasio || []
      if (gym.length > 0) {
        const volumenTotal = gym.reduce((a, g) => a + (Number(g.series) || 0) * (Number(g.reps) || 0) * (Number(g.peso) || 0), 0)
        const prs = gym.filter((g) => g.pr).length

        doc.setFontSize(13)
        doc.setTextColor(...negro)
        doc.text('Gimnasio', 14, y)
        y += 8

        autoTable(doc, {
          startY: y,
          head: [['Volumen total (kg)', 'Sesiones', 'PRs logrados']],
          body: [[volumenTotal.toLocaleString('es-AR'), String(gym.length), String(prs)]],
          theme: 'grid',
          headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' },
          margin: { left: 14, right: 14 }
        })
      }

      const paginas = doc.internal.getNumberOfPages()
      for (let i = 1; i <= paginas; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(...grisTexto)
        doc.text('Generado con BikeIQ', 14, 290)
      }

      doc.save(`bikeiq-reporte-${desde}-a-${hasta}.pdf`)
    } catch (err) {
      console.error(err)
      setError('No se pudo generar el PDF. ' + (err.message || ''))
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-ink-muted text-sm mt-1">Exportá un resumen de tu actividad en PDF</p>
      </div>

      <div className="card">
        <span className="label-eyebrow">Período rápido</span>
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {ATAJOS.map((a) => (
            <button
              key={a.dias}
              onClick={() => aplicarAtajo(a.dias)}
              className="border border-asphalt-700 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:text-ink hover:border-hiviz"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <span className="label-eyebrow">O elegí un rango personalizado</span>
        <div className="grid grid-cols-2 gap-3 mt-2.5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink"
            />
          </label>
        </div>
      </div>

      <div className="card">
        <span className="label-eyebrow">Qué incluye</span>
        <ul className="text-ink-muted text-xs mt-2 flex flex-col gap-1.5 list-disc pl-4">
          <li>Resumen y detalle de entrenamientos (km, horas, TSS, desnivel)</li>
          <li>Promedios de recuperación (sueño, Body Battery, stress score)</li>
          <li>Promedios de nutrición (kcal y proteínas por día)</li>
          <li>Volumen total y PRs de gimnasio</li>
        </ul>

        <button
          onClick={generarPDF}
          disabled={generando}
          className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-4"
        >
          {generando ? 'Generando…' : 'Generar y descargar PDF'}
        </button>

        {error && <p className="text-alert-red text-xs mt-3">{error}</p>}
      </div>
    </div>
  )
}
