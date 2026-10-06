# Plan de entrenamiento — 1700-1800 ELO FIDE (personalizado)

Sep 21, 2026 · @Mati

Versión del plan original que incorpora los hallazgos del análisis de tus partidas (Doc): mismo esqueleto de 12 semanas, con cuatro ajustes puntuales en manejo del reloj, táctica, aperturas y seguimiento.

## Devolución personal: estilo, progreso y errores

**Progreso a través de los años**: en rápidas, el rating subió con fuerza entre 2017 y 2021 (de 1500 a un pico de \~1960) y desde entonces se mueve en una meseta amplia (1650-1950), sin mejora sostenida en los últimos 4-5 años. En blitz el patrón es distinto y más preocupante: subió hasta 2020-2021 (\~1770) y desde entonces baja de forma consistente hasta los \~1440-1550 actuales. Un dato clave conecta ambas cosas: la tasa de errores tácticos por partida se mantuvo casi idéntica en cada cuarto de los últimos 10 años (entre 0,76 y 0,81 por partida) pese a la suba de rating — la mejora de 2017-2021 vino de otro lado (aperturas, finales, experiencia), no de calcular mejor bajo presión, y por eso la meseta y la caída en blitz no son un retroceso puntual sino la consecuencia de un problema que nunca se resolvió.

**Estilo de juego**: el repertorio (identificado por lo realmente jugado) es clásico y directo. Con blancas, 1.e4 en el 66% de las partidas, con el mejor resultado de todo el repertorio en el juego abierto 1.e4 e5 (62,6% de victorias en 796 partidas). Con negras, sistemas sólidos: la Francesa contra 1.e4 (1498 partidas, la línea más jugada por lejos) y la Eslava contra 1.d4. Los dos peores matchups —Caro-Kann con blancas (45,2% de victorias en 115 partidas, el único negativo) y la India de Rey con negras (48,6%/48,6% en 111 partidas)— son justo los dos sistemas más cerrados y posicionales del repertorio. El patrón es consistente: mejor en posiciones abiertas y de cálculo directo que en estructuras cerradas de maniobra lenta.

**Puntos fuertes**: un récord global sólido (55,8% de victorias en 5.940 partidas de 10 años). El juego abierto con blancas tras 1.e4 e5 es la mayor fortaleza del repertorio. Y algo que confirmó el motor real recién: cuando la jugada táctica se encuentra, el cálculo es correcto — las 20 tácticas y 6 de los 7 mates del estudio de partidas propias resultaron ser objetivamente la mejor jugada según Stockfish. El problema no es la calidad del cálculo cuando se activa, sino la consistencia en activarlo.

**Puntos débiles y errores recurrentes**: el reloj es el hallazgo más accionable de todo el historial — 17,6% de las partidas (1.047) se definen por bandera, y se pierden el 68% de esas, concentrado sobre todo en blitz. Con Stockfish real ya se confirmaron **1.536 errores tácticos reales** (150 centésimas de peón o más) en las partidas propias, con el 75% concentrado en el medio juego (15% en finales, 9% en la apertura) y una mediana de unos 5 peones de evaluación perdidos por error. De esos, **33 fueron ocasiones con mate forzado disponible que no se encontró** — un problema de cerrar partidas ganadas, no de crearlas. A nivel repertorio, Caro-Kann con blancas e India de Rey con negras piden un trabajo aparte.

Esto no cambia las prioridades ya fijadas en este plan (táctica y reloj primero), pero les da más peso: la meseta de rápidas y la caída de blitz de los últimos años se explican, con datos, por el mismo problema de siempre — no por haber empeorado, sino por no haber resuelto nunca el cálculo bajo presión.

## Objetivos y filosofía del plan

Entre 1700 y 1800 FIDE, las mayores pérdidas de puntos no vienen de la falta de teoría sino de errores de cálculo bajo presión, aperturas memorizadas sin comprender los planes que generan, técnica de finales floja y ausencia de un método para revisar las propias partidas. Este plan prioriza, en ese orden: cerrar la brecha táctica (mayor retorno por hora invertida en este rango), construir un repertorio de aperturas compacto y sólido, afianzar finales esenciales y crear el hábito de analizar cada partida jugada.

