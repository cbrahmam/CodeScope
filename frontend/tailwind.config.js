/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0D1117',
        'bg-secondary': '#161B22',
        'bg-tertiary': '#21262D',
        'border-primary': '#30363D',
        'accent': '#3FB950',
        'accent-hover': '#2EA043',
        'text-primary': '#E6EDF3',
        'text-secondary': '#8B949E',
        'severity-critical': '#DC2626',
        'severity-high': '#EF4444',
        'severity-medium': '#F59E0B',
        'severity-low': '#3B82F6',
        'severity-info': '#6B7280',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
