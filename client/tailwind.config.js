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
        serif: ['Newsreader', 'Iowan Old Style', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        navy: {
          DEFAULT: '#1f3a5f',
          mid: '#172c48',
          light: '#2f5585',
        },
        gold: {
          DEFAULT: '#c7dcf5',
          light: '#e3edfa',
        },
        ink: { DEFAULT: '#1d2025', soft: '#4a4f57', faint: '#6a6f77' },
        paper: { DEFAULT: '#f7f5f0', deep: '#efece4' },
        rule: { DEFAULT: '#dcd7cc', strong: '#bdb6a8' },
        off: '#f7f5f0',
      }
    },
  },
  plugins: [],
}
