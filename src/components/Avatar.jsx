export default function Avatar({ url, nombre, size = 32 }) {
  const inicial = (nombre || '?').trim().charAt(0).toUpperCase()
  const estiloBase = {
    width: size,
    height: size,
    borderRadius: '9999px',
    flexShrink: 0,
    objectFit: 'cover'
  }

  if (url) {
    return <img src={url} alt="Foto de perfil" style={estiloBase} />
  }

  return (
    <div
      style={{ ...estiloBase, fontSize: size * 0.42 }}
      className="bg-asphalt-700 text-ink-muted flex items-center justify-center font-semibold"
    >
      {inicial}
    </div>
  )
}
