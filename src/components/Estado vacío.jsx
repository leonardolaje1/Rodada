import IconoInsignia from './IconoInsignia'

export default function EstadoVacio({ Icono, titulo, descripcion, accion }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-4">
      <IconoInsignia Icono={Icono} activo={false} size={44} />
      <p className="text-sm font-semibold text-ink mt-1">{titulo}</p>
      {descripcion && <p className="text-ink-muted text-xs max-w-xs">{descripcion}</p>}
      {accion}
    </div>
  )
}
