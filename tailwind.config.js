/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warna resmi IKAPI — diambil dari logo biru khas IKAPI
        ikapi: {
          // Biru Langit IKAPI (primary — warna bunga logo)
          50:  '#f0f9ff',
          100: '#dff2fd',
          200: '#b8e6fc',
          300: '#7ad2f9',
          400: '#35baf5',
          500: '#0da2e7',  // warna utama logo IKAPI
          600: '#0884c4',  // hover / aktif
          700: '#096ba0',  // dark / header
          800: '#0d5680',  // very dark
          900: '#0e4568',  // deepest

          // Aksen putih bersih
          bg:   '#f8fbfe',
          card: '#ffffff',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif']
      }
    },
  },
  plugins: [],
}
