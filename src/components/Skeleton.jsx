export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-asphalt-700 rounded-lg ${className}`} />
}

export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="card flex flex-col gap-2">
      <Skeleton className="h-3 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-2/3" />
      ))}
    </div>
  )
}

export function SkeletonStatGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-2">
          <Skeleton className="h-2.5 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 3 }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center justify-between">
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  )
}
