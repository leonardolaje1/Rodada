/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        asphalt: {
          950: '#0D0F13',
          900: '#14161A',
          800: '#1C1F26',
          700: '#262A33',
          600: '#343946'
        },
        hiviz: {
          DEFAULT: '#C4F135',
          dim: '#8FAE2A'
        },
        route: {
          DEFAULT: '#4A9EFF',
          dim: '#2E6BB3'
        },
        alert: {
          amber: '#F5A623',
          red: '#F14A4A'
        },
        ink: {
          DEFAULT: '#E8E9ED',
          muted: '#8A8F9C',
          faint: '#565B68'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        data: ['"JetBrains Mono"', 'monospace']
      }
    }
  },
  plugins: []
}
