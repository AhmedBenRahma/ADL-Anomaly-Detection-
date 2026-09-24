/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0f1117',
          card: '#1a1d27',
          border: '#2a3142',
          muted: '#94a3b8',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
}
