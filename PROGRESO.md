# Progreso del entrenador de ajedrez

Resumen para retomar el trabajo en cualquier sesión. El detalle de métodos y herramientas está en `CLAUDE.md`.

## Orden de trabajo pedido por el usuario (2026-10-07)

1. **Libros**: táctica → problemas con cita del libro; partidas → "Partidas de libros" (si no están ya); finales → módulo de finales; aperturas → explicaciones, siempre verificando con Stockfish.
2. **Finales**.
3. **Aperturas**.

## Estado al 2026-10-08 (mediodía)

### Problemas de libros (Táctica → "Problemas de libros"): 8.309

| Libro | Problemas |
|---|---|
| Polgár, *Chess: 5334 Problems…* (Könemann, 1994) | 5128 |
| Palliser, *The Complete Chess Workout* (Everyman, 2007) | 846 |
| Brennan y Carson, *Tactics Time!* (2012) | 795 |
| Ivashchenko, *Chess School 2* (2002) | 485 |
| Mazja, *Chess School 3* (2003) | 348 |
| Ivashchenko, *Manual of Chess Combinations* vol. 1b (2007) | 255 |
| Reinfeld, *1001 Brilliant Chess Sacrifices and Combinations* (Sterling, 1955) | 208 |
| Yusupov, *Build Up Your Chess: The Fundamentals* (Quality Chess, 2008) | 109 |
| Schloss, *Problemas avanzados: mates en 3, 4 y 5* | 50 |
| Gude, *Problemas de cálculo* (Tutor, 2007) | 38 |
| Franco, *El arte del ataque* (Esfera, 2008) | 20 |
| Rafa C. M., *Curso de ajedrez, Lección 5* | 24 |
| Bondarewsky, *Táctica del medio juego* (Martínez Roca, 1972) | 3 |

**En curso** (verificaciones con Stockfish, guardan avance cada 25 posiciones; si se cortan, relanzar con `REANUDAR=1 TOPE_MS=60000 DEPURAR=1`):
- Polgár, *Middlegame* (Könemann, 1998) (`middle`, prefijo `polgar-middle`, 2166 posiciones con solución leída por OCR).
- Al terminar: revisar `datos-privados/biblioteca/<base>-verif-log.txt`, commitear `public/datos/problemas-libros.json` y actualizar esta tabla.

**Descartados por ahora**: Seneca (PDF se renderiza en blanco), Williams *Improve Your Attacking Chess* (diagramas sin marco), Speelman *Preparación de finales* (falta lector de soluciones en texto corrido), Khmelnitsky *Chess Exam* (opción múltiple), Crouch *Attacking Technique* (no son ejercicios), "chess problems (1).pdf" (es el mismo Polgár).

### Partidas de libros (Mis partidas → "Partidas de libros"): 899
- Polgár: 467 miniaturas. Fischer, *My 60 Memorable Games*: 50 de 60. *Partidas de personajes históricos*: 33 (`scripts/preparar-partidas-personajes.ts`). Capablanca, *Fundamentos del ajedrez*: las 14 partidas modelo (`scripts/preparar-partidas-capablanca.ts`). Lenyb, *Defensa de los Dos Caballos: 3750 partidas modelo* (2013): las 335 anteriores a 1950 que no estaban (3 excluidas porque el resultado no cuadra con la posición final) (`scripts/preparar-partidas-lenyb.ts`; las posteriores son casi todas de aficionados). Control: `scripts/verificar-partidas-libros.ts <prefijo>` (en la posición final, el ganador no puede estar peor para Stockfish).
- Pendiente: Crouch *Modern Chess: Move by Move*, Rubinstein (Donaldson y Minev), Keres, Kasparov… El OCR tiene las figuras ilegibles; `scripts/lib-ocr-jugadas.ts` reconstruye jugadas, pero todavía no completa ninguna partida de Crouch.

