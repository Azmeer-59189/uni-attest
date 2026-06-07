/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0D1B2A',
          mid: '#162234',
          light: '#1E3048',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E2C87A',
        },
        off: '#F2F0EC',
      }
    },
  },
  plugins: [],
}