/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'fun-bg':     '#fff8f3',
        'fun-card':   '#ffffff',
        'fun-border': '#fde8d8',
        'fun-accent': '#ff6b35',
        'fun-purple': '#a855f7',
        'fun-pink':   '#f472b6',
        'fun-sky':    '#38bdf8',
        'fun-yellow': '#fbbf24',
        'fun-green':  '#34d399',
        'fun-text':   '#2d1b69',
        'fun-muted':  '#a094b8',
      },
      fontFamily: {
        game: ['"Nunito"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':       '4px 4px 0px #fde8d8',
        'card-hover': '6px 6px 0px #fbd0bc',
        'btn':        '3px 3px 0px rgba(0,0,0,0.12)',
        'btn-hover':  '5px 5px 0px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
