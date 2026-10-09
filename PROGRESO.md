# Progreso del entrenador de ajedrez

Resumen para retomar el trabajo en cualquier sesión. El detalle de métodos y herramientas está en `CLAUDE.md`.

## Orden de trabajo pedido por el usuario (2026-10-07)

1. **Libros**: táctica → problemas con cita del libro; partidas → "Partidas de libros" (si no están ya); finales → módulo de finales; aperturas → explicaciones, siempre verificando con Stockfish.
2. **Finales**.
3. **Aperturas**.

## Estado al 2026-10-08 (mediodía)

### Problemas de libros (Táctica → "Problemas de libros"): 8.911

| Libro | Problemas |
|---|---|
| Polgár, *Chess: 5334 Problems…* (Könemann, 1994) | 5128 |
| Polgár, *Middlegame* (Könemann, 1998) | 505 |
| Palliser, *The Complete Chess Workout* (Everyman, 2007) | 844 |
| Brennan y Carson, *Tactics Time!* (2012) | 795 |
| Ivashchenko, *Chess School 2* (2002) | 485 |
| Mazja, *Chess School 3* (2003) | 348 |
| Ivashchenko, *Manual of Chess Combinations* vol. 1b (2007) | 255 |
| Reinfeld, *1001 Brilliant Chess Sacrifices and Combinations* (Sterling, 1955) | 208 |
| Yusupov, *Build Up Your Chess: The Fundamentals* (Quality Chess, 2008) | 109 |
| Schloss, *Problemas avanzados: mates en 3, 4 y 5* | 49 |
| Gude, *Problemas de cálculo* (Tutor, 2007) | 31 |
| Franco, *El arte del ataque* (Esfera, 2008) | 20 |
| Williams, *Improve Your Attacking Chess* (Gambit, 2004) | 93 |
| Aagaard, *Maestría en el cálculo* (Chessy, 2008) | 15 |
| Rafa C. M., *Curso de ajedrez, Lección 5* | 24 |
| Bondarewsky, *Táctica del medio juego* (Martínez Roca, 1972) | 2 |

**En curso** (verificaciones con Stockfish, guardan avance cada 25 posiciones; si se cortan, relanzar con `REANUDAR=1 TOPE_MS=60000 DEPURAR=1`):
- Al terminar: revisar `datos-privados/biblioteca/<base>-verif-log.txt`, commitear `public/datos/problemas-libros.json` y actualizar esta tabla.

**Descartados por ahora**: Seneca (PDF se renderiza en blanco), Speelman *Preparación de finales* (para el cuestionario completo falta un lector de soluciones en texto corrido; se usan diagramas sueltos transcriptos a mano), Khmelnitsky *Chess Exam* (opción múltiple), Crouch *Attacking Technique* (no son ejercicios), "chess problems (1).pdf" (es el mismo Polgár).

### Partidas de libros (Mis partidas → "Partidas de libros"): 899
- Polgár: 467 miniaturas. Fischer, *My 60 Memorable Games*: 50 de 60. *Partidas de personajes históricos*: 33 (`scripts/preparar-partidas-personajes.ts`). Capablanca, *Fundamentos del ajedrez*: las 14 partidas modelo (`scripts/preparar-partidas-capablanca.ts`). Lenyb, *Defensa de los Dos Caballos: 3750 partidas modelo* (2013): las 335 anteriores a 1950 que no estaban (3 excluidas porque el resultado no cuadra con la posición final) (`scripts/preparar-partidas-lenyb.ts`; las posteriores son casi todas de aficionados). Control: `scripts/verificar-partidas-libros.ts <prefijo>` (en la posición final, el ganador no puede estar peor para Stockfish).
- Pendiente: Crouch *Modern Chess: Move by Move*, Rubinstein (Donaldson y Minev), Keres, Kasparov… El OCR tiene las figuras ilegibles; `scripts/lib-ocr-jugadas.ts` reconstruye jugadas, pero todavía no completa ninguna partida de Crouch.

