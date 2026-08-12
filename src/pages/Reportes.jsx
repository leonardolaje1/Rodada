import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { calcularTSS } from '../lib/tss'
import IconoInsignia from '../components/IconoInsignia'
import { FileText } from 'lucide-react'

const ATAJOS = [
  { dias: 1, label: 'Hoy' },
  { dias: 7, label: '7 días' },
  { dias: 14, label: '14 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' }
]

const LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAIAAAAErfB6AAABWGlDQ1BJQ0MgUHJvZmlsZQAAeJx9kLFLw1AQxr9WpaB1EB0cHDKJQ5SSCro4tBVEcQhVweqUvqapkMZHkiIFN/+Bgv+BCs5uFoc6OjgIopPo5uSk4KLleS+JpCJ6j+N+fO+74zggOW5wbvcDqDu+W1zKK5ulLSX1jAS9IAzm8Zyur0r+rj/j/T703k7LWb///43Biukxqp+UGcZdH0ioxPqezyXvE4+5tBRxS7IV8onkcsjngWe9WCC+JlZYzagQvxCr5R7d6uG63WDRDnL7tOlsrMk5lBNYxA48cNgw0IQCHdk//LOBv4BdcjfhUp+FGnzqyZEiJ5jEy3DAMAOVWEOGUpN3ju53F91PjbWDJ2ChI4S4iLWVDnA2Rydrx9rUPDAyBFy1ueEagdRHmaxWgddTYLgEjN5Qz7ZXzWrh9uk8MPAoxNskkDoEui0hPo6E6B5T8wNw6XwBA6diE8HYWhMAABLMSURBVHja7Z19bFTVm8ef59w7r52ZtkC3C6I/KEp5CbBEC7jKm6vhR1Z5WSQoJmZx/UG0tGIif7j6IyYrakKMkTWRVcgv8RX5y8AfhcSVV0VEg8YKCz9oeEmhWkqhM/fO3Ln3nmf/ODO3w8y0tNPbMh3PN2PV2+m5d87nPM8553nOmYOTau8BAEVRrl+/Xl5e8dDCf1mwcOHEifeEykIAAIgIAIiQI+KciFSPx+fzqapq23Y8HtdiMU3TorFYtKsrFovduHEjGo3quq5pmq7r8Xhc/Ewmk0SUWRoiYs5dnPeIXxFR5hXM91R5lVVO1sXMZ+hjaeJv03WDTml5S8h8bCFVVf1+fzBUJhQMBoPBYDgcLi8vDwaDoVAoHA6LK8Fg0Ov1ElHSSCYNg3OOjPV0FyAiBM55R0fHiRMn9u3b98MPP+DkSRMBIBqNPvrYY40NL0yeMgX6IyI6d+7c/5069fezZ9uutF2/fl2P64ZhJJNJ27Zt2yYiBATspoI9N5riFAKQuyUSEQDnXIAXP1laHo/H6/X6/f5IJDJq1KixY8fefffdtbW1VVVV/bqJaZr79+/HyZMmapr26l//+pe/rHOaW09tmXPO0i3ol19+OXDgwI8//tja2moYBmNMVVVFUcRTZqLs/lwAQARSPfgMyhDnXFiIZVmMsXA4PGHChPvvv3/evHmjR48GANu2RbPoyWOJX+GY0dUv/+cr69c32LaNiHn/wLk3Y4xzfvjw4d27dzc3NxuG4ff7vV6v86CZTVIqbzX2pSNw3iOMhIhs2zYMw7KsESNGzJkzZ8mSJbW1tY7J9XQvzjn+xzP/vn3H32zbZj04d9FYFEUBgO+///7TTz9tbm5mjAUCAcFb4hwaCUCmacbj8UAgMH/+/NWrV48dO7aX7h8A8MyZM/fccw8nYr265Y6Oju3bt3/11VcAEAwGxXVZ6bfFqzPGbNvWNK2iomLVqlUrV64UlpbXlLEX+3Pc8rfffvvee+9duXIlEolItEXizBVFsSxL07R77733hRdeuPPOOx1HexNgznmPw24ARPzoo48+/vhjVVV9Pp/o2KWKyppjsVhFRcWLL774wAMP5Ha1+S1YNB/TNN9+++29e/dGIhFElIZbnFIUJZlMmqb5/PPPL1++PMuO8wAWVwzD2Lx58+HDhysqKqThFv/4i3OuadratWufeOKJTMYsL13O+RtvvHH48OHKykpJt/gl+tlwOPzBBx/s2rVLURSHGsvrnN99992DBw9WVlZaliXntcNlUEZEoVBo27Zt+/btcxizrPkuY2zXrl27d+926EKfg7RSt52xmMRu3br11KlTiqJwzlmmmSuK8tNPP+3YsSMSicgh1TBlLKZPW7ZsiUajiMgyPbOmaVu3bhUmK93y8O2Pg8FgS0vL9u3bswF/8sknLS0tgUBAmu+wlmVZkUikqanp6NGjKELSjLGWlpaGhoaeItdSwy4GYprmmDFjunHu3LkzkUjkxrqkhmln7PF42traUkHqM2fOHDlyJBgMyllviQ24Uha8Z88eXdel+ZYeY8YY6+zs/O6774LBoBxblZ4YABw/fry9vd3j8cipUWkCPnbsmBw8lyzga9eunTx50ufzSfMtTcDnzp3r7OxUVVUCLk3A58+fFwszZV2UJuCLFy/KZFEpA25tbWWMSf9csoB///13CbiUAXd1dckAVikDlrZb4oBBrsgpecBSErCUBCwlAUtJwFISsJQELCUBS8BSErCUBCwlAUtJwFLDA7BMTZY4YJmXlC5aSgKWkoClJGAJWEoClpKApSRgKQlYSgKWkoAlYCkJWEoClioBwL2colX4o9zu7wnp5eC3IikQ0kccDjrgaDRqWZaLjIkoGo327av2cAAvccxknuMmETGZTGqa5taHQkTDMHRdd7GWEFGc4Nr3MlkBJBhjixYtqqysNE3TlacXX426ePHiSCSS99tQEQABFUBEYMgZcAacYX9e4v0ACqJKTqk30R0/fvy8efNc+VCC7uTJk+fMmZNMJl2pJVHm9OnT6+rqDMPoY5msv/cgIlVV169fP2bMGLfqgnPu9/vr6+urqqpyHQMCmBwTFtdsSlio20y3UbeZbjHdZnGr+6Vnvez0y2K6jbqFug1xi2vECZRMI2aMxePxmTNnPv30067wYIzpur5w4cIVK1a4ZcSMMU3THnnkkWXLlsXj8T46arWwm8ViMddddCwWyzVfBDAJan3RSUrCRAYcAEicW9t97DOlrJHSLQacc1DFPyicMiIRIkRJ+S4RtlHNZIyIlmUJGK6sHUPERCLhos93jDgej/e9TLWw2yiKMhiDrJwyCREtm88N6CtGxJKmypAIKP0mAmAAlPkfBEywppt7WvEnnNDLqMXyHL8csEDFHlyUW4z7OyDq46itX2WqBRvc0AxsCVBBPJf0HYhC0uJIHEQ7cKyXCJAAGBABEgIDAAIuDNc5ZxwJAIgTqmj/Rh6e74O7flTuYCwy7G+ZhQMeDMa5ZXJCD8NDeuSQlronIiGisGNKWSYBpc0vZfapS44ZI6XcNCEhoMJUzDeQdheJ61VUQLWrhd3G9broeUrEAYAxBGAZw96UfRJB70+R7p0zfTUBMRv4H2QFr1o8j9LbScbdZpp1EW7ZoPP9fojoFsM6cBmqvD1NdsjKlIBvqrjMKVZpqBDAJbkDRYwqBmnwOCxdtOsVMWQDt1t+nFJqwazguhiMWrjt1iMmCH90C8a0SowuFEHK8pY1399EbYGhSqc6BlIjznxaPHQv/Z+LTSkVs+yeIZf4yLzAQAfnXCQmAWCA56WJKL/H48n1CoQixAgWgS1CUdkBjF5iGzltg0SYgwOin5CQclttkY+wCni8QgCLmO2ECRMQURy4xDnvyWn3NHhJZXuIRLqwrKwsN4EhEHCCf2TJkZiwnQIQABAyLR7Fj3Q8MhUBwXQmqZszQ4gTu2QHaNhacL8wFwJYeNRnnnkmkUgIFy2MWFS/AynrOcRKAWeAJh5UNAtxunwoFMpNQSoAcQ4Ph7v+rTKmW0zBDANN30DcFSiFTPw705AJSGSgOEAAWIutvtamJMCfGY52Gpzsg1N3evPNN5ubm53jwnsffzpcszJx4oo4sfqdd97JPR5EJAI7beVyUk3YjDCfcxbLcLKyByIVnH5/Or9PKrKrtoLE8hTjNmO30o4DUeEuOplMigOle+mDHeq9zDIFYMMwhJ/PvheAT4H/1coP6wEOyFJR6W6alE7qM2TCGxNR2kkTYtpvp95GjJiFSoIpCDyrrQxlEmUg/nnQXbQzTVIUpe+Z/+4FGDmAxVHGueUIv4oESaYkqQyBE0NIpwQdPKKrJqTuJXUASEAMoDtp6HTSJDrwogqz9MslDDrgzOooILaX+/6eCsHuIRQh2ikwmOGXe5lFYea/KCM9DN3ddQ/m69aSHdu23Z1YC0swTbPvT1h4LHqI2zsV+CJKZRS7Lf6W42e3PlpXV1coFHLxWCrGWEVFRSwWG/RQ5WAE5YvBQ9q27crnEqbW2tpaWVnp1tHqnHOv11tdXd3a2jqI66Kdm7l+HvztzZ46y+3cWunt8/nOnz9fVlY2evRoV9YXW5Y1cuTIESNGnD592uv19vGjFeiiRddS/Jm1vldr5mcZ+OcSS/lbW1uvXbt233339X0Zcy/OOZFITJ061TTNs2fP+ny+PhoYG0jdlV5iWGBwa526aZoHDhxYtGiRx+MZYKMRQ7ZFixYdO3YsGo2qal9Hx2ywLWMYqacYXMG9WDAYbGpqqqqqmj9/fjQaLXi0JfZJTJ06dcaMGV9++aUTXBp0C3a9fnspE1193TLi5ko37PV629vbv/jii/r6ep/PN5C9IMlksrGxcf/+/WfPng0EAoM7TRq8dS09FUuA1k0vsADs1AszXln/iznvAU5gA+KQZBps245EIjt37uzo6Ni4ceONGzcK6NdUVb169eq6deuqq6u3bdsWCoX6NbxVi8F2ezFfQgCiAJkqccSbQxQZK54zdql0r4BOB0q719tyRAbcJk8cPHQz5EFKF4oB6aZNm3bs2NHQ0LB169bKykpFUfJuosz1zETU3t6+evXqVatWNTQ0aJrW30mXWiT+mYjyfmYGkLDh0UjXn8OJpAXERKARncRRmjWKJe2pTUmpIKeIWGYgB1TRvmR5/7t9ZBK9CJxynDNjbCA7r0TyNLMn9vl8V69e3bBhw9tvvz1ixIgtW7aYphkOh0UaLbdJiWcgIk3TiKixsXH58uUvv/zyqVOnetpe6z5gtwICWfWS1TZRJP4QwsirVSNBqpNtSNdFal8KEOTZ40DZvRAR+JB0hVTgRr4l8aZpdnZ2WpZV8Czf4/EEg8HMyhHZ7paWlueee+7VV1/98MMPd+zY8c0335im6ff7PR6PkwEUlZBMJg3DUBRl5syZa9euLSsra2xsPH36dAF0CwccDof7PlLvo0sIh8MejyfLPxOAF3GfVn5MDzpppHS+CBlDIABigOI3XFhxejspEXXPfIiAiCNSEhSDqXjzpggR6Bg/fvyaNWv8fn9W8xUA8ua7IL3FWeycvnTp0tGjR7MCEbZth0Khq1evNjY2Pv744+vXr3/yyScPHTp04sSJtrY2XdctyxLBr2AwOGbMmBkzZixYsGD06NF79+79/PPPDcMojG4hgMWE7ODBgzdu3FAUxa24vGVZhw4dikajuQEBhnCV+34nH6T2lrFUTghBbBfu3inq2HFG0h/ttDF3ZxmZF23MGfFeuHDh5MmTc+bMER4yc21hVqrYSYM6Pznntm17vV5VVY8cOZLX54nVL5999llTU9PDDz88f/78ZcuWCVes6zrnPBAIBINBr9fb0dFx7Nixpqamy5cvRyKRQCBQGF0AwEcffbSAP4vH4z6fz8VUCREZhuH1evOWKRw1pvJAlN6rJNZxpGyKMCMJ6DBHpLSfT63fSXXUmLeRibR0H0f7jjVnLlBRVdXv9/fytyIdpGkaY6y6unrs2LGjRo0KBoMAoOt6e3v7lStXfvvtN9M0y8rKvF7vADe1FghYtHF3u2HG2C0rF/NvJsvaQZj7q6ye2dkw7n5sri/V4gyjTNNMJpPOgEak2D0ej+iYXdmvXGA/6nqmoY9lUr8u90adhnJ+39OUQVXVrGGH8xgF+2R3AEu5RXqwm5TcXVjikoAlYCkJWEoClpKApSRgKQlYSgKWgKUkYCkJWEoClpKApSRgKQlYApaSgKUkYCkJWEoClpKApSRgKQlYApaSgKWKG3CJnSIjJS34Dwa4GL60WmoQAQ/GUc9SRQS4vLzctm3JuGQBV1ZWurXXWKoYAY8cObKnL4+RKgXA1dXVg/F9DFLFAri2tlZVVTmQLlnAU6ZMqaysHMgXoUoVNeCqqqqamhrDMCTg0gQMALNmzZIWXMqA6+rqysvLLcuS1VGCgInojjvumD59+sAPjpAqRsBijrR48WJZF6UJWHxj7KxZsyZNmiSNuMRERKnTfz0ez8qVK+VQq8To+nw+BgDCiOfOnTtz5sxYLCaNuASkKEoikVi5ciVzaCuKsm7dur4fqSVVvP0uY7FYbNq0aStWrGDOJc75xIkTn3rqqa6uLhcPzJQaYomv5Pf7/Q0NDR6Ph2Vi55yvWrXqwQcflIyHtflqmrZ27dqamhrbtlkWfEVRNm7cOG7cOE3TJONhJ1VVOzs7ly1btmTJEtu2FUXJBsw5r6io2LRpU0VFRSKRkIyHHd158+bV19dzzsVgmeUauG3b48aNe/3118PhcDwel4yHEd3Zs2e/8sorqqo650+wvCNs27Zra2vfeuutUaNGxWIxd49IknJ9VKUoyrVr1+bOnfvaa6+JQ5+6T4Tpab2O8OBtbW2bN29ubm6ORCJDdmaFVL+GVLZta5q2dOnShoYGEdLIBNp94E9PjA3DeP/99/fs2eP1en0+n1yhVzyGK+a7gUDg2WefXbp0ad6zcfH69euRSFgcGpRbitNX79+/f/v27ZcvXw6FQn08PFNqUNGapqnr+vTp0+vr6ydOnCg8cS5E5R9Gjbj/nx+00yBzyxImXlNT89BDD1mWde7cuVgs5vV65eDrtjhkxphlWbFYrKKiYs2aNRs2bKiqqhK+Nq+JKufP/f3euro/3fUny7J6YiyCI8FgcNasWbNnz04mkxcvXhTHHauqKmPXQ2OyRBSPx3VdLy8vf+yxx1566aW6ujoRnurF2LB2wrjy8vL/2f63f5o5s6fOWEiYssB54cKFr7/++ujRo5cuXTJNU1VVMTSXMFyXOAHPsqxAIFBTUzN37twFCxZUVVVldqC9NY7pUycZ8XiwLPRfb7z558X/igxZr5xEKkKUaxjGzz//fPz48V9//bWtrU2ckeo8FgzOWeGDV3IxsHRM1rno8/nuuuuuadOm1dXVTZkyRdS8bdvOqcO9lKbr+v8Dim6vA4+rA/wAAAAASUVORK5CYII='

