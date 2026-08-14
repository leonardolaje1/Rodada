export default function IconoInsignia({ Icono, color = 'rgb(var(--color-hiviz))', colorFondo = 'rgb(var(--color-hiviz) / 0.1)', activo = true, size = 32 }) {
  return (
    <span
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: activo ? colorFondo : 'rgb(var(--color-asphalt-800))' }}
    >
      <Icono size={Math.round(size * 0.48)} strokeWidth={2} color={activo ? color : 'rgb(var(--color-ink-faint))'} />
    </span>
  )
}
