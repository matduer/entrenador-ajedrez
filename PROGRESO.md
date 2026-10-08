# Progreso del entrenador de ajedrez

Resumen para retomar el trabajo en cualquier sesión. El detalle de métodos y herramientas está en `CLAUDE.md`.

## Orden de trabajo pedido por el usuario (2026-10-07)

1. **Libros**: táctica → problemas con cita del libro; partidas → "Partidas de libros" (si no están ya); finales → módulo de finales; aperturas → explicaciones, siempre verificando con Stockfish.
2. **Finales**.
3. **Aperturas**.

## Estado al 2026-10-08 (mediodía)

### Problemas de libros (Táctica → "Problemas de libros"): 7.941

| Libro | Problemas |
|---|---|
| Polgár, *Chess: 5334 Problems…* (Könemann, 1994) | 5128 |
| Palliser, *The Complete Chess Workout* (Everyman, 2007) | 846 |
| Brennan y Carson, *Tactics Time!* (2012) | 795 |
| Ivashchenko, *Chess School 2* (2002) | 485 |
| Ivashchenko, *Manual of Chess Combinations* vol. 1b (2007) | 255 |
| Reinfeld, *1001 Brilliant Chess Sacrifices and Combinations* (Sterling, 1955) | 208 |
| Yusupov, *Build Up Your Chess: The Fundamentals* (Quality Chess, 2008) | 109 |
| Schloss, *Problemas avanzados: mates en 3, 4 y 5* | 50 |
| Gude, *Problemas de cálculo* (Tutor, 2007) | 38 |
| Rafa C. M., *Curso de ajedrez, Lección 5* | 24 |
| Bondarewsky, *Táctica del medio juego* (Martínez Roca, 1972) | 3 |

**En curso** (verificaciones con Stockfish, guardan avance cada 25 posiciones; si se cortan, relanzar con `REANUDAR=1 TOPE_MS=60000 DEPURAR=1`):
- Mazja, *Chess School 3* (`ivas3`, prefijo `mazja3`, 750 posiciones).
- Polgár, *Middlegame* (Könemann, 1998) (`middle`, prefijo `polgar-middle`, 2166 posiciones con solución leída por OCR).
- Al terminar: revisar `datos-privados/biblioteca/<base>-verif-log.txt`, commitear `public/datos/problemas-libros.json` y actualizar esta tabla.

**Descartados por ahora**: Seneca (PDF se renderiza en blanco), Williams *Improve Your Attacking Chess* (diagramas sin marco), Speelman *Preparación de finales* (falta lector de soluciones en texto corrido), Khmelnitsky *Chess Exam* (opción múltiple), Crouch *Attacking Technique* (no son ejercicios), "chess problems (1).pdf" (es el mismo Polgár).

### Partidas de libros (Mis partidas → "Partidas de libros"): 550
- Polgár: 467 miniaturas. Fischer, *My 60 Memorable Games*: 50 de 60. *Partidas de personajes históricos*: 33 (`scripts/preparar-partidas-personajes.ts`).
- Pendiente: Crouch *Modern Chess: Move by Move*, Rubinstein (Donaldson y Minev), Keres, Kasparov… El OCR tiene las figuras ilegibles; `scripts/lib-ocr-jugadas.ts` reconstruye jugadas, pero todavía no completa ninguna partida de Crouch.

### Finales: 33 temas, 57 posiciones
- Agregados el 2026-10-08: peones separados (cuadrado común), ruptura, carreras (Réti; mate con peones de Silman), torre en séptima, torre delante de su peón en séptima, torre y dos contra torre y uno; dama contra peón de torre con el rey cerca.
- Pendiente: alfil contra caballo (Averbakh); más de Flear y Silman.

### Aperturas: 74 archivos
- 2026-10-08: nuevos Blumenfeld, Vaganian y San Jorge; notas de libros en Moderna (Soltis, Storey), Dos Caballos (Traxler), Gambito de Rey (Falkbeer), Vienesa (Frankenstein-Drácula), Española del Cambio (Héctor), Cuatro Caballos (Halloween), Siciliana (2.a3), Moscú y Rossolimo (Jones), Mexicana (Palliser), Holandesa (McDonald).
- Los libros de aperturas con texto que quedan repiten líneas ya cubiertas con FCO.

