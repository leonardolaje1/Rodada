import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import EstadoVacio from '../components/EstadoVacio'

export default function NoEncontrado() {
  return (
    <EstadoVacio
      Icono={Compass}
      titulo="Esta ruta no existe"
      descripcion="La página que buscás no está o cambió de lugar."
      accion={
        <Link
          to="/"
          className="mt-2 inline-block px-4 py-2 rounded-lg bg-hiviz text-asphalt-950 text-sm font-semibold transition-transform duration-150 ease-apple active:scale-[0.97]"
        >
          Volver al panel
        </Link>
      }
    />
  )
}
