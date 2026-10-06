# Entrenador de ajedrez

App personal de entrenamiento de ajedrez: partidas propias analizadas con Stockfish, aperturas, táctica y finales. Es una PWA: se instala desde el navegador en el celular o la compu y funciona sin conexión.

**Usarla:** https://matduer.github.io/entrenador-ajedrez/ → en el celular, menú del navegador → "Instalar app" / "Agregar a pantalla de inicio".

## Desarrollo

Requiere Node.js 24.

```bash
npm install
npm run dev
```

Para probar en un celular conectado a la misma red Wi-Fi: `npm run dev:red` y abrir en el celular la dirección `http://192.168.x.x:5173` que muestra la consola. Por HTTP en la red local la app no se puede instalar ni usar offline (el navegador exige HTTPS); eso se prueba sobre la versión publicada.

## Licencia

GPL-3.0-or-later. Usa Stockfish y chessground (GPL).
