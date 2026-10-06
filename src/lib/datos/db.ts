import Dexie, { type Table } from 'dexie'
import type { Ajuste, ErrorPartida, LineaRepertorio, Partida, Repaso, RepasoLinea } from './tipos.ts'
import type { Usuarios } from './normalizar.ts'

class BaseDatos extends Dexie {
  partidas!: Table<Partida, string>
  errores!: Table<ErrorPartida, string>
  repasos!: Table<Repaso, string>
  ajustes!: Table<Ajuste, string>
  repertorio!: Table<LineaRepertorio, string>
  repasosLineas!: Table<RepasoLinea, string>

  constructor() {
    super('entrenador-ajedrez')
    this.version(1).stores({
      partidas: 'id, fecha, estadoAnalisis, fuente',
      errores: 'id, partidaId, clasificacion, fase, fecha',
      repasos: 'errorId, card.due, creado',
      ajustes: 'clave',
    })
    this.version(2).stores({
      repertorio: 'id, color',
      repasosLineas: 'id, color, card.due',
    })
  }
}

export const db = new BaseDatos()

// Pide al navegador que no borre los datos por falta de espacio (en iOS ayuda instalar la app).
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => undefined)
}

export async function leerAjuste<T>(clave: string, porDefecto: T): Promise<T> {
  const fila = await db.ajustes.get(clave)
  return fila === undefined ? porDefecto : (fila.valor as T)
}

export async function guardarAjuste(clave: string, valor: unknown): Promise<void> {
  await db.ajustes.put({ clave, valor })
}

export const leerUsuarios = () => leerAjuste<Usuarios>('usuarios', {})

export interface Preferencias {
  profundidad: number // profundidad del análisis de fondo
  nuevosPorDia: number
}

export const PREFERENCIAS_INICIALES: Preferencias = { profundidad: 12, nuevosPorDia: 15 }

export async function leerPreferencias(): Promise<Preferencias> {
  return { ...PREFERENCIAS_INICIALES, ...(await leerAjuste<Partial<Preferencias>>('preferencias', {})) }
}
