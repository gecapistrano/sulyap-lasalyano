/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#1C1714',
        'background-alt': '#251E19',
        foreground: '#E8DFD4',
        muted: {
          DEFAULT: '#3D332B',
          foreground: '#9C8B7A',
        },
        border: '#4A3F35',
        accent: {
          DEFAULT: '#C9A962',
          bright: '#D4B872',
          deep: '#B8953F',
          foreground: '#1C1714',
        },
        crimson: '#8B2635',
        grove: {
          DEFAULT: '#00703C',
          bright: '#0A8250',
        },
      },
      fontFamily: {
        display: ['var(--font-cinzel)', 'Cinzel', 'serif'],
        heading: ['var(--font-cormorant)', 'Cormorant Garamond', 'serif'],
        body: ['var(--font-crimson)', 'Crimson Pro', 'serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        aca: '4px',
      },
      transitionTimingFunction: {
        aca: 'ease-out',
      },
      transitionDuration: {
        aca: '300ms',
        'aca-fast': '150ms',
        'aca-slow': '500ms',
        'aca-dramatic': '700ms',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0%)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'slide-down': 'slide-down 0.42s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'fade-in': 'fade-in 0.2s ease forwards',
        'fade-out': 'fade-out 0.2s ease forwards',
        'pop-in': 'pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
    },
  },
  plugins: [],
}
