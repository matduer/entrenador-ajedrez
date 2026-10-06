import type { Card } from 'ts-fsrs'
import type { Clasificacion, Evaluacion } from '../ajedrez/evaluacion.ts'
import type { Fase } from '../ajedrez/fase.ts'
import type { MotivoError, Tema } from '../ajedrez/temas.ts'

export type Fuente = 'lichess' | 'chesscom'
export type Color = 'white' | 'black'
export type Ritmo = 'ultrabullet' | 'bullet' | 'blitz' | 'rapida' | 'clasica' | 'correspondencia'
export type Resultado = 'gano' | 'pierdo' | 'tablas'

/**
 * pendiente: falta analizarla con el motor · analizada: análisis completo hecho en la app ·
 * previo: viene del análisis anterior a la app (solo se analizaron los momentos con pérdida de
 * material, no la partida entera) · omitida: no se analiza (muy corta, variante, etc.).
 */
export type EstadoAnalisis = 'pendiente' | 'analizada' | 'previo' | 'omitida'

export interface Partida {
  id: string // "lichess:abcd1234" | "chesscom:123456789"
  fuente: Fuente
  url?: string
  fecha: number // ms
  ritmo: Ritmo
  control: string // "180+2", "600", "1/86400"
  blancas: string
  negras: string
  eloBlancas?: number
  eloNegras?: number
  miColor: Color
  resultado: Resultado
  porTiempo: boolean
  terminacion?: string
  eco?: string
  apertura?: string
  /** Clasificación propia con el catálogo de aperturas (igual criterio para Lichess y Chess.com). */
  aperturaApp?: { eco: string; familia: string; nombre: string } | null
  jugadas: string[] // UCI estándar
  relojes?: number[] // centésimas de segundo que le quedan al que acaba de mover, una por jugada
  estadoAnalisis: EstadoAnalisis
}

export interface ErrorPartida {
  id: string // `${partidaId}:${ply}`
  partidaId: string
  ply: number // índice en Partida.jugadas de la jugada errónea
  numeroJugada: number
  fen: string // posición antes de mi jugada (el ejercicio)
  jugada: string // lo que jugué (UCI)
  mejor: string // lo que recomienda el motor (UCI)
  lineaMejor: string[]
  refutacion: string[] // mejor línea del rival después de mi jugada
  evalAntes: Evaluacion // desde mi punto de vista, con la mejor jugada
  evalDespues: Evaluacion // desde mi punto de vista, después de mi jugada
  perdida: number // caída de chances de ganar (0 a 2)
  clasificacion: Clasificacion
  fase: Fase
  temas: Tema[] // de la mejor jugada
  motivo: MotivoError[] // cómo castiga el rival mi jugada
  miColor: Color
  fecha: number
  ritmo: Ritmo
  eco?: string
  apertura?: string
  origen: 'previo' | 'app'
}

export interface Repaso {
  errorId: string
  card: Card
  creado: number // primera vez que se vio el ejercicio (para el límite de nuevos por día)
  intentos: number
  aciertos: number
  ultimo?: number
}

/** Una línea de mi repertorio, desde la posición inicial. */
export interface LineaRepertorio {
  id: string // `${color}:${ucis.join(' ')}`
  color: Color
  ucis: string[]
  nombre?: string
  origen: 'manual' | 'partidas' | 'catalogo'
  creada: number
}

/** Repaso espaciado de una línea de apertura practicada (de mi repertorio o del catálogo). */
export interface RepasoLinea {
  id: string // `${color}:${ucis.join(' ')}`
  color: Color
  ucis: string[]
  card: Card
  creado: number
  intentos: number
  aciertos: number
  ultimo?: number
  ultimoBien?: boolean
}

export interface Ajuste {
  clave: string
  valor: unknown
}

export interface Respaldo {
  formato: 'entrenador-ajedrez'
  version: 1
  creado: number
  partidas: Partida[]
  errores: ErrorPartida[]
  repasos: Repaso[]
  ajustes: Ajuste[]
  repertorio?: LineaRepertorio[]
  repasosLineas?: RepasoLinea[]
}
