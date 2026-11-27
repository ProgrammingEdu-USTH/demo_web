/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        blueprint: {
          paper: '#F7F5EE',
          surface: '#FAF8F2',
          grid: '#E5E0D5',
          ink: '#1E293B',
          sky: '#BAE6FD',
          lavender: '#DDD6FE',
          mint: '#BBF7D0',
          coral: '#FECACA',
        },
      },
      boxShadow: {
        blueprint: '3px 3px 0 #1E293B',
        blueprintSm: '2px 2px 0 #1E293B',
      },
    },
  },
  plugins: [],
};
