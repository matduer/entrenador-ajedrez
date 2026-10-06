# Análisis de tus partidas — avatargs

Sep 21, 2026 · @Mati

Basado en 5940 partidas estándar jugadas entre 2016 y 2026 (5650 en Lichess, 290 en Chess.com).

## Resumen general

Sobre 5940 partidas estándar (se excluyeron 21 de variantes como Racing Kings o posiciones iniciales personalizadas): 55,8% ganadas, 41,8% perdidas, 2,5% tablas.

- **Rating actual en rápidas**: \~1828 (última partida), con un promedio de 1847 en los últimos 3 meses — justo en el rango 1700-1800+ del plan de entrenamiento.
- **Rating actual en blitz**: bastante más bajo, rondando 1440-1480 en los últimos meses. Es una brecha grande frente al rating en rápidas y, como se ve más abajo, coincide con peor manejo del reloj en ese ritmo.
- **Por color**: mejor rendimiento con blancas (57,7% de victorias) que con negras (54,1%).
- **Por ritmo de juego**: clásicas 69,8% de victorias (149 partidas), rápidas 59,5% (3872, el grueso del historial), blitz 47,6% (1789), bullet 28,9% (solo 45 partidas). El rendimiento cae de forma consistente a medida que baja el tiempo disponible.

## Gestión del reloj

Es el hallazgo más claro de todo el historial: **1047 de las 5940 partidas (17,6%) terminaron por bandera** (se acabó el tiempo), y de esas, el jugador perdió el 68% (713 de 1047) contra solo 31% ganadas.

El problema se concentra fuerte en blitz: 562 partidas de blitz terminaron por tiempo, y el 78% de esas se perdieron. En rápidas el patrón se repite pero más suave (452 partidas por tiempo, 56% perdidas).

&#91;embedded content: Lichess + Chess.com, 2016-2026 · partidas terminadas por tiempo\]

Esto no es un problema de nivel de juego sino de reloj: perder por bandera con más frecuencia de la que se gana así indica que, en posiciones donde igual se está jugando bien, el tiempo se administra mal. Es coherente con la caída de rendimiento de rápidas (59,5% de victorias) a blitz (47,6%) del resumen general.

## Patrones de error táctico

*Metodología*: no se contó con un motor de ajedrez en este entorno (sin acceso a internet para instalarlo), así que se reconstruyó cada partida jugada a jugada y se detectaron los momentos donde el balance de material cambia en 3 puntos o más (una pieza menor o más) sin que se recupere en el intercambio inmediato. Es una aproximación a "pieza regalada o cambio perdido", no un análisis de precisión como daría un motor: puede confundir un sacrificio correcto con un error, pero en miles de partidas la tendencia es válida.

Sobre esa base: **el 53% de las partidas tiene al menos un evento de este tipo**, con un promedio de 0,79 por partida. La diferencia entre ganar y perder es marcada: 1,02 eventos por partida en las derrotas contra 0,61 en las victorias, es decir que perder material sin compensar predice bastante bien el resultado.

&#91;embedded content: reconstrucción de material jugada a jugada sobre las 5939 partidas legibles\]

El 75% de estos eventos ocurre en el medio juego, contra 16% en finales y solo 9% en la apertura — el medio juego es, con diferencia, donde más puntos se pierden por cálculo. Un dato llamativo: la tasa de estos eventos por partida se mantuvo casi idéntica a lo largo de los últimos 10 años (entre 0,76 y 0,81 por partida en cada cuarto del historial), a pesar de que el rating subió. Esto sugiere que la mejora vino más de otros factores (aperturas, finales, experiencia) que de una reducción real de errores de cálculo — refuerza que la táctica sea la prioridad número uno del plan de entrenamiento.

## Rendimiento por apertura

El repertorio real (identificado por las jugadas realmente jugadas, no declarado) ya es bastante consistente: con blancas domina 1.e4 (66% de las partidas), y con negras la Francesa contra 1.e4 y la Eslava/Semieslava contra 1.d4. La tabla muestra dónde rinde bien y dónde no:

