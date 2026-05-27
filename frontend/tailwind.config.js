/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#2a2a2a',
          100: '#252525',
          200: '#1e1e1e',
          300: '#1a1a1a',
          400: '#141414',
          500: '#0f0f0f',
          600: '#0a0a0a',
          700: '#050505',
          800: '#000000',
          900: '#000000',
        }
      },
      backgroundColor: {
        'dark-primary': '#0a0a0a',
        'dark-secondary': '#1a1a1a',
        'dark-card': '#1e1e1e',
        'dark-hover': '#2a2a2a',
      },
      textColor: {
        'dark-primary': '#ffffff',
        'dark-secondary': '#a0a0a0',
        'dark-muted': '#6b6b6b',
      },
      borderColor: {
        'dark': '#2a2a2a',
      }
    },
  },
  plugins: [],
}