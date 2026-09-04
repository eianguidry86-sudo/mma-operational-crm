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
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 6px -1px rgba(0,0,0,0.06)',
        'modal': '0 20px 60px 0 rgba(0,0,0,0.18), 0 8px 24px -4px rgba(0,0,0,0.12)',
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
