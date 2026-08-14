import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { tieneError: false }
  }

  static getDerivedStateFromError() {
    return { tieneError: true }
  }

  componentDidCatch(error, info) {
    console.error('Error capturado por ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.tieneError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <p className="text-ink text-lg font-medium mb-2">Algo salió mal</p>
            <p className="text-ink-muted text-sm mb-6">
              Ocurrió un error inesperado. Probá recargar la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-hiviz text-asphalt-900 px-4 py-2 rounded-lg font-medium"
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
