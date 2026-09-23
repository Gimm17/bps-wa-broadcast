/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{svelte,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#172020',
        canvas: '#F7F7F3',
        muted: '#66706F',
        border: '#DCE2DF',
        primary: '#007979',
        accent: '#24B1B1',
        orange: '#E37434',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
