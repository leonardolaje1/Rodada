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

function nuevoDoc() {
  return { verdeHiviz: [196, 241, 53], grisTexto: [90, 95, 108], negro: [20, 22, 26] }
}

export default function Reportes() {
  const [desde, setDesde] = useState(fechaHace(7))
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [generando, setGenerando] = useState('')
  const [error, setError] = useState('')

  function aplicarAtajo(dias) {
    setDesde(fechaHace(dias - 1))
    setHasta(new Date().toISOString().slice(0, 10))
  }

  async function generarPDFGeneral() {
    setGenerando('general')
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
      const { verdeHiviz, grisTexto, negro } = nuevoDoc()
      const doc = new jsPDF()
      let y = 20

      doc.setFontSize(20); doc.setTextColor(...negro); doc.text('BikeIQ', 14, y)
      doc.setFontSize(10); doc.setTextColor(...grisTexto); doc.text('Reporte general de actividad', 14, y + 6)
      doc.text(`Período: ${desde} a ${hasta}`, 14, y + 14)
      doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, 14, y + 19)
      y += 32

      const ents = entrenamientos || []
      const kmTotal = ents.reduce((a, e) => a + (Number(e.km) || 0), 0)
      const horasTotal = ents.reduce((a, e) => a + (Number(e.duracion_min) || 0), 0) / 60
      const tssTotal = ents.reduce((a, e) => a + calcularTSS(e), 0)
      const desnivelTotal = ents.reduce((a, e) => a + (Number(e.desnivel) || 0), 0)

      doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Resumen de entrenamiento', 14, y); y += 8
      autoTable(doc, {
        startY: y,
        head: [['Km', 'Horas', 'TSS acumulado', 'Desnivel (m)', 'Salidas']],
        body: [[kmTotal.toFixed(0), horasTotal.toFixed(1), tssTotal.toFixed(0), desnivelTotal.toFixed(0), String(ents.length)]],
        theme: 'grid', headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
      })
      y = doc.lastAutoTable.finalY + 10

      if (ents.length > 0) {
        const nombreBici = (id) => (bicicletas || []).find((b) => b.id === id)?.nombre || '—'
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Tipo', 'Bici', 'Km', 'Min', 'TSS']],
          body: ents.map((e) => [e.fecha, e.tipo || '—', nombreBici(e.bicicleta_id), e.km ?? '—', e.duracion_min ?? '—', calcularTSS(e).toFixed(0)]),
          theme: 'striped', headStyles: { fillColor: [38, 42, 51], textColor: 255 }, styles: { fontSize: 8 }, margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      }
      if (y > 250) { doc.addPage(); y = 20 }

      const met = metricas || []
      if (met.length > 0) {
        const prom = (campo) => { const vals = met.map((m) => Number(m[campo])).filter((v) => !isNaN(v) && v != null); return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null }
        doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Recuperación', 14, y); y += 8
        autoTable(doc, {
          startY: y,
          head: [['Sueño promedio (h)', 'Body Battery promedio', 'Stress score promedio']],
          body: [[prom('sueño_horas')?.toFixed(1) ?? '—', prom('body_battery_manana')?.toFixed(0) ?? '—', prom('estres_score')?.toFixed(0) ?? '—']],
          theme: 'grid', headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      }
      if (y > 250) { doc.addPage(); y = 20 }

      const cms = comidas || []
      if (cms.length > 0) {
        const dias = new Set(cms.map((c) => c.fecha)).size || 1
        const kcalTotal = cms.reduce((a, c) => a + (Number(c.kcal) || 0), 0)
        const proteinasTotal = cms.reduce((a, c) => a + (Number(c.proteinas) || 0), 0)
        doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Nutrición', 14, y); y += 8
        autoTable(doc, {
          startY: y,
          head: [['Kcal promedio/día', 'Proteínas promedio/día (g)', 'Comidas registradas']],
          body: [[(kcalTotal / dias).toFixed(0), (proteinasTotal / dias).toFixed(0), String(cms.length)]],
          theme: 'grid', headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      }
      if (y > 250) { doc.addPage(); y = 20 }

      const gym = gimnasio || []
      if (gym.length > 0) {
        const volumenTotal = gym.reduce((a, g) => a + (Number(g.series) || 0) * (Number(g.reps) || 0) * (Number(g.peso) || 0), 0)
        const prs = gym.filter((g) => g.pr).length
        doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Gimnasio', 14, y); y += 8
        autoTable(doc, {
          startY: y,
          head: [['Volumen total (kg)', 'Sesiones', 'PRs logrados']],
          body: [[volumenTotal.toLocaleString('es-AR'), String(gym.length), String(prs)]],
          theme: 'grid', headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
        })
      }

      agregarPie(doc, grisTexto)
      doc.save(`bikeiq-resumen-${desde}-a-${hasta}.pdf`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el PDF. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  async function generarPDFEntrenamiento() {
    setGenerando('entrenamiento')
    setError('')
    try {
      const [{ data: entrenamientos }, { data: gimnasio }, { data: bicicletas }] = await Promise.all([
        supabase.from('entrenamientos').select('*').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'realizado').order('fecha', { ascending: true }),
        supabase.from('gimnasio').select('*').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'realizado').order('fecha', { ascending: true }),
        supabase.from('bicicletas').select('id, nombre')
      ])

      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const { verdeHiviz, grisTexto, negro } = nuevoDoc()
      const doc = new jsPDF()
      let y = 20

      doc.setFontSize(20); doc.setTextColor(...negro); doc.text('BikeIQ', 14, y)
      doc.setFontSize(10); doc.setTextColor(...grisTexto)
      doc.text('Reporte de entrenamiento — para uso profesional', 14, y + 6)
      doc.text(`Período: ${desde} a ${hasta}`, 14, y + 14)
      doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, 14, y + 19)
      y += 32

      const nombreBici = (id) => (bicicletas || []).find((b) => b.id === id)?.nombre || '—'
      const ents = (entrenamientos || []).map((e) => ({ fecha: e.fecha, tipo: 'ciclismo', data: e }))
      const gym = (gimnasio || []).map((g) => ({ fecha: g.fecha, tipo: 'gimnasio', data: g }))
      const combinado = [...ents, ...gym].sort((a, b) => a.fecha.localeCompare(b.fecha))

      if (combinado.length === 0) {
        doc.setFontSize(11); doc.setTextColor(...grisTexto)
        doc.text('Sin entrenamientos ni sesiones de gimnasio realizadas en este período.', 14, y)
      } else {
        doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Ciclismo', 14, y); y += 8
        if (ents.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [['Fecha', 'Tipo', 'Bici', 'Km', 'Min', 'Desnivel', 'Pot. media', 'NP', 'FC media', 'RPE', 'TSS', 'Comentarios']],
            body: ents.map(({ data: e }) => [
              e.fecha, e.tipo || '—', nombreBici(e.bicicleta_id),
              e.km ?? '—', e.duracion_min ?? '—', e.desnivel ?? '—',
              e.potencia_avg ?? '—', e.potencia_normalizada ?? '—', e.fc_avg ?? '—', e.rpe ?? '—',
              e.tss ?? calcularTSS(e).toFixed(0), e.comentarios || ''
            ]),
            theme: 'striped', headStyles: { fillColor: [38, 42, 51], textColor: 255, fontSize: 7 }, styles: { fontSize: 7 }, margin: { left: 14, right: 14 }
          })
          y = doc.lastAutoTable.finalY + 10
        } else {
          doc.setFontSize(9); doc.setTextColor(...grisTexto); doc.text('Sin sesiones de ciclismo en el período.', 14, y); y += 10
        }

        if (y > 240) { doc.addPage(); y = 20 }

        doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Gimnasio', 14, y); y += 8
        if (gym.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [['Fecha', 'Ejercicio', 'Series', 'Reps', 'Peso (kg)', 'RPE', 'PR']],
            body: gym.map(({ data: g }) => [g.fecha, g.ejercicio, g.series ?? '—', g.reps ?? '—', g.peso ?? '—', g.rpe ?? '—', g.pr ? 'Sí' : '']),
            theme: 'striped', headStyles: { fillColor: [38, 42, 51], textColor: 255, fontSize: 8 }, styles: { fontSize: 8 }, margin: { left: 14, right: 14 }
          })
        } else {
          doc.setFontSize(9); doc.setTextColor(...grisTexto); doc.text('Sin sesiones de gimnasio en el período.', 14, y)
        }
      }

      agregarPie(doc, grisTexto)
      doc.save(`bikeiq-entrenamiento-${desde}-a-${hasta}.pdf`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el PDF. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  async function generarPDFNutricion() {
    setGenerando('nutricion')
    setError('')
    try {
      const [{ data: comidas }, { data: hidratacion }, { data: suplementos }] = await Promise.all([
        supabase.from('comidas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('hidratacion').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('suplementos').select('*').eq('activo', true)
      ])

      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const { verdeHiviz, grisTexto, negro } = nuevoDoc()
      const doc = new jsPDF()
      let y = 20

      doc.setFontSize(20); doc.setTextColor(...negro); doc.text('BikeIQ', 14, y)
      doc.setFontSize(10); doc.setTextColor(...grisTexto)
      doc.text('Reporte de nutrición — para uso profesional', 14, y + 6)
      doc.text(`Período: ${desde} a ${hasta}`, 14, y + 14)
      doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, 14, y + 19)
      y += 32

      const cms = comidas || []
      doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Comidas', 14, y); y += 8
      if (cms.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Hora', 'Tipo', 'Descripción', 'Kcal', 'Prot (g)', 'Carb (g)', 'Grasas (g)']],
          body: cms.map((c) => [c.fecha, c.hora || '—', c.tipo || '—', c.descripcion || '', c.kcal ?? '—', c.proteinas ?? '—', c.carbohidratos ?? '—', c.grasas ?? '—']),
          theme: 'striped', headStyles: { fillColor: [38, 42, 51], textColor: 255, fontSize: 8 }, styles: { fontSize: 8 }, margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      } else {
        doc.setFontSize(9); doc.setTextColor(...grisTexto); doc.text('Sin comidas registradas en el período.', 14, y); y += 10
      }

      if (y > 240) { doc.addPage(); y = 20 }

      const hid = hidratacion || []
      doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Hidratación', 14, y); y += 8
      if (hid.length > 0) {
        const porBebida = {}
        for (const h of hid) { const b = h.bebida || 'Agua'; porBebida[b] = (porBebida[b] || 0) + (Number(h.ml) || 0) }
        autoTable(doc, {
          startY: y,
          head: [['Bebida', 'Total (ml)']],
          body: Object.entries(porBebida).map(([b, ml]) => [b, ml]),
          theme: 'grid', headStyles: { fillColor: verdeHiviz, textColor: negro, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      } else {
        doc.setFontSize(9); doc.setTextColor(...grisTexto); doc.text('Sin registros de hidratación en el período.', 14, y); y += 10
      }

      if (y > 240) { doc.addPage(); y = 20 }

      const sup = suplementos || []
      doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Suplementos actuales', 14, y); y += 8
      if (sup.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Nombre', 'Tipo', 'Dosis', 'Frecuencia', 'Notas']],
          body: sup.map((s) => [s.nombre, s.tipo || '—', s.dosis || '—', s.frecuencia || '—', s.notas || '']),
          theme: 'striped', headStyles: { fillColor: [38, 42, 51], textColor: 255, fontSize: 8 }, styles: { fontSize: 8 }, margin: { left: 14, right: 14 }
        })
      } else {
        doc.setFontSize(9); doc.setTextColor(...grisTexto); doc.text('Sin suplementos cargados.', 14, y)
      }

      agregarPie(doc, grisTexto)
      doc.save(`bikeiq-nutricion-${desde}-a-${hasta}.pdf`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el PDF. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  function agregarPie(doc, grisTexto) {
    const paginas = doc.internal.getNumberOfPages()
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(...grisTexto)
      doc.text('Generado con BikeIQ', 14, 290)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-ink-muted text-sm mt-1">Exportá tu actividad en PDF</p>
      </div>

      <div className="card">
        <span className="label-eyebrow">Período rápido</span>
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {ATAJOS.map((a) => (
            <button key={a.dias} onClick={() => aplicarAtajo(a.dias)} className="border border-asphalt-700 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:text-ink hover:border-hiviz">
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
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted text-xs">Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-asphalt-900 border border-asphalt-700 rounded-lg px-3 py-2 text-ink" />
          </label>
        </div>
      </div>

      <div className="card">
        <span className="label-eyebrow">Resumen general</span>
        <p className="text-ink-muted text-xs mt-2">Panorama rápido: entrenamiento, recuperación, nutrición y gimnasio en un vistazo.</p>
        <button onClick={generarPDFGeneral} disabled={!!generando} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-4">
          {generando === 'general' ? 'Generando…' : 'Descargar resumen (PDF)'}
        </button>
      </div>

      <div className="card">
        <span className="label-eyebrow">Reporte de entrenamiento</span>
        <p className="text-ink-muted text-xs mt-2">
          Detalle completo de ciclismo y gimnasio, ordenado por fecha, con todas las métricas — pensado para mostrarle a un entrenador que no use la app.
        </p>
        <button onClick={generarPDFEntrenamiento} disabled={!!generando} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-4">
          {generando === 'entrenamiento' ? 'Generando…' : 'Descargar entrenamiento (PDF)'}
        </button>
      </div>

      <div className="card">
        <span className="label-eyebrow">Reporte de nutrición</span>
        <p className="text-ink-muted text-xs mt-2">
          Comidas, hidratación y suplementos con sus notas — pensado para mostrarle a un nutricionista que no use la app.
        </p>
        <button onClick={generarPDFNutricion} disabled={!!generando} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-4">
          {generando === 'nutricion' ? 'Generando…' : 'Descargar nutrición (PDF)'}
        </button>
      </div>

      {error && <p className="text-alert-red text-xs">{error}</p>}
    </div>
  )
}
