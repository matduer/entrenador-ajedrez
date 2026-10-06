import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'
import { db } from '../datos/db.ts'
import type { Color, RepasoLinea } from '../datos/tipos.ts'
import { idLinea } from './repertorio.ts'

/**
 * Niveles de profundidad dentro de una apertura. Se empieza por el esqueleto de la línea y se
 * avanza hacia líneas más largas. Para pasar de nivel: 85 % de las líneas bien en su último
 * repaso y ninguna vencida.
 */
export const NIVELES = [
  { nivel: 1, nombre: 'Esqueleto', plies: 10, descripcion: 'Las primeras 5 jugadas de cada línea.' },
  { nivel: 2, nombre: 'Líneas principales', plies: 14, descripcion: 'Hasta la jugada 7.' },
  { nivel: 3, nombre: 'Ampliado', plies: 20, descripcion: 'Hasta la jugada 10, con más ramas.' },
  { nivel: 4, nombre: 'Completo', plies: 40, descripcion: 'Todas las líneas, hasta el final de la teoría cargada.' },
] as const

export const UMBRAL_DOMINIO = 0.85

/**
 * Recorta las líneas a la profundidad del nivel, de modo que terminen en una jugada propia (si
 * termina con una del rival no queda nada para responder), y saca repetidas y prefijos.
 */
export function lineasDelNivel(lineas: string[][], plies: number, color: Color): string[][] {
  const miParidad = color === 'white' ? 1 : 0 // largo de una línea que termina en jugada propia
  const recortadas = lineas.map((l) => {
    let r = l.slice(0, plies)
    if (r.length % 2 !== miParidad) r = r.slice(0, -1)
    return r
  })
  const unicas = [...new Map(recortadas.filter((l) => l.length > 0).map((l) => [l.join(' '), l])).values()]
  return unicas.filter((l) => !unicas.some((o) => o.length > l.length && o.join(' ').startsWith(l.join(' ') + ' ')))
}

export interface EstadoNivel {
  total: number
  dominadas: number
  vencidas: number
  nuevas: number
  dominio: number
}

export async function estadoLineas(color: Color, lineas: string[][]): Promise<EstadoNivel> {
  const repasos = await db.repasosLineas.bulkGet(lineas.map((l) => idLinea(color, l)))
  const ahora = Date.now()
  const dominadas = repasos.filter((r) => r?.ultimoBien).length
  return {
    total: lineas.length,
    dominadas,
    vencidas: repasos.filter((r) => r && new Date(r.card.due).getTime() <= ahora).length,
    nuevas: repasos.filter((r) => !r).length,
    dominio: lineas.length ? dominadas / lineas.length : 0,
  }
}

/** Nivel alcanzado: el primero que todavía no está dominado (o el último). */
export async function nivelActual(color: Color, todas: string[][]): Promise<number> {
  for (const n of NIVELES) {
    const e = await estadoLineas(color, lineasDelNivel(todas, n.plies, color))
    if (e.dominio < UMBRAL_DOMINIO || e.vencidas > 0) return n.nivel
  }
  return NIVELES[NIVELES.length - 1].nivel
}

/** Próxima línea a practicar: primero las vencidas, después las nuevas, después la que hace más que no se ve. */
export async function elegirLinea(color: Color, lineas: string[][]): Promise<string[] | undefined> {
  if (!lineas.length) return undefined
  const repasos = await db.repasosLineas.bulkGet(lineas.map((l) => idLinea(color, l)))
  const ahora = Date.now()
  const conDatos = lineas.map((l, i) => ({ l, r: repasos[i] }))
  const vencidas = conDatos.filter((x) => x.r && new Date(x.r.card.due).getTime() <= ahora)
  if (vencidas.length) return vencidas.sort((a, b) => new Date(a.r!.card.due).getTime() - new Date(b.r!.card.due).getTime())[0].l
  const nuevas = conDatos.filter((x) => !x.r)
  if (nuevas.length) return nuevas[Math.floor(Math.random() * nuevas.length)].l
  return conDatos.sort((a, b) => (a.r!.ultimo ?? 0) - (b.r!.ultimo ?? 0))[0].l
}

const planificador = fsrs({ enable_fuzz: true })

export async function registrarLinea(color: Color, ucis: string[], bien: boolean): Promise<RepasoLinea> {
  const id = idLinea(color, ucis)
  const ahora = new Date()
  const actual = await db.repasosLineas.get(id)
  const base: RepasoLinea = actual ?? { id, color, ucis, card: createEmptyCard(ahora), creado: ahora.getTime(), intentos: 0, aciertos: 0 }
  const { card } = planificador.next(base.card, ahora, bien ? Rating.Good : Rating.Again)
  const r: RepasoLinea = { ...base, card, intentos: base.intentos + 1, aciertos: base.aciertos + (bien ? 1 : 0), ultimo: ahora.getTime(), ultimoBien: bien }
  await db.repasosLineas.put(r)
  return r
}
