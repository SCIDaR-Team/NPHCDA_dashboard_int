/** @type {import('tailwindcss').Config} */
export default {
  darkmode: 'class',
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // All colours resolve to CSS variables defined in src/styles/tokens.css.
        // This keeps the NPHCDA brand palette in one place and powers dark/light theming.
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        'bg-elev': 'rgb(var(--c-bg-elev) / <alpha-value>)',
        'bg-elev-2': 'rgb(var(--c-bg-elev-2) / <alpha-value>)',
        'bg-elev-3': 'rgb(var(--c-bg-elev-3) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        'border-soft': 'rgb(var(--c-border-soft) / <alpha-value>)',
        text: 'rgb(var(--c-text) / <alpha-value>)',
        'text-soft': 'rgb(var(--c-text-soft) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        'muted-2': 'rgb(var(--c-muted-2) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--c-green) / <alpha-value>)',
          dark: 'rgb(var(--c-green-dark) / <alpha-value>)',
          bright: 'rgb(var(--c-green-bright) / <alpha-value>)',
        },
        danger: 'rgb(var(--c-red) / <alpha-value>)',
        'danger-strong': 'rgb(var(--c-red-strong) / <alpha-value>)',
        warning: 'rgb(var(--c-amber) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.18)',
        'card-hover': '0 2px 4px rgb(0 0 0 / 0.06), 0 16px 40px -16px rgb(0 0 0 / 0.28)',
        pop: '0 12px 40px -8px rgb(0 0 0 / 0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'fade-in-up': 'fade-in-up 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