### Finales: 50 temas, 113 posiciones
- Agregados el 2026-10-08: peones separados (cuadrado común), ruptura, carreras (Réti; mate con peones de Silman), torre en séptima, torre delante de su peón en séptima, torre y dos contra torre y uno; dama contra peón de torre con el rey cerca.
- 2026-10-08 (tarde): alfil contra caballo con un peón (De la Villa, cap. 8): la diagonal larga, el recurso de Lloyd con peón de torre, el rey del color del caballo y el zugzwang con peón en séptima.
- 2026-10-08 (tarde): más De la Villa: torre contra dos peones ligados (cap. 6), el rey cortado (cortes de una y dos columnas con la maniobra de Grigoriev; corte horizontal perfecto e imperfecto, finales 59 a 63) y peones doblados (final 77).
- 2026-10-08 (tarde): Flear, cap. 9: espacio y tiempo de reserva (Ivanov-Pereira Figueroa: con 1.h3? se pasa de +4,4 a tablas) y la ruptura 1.g5! de Ekström-Jenni; cap. 11: pasar a un final de peones ganado (1.Tc8!, devolver la calidad, y 4.Rxc4! en lugar de 4.dxc4?, que empata). Las posiciones de los diagramas se transcriben mirando la imagen y se verifican con Stockfish a profundidad 30.
- 2026-10-08 (tarde): Speelman, *Preparación de finales*, cap. 2: recursos de ahogado (diagramas 46 a 48) , cap. 3: «gana el que mueve» (diagrama 83, Schwiede-Sika 1929) y cap. 1: el estudio de Peckover y el jaque a través (diagramas 4 y 5), transcriptos mirando la imagen (el 4, reconstruido desde el texto y confirmado por la tablebase). Los diagramas 49 y 50 se descartaron porque la lectura no cuadraba con el texto del libro.
- 2026-10-08 (tarde): Silman, carreras extrañas (diagramas 213 y 215) y bombas tácticas (171 a 174, la ruptura ...b3! y su prevención 1.b3!).
- 2026-10-08 (noche): Keres, *Finales prácticos* (escaneo; texto por OCR, posiciones transcriptas mirando el diagrama): estudio de Grigoriev y el peón pasado protegido.
- 2026-10-09: Keres, cap. 3: dama y peón en séptima contra dama (diagramas 91, 94 y 95: rey en la esquina, peón central, peón de alfil); cap. 6: caballo y peón contra caballo (Kling 1867, diag. 322 con 3.Cb8+!, Réti 1929 con 1.Cc5! única, y la defensa de Goldenov-Kan 1946 con 5.Rg3! única). Todo con tablebase. El PDF es una transcripción digital con diagramas limpios: no hace falta OCR, se lee mirando la página.
- 2026-10-09: Keres, cap. 5: alfil contra peones (Otten 1892; dos peones ligados, diag. 232, 234 y 234b) y tres posiciones de alfil y peón contra alfil del mismo color (diag. 241, 243, 244). Caps. 4 (torre) y 5.5-5.6 (alfil contra caballo) se saltean: el temario ya cubre esos temas con De la Villa y Silman.
- 2026-10-09: De la Villa, Finales 56 a 58 (defensa de Kling y Horwitz, lado largo con y sin efectividad lejana) y Final 73 (Gligoric-Smyslov 1947, en torre y dos peones contra torre).
- 2026-10-09: Dvoretsky, *Endgame Manual*, cap. 1: el hombro (Schlage-Ahues 1921) y el péndulo. Chernev, *Capablanca's Best Chess Endings*, va al registro: son 60 partidas completas en algebraica larga, mejor como «Partidas de libros».
- Etapa 2 cerrada el 2026-10-09 (los temas que quedan de Dvoretsky, De la Villa y Keres ya están cubiertos en lo esencial; se retoman si hace falta). y de Silman (torre y peón en 4.ª o 5.ª fila, Parte Ocho); De la Villa caps. 11 (T+2P contra T) y 13, y el final 56 (Kling y Horwitz). Hecho también el final 55 (defensa de la primera fila con peón de caballo).

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
2. ✅ Mazja *Chess School 3*: 348 (395 sin solución legible quedaron afuera por no tener una jugada única y decisiva). ✅ Polgár *Middlegame*: 505 de 2166. En este escaneo las damas negras están impresas huecas, como las blancas: se descartaron las lecturas con dos damas del mismo bando (286 aceptados mal leídos, de los que 41 volvieron a confirmarse con una dama por bando) y los 6 con una sola dama (color indecidible). Control de material en todos los libros publicados: 17 mal leídos retirados (Gude 7, Williams 6, *Workout* 2, Schloss 1, Bondarewsky 1; `img/excluidos_material.json`).
3. ✅ Franco *El arte del ataque*: 20 de 73 (`franco.py`: diagramas JBIG2 sin rayado por apertura morfológica; la mayoría de sus problemas son de plan, no de golpe táctico). Siguen, con texto:  Hansen *Mejore su ajedrez posicional* (caps. 11-12, solo los tácticos), Bronstein *El aprendiz de brujo* (40 combinaciones explicadas), Aagaard *Maestría en el cálculo*, Dvoretsky *El arte de maniobrar con las piezas* (solo los de solución forzada).
4. Estudios: Troitzky *360 estudios* (OCR, notación descriptiva).
5. Partidas comentadas: ✅ Capablanca *Fundamentos* (14). Siguen: Keres (2 tomos), Rubinstein (Donaldson y Minev; *Masterpieces*), Kasparov *Mis geniales predecesores*, Bronstein *Zúrich 1953*, Tal (Hajtun).
6. Libros del registro de problemas (al final de la etapa). ✅ Williams *Improve Your Attacking Chess*: 99 de 250, cada uno controlado a ojo con `control_visual.py` (la letra leída sobre cada casilla del escaneo); 21 aceptados por el verificador se descartaron por una pieza mal leída (`img/williams_excluir.json`).

