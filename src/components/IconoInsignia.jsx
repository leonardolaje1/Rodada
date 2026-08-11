export default function IconoInsignia({ Icono, color = '#EB642A', activo = true, size = 32 }) {
  return (
    <span
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: activo ? `${color}1A` : 'rgb(44,44,44)' }}
    >
      <Icono size={Math.round(size * 0.48)} strokeWidth={2} color={activo ? color : '#6E6E6E'} />
    </span>
  )
}
