export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        family: {
          unix: '#a855f7',
          bsd: '#f59e0b',
          linux: '#10b981',
          windows: '#0284c7',
          apple: '#f43f5e',
          independent: '#6366f1',
        },
      },
    },
  },
  plugins: [],
}
