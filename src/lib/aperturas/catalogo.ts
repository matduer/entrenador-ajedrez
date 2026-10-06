import { Chess, type Position } from 'chessops/chess'
import { clavePosicion, fenDe, jugadaLegal } from '../ajedrez/posicion.ts'
import type { Apertura, AperturaDatos } from './tipos.ts'

/** Nombres en español de las familias más comunes; el resto queda con el nombre original en inglés. */
const FAMILIAS_ES: Record<string, string> = {
  'Alekhine Defense': 'Defensa Alekhine',
  'Benoni Defense': 'Defensa Benoni',
  'Bird Opening': 'Apertura Bird',
  'Bishop\'s Opening': 'Apertura de alfil',
  'Bogo-Indian Defense': 'Defensa Bogoindia',
  'Caro-Kann Defense': 'Defensa Caro-Kann',
  'Catalan Opening': 'Apertura Catalana',
  'Center Game': 'Partida del centro',
  'Dutch Defense': 'Defensa Holandesa',
  'English Opening': 'Apertura Inglesa',
  'Four Knights Game': 'Partida de los cuatro caballos',
  'French Defense': 'Defensa Francesa',
  'Grünfeld Defense': 'Defensa Grünfeld',
  'Italian Game': 'Partida Italiana',
  'King\'s Gambit': 'Gambito de Rey',
  'King\'s Gambit Accepted': 'Gambito de Rey aceptado',
  'King\'s Gambit Declined': 'Gambito de Rey rehusado',
  'King\'s Indian Attack': 'Ataque Indio de Rey',
  'King\'s Indian Defense': 'Defensa India de Rey',
  'King\'s Pawn Game': 'Apertura de peón de rey',
  'Modern Defense': 'Defensa Moderna',
  'Nimzo-Indian Defense': 'Defensa Nimzoindia',
  'Nimzo-Larsen Attack': 'Ataque Nimzo-Larsen',
  'Old Indian Defense': 'Defensa India Antigua',
  'Petrov\'s Defense': 'Defensa Petrov',
  'Philidor Defense': 'Defensa Philidor',
  'Pirc Defense': 'Defensa Pirc',
  'Queen\'s Gambit Accepted': 'Gambito de Dama aceptado',
  'Queen\'s Gambit Declined': 'Gambito de Dama rehusado',
  'Queen\'s Gambit': 'Gambito de Dama',
  'Queen\'s Indian Defense': 'Defensa India de Dama',
  'Queen\'s Pawn Game': 'Apertura de peón de dama',
  'Réti Opening': 'Apertura Réti',
  'Ruy Lopez': 'Apertura Española',
  'Scandinavian Defense': 'Defensa Escandinava',
  'Scotch Game': 'Apertura Escocesa',
  'Semi-Slav Defense': 'Defensa Semieslava',
  'Sicilian Defense': 'Defensa Siciliana',
  'Slav Defense': 'Defensa Eslava',
  'Three Knights Opening': 'Apertura de los tres caballos',
  'Two Knights Defense': 'Defensa de los dos caballos',
  'Vienna Game': 'Partida Vienesa',
  'Zukertort Opening': 'Apertura Zukertort',
  'London System': 'Sistema Londres',
  'Indian Defense': 'Defensa India',
  'Horwitz Defense': 'Defensa Horwitz',
  'Owen Defense': 'Defensa Owen',
  'Polish Opening': 'Apertura Polaca',
  'Van Geet Opening': 'Apertura Van Geet',
  'Hungarian Opening': 'Apertura Húngara',
  'Trompowsky Attack': 'Ataque Trompowsky',
  'Ponziani Opening': 'Apertura Ponziani',
  'Elephant Gambit': 'Gambito Elefante',
  'Latvian Gambit': 'Gambito Letón',
  'Danish Gambit': 'Gambito Danés',
  'Englund Gambit': 'Gambito Englund',
  'Budapest Defense': 'Defensa Budapest',
  'Benko Gambit': 'Gambito Benko',
  'Tarrasch Defense': 'Defensa Tarrasch',
  'Rat Defense': 'Defensa Rata',
  'Nimzowitsch Defense': 'Defensa Nimzowitsch',
  'Hippopotamus Defense': 'Defensa Hipopótamo',
}

export function familiaEnEspanol(familia: string): string {
  return FAMILIAS_ES[familia] ?? familia
}

export function nombreEnEspanol(a: Pick<Apertura, 'familia' | 'variante'>): string {
  return a.variante ? `${familiaEnEspanol(a.familia)}: ${a.variante}` : familiaEnEspanol(a.familia)
}

export interface Catalogo {
  aperturas: Apertura[]
  porPosicion: Map<string, Apertura>
}

let promesa: Promise<Catalogo> | undefined

function armar(datos: AperturaDatos[]): Catalogo {
  const aperturas: Apertura[] = datos.map((d) => {
    const [familia, variante] = d.nombre.split(/:\s*/, 2)
    return { ...d, familia, variante, ucis: d.jugadas.split(' ') }
  })
  // Cada posición nombrada recibe la línea más corta que llega a ella (las transposiciones
  // conservan el nombre de la primera).
  const porPosicion = new Map<string, Apertura>()
  for (const a of [...aperturas].sort((x, y) => x.ucis.length - y.ucis.length)) {
    const pos: Position = Chess.default()
    for (const uci of a.ucis) {
      const move = jugadaLegal(pos, uci)
      if (!move) break
      pos.play(move)
    }
    const clave = clavePosicion(fenDe(pos))
    if (!porPosicion.has(clave)) porPosicion.set(clave, a)
  }
  return { aperturas, porPosicion }
}

export function cargarCatalogo(): Promise<Catalogo> {
  promesa ??= fetch(`${import.meta.env.BASE_URL}datos/aperturas.json`)
    .then((r) => r.json() as Promise<AperturaDatos[]>)
    .then(armar)
  return promesa
}

/** La apertura con nombre más profunda por la que pasa la partida (como hace Lichess). */
export function clasificar(catalogo: Catalogo, jugadas: string[], maxPlies = 40): Apertura | undefined {
  const pos: Position = Chess.default()
  let ultima: Apertura | undefined
  for (const uci of jugadas.slice(0, maxPlies)) {
    const move = jugadaLegal(pos, uci)
    if (!move) break
    pos.play(move)
    ultima = catalogo.porPosicion.get(clavePosicion(fenDe(pos))) ?? ultima
  }
  return ultima
}
