import { db } from './db.ts'
import type { Ajuste, ErrorPartida, Partida, Repaso, RepasoLinea, Respaldo } from './tipos.ts'

export async function crearRespaldo(): Promise<Respaldo> {
  return {
    formato: 'entrenador-ajedrez',
    version: 1,
    creado: Date.now(),
    partidas: await db.partidas.toArray(),
    errores: await db.errores.toArray(),
    repasos: await db.repasos.toArray(),
    ajustes: (await db.ajustes.toArray()).filter((a) => a.clave !== 'tokenLichess'),
    repertorio: await db.repertorio.toArray(),
    repasosLineas: await db.repasosLineas.toArray(),
  }
}

export async function descargarRespaldo(): Promise<void> {
  const respaldo = await crearRespaldo()
  const blob = new Blob([JSON.stringify(respaldo)], { type: 'application/json' })
  const fecha = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `entrenador-ajedrez-${fecha}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export interface ResumenImportacion {
  partidasNuevas: number
  erroresNuevos: number
  repasosActualizados: number
}

const RANGO_ESTADO: Record<Partida['estadoAnalisis'], number> = { omitida: 0, pendiente: 1, previo: 2, analizada: 3 }

/** Las fechas de las tarjetas de repaso vuelven como texto del JSON: se reconvierten. */
function revivir<T extends { card: Repaso['card'] }>(r: T): T {
  const card = { ...r.card, due: new Date(r.card.due) }
  if (r.card.last_review) card.last_review = new Date(r.card.last_review)
  return { ...r, card }
}

/**
 * Combina un respaldo con lo que ya hay en este dispositivo, sin pisar progreso más nuevo:
 * se queda con el análisis más completo de cada partida y con el repaso más reciente de cada ejercicio.
 */
export async function importarRespaldo(texto: string): Promise<ResumenImportacion> {
  const datos = JSON.parse(texto) as Respaldo
  if (datos.formato !== 'entrenador-ajedrez') throw new Error('El archivo no es un respaldo de esta app.')
  const resumen: ResumenImportacion = { partidasNuevas: 0, erroresNuevos: 0, repasosActualizados: 0 }

  const tablas = [db.partidas, db.errores, db.repasos, db.ajustes, db.repertorio, db.repasosLineas]
  await db.transaction('rw', tablas, async () => {
    const partidasExistentes = await db.partidas.bulkGet(datos.partidas.map((p) => p.id))
    const partidas: Partida[] = []
    datos.partidas.forEach((p, i) => {
      const actual = partidasExistentes[i]
      if (!actual) resumen.partidasNuevas++
      if (!actual || RANGO_ESTADO[p.estadoAnalisis] > RANGO_ESTADO[actual.estadoAnalisis]) partidas.push(p)
      else if (!actual.relojes && p.relojes) partidas.push({ ...actual, relojes: p.relojes })
    })
    await db.partidas.bulkPut(partidas)

    const erroresExistentes = await db.errores.bulkGet(datos.errores.map((e) => e.id))
    const errores: ErrorPartida[] = []
    datos.errores.forEach((e, i) => {
      const actual = erroresExistentes[i]
      if (!actual) {
        resumen.erroresNuevos++
        errores.push(e)
      } else if (actual.origen === 'previo' && e.origen === 'app') errores.push(e)
    })
    await db.errores.bulkPut(errores)

    const repasosExistentes = await db.repasos.bulkGet(datos.repasos.map((r) => r.errorId))
    const repasos: Repaso[] = []
    datos.repasos.forEach((r, i) => {
      const actual = repasosExistentes[i]
      if (!actual || (r.ultimo ?? 0) > (actual.ultimo ?? 0)) repasos.push(revivir(r))
    })
    await db.repasos.bulkPut(repasos)

    const lineas = datos.repasosLineas ?? []
    const lineasExistentes = await db.repasosLineas.bulkGet(lineas.map((r) => r.id))
    const repasosLineas: RepasoLinea[] = []
    lineas.forEach((r, i) => {
      const actual = lineasExistentes[i]
      if (!actual || (r.ultimo ?? 0) > (actual.ultimo ?? 0)) repasosLineas.push(revivir(r))
    })
    await db.repasosLineas.bulkPut(repasosLineas)
    resumen.repasosActualizados = repasos.length + repasosLineas.length

    // El repertorio se suma: una línea borrada en un dispositivo no se borra en el otro.
    if (datos.repertorio?.length) await db.repertorio.bulkPut(datos.repertorio)

    for (const a of datos.ajustes) await combinarAjuste(a)
  })
  return resumen
}

async function combinarAjuste(a: Ajuste) {
  const actual = await db.ajustes.get(a.clave)
  if (a.clave.startsWith('cursor:')) {
    await db.ajustes.put({ clave: a.clave, valor: Math.max(Number(actual?.valor ?? 0), Number(a.valor ?? 0)) })
  } else if (!actual) {
    await db.ajustes.put(a)
  }
}
