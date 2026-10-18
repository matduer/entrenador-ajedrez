import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages la app vive en /entrenador-ajedrez/; en desarrollo, en la raíz.
const base = process.env.GITHUB_ACTIONS ? '/entrenador-ajedrez/' : '/'

/**
 * Las explicaciones de aperturas guardan los resultados del verificador de Stockfish, que la app no usa
 * y son más de la mitad del peso: se sacan al armar el paquete (si no, el JS pasa el límite de la PWA).
 */
const sinVerificacion: Plugin = {
  name: 'explicaciones-sin-verificacion',
  enforce: 'pre',
  transform(codigo, id) {
    if (!/[\/]contenido[\/]aperturas[\/][^\/]+\.json$/.test(id)) return
    const e = JSON.parse(codigo)
    delete e.verificacion
    return { code: JSON.stringify(e), map: null }
  },
}

export default defineConfig({
  base,
  plugins: [
    sinVerificacion,
    svelte(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Entrenador de ajedrez',
        short_name: 'Ajedrez',
        description: 'Entrenamiento personal de ajedrez: partidas propias, aperturas, táctica y finales. Funciona sin conexión.',
        lang: 'es-AR',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#1f1d1a',
        theme_color: '#1f1d1a',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Incluye el motor (stockfish.wasm, ~1,7 MB) para que funcione sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
