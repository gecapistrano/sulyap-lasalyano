/** Tailwind scans `index.html` and all `src` JS/JSX for class names. */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 0.3s ease',
      },
    },
  },
  plugins: [],
}