### Etapa 2 — Finales ✅ (2026-10-08 a 2026-10-09)
1. ✅ Alfil contra caballo (De la Villa, cap. 8).
2. ⏳ De la Villa: hechos cap. 6, cortes del cap. 10 y peones doblados; faltan T+2P contra T (cap. 11), finales 55-56 y más del cap. 12.
3. Keres *Finales prácticos*, Dvoretsky *Endgame Manual*, Chernev *Capablanca's Best Chess Endings* (posiciones de partidas reales).

### Etapa 3 — Aperturas (en curso)
1. ✅ Larsen *Teoría y práctica en los juegos abiertos* (Española Abierta). Aguilera *El error en la apertura*: al registro de problemas.
2. Aguilera *El espíritu de la apertura*, Larsen *Teoría y práctica en los juegos abiertos*.
3. Monografías que todavía no se usaron (Bologan Española, Anti-Sicilianas, Pirc, Catalana, Makogonov, Veresov, Londres de Lemos…).
   - ✅ 2026-10-09: Catalana (Raetsky y Chetverik, Everyman 2004): 11 notas sobre las sextas jugadas del negro en la Catalana abierta; se descartó su preferencia por 7.0-0 contra 5...b5 6.a4 c6 (Stockfish: pierde 0,16; prefiere 7.Ce5).
   - ✅ Aguilera *El espíritu de la apertura*: una nota en el Letón (7.f3); dos de sus tres afirmaciones concretas no las confirma Stockfish. Las partidas comentadas de la parte III (6, notación descriptiva) quedan para «Partidas de libros».
   - ✅ Rogozenko *Anti-Sicilians: A Guide for Black* (Gambit, 2003; OCR → `textos/rogozenko_antisic.txt`): 2.f4 d5! (Siciliana), el fianchetto contra el Gran Prix con ...Cd4 y ...e6/...d5 (Cerrada), 3.Ac4? Cxe4 y el truco ...d6/...e6 contra 4.g3 (Alapin). Todo confirmado por Stockfish.
   - ✅ Bellin *Queen's Pawn: Veresov System* (Batsford, 1983; OCR → `textos/bellin_veresov.txt`): 7 notas (3...h6 4.Axf6 exf6 5.e3; 3...c6 con 4.Dd2 y 4.f3 Db6; 3...Cbd7 4.e3 e6). Rogozenko suma 3.Cge2 en la Cerrada (Stockfish prefiere 3...Cd4).
   - ✅ Bologan, más notas en la Española: Wormald 5.De2 Ac5 (con 6.Axc6 bxc6 7.Cxe5 0-0!) y el cambio retardado 6.Axc6 dxc6.
   - ✅ Collins *The c3 Sicilian* (Gambit, 2007): 5 notas en la Alapin (5.Cf3 e6 6.cxd4 d6 7.Ac4). Plaskett *Sicilian Grand Prix Attack* (Everyman, 2000): el gambito 6.f5 contra ...g6/...e6, que Stockfish no confirma (pierde 0,11), queda como «por qué no».
   - ✅ Emms *Starting Out: The Scotch Game*: 3 notas (4...Ab4+, 4...Df6) y 3 trampas (5.Ad3?? Cxd4; 5.f3 Ac5 6.Ae3? Cxe4!; el mate de 4...Cge7 5.Cc3 g6? con 10.Ah6#), confirmadas por Stockfish. El PDF no trae la página de créditos: se cita sin año.
   - ✅ Davies *Starting Out: The Modern* (Everyman, 2008): 2.f4 d5!, ...c5 contra los Tres Peones y el esquema ...e6/...Ce7 contra el Austríaco. Su temor a 4...Cc6 5.Ab5 no lo confirma Stockfish (5.Ab5 pierde 0,12), así que no se menciona.
   - ✅ McDonald *Main Line Caro-Kann*: dos celadas (5.De2 Cgf6?? 6.Cd6#; 5.Cg5 h6 6.Ce6! fxe6? 7.Dh5+) y la respuesta 5...Cdf6 a 5.De2. Kotronias *Beating the Caro-Kann*: texto ilegible, la línea ya está cubierta.
   - ✅ Moskalenko *La Defensa Francesa* (Esfera, 2008): 5 notas (5...Ch6 en el Avance, el tornillo de Kortchnoi 4...d4 contra el gambito 4.b4, el Anti-Winawer 4.Cge2, 6...Da5 en la Winawer); tres marcadas `inferior` (Stockfish las ve algo peores, 0,09-0,11).
   - ✅ Cuadernos de Ajedrez (Sistac): Philidor n.º 64 (4...dxe5? de la Hanham, 6.Cg5 imprecisa, ...c5! en la Línea del Cambio) y Dos Caballos n.º 34 (4.Cc3 Cxe4! y la celada 6.Ab5? dxe4 7.Cxe5 Dg5!).
   - ✅ Panjwani *El Dragón Hiperacelerado* (La Casa del Ajedrez, 2019): la trampa 8.Dd2? Cxe4! 9.Cxc6 Dxc3!! (el OCR leía «Cxc3»: se corrigió con Stockfish), su sistema 8.Ab3 a6 y la Breyer 7...Cg4 contra el Maroczy.
   - ✅ Watson *Play the French* (3.ª ed., 2003): las cuartas jugadas alternativas contra la Winawer (4.a3 con el gambito Winckelmann-Riemer, 4.Ad2 con 7...Dxd4!, 4.Dg4, 4.Ad3) como «por qué no» de 4.e5. Watson *Symmetrical English* (1988): casi todo variantes sin prosa y texto sucio; pendiente.
   - ✅ Janjgava *The Petroff Defence* (Gambit, 2001): celada 3...Cxe4 4.De2 Cf6?? 5.Cc6+, el Cochrane 4.Cxf7 como «por qué no» y 8...Cb4. Anderson *The Portuguese Variation* (1997): 4.f3 y 4...Af5 (`inferior`). Pedersen *The French: Tarrasch Variation* (Gambit, 2005): 7...Dd6 y 3...a6. **Apertura nueva**: Grünfeld con fianchetto / Neo-Grünfeld (`grunfeld-fianchetto.json`, Beliavsky y Mikhalchishin, Cadogan 1998), 7 notas. Karpov *How to Play the English* (30 partidas, figuras perdidas en el OCR) y Reca *Caro-Kann* (1948): pendientes.
   - ✅ Más libros (2026-10-09): Panczyk e Ilczuk *The Cambridge Springs* y EDAMI 5.Af4 (Rehusado), Sepúlveda 1.d4 e5 (Englund: 2.d5?! Ac5!, 3.Af4 g5!?, 4...d6!? y la celada 5.c3?? Dxf4; su 5.Cc3!? contra 4...Db4+ no lo confirma Stockfish), Pinski *The Four Knights* (4.a3), Kosten *The Latvian Gambit Lives!* (Svedenborg 4...d5), Williams *Play the Classical Dutch* (4...Ab4+, 10...e5! y la celada 12.Cxe5??; la partida Bogoljubow-Alekhine 1922 entra en «Partidas de libros»), Danielsen *The Polar Bear System* (Bird, 8.Ca3). Koltanowski *Colle System* (texto con columnas mezcladas) y Kapitaniak *The Polish Defense* (1.d4 b5, no encaja en la raíz 1.b4): pendientes.
   - ✅ Bauer *Play 1...b6* (Owen: 3...Cf6 4.De2, 4.e5? Axg2), Lane *Vienna Game* (5.Cf3 Ae7; Variante Oxford 5.d3 Cxc3) y **apertura nueva: Apertura del Alfil** (`apertura-del-alfil.json`, Lane *The Bishop's Opening Explained*, Batsford 2004; la trampa de la Vienesa espejo 4.Dg4! Df6?! 5.Cd5!). Buckley *Easy Guide to the QGA*: texto en columnas mezcladas, el Aceptado ya está cubierto.
   - ✅ Panczyk y Emms *Archangel and New Archangel* (7.d4 Cxd4!, 7...exd4? 8.e5), Lalic *The Marshall Attack* (Capablanca-Marshall 1918 a «Partidas de libros», 901; su «11...Cf6?!» no lo confirma Stockfish), Gufeld y Stetsko *Caro-Kann: Smyslov System* (7.De2 Cb6!, 7...h6?? 8.Cxf7!). Beim *Understanding the Leningrad Dutch*: sin aporte nuevo frente a McDonald.
   - Inventario 2026-10-09: ~50 aperturas sin libro propio. Con texto: Moskalenko (Francesa), *Play the French*, *Symmetrical English*, Philidor y Italiana (en castellano). OCR en cola: Panjwani (Dragón Hiperacelerado), Petrov, Escandinava, Karpov (Inglesa), Francesa Tarrasch, Benoni, Grünfeld fianchetto, Reca (Caro-Kann).

## Registro de problemas (para retomar al final)

| Libro | Problema | Qué haría falta |
|---|---|---|
| Seneca, *Problemas de ajedrez* | El PDF ("compress") se renderiza en blanco | Otra copia del PDF, o rasterizar con otro programa |
| Speelman, *Preparación de finales* | Número de diagrama y solución en texto corrido | Lector de soluciones en prosa («el diagrama 20… 1. f6!!») |
| Crouch, *Modern Chess: Move by Move* | OCR con figuras ilegibles: ninguna partida llega completa al resultado | Mejorar `lib-ocr-jugadas.ts` o leer las figuras como imágenes (como Fischer) |
| *Partidas de personajes históricos* | Alekhine-Prokófiev (Moscú 1914) es con ventaja: 9.Tb1 es ilegal desde la posición inicial | Averiguar qué pieza falta y arrancar desde esa posición |
| Chernev, *Ajedrez lógico, jugada a jugada* (Diana, 1959) | La notación descriptiva ya se lee (`lib-descriptiva.ts`), pero el OCR rompe la estructura: números de jugada partidos («3_ A4A», «6. '" »), renglones basura entre jugada y jugada; `scripts/preparar-partidas-chernev.ts` no reconstruye ninguna partida | Otra pasada de OCR por columnas, o armar la secuencia con todos los renglones cortos legibles como jugada y dejar que la búsqueda hacia adelante descarte los de los comentarios |
| Larsen, *Todas las piezas atacan* | Figuras ilegibles en el OCR, como Crouch | Lo mismo que Crouch |
| Bronstein, *Zúrich 1953* (CDA 19) | `scripts/preparar-partidas-zurich.ts` (lector con búsqueda hacia adelante para «&» = 5 o 6) todavía da 0 partidas: el OCR confunde c/e y l/1, hay figuras ilegibles («ʥ»), las columnas blancas/negras se separan y el final de cada partida va en prosa, donde el lector se mete en variantes | Corregir el OCR (otra pasada de OCR sobre las páginas, o leer los diagramas) y marcar mejor dónde termina la línea principal |
| Keres, Kasparov, Rubinstein, Tal (partidas comentadas) | Escaneos con figuras ilegibles, mismo problema que Crouch y Larsen | Lo mismo que Crouch |
| Aguilera, *El error en la apertura* (5.ª ed., 1988) | Notación descriptiva con OCR muy ruidoso («NR» por P4R, «%.» por 2., jugadas sueltas como «⁵»), y en dos columnas | `lib-descriptiva.ts` ya lee la notación; falta un OCR mejor de las páginas |
| Tiviakov y Gökbulut, *Rock Solid Chess* (2 tomos) | Es un libro de estrategia (estructuras de peones), no de aperturas: no hay un módulo donde encaje | Un módulo de estrategia o de estructuras |
| *London Pet Line 4...Qxb2* (2025) | No es un libro: es una exportación de partidas rápidas entre bots y jugadores online | — (descartado) |
| Lemos, *The London System* (ICC) | No es un libro: es el folleto de 14 páginas de un curso en video, sin análisis | — (descartado) |
| Bondarewsky, *Táctica del medio juego* | Escaneo pobre: solo 3 problemas confirmados | Mejor escaneo |
| Chernev, *Capablanca's Best Chess Endings* (Dover, 1982) | Son 60 partidas completas, no posiciones de finales sueltas; el texto (OCR del PDF) usa algebraica larga («Nb8-a6») con ruido | Un lector de algebraica larga para pasarlas a «Partidas de libros», junto con las otras partidas comentadas |

## Para el usuario: qué probar

- Táctica → "Problemas de libros": filtro por libro, cita, jugada alternativa ganadora aceptada.
- Mis partidas → "Partidas de libros": Fischer y Polgár.
- Finales: los temas nuevos.
- Explorador: las aperturas nuevas y las notas con libro citado.