Está pensado para funcionar en tres formatos a la vez:

- **Grupal**: la reunión semanal del club se usa para lo que rinde más en conjunto — análisis colectivo de partidas, sparring, mini-clases temáticas y puesta en común del trabajo individual.
- **Individual**: el trabajo repetitivo (táctica, finales, estudio de repertorio) se hace solo, al ritmo de cada jugador.
- **Mixto**: las tareas individuales alimentan la sesión grupal (traer partidas propias, dudas de repertorio, posiciones para analizar entre todos).

El ciclo completo dura 12 semanas y es repetible: al cerrar cada ciclo se revisan los números (rating de táctica, resultados de torneo, errores recurrentes) y se ajusta el énfasis del siguiente.

## Estructura general

- **Duración**: ciclos de 12 semanas, repetibles, con una revisión de avances cada 4 semanas.
- **Carga semanal sugerida**: 8-10 horas totales por jugador (5-6 h de trabajo individual + 2-3 h de sesión grupal + partidas jugadas).
- **Fases del ciclo**:
  1. Semanas 1-4: base táctica y finales elementales.
  2. Semanas 5-8: repertorio de aperturas y estrategia de medio juego.
  3. Semanas 9-12: preparación de torneo, simulacros con reloj y consolidación de lo trabajado.

| Modalidad | Frecuencia | Contenido principal |
| --- | --- | --- |
| Grupal (club) | 1 sesión semanal (\~2 h) | Análisis colectivo de partidas, sparring dirigido, mini-clases temáticas |
| Individual | Diaria (45-60 min) | Táctica, estudio de repertorio, finales, análisis de partidas propias |
| Mixto | Antes/después de cada sesión grupal | Tareas individuales que se discuten y corrigen en el grupo |

Cada jugador lleva su propio ritmo dentro de esta estructura; el club aporta el marco común (temas de la semana, partidas para analizar en conjunto) y cada uno ajusta las horas individuales a su disponibilidad.

## Táctica y cálculo

Es el área de mayor prioridad en este rango de ELO. Rutina diaria: 15-20 problemas de dificultad mixta (ajustados al rating táctico propio, no al ELO FIDE), resueltos sin mover piezas y verificados recién al terminar.

> **Ajuste según análisis de partidas propias**: en el historial revisado, el 75% de las pérdidas de material sin compensar ocurre en el medio juego (jugadas 11-30), y esa proporción no mejoró en años de juego. El cuaderno de errores (método, punto 2) debe registrar explícitamente la jugada del medio juego donde se perdió material, no solo el motivo táctico, para poder ver si esa concentración en el medio juego mejora ciclo a ciclo.

**Motivos a dominar**: clavadas, horquillas, ataques descubiertos, desviación, atracción, rayos X (x-ray), jaque intermedio (zwischenzug) y combinaciones de 2-3 jugadas que combinan varios motivos.

**Método**:

1. Resolver visualizando, sin tocar las piezas.
2. Corregir con motor y anotar en un cuaderno de errores, clasificando cada fallo por motivo táctico y por la jugada/fase en la que ocurrió (apertura, medio juego o final), no solo "me equivoqué".
3. Una vez por semana, sesión de "cálculo profundo": 5-8 posiciones complejas, 5-10 minutos cada una, calculando variantes completas antes de mover, priorizando posiciones de medio juego con piezas activas de ambos bandos.

**Seguimiento**: registrar el rating de táctica (Lichess/Chess.com) semana a semana y revisar el cuaderno de errores una vez al mes para ver qué motivos siguen repitiéndose y si la concentración de errores en el medio juego baja respecto al ciclo anterior.

**Recursos**: entrenador de tácticas de Lichess o Chess.com, cursos de Chessable orientados a cálculo, y libros como *Chess Tactics from Scratch* (Emms) o *Tactics Time* (Weeramantry/Eusebi).

## Aperturas y repertorio

En este rango de ELO conviene un repertorio compacto (2-3 sistemas por color) basado en comprender planes y estructuras, no en memorizar variantes largas.

