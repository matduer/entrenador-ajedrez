# Entrenador de ajedrez — PWA personal

App de entrenamiento de ajedrez de Mati (Lichess y Chess.com: `avatargs`, GitHub: `matduer`). Código abierto (GPL-3.0), uso personal y para algunos amigos, sin tiendas. Objetivo de juego: **1700-1800 FIDE**.

Contexto del jugador: `docs/contexto/analisis-partidas-avatargs.md` y `docs/contexto/plan-entrenamiento-1700-1800.md`. **Leerlos antes de priorizar contenido.** Resumen: 17,6 % de las partidas terminan por tiempo (68 % perdidas); 75 % de las pérdidas de material, en el medio juego; balance negativo contra la Caro-Kann con blancas; repertorio disperso contra 1.d4.

## Reglas de trabajo

- **Nunca borrar archivos definitivamente**: siempre a la Papelera (`[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')`). Nada de `Remove-Item`.
- Trabajo por etapas; no arrancar una etapa sin aprobación del usuario.
- Commits frecuentes y descriptivos, en español. Identidad: `matduer <160158269+matduer@users.noreply.github.com>` (configurada solo en este repo; el mail real no va al repo).
- Mantener este archivo actualizado (estado y próximos pasos).
- Al cerrar cada etapa: resumen en un documento de Claude (o Notion si no se puede) para retomar desde Chat o Cowork.
- Interfaz en **español rioplatense**.
- **No reanalizar lo ya analizado** (ver "Datos previos").

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataforma | PWA instalable (Android, iOS, Windows 11), una sola base de código, offline salvo importación y consultas opcionales |
| Build / UI | Vite 8 + TypeScript + **Svelte 5** (elegido por el usuario: bundle chico en celular) |
| PWA | `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`: aviso "Hay una versión nueva") |
| Tablero | chessground (GPL) |
| Reglas / PGN | **chessops** (GPL; parseo rápido de miles de PGN, lee `%clk`) en vez de chess.js |
| Motor | Stockfish 17 **lite WASM monohilo** en Web Worker (~7 MB). La versión multihilo necesita COOP/COEP, que GitHub Pages no permite → mejora opcional futura |
| Datos | IndexedDB vía **Dexie**; exportar/importar progreso como archivo para pasar entre dispositivos |
| Repaso espaciado | **ts-fsrs** (FSRS) |
| Hosting | GitHub Pages (`https://matduer.github.io/entrenador-ajedrez/`), deploy con GitHub Actions en cada push a `main`. `base` de Vite = `/entrenador-ajedrez/` solo cuando `GITHUB_ACTIONS` está definido |
| Multiusuario | Nada fijo en el código: usuarios de Lichess/Chess.com en configuración, datos en cada dispositivo |
| Navegación | Rutas por hash (`#/partidas`, `#/aperturas`…): funciona en Pages sin reescrituras |

### Aperturas (decisiones del usuario, importantes)
- **Explorar CUALQUIER apertura con cualquier color** es la prioridad; el repertorio propio es un modo más. Lo mismo para finales: editor de posiciones para jugar cualquier final contra Stockfish, además del temario.
- **Referencia = mejor jugada y lo que juegan los GM, NO lo que juega un 1800.** Las jugadas de ambos lados salen de la base **Masters** de Lichess filtrada por Stockfish (se descartan jugadas de maestro que el motor marca como error claro). Si el motor prefiere otra jugada que la de los GM, se marca. Donde Masters tiene pocas partidas (líneas profundas/raras), se usan las 2-3 mejores de Stockfish, indicando que la fuente es el motor.
- Niveles: profundidad + popularidad **dentro de Masters** + complejidad (cantidad de ramas y "filo": diferencia de evaluación entre la mejor y la segunda jugada con multipv). Nivel 1 = líneas principales de maestros; los altos suman alternativas menos jugadas pero sanas. Para avanzar: ≥ 85 % de acierto y nada vencido en FSRS.
- Las partidas de club se usan **solo** para elegir qué "errores típicos" explicar en el "por qué no"; nunca como respuesta del rival en la práctica.
- **"Por qué sí" y "por qué no"**: ante una jugada incorrecta se muestra cómo se castiga (refutación de Stockfish animada, evaluación antes/después, motivo táctico si se detecta). En líneas con explicación escrita, además texto de "por qué no" para los errores típicos. Igual en táctica y finales.
- Explicaciones escritas: JSON offline, redacción propia, jugadas verificadas con Stockfish, fuentes con enlace, marca "explicación generada, puede contener errores". Fuentes abiertas (Wikilibros, Wikipedia: citar si se adapta); de material con derechos solo ideas. Punto de extensión para generar explicaciones en vivo con una API (futuro).
- Orden de las explicaciones escritas: mezcla de historial + aperturas más jugadas a nivel magistral. Propuesta: Caro-Kann (ambos lados), Eslava, Francesa, 1.e4 e5 (Española/Italiana); después Siciliana, Gambito de Dama, India de Rey, Nimzoindia. El usuario puede cambiarla.
- Explorador de Lichess online: **verificar si requiere token** (probablemente sí desde 2025). Las frecuencias de Masters se precalculan en desarrollo y se guardan como JSON offline.

