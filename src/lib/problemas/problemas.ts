import { db, leerPreferencias } from '../datos/db.ts'
import type { Fuente } from '../aperturas/explicaciones.ts'

/**
 * Problema de la base pública de Lichess (CC0): `jugadas[0]` es la jugada del rival que plantea el problema.
 * Problema de un libro: tiene `fuente` y `jugadas[0]` ya es la jugada que hay que encontrar.
 */
export interface Problema {
  id: string
  fen: string
  jugadas: string[]
  rating?: number
  temas: string[]
  fuente?: Fuente
}

export type Origen = 'lichess' | 'libros'
export const esDeLibro = (p: Problema) => p.fuente !== undefined

export const NOMBRE_TEMA: Record<string, string> = {
  hangingPiece: 'Pieza colgada',
  fork: 'Horquilla',
  pin: 'Clavada',
  skewer: 'Enfilada',
  discoveredAttack: 'Ataque descubierto',
  mateIn1: 'Mate en 1',
  mateIn2: 'Mate en 2',
  mateIn3: 'Mate en 3',
  backRankMate: 'Mate en la primera fila',
  deflection: 'Desviación',
  attraction: 'Atracción',
  intermezzo: 'Jugada intermedia',
  xRayAttack: 'Rayos X',
  trappedPiece: 'Pieza atrapada',
  defensiveMove: 'Jugada defensiva',
  quietMove: 'Jugada tranquila',
  sacrifice: 'Sacrificio',
  rookEndgame: 'Final de torres',
  pawnEndgame: 'Final de peones',
  middlegame: 'Medio juego',
  endgame: 'Final',
  opening: 'Apertura',
  advantage: 'Ventaja',
  crushing: 'Decisivo',
  mate: 'Mate',
  short: 'Corto',
  long: 'Largo',
  oneMove: 'Una jugada',
  veryLong: 'Muy largo',
  discoveredCheck: 'Jaque descubierto',
  doubleCheck: 'Jaque doble',
  exposedKing: 'Rey expuesto',
  kingsideAttack: 'Ataque al flanco de rey',
  queensideAttack: 'Ataque al flanco de dama',
  promotion: 'Promoción',
  advancedPawn: 'Peón avanzado',
  capturingDefender: 'Eliminar al defensor',
  interference: 'Interferencia',
  clearance: 'Despeje',
  zugzwang: 'Zugzwang',
  equality: 'Igualdad',
  smotheredMate: 'Mate de la coz',
  anastasiaMate: 'Mate de Anastasia',
  arabianMate: 'Mate árabe',
  bodenMate: 'Mate de Boden',
  hookMate: 'Mate del gancho',
  doubleBishopMate: 'Mate de los dos alfiles',
  dovetailMate: 'Mate de la cola de golondrina',
  queenEndgame: 'Final de damas',
  bishopEndgame: 'Final de alfiles',
  knightEndgame: 'Final de caballos',
  queenRookEndgame: 'Final de dama y torre',
  castling: 'Enroque',
  enPassant: 'Captura al paso',
  underPromotion: 'Subpromoción',
  master: 'Partida de maestros',
  masterVsMaster: 'Maestro contra maestro',
  superGM: 'Súper GM',
  mateIn4: 'Mate en 4',
  mateIn5: 'Mate en 5 o más',
  miniatura: 'Miniatura (partida corta)',
  partidaPolgar: 'Partidas de las hermanas Polgár',
}

/** Temas que se ofrecen como filtro en los problemas de libros. */
export const TEMAS_LIBROS = ['mateIn1', 'mateIn2', 'mateIn3', 'miniatura', 'endgame', 'defensiveMove', 'partidaPolgar']

/** Temas que se ofrecen como filtro (los de la selección). */
export const TEMAS_FILTRO = [
  'hangingPiece',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'backRankMate',
  'deflection',
  'attraction',
  'intermezzo',
  'xRayAttack',
  'trappedPiece',
  'defensiveMove',
  'quietMove',
  'sacrifice',
  'rookEndgame',
  'pawnEndgame',
]

export const nombreTema = (t: string) => NOMBRE_TEMA[t] ?? t

const promesas: Partial<Record<Origen, Promise<Problema[]>>> = {}
/** Problemas de Lichess (`problemas.json`) o de libros (`problemas-libros.json`), cargados una sola vez. */
export function cargarProblemas(origen: Origen = 'lichess'): Promise<Problema[]> {
  promesas[origen] ??= fetch(`${import.meta.env.BASE_URL}datos/${origen === 'lichess' ? 'problemas' : 'problemas-libros'}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Problema[]>) : []))
    .catch(() => [])
  return promesas[origen]!
}

const PREFIJO: Record<Origen, string> = { lichess: 'lichess-problema:', libros: 'libro-problema:' }
export const idRepaso = (p: Problema) => `${PREFIJO[esDeLibro(p) ? 'libros' : 'lichess']}${p.id}`

export interface FiltrosProblemas {
  origen?: Origen
  tema?: string
  /** Solo problemas de libros: título del libro. */
  libro?: string
  ratingMin: number
  ratingMax: number
}

export const FILTROS_PROBLEMAS: FiltrosProblemas = { ratingMin: 1500, ratingMax: 2000 }

function inicioDelDia(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export async function estadoProblemas(f: FiltrosProblemas) {
  const origen = f.origen ?? 'lichess'
  const todos = (await cargarProblemas(origen)).filter(
    (p) =>
      (!f.tema || p.temas.includes(f.tema)) &&
      (!f.libro || p.fuente?.titulo === f.libro) &&
      (origen === 'libros' || ((p.rating ?? 0) >= f.ratingMin && (p.rating ?? 0) <= f.ratingMax)),
  )
  const repasos = await db.repasos.where('errorId').startsWith(PREFIJO[origen]).toArray()
  const porId = new Map(repasos.map((r) => [r.errorId, r]))
  const ahora = Date.now()
  const { nuevosPorDia } = await leerPreferencias()
  const nuevosHoy = Math.max(0, nuevosPorDia - repasos.filter((r) => r.creado >= inicioDelDia()).length)
  const vencidos = todos.filter((p) => {
    const r = porId.get(idRepaso(p))
    return r && new Date(r.card.due).getTime() <= ahora
  })
  const nuevos = todos.filter((p) => !porId.has(idRepaso(p)))
  return { todos, vencidos, nuevos, nuevosHoy, porId }
}

/** Sesión: los vencidos primero (lo fallado vuelve antes) y después nuevos al azar, hasta el límite diario. */
export async function armarSesionProblemas(f: FiltrosProblemas, maximo = 20): Promise<Problema[]> {
  const { vencidos, nuevos, nuevosHoy, porId } = await estadoProblemas(f)
  vencidos.sort((a, b) => new Date(porId.get(idRepaso(a))!.card.due).getTime() - new Date(porId.get(idRepaso(b))!.card.due).getTime())
  const mezcla = [...nuevos].sort(() => Math.random() - 0.5).slice(0, nuevosHoy)
  return [...vencidos, ...mezcla].slice(0, maximo)
}
