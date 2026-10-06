import { createEmptyCard, fsrs, Rating, type Grade } from 'ts-fsrs'
import type { Clasificacion } from '../ajedrez/evaluacion.ts'
import type { Fase } from '../ajedrez/fase.ts'
import { db, leerPreferencias } from '../datos/db.ts'
import type { Color, ErrorPartida, Repaso } from '../datos/tipos.ts'

const planificador = fsrs({ enable_fuzz: true })

export type ResultadoIntento = 'bien' | 'pista' | 'mal'

const NOTA: Record<ResultadoIntento, Grade> = { bien: Rating.Good, pista: Rating.Hard, mal: Rating.Again }

export interface Filtros {
  clasificaciones: Clasificacion[]
  fase?: Fase
  motivo?: string // tema de la mejor jugada o motivo del error
  color?: Color
}

export const FILTROS_INICIALES: Filtros = { clasificaciones: ['grave', 'error'] }

export function cumple(e: ErrorPartida, f: Filtros): boolean {
  if (!f.clasificaciones.includes(e.clasificacion)) return false
  if (f.fase && e.fase !== f.fase) return false
  if (f.color && e.miColor !== f.color) return false
  if (f.motivo) {
    const etiquetas: string[] = [...e.temas, ...e.motivo]
    if (f.motivo === 'sin clasificar' ? etiquetas.length > 0 : !etiquetas.includes(f.motivo)) return false
  }
  return true
}

/** Repasos que no son ejercicios de mis errores (problemas de Lichess, finales). */
export function esOtroRepaso(id: string): boolean {
  return id.startsWith('lichess-problema:') || id.startsWith('final:') || id.startsWith('final-propio:')
}

function inicioDelDia(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export interface EstadoRepaso {
  vencidos: number
  nuevosDisponibles: number
  nuevosHoy: number // cuántos nuevos se pueden empezar todavía hoy
  total: number
}

async function datos(filtros: Filtros) {
  const [errores, repasos] = await Promise.all([db.errores.toArray(), db.repasos.toArray()])
  const porId = new Map(repasos.map((r) => [r.errorId, r]))
  const elegibles = errores.filter((e) => cumple(e, filtros))
  return { elegibles, porId, repasos }
}

export async function estadoRepaso(filtros: Filtros): Promise<EstadoRepaso> {
  const { elegibles, porId, repasos } = await datos(filtros)
  const ahora = Date.now()
  const { nuevosPorDia } = await leerPreferencias()
  // Los problemas de Lichess y los finales comparten la tabla de repasos pero no cuentan para este límite diario.
  const empezadosHoy = repasos.filter((r) => r.creado >= inicioDelDia() && !esOtroRepaso(r.errorId)).length
  return {
    vencidos: elegibles.filter((e) => {
      const r = porId.get(e.id)
      return r && new Date(r.card.due).getTime() <= ahora
    }).length,
    nuevosDisponibles: elegibles.filter((e) => !porId.has(e.id)).length,
    nuevosHoy: Math.max(0, nuevosPorDia - empezadosHoy),
    total: elegibles.length,
  }
}

/**
 * Arma una sesión: primero lo que toca repasar (lo fallado vuelve antes), después ejercicios
 * nuevos hasta el límite diario. Los nuevos van de los errores graves y recientes a los más viejos.
 */
export async function armarSesion(filtros: Filtros, maximo = 20): Promise<ErrorPartida[]> {
  const { elegibles, porId } = await datos(filtros)
  const estado = await estadoRepaso(filtros)
  const ahora = Date.now()
  const vencidos = elegibles
    .filter((e) => {
      const r = porId.get(e.id)
      return r && new Date(r.card.due).getTime() <= ahora
    })
    .sort((a, b) => new Date(porId.get(a.id)!.card.due).getTime() - new Date(porId.get(b.id)!.card.due).getTime())
  const peso = { grave: 0, error: 1, imprecision: 2 }
  const nuevos = elegibles
    .filter((e) => !porId.has(e.id))
    .sort((a, b) => peso[a.clasificacion] - peso[b.clasificacion] || b.fecha - a.fecha)
    .slice(0, estado.nuevosHoy)
  return [...vencidos, ...nuevos].slice(0, maximo)
}

export async function registrarIntento(errorId: string, resultado: ResultadoIntento): Promise<Repaso> {
  const ahora = new Date()
  const actual = await db.repasos.get(errorId)
  const base: Repaso = actual ?? { errorId, card: createEmptyCard(ahora), creado: ahora.getTime(), intentos: 0, aciertos: 0 }
  const { card } = planificador.next(base.card, ahora, NOTA[resultado])
  const repaso: Repaso = {
    ...base,
    card,
    intentos: base.intentos + 1,
    aciertos: base.aciertos + (resultado === 'mal' ? 0 : 1),
    ultimo: ahora.getTime(),
  }
  await db.repasos.put(repaso)
  return repaso
}
