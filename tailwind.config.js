/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#EEF1F7',
          100: '#D5DCE9',
          200: '#ABB9D3',
          300: '#7E95BC',
          400: '#5472A6',
          500: '#3D5E93',
          600: '#2D4B7A',
          700: '#243D64',
          800: '#1B2D4F',
          900: '#111E34',
          950: '#0A1220',
        },
        crimson: {
          50:  '#FEF2F1',
          100: '#FDE0DD',
          200: '#FBC5BF',
          300: '#F7A099',
          400: '#F07068',
          500: '#D44332',
          600: '#C0392B',
          700: '#A02E22',
          800: '#82241B',
          900: '#671D16',
        },
        surface: {
          50:  '#FAFAF9',
          100: '#F5F3EF',
          200: '#EDEAE4',
          300: '#E2DDD5',
          400: '#CEC7BC',
          500: '#B8AFA2',
        },
        // "Ledger" design system tokens (see design_handoff_crm/README.md).
        // Kept separate from the legacy navy/crimson/surface scale above so
        // screens can be reskinned one at a time without shifting colors on
        // screens that haven't been touched yet.
        ledger: {
          navy: '#0A1A3C',
          navyHover: '#132868',
          crimson: '#CF1B3C',
          crimsonDeep: '#B01633',
          paper: '#FBFAF7',
          zebra: '#F6F4EF',
          rowHover: '#F2EFE8',
          hairline: '#DDD9D0',
          hairline2: '#EDEAE3',
          navInactive: '#8FA1C4',
          body: '#3D4451',
          mid: '#565C66',
          soft: '#5A6068',
          faint: '#616770',
          muted: '#8E8B84',
          green: '#0F6B4F',
          amber: '#8A5A12',
          blue: '#1F3D7A',
          gray: '#5A6068',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        serifLedger: ['"Instrument Serif"', 'Georgia', 'serif'],
        plexSans: ['"IBM Plex Sans"', '-apple-system', 'sans-serif'],
        plexMono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        geist: ['Geist', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 6px -1px rgba(0,0,0,0.06)',
        'modal': '0 20px 60px 0 rgba(0,0,0,0.18), 0 8px 24px -4px rgba(0,0,0,0.12)',
        'ledger-frame': '0 24px 60px -20px rgba(0,0,0,0.55)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