function fechaHace(dias) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function textoPrescrito(e) {
  const partes = []
  if (e.estilo_sesion) partes.push(e.estilo_sesion)
  if (e.zona_objetivo) partes.push(e.zona_objetivo)
  if (e.watts_kg_objetivo) partes.push(`${e.watts_kg_objetivo}W/kg`)
  if (e.series_objetivo) partes.push(`${e.series_objetivo}x${e.tiempo_trabajo_objetivo || (e.repeticiones_objetivo ? e.repeticiones_objetivo + 'r' : '')}`)
  if (e.pausa_objetivo) partes.push(`r=${e.pausa_objetivo}`)
  return partes.length > 0 ? partes.join(' · ') : '—'
}

function nuevoDoc() {
  return { naranjaHiviz: [235, 100, 42], grisTexto: [90, 95, 108], negro: [20, 22, 26] }
}

function agregarEncabezado(doc, negro, grisTexto, subtitulo, desde, hasta) {
  doc.addImage(LOGO_BASE64, 'PNG', 14, 10, 16, 16)
  doc.setFontSize(18); doc.setTextColor(...negro); doc.text('HELU', 34, 19)
  doc.setFontSize(10); doc.setTextColor(...grisTexto); doc.text(subtitulo, 34, 25)
  doc.text(`Período: ${desde} a ${hasta}`, 14, 34)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, 14, 39)
  return 48
}

