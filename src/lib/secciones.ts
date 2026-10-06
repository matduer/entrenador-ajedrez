export type IdSeccion = 'partidas' | 'aperturas' | 'tactica' | 'finales' | 'progreso' | 'ajustes'

export interface Seccion {
  id: IdSeccion
  titulo: string
  icono: string
  descripcion: string
}

export const SECCIONES: Seccion[] = [
  {
    id: 'partidas',
    titulo: 'Partidas',
    icono: '♟',
    descripcion: 'Importación desde Lichess y Chess.com, errores detectados por Stockfish y estadísticas.',
  },
  {
    id: 'aperturas',
    titulo: 'Aperturas',
    icono: '♞',
    descripcion: 'Explorador de cualquier apertura, mi repertorio, práctica por niveles y explicaciones de por qué sí y por qué no.',
  },
  {
    id: 'tactica',
    titulo: 'Táctica',
    icono: '⚔',
    descripcion: 'Ejercicios a partir de mis propios errores, con repaso espaciado.',
  },
  {
    id: 'finales',
    titulo: 'Finales',
    icono: '♚',
    descripcion: 'Temario progresivo y editor para jugar cualquier final contra Stockfish.',
  },
  {
    id: 'progreso',
    titulo: 'Progreso',
    icono: '◔',
    descripcion: 'Dominio por apertura y tema, y cola de repaso de lo fallado.',
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes',
    icono: '⚙',
    descripcion: 'Usuarios, preferencias y respaldo.',
  },
]
