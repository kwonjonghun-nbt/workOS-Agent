/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Claude brand coral accent (works in both themes)
        claude: {
          50: '#FBF1EC',
          100: '#F5DDD0',
          200: '#EDBFA8',
          300: '#E29F7F',
          400: '#D7825D',
          500: '#C96442',
          600: '#B05537',
          700: '#8E4329',
          800: '#6B321F',
          900: '#4A2316',
        },
        // Theme-aware grayscale — driven by CSS variables in index.css so the
        // same class set renders in both dark and light modes.
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          750: 'rgb(var(--ink-750) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          850: 'rgb(var(--ink-850) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          950: 'rgb(var(--ink-950) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Inter"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.22)',
      },
    },
  },
  plugins: [],
};
