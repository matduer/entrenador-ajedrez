import type { Fase } from '../ajedrez/fase.ts'
import { cargarCatalogo, clasificar } from '../aperturas/catalogo.ts'
import { db } from '../datos/db.ts'
import type { Color, ErrorPartida, Partida, Ritmo } from '../datos/tipos.ts'

export interface FiltroEstadisticas {
  ritmo?: Ritmo
  desde?: number // ms
  color?: Color
}

export interface Marcador {
  n: number
  gano: number
  tablas: number
  pierdo: number
}

export const puntaje = (m: Marcador) => (m.n ? (m.gano + m.tablas / 2) / m.n : 0)

function sumar(m: Marcador, p: Partida) {
  m.n++
  m[p.resultado]++
}

const vacio = (): Marcador => ({ n: 0, gano: 0, tablas: 0, pierdo: 0 })

/** Clasifica con el catálogo propio las partidas que todavía no tienen apertura asignada (una sola vez). */
export async function completarAperturas(): Promise<void> {
  const faltan = await db.partidas.filter((p) => p.aperturaApp === undefined).toArray()
  if (!faltan.length) return
  const catalogo = await cargarCatalogo()
  for (const p of faltan) {
    const a = clasificar(catalogo, p.jugadas)
    p.aperturaApp = a ? { eco: a.eco, familia: a.familia, nombre: a.nombre } : null
  }
  await db.partidas.bulkPut(faltan)
}

export function filtrar(partidas: Partida[], f: FiltroEstadisticas): Partida[] {
  return partidas.filter(
    (p) => (!f.ritmo || p.ritmo === f.ritmo) && (!f.desde || p.fecha >= f.desde) && (!f.color || p.miColor === f.color),
  )
}

// ——— Resumen ———

export interface Resumen {
  total: Marcador
  blancas: Marcador
  negras: Marcador
  porRitmo: { ritmo: Ritmo; m: Marcador }[]
}

export function resumen(partidas: Partida[]): Resumen {
  const r: Resumen = { total: vacio(), blancas: vacio(), negras: vacio(), porRitmo: [] }
  const ritmos = new Map<Ritmo, Marcador>()
  for (const p of partidas) {
    sumar(r.total, p)
    sumar(p.miColor === 'white' ? r.blancas : r.negras, p)
    if (!ritmos.has(p.ritmo)) ritmos.set(p.ritmo, vacio())
    sumar(ritmos.get(p.ritmo)!, p)
  }
  r.porRitmo = [...ritmos].map(([ritmo, m]) => ({ ritmo, m })).sort((a, b) => b.m.n - a.m.n)
  return r
}

// ——— Aperturas ———

export interface FilaApertura {
  familia: string
  color: Color
  m: Marcador
  errores: number // errores y errores graves en partidas con análisis
  analizadas: number
  variantes: { nombre: string; m: Marcador }[]
}

export function porApertura(partidas: Partida[], errores: ErrorPartida[], minimo = 5): FilaApertura[] {
  const erroresPorPartida = new Map<string, number>()
  for (const e of errores) if (e.clasificacion !== 'imprecision') erroresPorPartida.set(e.partidaId, (erroresPorPartida.get(e.partidaId) ?? 0) + 1)

  const filas = new Map<string, FilaApertura & { _var: Map<string, Marcador> }>()
  for (const p of partidas) {
    const familia = p.aperturaApp?.familia ?? 'Sin clasificar'
    const clave = `${p.miColor}|${familia}`
    let f = filas.get(clave)
    if (!f) filas.set(clave, (f = { familia, color: p.miColor, m: vacio(), errores: 0, analizadas: 0, variantes: [], _var: new Map() }))
    sumar(f.m, p)
    if (p.estadoAnalisis === 'analizada' || p.estadoAnalisis === 'previo') {
      f.analizadas++
      f.errores += erroresPorPartida.get(p.id) ?? 0
    }
    const variante = p.aperturaApp?.nombre ?? familia
    if (!f._var.has(variante)) f._var.set(variante, vacio())
    sumar(f._var.get(variante)!, p)
  }
  return [...filas.values()]
    .filter((f) => f.m.n >= minimo)
    .map(({ _var, ...f }) => ({
      ...f,
      variantes: [..._var].map(([nombre, m]) => ({ nombre, m })).sort((a, b) => b.m.n - a.m.n),
    }))
    .sort((a, b) => b.m.n - a.m.n)
}

// ——— Fases ———

export interface FilaFase {
  fase: Fase
  errores: number
  graves: number
  perdidaMedia: number
}

export function porFase(errores: ErrorPartida[]): FilaFase[] {
  const fases: Fase[] = ['apertura', 'medio', 'final']
  return fases.map((fase) => {
    const es = errores.filter((e) => e.fase === fase && e.clasificacion !== 'imprecision')
    return {
      fase,
      errores: es.length,
      graves: es.filter((e) => e.clasificacion === 'grave').length,
      perdidaMedia: es.length ? es.reduce((s, e) => s + e.perdida, 0) / es.length : 0,
    }
  })
}

// ——— Reloj ———

function baseYIncremento(control: string): [number, number] | undefined {
  if (control.includes('/') || control === '-') return undefined
  const [base, inc] = control.split('+').map(Number)
  return Number.isFinite(base) && base > 0 ? [base, inc || 0] : undefined
}

/** Relojes propios (centésimas) tras cada jugada propia, o undefined si la partida no los tiene. */
function misRelojes(p: Partida): number[] | undefined {
  if (!p.relojes) return undefined
  const desde = p.miColor === 'white' ? 0 : 1
  const r: number[] = []
  for (let i = desde; i < p.relojes.length; i += 2) {
    if (p.relojes[i] < 0) return undefined
    r.push(p.relojes[i])
  }
  return r
}