### Finales: 38 temas, 70 posiciones
- Agregados el 2026-10-08: peones separados (cuadrado común), ruptura, carreras (Réti; mate con peones de Silman), torre en séptima, torre delante de su peón en séptima, torre y dos contra torre y uno; dama contra peón de torre con el rey cerca.
- 2026-10-08 (tarde): alfil contra caballo con un peón (De la Villa, cap. 8): la diagonal larga, el recurso de Lloyd con peón de torre, el rey del color del caballo y el zugzwang con peón en séptima.
- 2026-10-08 (tarde): más De la Villa: torre contra dos peones ligados (cap. 6), el rey cortado (cortes de una y dos columnas con la maniobra de Grigoriev; corte horizontal perfecto e imperfecto, finales 59 a 63) y peones doblados (final 77).
- Pendiente: más de Flear y Silman; De la Villa caps. 11 (T+2P contra T) y 13, y el final 56 (Kling y Horwitz). Hecho también el final 55 (defensa de la primera fila con peón de caballo).

### Aperturas: 74 archivos
- 2026-10-08 (tarde): Estrin, *La Defensa de los Dos Caballos*, en los Dos Caballos (Polerio, Bogoljubov, Fritz, Ulvestad).
- 2026-10-08 (tarde): Lakdawala y Hansen, *Makogonov Variation*, en la India de Rey (5.h3).
- 2026-10-08 (tarde): Dembo, *Fighting the Anti-King's Indians*, en el Trompowsky.
- 2026-10-08 (tarde): Sielecki, *Opening Repertoire: Nimzo and Bogo Indian*, en la Nimzoindia y la Bogoindia.
- 2026-10-08 (tarde): Vigus, *The Pirc in Black and White*, en el Ataque Austriaco de la Pirc.
- 2026-10-08 (tarde): trampas de Bologan, *Bologan's Ruy Lopez for Black*, en la Española (Löwenthal-Anderssen, Wormald, 5.d3, Anti-Marshall con 8.d4).
- 2026-10-08 (tarde): notas de Larsen, *Teoría y práctica en los juegos abiertos*, en la Española Abierta (9.c3 con las variantes «italiana» y «Berlín», 9.Cc3?, Ataque Dilworth). Nuevo `scripts/lib-descriptiva.ts`: lee notación descriptiva española con ruido de OCR (restricciones + legalidad + búsqueda hacia adelante).
- 2026-10-08: nuevos Blumenfeld, Vaganian y San Jorge; notas de libros en Moderna (Soltis, Storey), Dos Caballos (Traxler), Gambito de Rey (Falkbeer), Vienesa (Frankenstein-Drácula), Española del Cambio (Héctor), Cuatro Caballos (Halloween), Siciliana (2.a3), Moscú y Rossolimo (Jones), Mexicana (Palliser), Holandesa (McDonald).
- Los libros de aperturas con texto que quedan repiten líneas ya cubiertas con FCO.

## Hoja de ruta (2026-10-08)

Regla de trabajo pedida por el usuario: **si un libro trae un problema, se anota en el registro de abajo, se saltea y se sigue con el siguiente; lo problemático se retoma recién cuando esté hecho todo lo demás.**

### Etapa 1 — Libros
1. ✅ *Partidas de personajes históricos* (ajedrezdeataque.com): 33 partidas.
2. ✅ Mazja *Chess School 3*: 348 (395 sin solución legible quedaron afuera por no tener una jugada única y decisiva). ⏳ Polgár *Middlegame*: verificación en curso → commitear al terminar.
3. ✅ Franco *El arte del ataque*: 20 de 73 (`franco.py`: diagramas JBIG2 sin rayado por apertura morfológica; la mayoría de sus problemas son de plan, no de golpe táctico). Siguen, con texto:  Hansen *Mejore su ajedrez posicional* (caps. 11-12, solo los tácticos), Bronstein *El aprendiz de brujo* (40 combinaciones explicadas), Aagaard *Maestría en el cálculo*, Dvoretsky *El arte de maniobrar con las piezas* (solo los de solución forzada).
4. Estudios: Troitzky *360 estudios* (OCR, notación descriptiva).
5. Partidas comentadas: ✅ Capablanca *Fundamentos* (14). Siguen: Keres (2 tomos), Rubinstein (Donaldson y Minev; *Masterpieces*), Kasparov *Mis geniales predecesores*, Bronstein *Zúrich 1953*, Tal (Hajtun).
6. Libros del registro de problemas (al final de la etapa).