### Otros
- **Estadísticas de reloj** (aprobadas, etapa 2): tiempo restante en jugadas 15/20/25, % de derrotas por tiempo por ritmo, dónde se gasta tiempo, evolución mensual. Fuente: `%clk` de los PGN.
- Tema táctico automático: detectores heurísticos propios (mate en N, pieza colgada, horquilla, clavada, descubierto, primera fila). Si no se reconoce → "sin clasificar"; nunca inventar etiqueta.
- Problemas de Lichess (CC0): filtrar en desarrollo a ~3.000-5.000 problemas de rating 1500-2100 por tema.

## Datos previos (no repetir el trabajo)

- Partidas: `docs/contexto/partidas/*.pgn` (5.961 partidas Lichess + Chess.com hasta 2026-09-21). **Excluidas de git** (nombres de rivales).
- Análisis Stockfish ya hecho: `D:\Documentos de Mati\Facultad\2025 - 1er cuatrimestre\Ajedrez\Claude Ajedrez\Claude outputs\Stockfish - instalar y analizar\`:
  - `posiciones_completo.json` (posiciones) + `resultados_completo.jsonl` (10.058 líneas: `id`, `engine_bestmove`, `score_type`, `score_value`, `pv`). ~1.536 errores tácticos confirmados (≥150 cp).
  - Ojo: la reorganización pendiente de `Facultad` mueve `2025 - 1er cuatrimestre\Ajedrez` a `2 - Docencia\Ajedrez`. **Verificar la ruta antes de usarla.** En la etapa 1 conviene copiar lo necesario a `datos-privados/` (excluido de git) y transformarlo con un script.

## Etapas

0. ✅ Preparación: repo, esqueleto PWA, licencia, deploy, este archivo.
1. Base + Stockfish offline + importación incremental (Lichess/Chess.com/PGN) + carga del análisis previo + detección de errores + ejercicios de táctica desde mis errores + FSRS + exportar/importar progreso.
2. Mis partidas: estadísticas por apertura/color/fase + **reloj**.
3. Aperturas: explorador de cualquier apertura, repertorio (sugerido desde lo que juego), práctica por niveles, FSRS, por qué sí / por qué no, primeras explicaciones.
4. Táctica general: subconjunto de problemas de Lichess.
5. Finales: temario + editor + finales mal jugados propios + tablebases online opcionales.
6. Progreso y pulido.

## Estado actual (2026-10-06)

- Etapa 0 hecha: Vite + Svelte 5 + TS + vite-plugin-pwa; app con navegación de las 5 secciones (pantallas vacías "en construcción"), aviso de actualización y de modo offline, íconos PNG, tema claro/oscuro, workflow `.github/workflows/deploy.yml`. `npm run check` y `npm run build` sin errores.
- Git y Node 24 LTS instalados con winget en esta máquina. En PowerShell, si `node`/`git` no se encuentran, refrescar el PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.

- Publicada en https://matduer.github.io/entrenador-ajedrez/ (repo público `matduer/entrenador-ajedrez`, Pages con fuente "GitHub Actions"). Primer deploy OK, service worker registrado.
- Resumen de la etapa 0 (documento de Claude): https://claude.ai/code/artifact/5b9365d9-6bcd-4878-bc38-93eb32cf98e6
- Push: la credencial de GitHub quedó guardada en el Git Credential Manager. Si un push desde la herramienta falla por "terminal prompts disabled", abrir una ventana aparte (`Start-Process powershell -NoExit`) con `$env:GCM_INTERACTIVE='auto'` para que el usuario inicie sesión.

## Próximos pasos

1. Etapa 1, previa aprobación del usuario.

## Comandos

- `npm run dev` — desarrollo en la compu (`http://localhost:5173`).
- `npm run dev:red` — expone en la red local para probar en el celular por Wi-Fi (sin service worker: requiere HTTPS o localhost).
- `npm run check` — chequeo de tipos. `npm run build` — build de producción en `dist/`.
