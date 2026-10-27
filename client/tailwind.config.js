/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#203c63',
          mid: '#182e4d',
          light: '#345f94',
        },
        gold: {
          DEFAULT: '#c7dcf5',
          light: '#e3edfa',
        },
        off: '#f8f9fb',
      }
    },
  },
  plugins: [],
}