### Etapa 2 — Finales (en curso desde el 2026-10-08 a la tarde)
1. ✅ Alfil contra caballo (De la Villa, cap. 8).
2. ⏳ De la Villa: hechos cap. 6, cortes del cap. 10 y peones doblados; faltan T+2P contra T (cap. 11), finales 55-56 y más del cap. 12.
3. Keres *Finales prácticos*, Dvoretsky *Endgame Manual*, Chernev *Capablanca's Best Chess Endings* (posiciones de partidas reales).

### Etapa 3 — Aperturas (en curso)
1. ✅ Larsen *Teoría y práctica en los juegos abiertos* (Española Abierta). Aguilera *El error en la apertura*: al registro de problemas.
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
| Aagaard, *Maestría en el cálculo* (Chessy, 2008) | 426 diagramas detectados (`CIERRE_EXTRA=9 UMBRAL_EXTRA=200`) y etiquetados (`img/aagaard_etiquetas.json`), pero el clasificador confunde piezas blancas sobre casillas rayadas con casillas vacías, y los ejercicios no tienen solución numerada: sin la jugada del libro, un tablero mal leído podría pasar como problema | Mejor separación vacía/pieza blanca en casillas oscuras, y emparejar cada ejercicio con su solución |
| Chernev, *Ajedrez lógico, jugada a jugada* | Notación descriptiva con OCR roto («A4A», «C5C») | Lector de notación descriptiva |
| Larsen, *Todas las piezas atacan* | Figuras ilegibles en el OCR, como Crouch | Lo mismo que Crouch |
| Bronstein, *Zúrich 1953* (CDA 19) | `scripts/preparar-partidas-zurich.ts` (lector con búsqueda hacia adelante para «&» = 5 o 6) todavía da 0 partidas: el OCR confunde c/e y l/1, hay figuras ilegibles («ʥ»), las columnas blancas/negras se separan y el final de cada partida va en prosa, donde el lector se mete en variantes | Corregir el OCR (otra pasada de OCR sobre las páginas, o leer los diagramas) y marcar mejor dónde termina la línea principal |
| Keres, Kasparov, Rubinstein, Tal (partidas comentadas) | Escaneos con figuras ilegibles, mismo problema que Crouch y Larsen | Lo mismo que Crouch |
| Aguilera, *El error en la apertura* (5.ª ed., 1988) | Notación descriptiva con OCR muy ruidoso («NR» por P4R, «%.» por 2., jugadas sueltas como «⁵»), y en dos columnas | `lib-descriptiva.ts` ya lee la notación; falta un OCR mejor de las páginas |
| Tiviakov y Gökbulut, *Rock Solid Chess* (2 tomos) | Es un libro de estrategia (estructuras de peones), no de aperturas: no hay un módulo donde encaje | Un módulo de estrategia o de estructuras |
| *London Pet Line 4...Qxb2* (2025) | No es un libro: es una exportación de partidas rápidas entre bots y jugadores online | — (descartado) |
| Bondarewsky, *Táctica del medio juego* | Escaneo pobre: solo 3 problemas confirmados | Mejor escaneo |

## Para el usuario: qué probar

- Táctica → "Problemas de libros": filtro por libro, cita, jugada alternativa ganadora aceptada.
- Mis partidas → "Partidas de libros": Fischer y Polgár.
- Finales: los temas nuevos.
- Explorador: las aperturas nuevas y las notas con libro citado.
