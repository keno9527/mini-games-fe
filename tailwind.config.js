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

        crt: {
          'bg-deep':   '#0a0e27',
          'bg-card':   '#0f1440',
          'bg-card-2': '#151a3a',
          border:      '#252a5a',
          pink:        '#ff2e88',
          cyan:        '#00f0ff',
          yellow:      '#ffd23f',
          green:       '#39ff14',
          purple:      '#b026ff',
          text:        '#f0f0ff',
          muted:       '#8888b8',
        },
      },
      fontFamily: {
        game:       ['"Nunito"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        pixel:      ['"Press Start 2P"', 'monospace'],
        'mono-crt': ['"VT323"', 'monospace'],
        body:       ['"Nunito"', '"PingFang SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':       '4px 4px 0px #fde8d8',
        'card-hover': '6px 6px 0px #fbd0bc',
        'btn':        '3px 3px 0px rgba(0,0,0,0.12)',
        'btn-hover':  '5px 5px 0px rgba(0,0,0,0.12)',
        'crt-card':   '4px 4px 0 #ff2e88',
        'crt-lift':   '6px 6px 0 #ff2e88',
        'neon-c':     '0 0 12px #00f0ffaa',
        'neon-p':     '0 0 12px #ff2e88aa',
        'neon-y':     '0 0 12px #ffd23faa',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        breathe: {
          '0%, 100%': { boxShadow: '0 0 6px #ffd23faa' },
          '50%':      { boxShadow: '0 0 18px #ffd23f' },
        },
      },
      animation: {
        blink:   'blink 1s steps(2) infinite',
        breathe: 'breathe 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