| Línea | Partidas | Victorias | Derrotas |
| --- | --- | --- | --- |
| Blancas: 1.e4 vs 1...e5 (Abierta/Ruy López) | 796 | 62,6% | 35,7% |
| Blancas: 1.c4 (Inglesa) | 531 | 58,4% | 38,6% |
| Blancas: 1.e4 vs 1...e6 (Francesa) | 203 | 55,2% | 40,4% |
| Blancas: 1.e4 vs 1...c5 (Siciliana) | 352 | 52,8% | 43,2% |
| Blancas: 1.e4 vs 1...c6 (Caro-Kann) | 115 | 45,2% | 51,3% |
| Negras: vs 1.e4 1...e5 (Abierta) | 435 | 57,2% | 40,2% |
| Negras: vs 1.e4 1...e6 (Francesa) | 1498 | 54,6% | 43,1% |
| Negras: vs 1.d4 1...d5 2...c6 (Eslava) | 232 | 52,2% | 46,6% |
| Negras: vs 1.d4 otras con 1...d5 | 473 | 51,6% | 45,0% |
| Negras: vs 1.d4 1...Nf6 (India de Rey) | 111 | 48,6% | 48,6% |

Dos puntos concretos para el plan:

- **Contra la Caro-Kann (blancas)** es la única línea habitual con balance negativo (45,2% vs 51,3%). Vale la pena revisar específicamente el plan contra 3...Bf5/3...c5, que es donde más se repite.
- **Contra 1.d4 (negras)** el rendimiento es sistemáticamente más bajo que contra 1.e4 (48,6%-52,2% contra 54,6%-57,2%), y además se mezclan tres sistemas distintos (Eslava, India de Rey, otras con 1...d5) sin que ninguno domine. Consolidar en uno solo (la Eslava, que ya es la más jugada) en vez de repartir el estudio entre tres, va en línea con el principio de repertorio compacto del plan.

## Evolución del rating

&#91;embedded content: promedio mensual de rating propio por partida, 2016-2026\]

El rating en rápidas subió con fuerza entre 2017 y 2021 (de 1500 a un pico de \~1960) y desde entonces oscila en una meseta amplia, entre 1650 y 1950, sin una tendencia clara de mejora sostenida en los últimos 4-5 años. El rating en blitz sigue un patrón distinto: subió hasta 2020-2021 (\~1770) y desde entonces viene bajando de forma bastante consistente hasta los \~1440-1550 actuales.

Esto encaja con lo visto antes: el estancamiento en rápidas coincide con una tasa de errores tácticos que tampoco mejoró en el mismo período, y la caída en blitz coincide con el mal manejo del reloj en ese ritmo. Ambas cosas apuntan en la misma dirección: el techo actual no es de conocimiento, es de cálculo bajo presión y de reloj.

## Recomendaciones concretas para el plan de entrenamiento

1. **Gestión del reloj (sección "Preparación para torneos")**: subirla de prioridad. El 68% de las partidas perdidas por bandera es el hallazgo más accionable de todo el análisis, sobre todo en blitz. Conviene agregar práctica específica de manejo de reloj (jugar con menos tiempo del habitual a propósito, o partidas con incremento bajo) además de la rápida/clásica ya prevista.
2. **Táctica (sección "Táctica y cálculo")**: los datos confirman que es la prioridad correcta — el medio juego concentra el 75% de las pérdidas de material, y la tasa no mejoró en 10 años pese a subir de rating. Vale la pena que el cuaderno de errores registre explícitamente en qué jugada del medio juego se perdió material, no solo el motivo táctico.
3. **Aperturas (sección "Aperturas y repertorio")**: revisar puntualmente la línea contra la Caro-Kann con blancas (único matchup con balance negativo), y consolidar el repertorio con negras contra 1.d4 en un solo sistema (la Eslava, ya la más jugada) en lugar de repartirlo entre tres.
4. **Seguimiento**: además del rating de táctica online que ya prevé el plan, vale la pena revisar cada 4 semanas cuántas partidas se están perdiendo por tiempo — es una métrica fácil de sacar de Lichess/Chess.com y muy sensible a si la práctica de reloj está funcionando.

Si querés, puedo aplicar estos cuatro puntos directamente sobre el plan de entrenamiento (el otro documento del proyecto) en vez de dejarlos solo acá.
