/**
 * Carga módulos de la app desde Node a través de Vite (para que funcionen `import.meta.glob` y
 * `import.meta.env`), y hace que `fetch` de rutas relativas lea de `public/`, como el navegador.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const fetchOriginal = globalThis.fetch
globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
  if (url.startsWith('/')) return new Response(fs.readFileSync(path.join('public', url.split('?')[0])))
  return fetchOriginal(entrada, init)
}) as typeof fetch

const servidor = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

export const cargarModulo = <T>(ruta: string) => servidor.ssrLoadModule(ruta) as Promise<T>
export const cerrarVite = () => servidor.close()
