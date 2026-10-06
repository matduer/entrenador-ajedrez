// Copia Stockfish (versión lite, un solo hilo) de node_modules a public/motor para que Vite lo sirva
// y el service worker lo guarde para usar sin conexión.
import { copyFileSync, mkdirSync } from 'node:fs'

const origen = 'node_modules/stockfish/bin/stockfish-19-lite-single'
mkdirSync('public/motor', { recursive: true })
copyFileSync(`${origen}.js`, 'public/motor/stockfish.js')
copyFileSync(`${origen}.wasm`, 'public/motor/stockfish.wasm')
console.log('Motor copiado a public/motor/')
