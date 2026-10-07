# Entrenador de ajedrez

App personal de entrenamiento de ajedrez: partidas propias analizadas con Stockfish, aperturas, táctica y finales. Es una PWA: se instala desde el navegador en el celular o la compu y funciona sin conexión (salvo importar partidas y las consultas opcionales).

**Usarla:** https://matduer.github.io/entrenador-ajedrez/

- **Android (Chrome):** menú ⋮ → "Instalar app" o "Agregar a la pantalla principal".
- **iPhone (Safari):** botón Compartir → "Agregar a inicio". En iOS conviene instalarla: si no, Safari puede borrar los datos de la app tras unas semanas sin usarla.
- **Windows (Chrome o Edge):** ícono de instalar en la barra de direcciones.

## Qué hace

| Sección | Qué tiene |
| --- | --- |
| Partidas | Importa tus partidas de Lichess y Chess.com (solo las nuevas cada vez), las analiza con Stockfish en el dispositivo y muestra estadísticas por apertura, color, fase y **reloj**. |
| Aperturas | Explorador de cualquier apertura con los dos colores, árbol de teoría, Stockfish, "por qué no" automático, repertorio propio (sugerido desde tus partidas), práctica por niveles con repaso espaciado y explicaciones escritas (Caro-Kann, Eslava…). |
| Táctica | Ejercicios armados con tus propios errores y una selección de 4.550 problemas de Lichess, con repaso espaciado. |
| Finales | Temario progresivo con posiciones verificadas, finales mal jugados en tus partidas y editor de posiciones; el rival juega con las tablebases de Lichess (en línea) o Stockfish. |
| Progreso | Dominio por área y lo que toca repasar hoy. Sin rachas ni puntos. |

## Primeros pasos

1. **Ajustes → Usuarios:** cargá tu usuario de Lichess y/o Chess.com.
2. **Partidas → Importar partidas nuevas.** El análisis con Stockfish corre en el dispositivo; se puede pausar.
3. Si ya tenés un análisis previo en formato de respaldo (por ejemplo `analisis-previo.json`), cargalo en **Ajustes → Importar respaldo**: no se vuelve a analizar.

### Pasar los datos entre la compu y el celular

Los datos viven solo en cada dispositivo. En el que tiene los datos: **Ajustes → Exportar respaldo** (baja un `.json`). En el otro: **Ajustes → Importar respaldo**. Se combinan sin pisar el progreso más nuevo, así que se puede repetir cuando haga falta.

## Desarrollo

Requiere Node.js 24.

```bash
npm install
npm run dev
```

### Probar en el celular por Wi-Fi

1. La compu y el celular tienen que estar en la misma red Wi-Fi.
2. En la compu: `npm run dev:red`. La consola muestra una dirección del tipo `http://192.168.0.15:5173` (la línea "Network").
3. Abrí esa dirección en el navegador del celular.
4. Si no carga, Windows puede estar bloqueando el puerto: la primera vez que corre, aceptá el aviso del Firewall de Windows para **redes privadas** (o permití Node.js en "Firewall de Windows Defender → Permitir una aplicación").

Por HTTP en la red local la app **no se puede instalar ni usar sin conexión**, porque el navegador exige HTTPS para el service worker. Para probar la instalación y el modo offline, usá la versión publicada en GitHub Pages: cada `git push` a `main` la actualiza en un par de minutos.

### Scripts

| Comando | Para qué |
| --- | --- |
| `npm run check` | Chequeo de tipos de la app y los scripts. |
| `npm run build` | Build de producción en `dist/`. |
| `npm run aperturas` | Regenera el catálogo de aperturas desde `datos-fuente/aperturas`. |
| `node scripts/preparar-problemas.ts` | Regenera la selección de problemas de Lichess. |
| `node scripts/verificar-explicaciones.ts 18` | Verifica con Stockfish las explicaciones de aperturas. |
| `node scripts/verificar-finales.ts` | Verifica el temario de finales con las tablebases. |
| `node scripts/explorar-posicion.ts "<jugadas UCI>"` | Cuánto pierde cada jugada de una posición (para escribir explicaciones). |

Los scripts que usan Stockfish nativo toman la ruta del ejecutable de la variable `STOCKFISH`.

## Licencia y fuentes

GPL-3.0-or-later. Usa [Stockfish](https://stockfishchess.org/) (GPL), [chessground](https://github.com/lichess-org/chessground) y [chessops](https://github.com/niklasf/chessops) (GPL). Datos: catálogo de aperturas y problemas de Lichess (CC0), tablebases de Lichess. Las explicaciones están redactadas a partir de fuentes abiertas (Wikipedia, Wikilibros), citadas en cada una.