**Construcción del repertorio**:

- Con blancas: un sistema principal frente a las respuestas más comunes (evitar cambiar de apertura cada pocos meses).
- Con negras: una respuesta sólida a 1.e4 y otra a 1.d4, elegidas por afinidad de estilo (posicional vs. táctico) más que por moda.
- Memorizar solo las líneas críticas y forzadas (10-15 jugadas máximo) y entender el porqué de cada una, no solo el orden de jugadas.

> **Ajuste según análisis de partidas propias**: el repertorio real ya es bastante consistente (1.e4 con blancas, Francesa y Eslava con negras). Dos correcciones puntuales que arrojó el análisis: (1) contra la Caro-Kann (blancas) el balance es negativo — conviene revisar específicamente la línea de Avance (3.e5) contra 3...Bf5, que es la más repetida; (2) contra 1.d4 con negras el estudio está repartido entre la Eslava, la India de Rey y otras líneas con 1...d5, sin que ninguna rinda claramente mejor — conviene consolidar en un solo sistema (la Eslava, ya la más jugada) en vez de sostener tres a la vez.

**Método de estudio**: revisar partidas modelo de jugadores fuertes que usan el mismo repertorio, identificar la estructura de peones típica y los planes de cada bando en el medio juego resultante. El repertorio crece de forma orgánica: se agregan líneas nuevas solo cuando aparecen problemas reales en partidas jugadas, no por anticipado.

**Recursos**: estudios de Lichess o cursos de Chessable sobre el sistema elegido, y las propias partidas del club como banco de posiciones para discutir en la sesión grupal.

## Finales

Finales imprescindibles en este nivel:

- **Peones**: oposición, casillas clave, ruptura de peones pasados.
- **Torres**: posición de Lucena, posición de Philidor, corte de rey, torre detrás del peón pasado (propio y del rival).
- **Piezas menores**: finales de alfiles del mismo color y de distinto color, caballo contra alfil, finales básicos de dama.

**Método**: estudiar las posiciones teóricas con repetición espaciada (fichas o un mazo de posiciones que se repasan periódicamente) y después llevarlas a la práctica jugando esas posiciones contra un compañero o un motor. Una vez al mes, dedicar la sesión grupal completa a finales: partidas jugadas en vivo desde posiciones teóricas dadas.

**Recursos**: *100 Endgames You Must Know* (de la Villa) y los capítulos para nivel intermedio-avanzado de *Silman's Complete Endgame Course*.

## Estrategia y medio juego

Áreas de trabajo: evaluación de estructuras de peones (peones aislados, cadenas, ataques de minoría), ubicación de piezas y puestos avanzados, casillas débiles, planificación según la estructura y profilaxis.

**Método**:

- 2-3 partidas magistrales comentadas por semana, con foco en los planes y no solo en las jugadas.
- Ejercicios de "adivina la jugada" contra partidas de jugadores fuertes.
- Sets de ejercicios posicionales (por ejemplo de *Chess Structures* de Mauricio Flores Ríos, o una versión simplificada de *Mi Sistema* de Nimzowitsch para los conceptos básicos).

**En la sesión grupal**: análisis colectivo de una partida instructiva por semana, discutiendo los planes típicos de las estructuras que salen del repertorio del grupo.

## Análisis de las propias partidas

Es el hábito que más acelera la mejora en este nivel y el que más se salta.

**Método, después de cada partida**:

1. Analizarla sin motor primero, anotando los momentos críticos y qué se pensó en cada uno.
2. Recién después revisar con motor para detectar errores graves e imprecisiones.
3. Clasificar cada error en categorías recurrentes: cálculo, manejo del reloj, falta de preparación de apertura, técnica de finales.
4. Llevar todo a un cuaderno de errores que se revisa mensualmente para priorizar el estudio.

Dedicar al menos 30-45 minutos por partida analizada; es preferible analizar pocas partidas a fondo que muchas por encima. Una vez al mes, cada jugador trae una partida propia a la sesión grupal para analizarla en conjunto.

## Preparación para torneos

