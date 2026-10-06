export type IdSeccion = 'partidas' | 'aperturas' | 'tactica' | 'finales' | 'progreso'

export interface Seccion {
  id: IdSeccion
  titulo: string
  icono: string
  descripcion: string
  etapa: number
}

export const SECCIONES: Seccion[] = [
  {
    id: 'partidas',
    titulo: 'Mis partidas',
    icono: '♟',
    descripcion: 'Importación desde Lichess y Chess.com, errores detectados por Stockfish y estadísticas por apertura y de reloj.',
    etapa: 1,
  },
  {
    id: 'aperturas',
    titulo: 'Aperturas',
    icono: '♞',
    descripcion: 'Explorador de cualquier apertura, mi repertorio, práctica por niveles y explicaciones de por qué sí y por qué no.',
    etapa: 3,
  },
  {
    id: 'tactica',
    titulo: 'Táctica',
    icono: '⚔',
    descripcion: 'Ejercicios a partir de mis propios errores y problemas de la base abierta de Lichess, con repaso espaciado.',
    etapa: 1,
  },
  {
    id: 'finales',
    titulo: 'Finales',
    icono: '♚',
    descripcion: 'Temario progresivo y editor para jugar cualquier final contra Stockfish.',
    etapa: 5,
  },
  {
    id: 'progreso',
    titulo: 'Progreso',
    icono: '◔',
    descripcion: 'Dominio por apertura y tema, y cola de repaso de lo fallado.',
    etapa: 6,
  },
]
