/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        azul: '#3D63DB',
        vermelho: '#E0543C',
        ambar: '#EDA33B',
        verde: '#30A46C',
        tinta: '#141414',
        osso: '#FAFAF7',
        cinza: '#6B6F76',
        borda: '#ECEBE6',
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 8px 24px rgba(20, 20, 20, 0.07)',
      },
    },
  },
  plugins: [],
}
