import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Versão = momento do build no horário de Brasília: DDMM.HHMM.AA (ex.: 1711.1137.26)
const versaoBuild = (() => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value])
  )
  return `${p.day}${p.month}.${p.hour}${p.minute}.${p.year}`
})()

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versaoBuild),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
