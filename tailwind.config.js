/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './src/index.html'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#1e1e2e',
          secondary: '#181825',
          tertiary: '#11111b',
          surface: '#313244',
          hover: '#45475a',
        },
        text: {
          primary: '#cdd6f4',
          secondary: '#a6adc8',
          muted: '#6c7086',
        },
        accent: {
          blue: '#89b4fa',
          green: '#a6e3a1',
          red: '#f38ba8',
          yellow: '#f9e2af',
          purple: '#cba6f7',
          teal: '#94e2d5',
        },
        border: {
          DEFAULT: '#313244',
          active: '#585b70',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'monospace'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