function agregarPie(doc, grisTexto) {
  const paginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...grisTexto)
    doc.text('Generado con HELU', 14, 290)
  }
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
      const { naranjaHiviz, grisTexto, negro } = nuevoDoc()
      const doc = new jsPDF()
      let y = agregarEncabezado(doc, negro, grisTexto, 'Reporte general de actividad', desde, hasta)

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
        theme: 'grid', headStyles: { fillColor: naranjaHiviz, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
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
          theme: 'grid', headStyles: { fillColor: naranjaHiviz, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
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
          theme: 'grid', headStyles: { fillColor: naranjaHiviz, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
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
          theme: 'grid', headStyles: { fillColor: naranjaHiviz, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
        })
      }

      agregarPie(doc, grisTexto)
      doc.save(`helu-resumen-${desde}-a-${hasta}.pdf`)
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
      const { naranjaHiviz, grisTexto, negro } = nuevoDoc()
      const doc = new jsPDF()
      let y = agregarEncabezado(doc, negro, grisTexto, 'Reporte de entrenamiento — para uso profesional', desde, hasta)

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
            head: [['Fecha', 'Tipo', 'Ruta', 'Bici', 'Km', 'Min', 'Desnivel', 'Pot. media', 'NP', 'FC media', 'RPE', 'Cal', 'Vel', 'TSS', '★', 'Prescrito', 'Comentarios']],
            body: ents.map(({ data: e }) => [
              e.fecha, e.tipo || '—', e.ruta || '—', nombreBici(e.bicicleta_id),
              e.km ?? '—', e.duracion_min ?? '—', e.desnivel ?? '—',
              e.potencia_avg ?? '—', e.potencia_normalizada ?? '—', e.fc_avg ?? '—', e.rpe ?? '—',
              e.calorias ?? '—', e.velocidad_avg ?? '—',
              e.tss ?? calcularTSS(e).toFixed(0), e.es_clave ? '★' : '', textoPrescrito(e), e.comentarios || ''
            ]),
            theme: 'striped', headStyles: { fillColor: [38, 42, 51], textColor: 255, fontSize: 6 }, styles: { fontSize: 6 }, margin: { left: 14, right: 14 }
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
            head: [['Fecha', 'Ejercicio', 'Series', 'Reps', 'Peso (kg)', 'RPE', 'PR', '★']],
            body: gym.map(({ data: g }) => [g.fecha, g.ejercicio, g.series ?? '—', g.reps ?? '—', g.peso ?? '—', g.rpe ?? '—', g.pr ? 'Sí' : '', g.es_clave ? '★' : '']),
            theme: 'striped', headStyles: { fillColor: [38, 42, 51], textColor: 255, fontSize: 8 }, styles: { fontSize: 8 }, margin: { left: 14, right: 14 }
          })
        } else {
          doc.setFontSize(9); doc.setTextColor(...grisTexto); doc.text('Sin sesiones de gimnasio en el período.', 14, y)
        }
      }

      agregarPie(doc, grisTexto)
      doc.save(`helu-entrenamiento-${desde}-a-${hasta}.pdf`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el PDF. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  async function generarPDFNutricion() {
    setGenerando('nutricion')
    setError('')
    try {
      const [{ data: comidas }, { data: hidratacion }, { data: suplementos }, { data: pesos }] = await Promise.all([
        supabase.from('comidas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('hidratacion').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('suplementos').select('*').eq('activo', true),
        supabase.from('peso_historial').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true })
      ])

      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const { naranjaHiviz, grisTexto, negro } = nuevoDoc()
      const doc = new jsPDF()
      let y = agregarEncabezado(doc, negro, grisTexto, 'Reporte de nutrición — para uso profesional', desde, hasta)

      const pss = pesos || []
      doc.setFontSize(13); doc.setTextColor(...negro); doc.text('Peso corporal', 14, y); y += 8
      if (pss.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Peso (kg)', 'Notas']],
          body: pss.map((p) => [p.fecha, p.peso, p.notas || '']),
          theme: 'grid', headStyles: { fillColor: naranjaHiviz, textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8 }, margin: { left: 14, right: 14 }
        })
        y = doc.lastAutoTable.finalY + 10
      } else {
        doc.setFontSize(9); doc.setTextColor(...grisTexto); doc.text('Sin registros de peso en el período.', 14, y); y += 10
      }

      if (y > 240) { doc.addPage(); y = 20 }

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
          theme: 'grid', headStyles: { fillColor: naranjaHiviz, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
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
      doc.save(`helu-nutricion-${desde}-a-${hasta}.pdf`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el PDF. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  async function generarExcelGeneral() {
    setGenerando('excel-general')
    setError('')
    try {
      const [{ data: entrenamientos }, { data: metricas }, { data: comidas }, { data: gimnasio }, { data: bicicletas }] = await Promise.all([
        supabase.from('entrenamientos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('metricas_diarias').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('comidas').select('*').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('gimnasio').select('*').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('bicicletas').select('id, nombre')
      ])
      const XLSX = await import('xlsx')
      const nombreBici = (id) => (bicicletas || []).find((b) => b.id === id)?.nombre || '—'

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((entrenamientos || []).map((e) => ({
        Fecha: e.fecha, Tipo: e.tipo, Ruta: e.ruta, Bici: nombreBici(e.bicicleta_id), Km: e.km,
        'Duración (min)': e.duracion_min, 'Desnivel (m)': e.desnivel, 'Descenso (m)': e.descenso,
        'Pot. media (W)': e.potencia_avg, 'NP (W)': e.potencia_normalizada, 'Pot. máxima (W)': e.potencia_max,
        'FC media': e.fc_avg, RPE: e.rpe, TSS: e.tss ?? calcularTSS(e).toFixed(0), Calorías: e.calorias,
        'Cadencia media': e.cadencia_avg, 'Cadencia máx': e.cadencia_max,
        'Velocidad media (km/h)': e.velocidad_avg, 'Velocidad máx (km/h)': e.velocidad_max,
        'Temperatura media (°C)': e.temperatura_avg, 'Trabajo (kJ)': e.trabajo_kj,
        Estado: e.estado, 'Sesión clave': e.es_clave ? 'Sí' : '', Comentarios: e.comentarios
      }))), 'Entrenamientos')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((metricas || []).map((m) => ({
        Fecha: m.fecha, 'Sueño (h)': m.sueño_horas, 'Body Battery mañana': m.body_battery_manana,
        'Estrés': m.estres_score, HRV: m.hrv, 'FC reposo': m.fc_reposo
      }))), 'Recuperación')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((comidas || []).map((c) => ({
        Fecha: c.fecha, Hora: c.hora, Tipo: c.tipo, Descripción: c.descripcion,
        Kcal: c.kcal, 'Proteínas (g)': c.proteinas, 'Carbohidratos (g)': c.carbohidratos, 'Grasas (g)': c.grasas
      }))), 'Nutrición')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((gimnasio || []).map((g) => ({
        Fecha: g.fecha, Ejercicio: g.ejercicio, Series: g.series, Reps: g.reps, 'Peso (kg)': g.peso,
        Estado: g.estado, PR: g.pr ? 'Sí' : ''
      }))), 'Gimnasio')

      XLSX.writeFile(wb, `helu-resumen-${desde}-a-${hasta}.xlsx`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el Excel. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  async function generarExcelEntrenamiento() {
    setGenerando('excel-entrenamiento')
    setError('')
    try {
      const [{ data: entrenamientos }, { data: gimnasio }, { data: bicicletas }] = await Promise.all([
        supabase.from('entrenamientos').select('*').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'realizado').order('fecha', { ascending: true }),
        supabase.from('gimnasio').select('*').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'realizado').order('fecha', { ascending: true }),
        supabase.from('bicicletas').select('id, nombre')
      ])
      const XLSX = await import('xlsx')
      const nombreBici = (id) => (bicicletas || []).find((b) => b.id === id)?.nombre || '—'

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((entrenamientos || []).map((e) => ({
        Fecha: e.fecha, Tipo: e.tipo, Ruta: e.ruta, Bici: nombreBici(e.bicicleta_id),
        'Km': e.km, 'Duración (min)': e.duracion_min, 'Tiempo en movimiento (min)': e.tiempo_movimiento_min,
        'Desnivel (m)': e.desnivel, 'Descenso (m)': e.descenso, 'Altura mín (m)': e.altura_min, 'Altura máx (m)': e.altura_max,
        'Pot. media (W)': e.potencia_avg, 'NP (W)': e.potencia_normalizada, 'Pot. máxima (W)': e.potencia_max, 'Pot. media máx 20min (W)': e.potencia_20min,
        'Cadencia media': e.cadencia_avg, 'Cadencia máx': e.cadencia_max,
        'FC media': e.fc_avg, RPE: e.rpe, TSS: e.tss ?? calcularTSS(e).toFixed(0),
        Calorías: e.calorias, 'Trabajo (kJ)': e.trabajo_kj,
        'Velocidad media (km/h)': e.velocidad_avg, 'Velocidad máx (km/h)': e.velocidad_max,
        'Temperatura media (°C)': e.temperatura_avg, 'Temperatura mín (°C)': e.temperatura_min, 'Temperatura máx (°C)': e.temperatura_max,
        'Sesión clave': e.es_clave ? 'Sí' : '',
        'Estilo prescrito': e.estilo_sesion, 'Zona prescrita': e.zona_objetivo, 'W/kg prescrito': e.watts_kg_objetivo,
        'Series prescritas': e.series_objetivo, 'Reps prescritas': e.repeticiones_objetivo,
        'Tiempo de trabajo prescrito': e.tiempo_trabajo_objetivo, 'Pausa prescrita': e.pausa_objetivo,
        Comentarios: e.comentarios
      }))), 'Ciclismo')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((gimnasio || []).map((g) => ({
        Fecha: g.fecha, Ejercicio: g.ejercicio, Series: g.series, Reps: g.reps, 'Peso (kg)': g.peso, RPE: g.rpe,
        PR: g.pr ? 'Sí' : '', 'Sesión clave': g.es_clave ? 'Sí' : '',
        'Método prescrito': g.metodo_prescrito, 'Valor prescrito': g.valor_prescrito
      }))), 'Gimnasio')

      XLSX.writeFile(wb, `helu-entrenamiento-${desde}-a-${hasta}.xlsx`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el Excel. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  async function generarExcelNutricion() {
    setGenerando('excel-nutricion')
    setError('')
    try {
      const [{ data: comidas }, { data: hidratacion }, { data: suplementos }, { data: pesos }] = await Promise.all([
        supabase.from('comidas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('hidratacion').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
        supabase.from('suplementos').select('*').eq('activo', true),
        supabase.from('peso_historial').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true })
      ])
      const XLSX = await import('xlsx')

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((pesos || []).map((p) => ({
        Fecha: p.fecha, 'Peso (kg)': p.peso, Notas: p.notas
      }))), 'Peso')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((comidas || []).map((c) => ({
        Fecha: c.fecha, Hora: c.hora, Tipo: c.tipo, Descripción: c.descripcion,
        Kcal: c.kcal, 'Proteínas (g)': c.proteinas, 'Carbohidratos (g)': c.carbohidratos, 'Grasas (g)': c.grasas
      }))), 'Comidas')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((hidratacion || []).map((h) => ({
        Fecha: h.fecha, Hora: h.hora, Bebida: h.bebida || 'Agua', 'Cantidad (ml)': h.ml
      }))), 'Hidratación')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((suplementos || []).map((s) => ({
        Nombre: s.nombre, Tipo: s.tipo, Dosis: s.dosis, Frecuencia: s.frecuencia, Notas: s.notas
      }))), 'Suplementos')

      XLSX.writeFile(wb, `helu-nutricion-${desde}-a-${hasta}.xlsx`)
    } catch (err) {
      console.error(err); setError('No se pudo generar el Excel. ' + (err.message || ''))
    } finally { setGenerando('') }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IconoInsignia Icono={FileText} />
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-ink-muted text-sm mt-1">Exportá tu actividad en PDF</p>
        </div>
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
          Detalle completo de ciclismo y gimnasio, ordenado por fecha, con todas las métricas (incluida ruta y sesiones clave) — pensado para mostrarle a un entrenador que no use la app.
        </p>
        <button onClick={generarPDFEntrenamiento} disabled={!!generando} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-4">
          {generando === 'entrenamiento' ? 'Generando…' : 'Descargar entrenamiento (PDF)'}
        </button>
      </div>

      <div className="card">
        <span className="label-eyebrow">Reporte de nutrición</span>
        <p className="text-ink-muted text-xs mt-2">
          Peso corporal con fecha, comidas, hidratación y suplementos con sus notas — pensado para mostrarle a un nutricionista que no use la app.
        </p>
        <button onClick={generarPDFNutricion} disabled={!!generando} className="bg-hiviz text-asphalt-950 font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 mt-4">
          {generando === 'nutricion' ? 'Generando…' : 'Descargar nutrición (PDF)'}
        </button>
      </div>

      {error && <p className="text-alert-red text-xs">{error}</p>}
    </div>
  )
}
