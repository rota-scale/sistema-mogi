/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O painel fala com o backend Go pelo proxy /api, inclusive o WebSocket,
// então não há CORS no desenvolvimento. Em produção o próprio Go serve o
// build e atende /api no mesmo endereço.
const API = process.env.MOGI_API ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Três páginas: o painel da prefeitura, o relato do morador (leve: o mapa
      // de marcar o ponto só é baixado quando o morador pede) e a tela da
      // equipe de campo, feita para o celular.
      input: { index: 'index.html', relatar: 'relatar.html', campo: 'campo.html' },
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': { target: API, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: 'node',
  },
})
