import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'

export default function PMCChart({ data, hoy }) {
  const [abierto, setAbierto] = useState(false)
  const hayAlgoHoy = hoy && (hoy.entrenamientoPendiente || hoy.gimnasioPendiente || hoy.faltaRecuperacion)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <span className="label-eyebrow">Carga — 90 días</span>
        <Legend />
      </div>

      {hayAlgoHoy && (
        <div className="mb-2">
          <button onClick={() => setAbierto((v) => !v)} className="flex items-center gap-1.5 text-xs text-hiviz font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-hiviz inline-block" />
            Hoy
            <span className="text-ink-faint">{abierto ? '▲' : '▼'}</span>
          </button>
          {abierto && (
            <div className="flex flex-col gap-1.5 mt-2 pl-3 border-l border-asphalt-700">
              {hoy.entrenamientoPendiente && (
                <Link to="/entrenamientos" className="text-xs text-ink-muted hover:text-ink">
                  🚴 Entrenamiento: {hoy.entrenamientoPendiente.tipo}{hoy.entrenamientoPendiente.es_clave ? ' ★' : ''} →
                </Link>
              )}
              {hoy.gimnasioPendiente && (
                <Link to="/gimnasio" className="text-xs text-ink-muted hover:text-ink">
                  🏋️ Gimnasio pendiente →
                </Link>
              )}
              {hoy.faltaRecuperacion && (
                <Link to="/recuperacion" className="text-xs text-ink-muted hover:text-ink">
                  🌙 Falta cargar recuperación →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#262A33" vertical={false} />
          <XAxis
            dataKey="fecha"
            tick={{ fill: '#8A8F9C', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#262A33' }}
            minTickGap={30}
          />
          <YAxis tick={{ fill: '#8A8F9C', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: '#1C1F26',
              border: '1px solid #262A33',
              borderRadius: 8,
              fontSize: 12
            }}
            labelStyle={{ color: '#8A8F9C' }}
          />
          <Area
            type="monotone"
            dataKey="tsb"
            fill="#4A9EFF22"
            stroke="none"
            name="TSB (forma)"
          />
          <Line
            type="monotone"
            dataKey="ctl"
            stroke="#C4F135"
            strokeWidth={2}
            dot={false}
            name="CTL (fitness)"
          />
          <Line
            type="monotone"
            dataKey="atl"
            stroke="#F14A4A"
            strokeWidth={1.5}
            dot={false}
            name="ATL (fatiga)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex gap-3 text-[11px] text-ink-muted font-body">
      <span className="flex items-center gap-1">
        <i className="w-2 h-2 rounded-full bg-hiviz inline-block" /> CTL
      </span>
      <span className="flex items-center gap-1">
        <i className="w-2 h-2 rounded-full bg-alert-red inline-block" /> ATL
      </span>
      <span className="flex items-center gap-1">
        <i className="w-2 h-2 rounded-full bg-route inline-block" /> TSB
      </span>
    </div>
  )
}