> **Ajuste según análisis de partidas propias**: el 17,6% de las partidas del historial terminó por bandera, y de esas se perdió el 68% (en blitz, el 78%). Es el hallazgo más accionable de todo el análisis: no es un problema de nivel de juego sino de reloj, así que el manejo del tiempo pasa a ser tan prioritario como la táctica dentro de este bloque.

**Manejo del reloj** (prioridad alta): además de alternar partidas rápidas/blitz (intuición) con partidas a ritmo largo (cálculo profundo), agregar dos hábitos específicos:

- Una vez por semana, jugar 2-3 partidas con menos tiempo del habitual a propósito (por ejemplo, rápida en vez de clásica) para entrenar decisiones rápidas sin perder solidez.
- Revisar en cada partida propia analizada (ver sección "Análisis de las propias partidas") cuánto tiempo quedaba en los momentos clave: si se llega sistemáticamente con poco reloj a la jugada 20-25, el objetivo concreto es jugar las primeras 15 jugadas más rápido (dentro de lo ya preparado en el repertorio) para guardar tiempo para el medio juego.

**Preparación de rivales**: cuando sea posible, revisar rating y estilo del próximo rival antes de la ronda.

**Rutina pre-torneo**: dormir bien, calentar con unos pocos ejercicios tácticos suaves antes de cada ronda, evitar estudiar aperturas nuevas la noche anterior.

**Durante el torneo**: repaso rápido de la partida recién jugada, descanso real entre rondas, cuidar hidratación y comida.

**Preparación psicológica**: tener un plan simple para procesar una derrota sin que contamine la ronda siguiente, y mantenerse objetivo en posiciones incómodas en vez de jugar por inercia o frustración.

Dentro del ciclo de 12 semanas, conviene simular al menos un fin de semana de torneo (semana 10) jugando con ritmo de reloj real para poner en práctica todo lo anterior.

## Rutina semanal sugerida

| Día | Actividad | Duración |
| --- | --- | --- |
| Lunes | Táctica individual (15-20 problemas + repaso de errores) | 45-60 min |
| Martes | Repertorio de aperturas (partidas modelo + líneas propias) | 45-60 min |
| Miércoles | Sesión grupal del club (análisis colectivo, sparring, mini-clase) | \~2 h |
| Jueves | Finales (estudio teórico + posiciones jugadas) | 45-60 min |
| Viernes | Análisis de una partida propia reciente | 45-60 min |
| Sábado/Domingo | Partidas clásicas o rápidas online/torneo + repaso rápido post-partida | Variable |

Esta rutina es una base: cada jugador puede correr días según su disponibilidad, siempre que mantenga el equilibrio semanal entre táctica, aperturas, finales, estrategia y análisis propio.

## Recursos recomendados y seguimiento

**Plataformas**: Lichess y Chess.com (entrenador de tácticas, análisis con motor, partidas por rating), Chessable (cursos de repertorio y finales).

**Libros**: *Chess Tactics from Scratch* (Emms), *Tactics Time* (Weeramantry/Eusebi), *100 Endgames You Must Know* (de la Villa), *Silman's Complete Endgame Course*, *Chess Structures* (Flores Ríos).

**Herramientas de análisis**: un motor gratuito (Stockfish) integrado en Lichess/Chess.com alcanza para el análisis de partidas propias en este nivel.

**Seguimiento del progreso** (revisar cada 4 semanas, al cierre de cada fase del ciclo):

- Evolución del rating de táctica online.
- Resultados y rendimiento en partidas/torneos jugados en el período.
- **Nuevo**: % de partidas perdidas por tiempo (bandera) en el período, separado por ritmo de juego. Es la métrica más sensible a si la práctica de manejo del reloj está funcionando; se puede sacar directamente del historial de Lichess/Chess.com.
- Repaso del cuaderno de errores: ¿qué motivos tácticos o tipos de error siguen repitiéndose, y siguen concentrándose en el medio juego?
- Ajuste del énfasis del próximo ciclo según lo anterior (por ejemplo, más tiempo en finales si siguen apareciendo errores básicos ahí, o más práctica de reloj si el % de partidas perdidas por tiempo no baja).
