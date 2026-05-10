export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#000000',
        'dark-surface': '#0a0a0a',
        'dark-surface-2': '#111111',
        'dark-surface-3': '#1a1a1a',
        'dark-border': '#1f1f1f',
        'dark-border-strong': '#2a2a2a',
      },
      fontFamily: {
        'inter': ["'Inter', -apple-system, BlinkMacSystemFont, sans-serif"],
        'mono': ["'JetBrains Mono', monospace"],
      },
    },
  },
  plugins: [],
}