export interface Reloj {
  partidasConReloj: number
  porTiempo: { ritmo: Ritmo; partidas: number; porTiempo: number; perdidasPorTiempo: number }[]
  /** Fracción media del tiempo inicial que te queda al llegar a cada jugada. */
  restante: { jugada: number; fraccion: number; apurado: number; partidas: number }[]
  /** Segundos medios por jugada, por tramo de la partida. */
  usoPorTramo: { tramo: string; segundos: number; fraccionDeLaBase: number }[]
  mensual: { mes: string; partidas: number; perdidasPorTiempo: number }[]
  /** Tasa de errores según el tiempo que te quedaba (solo partidas con análisis completo). */
  erroresPorReloj: { tramo: string; jugadas: number; errores: number }[]
}

export function reloj(partidas: Partida[], errores: ErrorPartida[]): Reloj {
  const ritmos = new Map<Ritmo, { partidas: number; porTiempo: number; perdidasPorTiempo: number }>()
  for (const p of partidas) {
    if (!ritmos.has(p.ritmo)) ritmos.set(p.ritmo, { partidas: 0, porTiempo: 0, perdidasPorTiempo: 0 })
    const r = ritmos.get(p.ritmo)!
    r.partidas++
    if (p.porTiempo) {
      r.porTiempo++
      if (p.resultado === 'pierdo') r.perdidasPorTiempo++
    }
  }

  const JUGADAS = [10, 15, 20, 25, 30, 40]
  const acum = JUGADAS.map((jugada) => ({ jugada, suma: 0, apurado: 0, partidas: 0 }))
  const tramos = [
    { tramo: 'Jugadas 1-10', desde: 1, hasta: 10, seg: 0, frac: 0, n: 0 },
    { tramo: 'Jugadas 11-25', desde: 11, hasta: 25, seg: 0, frac: 0, n: 0 },
    { tramo: 'Jugadas 26-40', desde: 26, hasta: 40, seg: 0, frac: 0, n: 0 },
    { tramo: 'Jugada 41 en adelante', desde: 41, hasta: 999, seg: 0, frac: 0, n: 0 },
  ]
  const erroresPorId = new Map<string, ErrorPartida>()
  for (const e of errores) if (e.clasificacion !== 'imprecision') erroresPorId.set(e.id, e)
  const buckets = [
    { tramo: 'Más de la mitad del tiempo', min: 0.5, jugadas: 0, errores: 0 },
    { tramo: 'Entre 20 % y 50 %', min: 0.2, jugadas: 0, errores: 0 },
    { tramo: 'Entre 10 % y 20 %', min: 0.1, jugadas: 0, errores: 0 },
    { tramo: 'Menos del 10 %', min: 0, jugadas: 0, errores: 0 },
  ]
  let conReloj = 0

  for (const p of partidas) {
    const bi = baseYIncremento(p.control)
    const mr = misRelojes(p)
    if (!bi || !mr || mr.length < 2) continue
    conReloj++
    const base = bi[0] * 100
    const inc = bi[1] * 100

    for (const a of acum) {
      const r = mr[a.jugada - 1]
      if (r === undefined) continue
      a.partidas++
      a.suma += Math.min(1.5, r / base)
      if (r / base < 0.1) a.apurado++
    }

    let anterior = base
    for (let i = 0; i < mr.length; i++) {
      const usado = Math.max(0, anterior - mr[i] + inc)
      anterior = mr[i]
      const t = tramos.find((t) => i + 1 >= t.desde && i + 1 <= t.hasta)!
      t.seg += usado / 100
      t.frac += usado / base
      t.n++
    }

    // Errores según el reloj antes de pensar la jugada. El análisis previo solo miró las pérdidas
    // de material, así que su tasa absoluta es menor, pero el sesgo es el mismo en todos los tramos
    // de reloj: la comparación entre tramos sigue valiendo.
    if (p.estadoAnalisis === 'analizada' || p.estadoAnalisis === 'previo') {
      const primerPly = p.miColor === 'white' ? 0 : 1
      for (let i = 0; i < mr.length; i++) {
        const antes = i === 0 ? base : mr[i - 1]
        const b = buckets.find((b) => antes / base >= b.min)!
        b.jugadas++
        if (erroresPorId.has(`${p.id}:${primerPly + 2 * i}`)) b.errores++
      }
    }
  }

  const meses = new Map<string, { partidas: number; perdidasPorTiempo: number }>()
  for (const p of partidas) {
    const mes = new Date(p.fecha).toISOString().slice(0, 7)
    if (!meses.has(mes)) meses.set(mes, { partidas: 0, perdidasPorTiempo: 0 })
    const m = meses.get(mes)!
    m.partidas++
    if (p.porTiempo && p.resultado === 'pierdo') m.perdidasPorTiempo++
  }

  return {
    partidasConReloj: conReloj,
    porTiempo: [...ritmos].map(([ritmo, r]) => ({ ritmo, ...r })).sort((a, b) => b.partidas - a.partidas),
    restante: acum.filter((a) => a.partidas).map((a) => ({ jugada: a.jugada, fraccion: a.suma / a.partidas, apurado: a.apurado / a.partidas, partidas: a.partidas })),
    usoPorTramo: tramos.filter((t) => t.n).map((t) => ({ tramo: t.tramo, segundos: t.seg / t.n, fraccionDeLaBase: t.frac / t.n })),
    mensual: [...meses].map(([mes, m]) => ({ mes, ...m })).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12),
    erroresPorReloj: buckets.map(({ tramo, jugadas, errores }) => ({ tramo, jugadas, errores })),
  }
}
