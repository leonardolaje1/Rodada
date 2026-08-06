export default function StatCard({ label, value, unit, accent = 'ink' }) {
  const accentClass =
    {
      hiviz: 'text-hiviz',
      route: 'text-route',
      amber: 'text-alert-amber',
      red: 'text-alert-red',
      ink: 'text-ink'
    }[accent] || 'text-ink'

  return (
    <div className="card flex flex-col justify-between min-h-[92px]">
      <span className="label-eyebrow">{label}</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`readout text-3xl font-bold ${accentClass}`}>{value}</span>
        {unit && <span className="text-ink-muted text-xs font-body">{unit}</span>}
      </div>
    </div>
  )
}
