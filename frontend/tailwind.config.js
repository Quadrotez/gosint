/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0c0f',
          secondary: '#111318',
          tertiary: '#181c24',
          elevated: '#1e2330',
        },
        border: {
          subtle: '#1e2330',
          default: '#262d3d',
          strong: '#3a4460',
        },
        accent: {
          cyan: '#00d4ff',
          green: '#00ff88',
          orange: '#ff6b35',
          purple: '#8b5cf6',
          red: '#ff4444',
          yellow: '#ffd700',
        },
        text: {
          primary: '#e8edf5',
          secondary: '#7a8ba8',
          muted: '#4a5568',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