## Hoja de ruta (2026-10-08)

Regla de trabajo pedida por el usuario: **si un libro trae un problema, se anota en el registro de abajo, se saltea y se sigue con el siguiente; lo problemático se retoma recién cuando esté hecho todo lo demás.**

### Etapa 1 — Libros
1. ✅ *Partidas de personajes históricos* (ajedrezdeataque.com): 33 partidas.
2. ⏳ Mazja *Chess School 3* y Polgár *Middlegame*: verificación en curso → commitear al terminar.
3. Táctica con texto (soluciones legibles): Franco *El arte del ataque* (problemas con soluciones), Hansen *Mejore su ajedrez posicional* (caps. 11-12, solo los tácticos), Bronstein *El aprendiz de brujo* (40 combinaciones explicadas), Aagaard *Maestría en el cálculo*, Dvoretsky *El arte de maniobrar con las piezas* (solo los de solución forzada).
4. Estudios: Troitzky *360 estudios* (OCR, notación descriptiva).
5. Partidas comentadas: Chernev *Ajedrez lógico, jugada a jugada*, Capablanca *Fundamentos*, Larsen (*Todas las piezas atacan*, *Yo juego para ganar*), Keres (2 tomos), Rubinstein (Donaldson y Minev; *Masterpieces*), Kasparov *Mis geniales predecesores*, Bronstein *Zúrich 1953*, Tal (Hajtun).
6. Libros del registro de problemas (al final de la etapa).

### Etapa 2 — Finales
1. Alfil contra caballo (Averbakh).
2. De la Villa: los capítulos que faltan (Caballo contra peón, Torre contra dos peones, A+P contra A, alfiles de distinto color, T+2P contra T).
3. Keres *Finales prácticos*, Dvoretsky *Endgame Manual*, Chernev *Capablanca's Best Chess Endings* (posiciones de partidas reales).

### Etapa 3 — Aperturas
1. Aguilera *El error en la apertura* (los "por qué no", verificados con Stockfish).
2. Aguilera *El espíritu de la apertura*, Larsen *Teoría y práctica en los juegos abiertos*.
3. Monografías que todavía no se usaron (Bologan Española, Anti-Sicilianas, Pirc, Catalana, Makogonov, Veresov, Londres de Lemos…).

## Registro de problemas (para retomar al final)

| Libro | Problema | Qué haría falta |
|---|---|---|
| Seneca, *Problemas de ajedrez* | El PDF ("compress") se renderiza en blanco | Otra copia del PDF, o rasterizar con otro programa |
| Williams, *Improve Your Attacking Chess* | Diagramas sin marco, casillas oscuras punteadas | Detector de tableros por cuadrícula en vez de por contorno |
| Speelman, *Preparación de finales* | Número de diagrama y solución en texto corrido | Lector de soluciones en prosa («el diagrama 20… 1. f6!!») |
| Crouch, *Modern Chess: Move by Move* | OCR con figuras ilegibles: ninguna partida llega completa al resultado | Mejorar `lib-ocr-jugadas.ts` o leer las figuras como imágenes (como Fischer) |
| *Partidas de personajes históricos* | Alekhine-Prokófiev (Moscú 1914) es con ventaja: 9.Tb1 es ilegal desde la posición inicial | Averiguar qué pieza falta y arrancar desde esa posición |
| Bondarewsky, *Táctica del medio juego* | Escaneo pobre: solo 3 problemas confirmados | Mejor escaneo |

## Para el usuario: qué probar

- Táctica → "Problemas de libros": filtro por libro, cita, jugada alternativa ganadora aceptada.
- Mis partidas → "Partidas de libros": Fischer y Polgár.
- Finales: los temas nuevos.
- Explorador: las aperturas nuevas y las notas con libro citado.
