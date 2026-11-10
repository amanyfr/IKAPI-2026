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
        },
        // Design system situs resmi ikapi.org
        brand: {
          blue:  '#0c71c3',  // tombol utama (READ MORE)
          nav:   '#1e84bf',  // menu aktif / hover tombol
          sky:   '#2ea3f2',  // link & tombol outline
          navy:  '#082691',  // gradasi footer
          gold:  '#e7b14e',  // subjudul aksen
          ink:   '#232323',  // judul & tombol gelap
          text:  '#666666',  // teks isi
          line:  '#d8d8d8',  // garis / border
          muted: '#f2f2f2',  // latar abu muda
        }
      },
      // Ikon tanda tanya di tahap Input KTA bergoyang pelan sesekali
      keyframes: {
        'stepper-wiggle': {
          '0%, 70%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '76%': { transform: 'rotate(-14deg) scale(1.12)' },
          '82%': { transform: 'rotate(12deg) scale(1.12)' },
          '88%': { transform: 'rotate(-8deg) scale(1.06)' },
          '94%': { transform: 'rotate(4deg) scale(1)' },
        },
        // Kilau mengalir di garis tahap yang sudah lewat & badge status
        'stepper-flow': { '0%': { backgroundPosition: '100% 0' }, '100%': { backgroundPosition: '-100% 0' } },
        'stepper-flow-v': { '0%': { backgroundPosition: '0 100%' }, '100%': { backgroundPosition: '0 -100%' } },
        'stepper-shine': { '0%': { backgroundPosition: '100% 0' }, '60%, 100%': { backgroundPosition: '-150% 0' } },
        'stepper-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'stepper-wiggle': 'stepper-wiggle 2.4s ease-in-out infinite',
        'stepper-flow': 'stepper-flow 2.8s linear infinite',
        'stepper-flow-v': 'stepper-flow-v 2.8s linear infinite',
        'stepper-shine': 'stepper-shine 3.5s ease-in-out infinite',
        'stepper-in': 'stepper-in 0.5s ease-out both',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif']
      }
    },
  },
  plugins: [],
}
