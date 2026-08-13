/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector'],
  theme: {
    extend: {
      colors: {
        asphalt: {
          950: '#0F0F0F',
          900: 'rgb(var(--color-asphalt-900) / <alpha-value>)',
          800: 'rgb(var(--color-asphalt-800) / <alpha-value>)',
          700: 'rgb(var(--color-asphalt-700) / <alpha-value>)',
          600: 'rgb(var(--color-asphalt-600) / <alpha-value>)'
        },
        hiviz: {
          DEFAULT: 'rgb(var(--color-hiviz) / <alpha-value>)',
          dim: 'rgb(var(--color-hiviz-dim) / <alpha-value>)'
        },
        route: {
          DEFAULT: 'rgb(var(--color-route) / <alpha-value>)',
          dim: 'rgb(var(--color-route-dim) / <alpha-value>)'
        },
        alert: {
          amber: 'rgb(var(--color-alert-amber) / <alpha-value>)',
          red: 'rgb(var(--color-alert-red) / <alpha-value>)'
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--color-ink-faint) / <alpha-value>)'
        },
        // Tokens de estado — usados en alertas, insignias y bordes de tarjeta
        // condicionales. Reemplazan los hex inline (#F5A623, #F14A4A, etc.)
        // que hoy están repartidos en Dashboard, BicicletaDetalle,
        // Entrenamientos, Recuperacion y VerAtleta.
        state: {
          critical: 'rgb(var(--color-state-critical) / <alpha-value>)',
          warning: 'rgb(var(--color-state-warning) / <alpha-value>)',
          success: 'rgb(var(--color-state-success) / <alpha-value>)',
          neutral: 'rgb(var(--color-state-neutral) / <alpha-value>)'
        }
      },
      fontFamily: {
        display: ['"Jost"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        data: ['"JetBrains Mono"', 'monospace']
      },
      transitionTimingFunction: {
        // easing tipo Apple: entrada rápida, salida suave
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
      }
    }
  },
  plugins: []
}
