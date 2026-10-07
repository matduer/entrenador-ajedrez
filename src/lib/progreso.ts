import { db } from './datos/db.ts'
import type { Repaso } from './datos/tipos.ts'
import { NIVELES, lineasDelNivel, estadoLineas } from './aperturas/practica.ts'
import { cargarProblemas, idRepaso, nombreTema } from './problemas/problemas.ts'
import temario from '../contenido/finales/temario.json'
import type { Temario } from './finales/tipos.ts'

export interface Fila {
  nombre: string
  practicados: number
  total: number
  aciertos: number
  intentos: number
  vencidos: number
}

const vencido = (r: Pick<Repaso, 'card'>, ahora: number) => new Date(r.card.due).getTime() <= ahora

function fila(nombre: string, total: number, repasos: Repaso[], ahora: number): Fila {
  return {
    nombre,
    total,
    practicados: repasos.length,
    aciertos: repasos.reduce((s, r) => s + r.aciertos, 0),
    intentos: repasos.reduce((s, r) => s + r.intentos, 0),
    vencidos: repasos.filter((r) => vencido(r, ahora)).length,
  }
}

export interface Progreso {
  colaHoy: { tactica: number; problemas: number; aperturas: number; finales: number }
  tacticaPorMotivo: Fila[]
  problemasPorTema: Fila[]
  aperturas: { color: string; lineas: number; niveles: { nombre: string; dominio: number; total: number }[] }[]
  finales: { titulo: string; dominio: number; posiciones: number }[]
}

export async function calcularProgreso(): Promise<Progreso> {
  const ahora = Date.now()
  const [repasos, errores, repertorio, repasosLineas] = await Promise.all([
    db.repasos.toArray(),
    db.errores.filter((e) => e.clasificacion !== 'imprecision').toArray(),
    db.repertorio.toArray(),
    db.repasosLineas.toArray(),
  ])
  const porId = new Map(repasos.map((r) => [r.errorId, r]))

  // Táctica con mis errores, por motivo (cómo me castigaron) o tema de la mejor jugada.
  const grupos = new Map<string, { total: number; repasos: Repaso[] }>()
  for (const e of errores) {
    const motivo = e.motivo[0] ?? e.temas[0] ?? 'sin clasificar'
    if (!grupos.has(motivo)) grupos.set(motivo, { total: 0, repasos: [] })
    const g = grupos.get(motivo)!
    g.total++
    const r = porId.get(e.id)
    if (r) g.repasos.push(r)
  }
  const tacticaPorMotivo = [...grupos].map(([m, g]) => fila(m, g.total, g.repasos, ahora)).sort((a, b) => b.total - a.total)

  // Problemas de Lichess y de libros, por tema.
  const problemas = [...(await cargarProblemas('lichess')), ...(await cargarProblemas('libros'))]
  const repProblemas = repasos.filter((r) => r.errorId.startsWith('lichess-problema:') || r.errorId.startsWith('libro-problema:'))
  const temaDe = new Map(problemas.map((p) => [idRepaso(p), p.temas]))
  const porTema = new Map<string, Repaso[]>()
  for (const r of repProblemas) {
    for (const t of temaDe.get(r.errorId) ?? []) {
      if (['short', 'long', 'oneMove', 'veryLong', 'middlegame', 'endgame', 'opening', 'advantage', 'crushing', 'master', 'masterVsMaster', 'superGM', 'mate'].includes(t)) continue
      if (!porTema.has(t)) porTema.set(t, [])
      porTema.get(t)!.push(r)
    }
  }
  const problemasPorTema = [...porTema]
    .map(([t, rs]) => fila(nombreTema(t), problemas.filter((p) => p.temas.includes(t)).length, rs, ahora))
    .sort((a, b) => b.intentos - a.intentos)

  // Aperturas: dominio por nivel del repertorio de cada color.
  const aperturas = []
  for (const color of ['white', 'black'] as const) {
    const lineas = repertorio.filter((l) => l.color === color).map((l) => l.ucis)
    const niveles = []
    if (lineas.length) {
      for (const n of NIVELES) {
        const e = await estadoLineas(color, lineasDelNivel(lineas, n.plies, color))
        niveles.push({ nombre: `${n.nivel}. ${n.nombre}`, dominio: e.dominio, total: e.total })
      }
    }
    aperturas.push({ color: color === 'white' ? 'Blancas' : 'Negras', lineas: lineas.length, niveles })
  }

  // Finales del temario.
  const finales = (temario as Temario).temas.map((t) => {
    const logradas = t.posiciones.filter((p) => {
      const r = porId.get(`final:${t.id}/${p.id}`)
      return r && !vencido(r, ahora)
    }).length
    return { titulo: t.titulo, dominio: logradas / t.posiciones.length, posiciones: t.posiciones.length }
  })

  const errorIds = new Set(errores.map((e) => e.id))
  return {
    colaHoy: {
      tactica: repasos.filter((r) => errorIds.has(r.errorId) && vencido(r, ahora)).length,
      problemas: repProblemas.filter((r) => vencido(r, ahora)).length,
      aperturas: repasosLineas.filter((r) => vencido(r, ahora)).length,
      finales: repasos.filter((r) => r.errorId.startsWith('final') && vencido(r, ahora)).length,
    },
    tacticaPorMotivo,
    problemasPorTema,
    aperturas,
    finales,
  }
}
