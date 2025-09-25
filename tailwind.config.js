/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Fira Code', 'Source Code Pro', 'monospace'],
      },
      colors: {
        slate: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          300: '#cbd5e1',
          200: '#e2e8f0',
        },
      },
      boxShadow: {
        glass: '0 18px 40px rgba(15, 23, 42, 0.5)',
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [],
};