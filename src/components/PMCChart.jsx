import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1E] border border-[#242429] rounded-[10px] px-3 py-2 text-[12px]">
      <p className="text-[#6B6B71] text-[10px] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center gap-2" style={{ color: p.stroke }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.stroke }} />
          {p.dataKey.toUpperCase()}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function PMCChart({ data = [] }) {
  const chartData = data.length ? data : [
    { fecha: '2026-05-20', ctl: 0, atl: 0, tsb: 0 },
    { fecha: '2026-05-31', ctl: 0, atl: 0, tsb: 0 },
    { fecha: '2026-06-11', ctl: 0, atl: 0, tsb: 0 },
    { fecha: '2026-06-22', ctl: 0, atl: 0, tsb: 0 },
    { fecha: '2026-07-03', ctl: 0, atl: 0, tsb: 0 },
    { fecha: '2026-07-14', ctl: 0, atl: 0, tsb: 0 },
    { fecha: '2026-07-25', ctl: 0, atl: 0, tsb: 0 },
    { fecha: '2026-08-08', ctl: 0, atl: 0, tsb: 0 },
  ]

  return (
    <div className="h-[240px] w-full -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ctlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C4F135" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#C4F135" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="atlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F45D5D" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#F45D5D" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="tsbGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5DA9FF" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#5DA9FF" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="#1A1A1E" strokeWidth={1} />
          <XAxis
            dataKey="fecha"
            tick={{ fill: '#5A5A63', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={10}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 4]}
            ticks={[0,1,2,3,4]}
            tick={{ fill: '#5A5A63', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="atl" stroke="#FF7A45" fill="transparent" strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="ctl" stroke="#C4F135" fill="url(#ctlGrad)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="atl" stroke="#F45D5D" fill="url(#atlGrad)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="tsb" stroke="#5DA9FF" fill="url(#tsbGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
