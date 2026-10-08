# Cómo diseñan las masmorras grandes (investigación) y qué aplicamos

## Ideas clave
1. **Camino principal primero** (Spelunky, Dormans): se elige entrada y meta lejos y se traza
   un camino largo que serpentea; todo lo demás cuelga de ese camino.
2. **Ciclos con propósito, no bucles al azar** (Unexplored / Boris the Brave, Jaquays):
   ruta alternativa, atajo de vuelta a la entrada, llave y cerradura, ruta larga peligrosa vs. corta segura.
3. **Atajos estilo Dark Souls / Zelda**: una puerta que une un punto profundo con uno cercano a
   la entrada; se abre desde el lado profundo. El valor del atajo = tramos que ahorra.
4. **Callejones con propósito**: todo callejón termina en una sala (tesoro, llave, santuario),
   nunca en un pasillo ciego.
5. **Sin espacio desperdiciado** (BSP, Rooms & Mazes de Nystrom): cada zona del mapa es sala,
   pasillo o roca a propósito; los huecos grandes se rellenan con salas o serpientes.
6. **Secciones en serpiente**: "winding percent" de Nystrom, recorridos en zigzag (ida y vuelta)
   y curvas que llenan espacio (Hilbert). Con nuestras reglas, cada vuelta en U se hace con dos
   giros de 45° o con muros internos en una sala (como tu "cuarto laberinto semi-zigzag").
7. **Métricas** para juzgar cada masmorra: largo del camino principal y rodeo (largo / distancia
   directa, ideal 2–4), número de bucles, % de callejones que terminan en sala (ideal 100%),
   ahorro de cada atajo, % de piso usado, hueco vacío más grande.

## Lo que ya hace el generador (🏰 Masmorra)
- Entrada arriba con puerta al borde; camino principal estilo Spelunky hasta la fila de abajo (meta).
- Ramas que crecen hasta ocupar todas las celdas del mapa.
- Atajos: se unen los vecinos cuyo recorrido por el árbol es más largo.
- Callejones: todos terminan en sala. Salas en serpiente: sala 14×14 con dos muros internos y
  puertas en extremos alternos. Salas pegadas pueden no conectarse (rodeo, como tu ejemplo).
- La descripción de cada masmorra trae sus métricas.

## Siguientes pasos posibles
- Ciclos tipados (llave/cerradura, ruta alternativa) y puertas de un solo sentido para los atajos.
- Pasillos en zigzag (serpiente) para rellenar huecos grandes.
- Generar varias y quedarse con la de mejores métricas.

## Mapas y fuentes para mirar
- Dyson Logos, Megadelve: https://dysonlogos.blog/2019/08/22/delve-top-bottom/
- Jaquaying the dungeon (The Alexandrian): https://thealexandrian.net/wordpress/13085/roleplaying-games/jaquaying-the-dungeon
- Generación cíclica de Unexplored: https://80.lv/articles/unexplored-a-game-with-cyclic-dungeon-generation/
- Boris the Brave, reescritura de grafos: https://www.boristhebrave.com/2021/04/02/graph-rewriting/
- Dormans 2010 (misión y espacio): https://www.pcgworkshop.com/archive/dormans2010adventures.pdf
- Nystrom, Rooms and Mazes: https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/
- Generador de Spelunky: https://tinysubversions.com/spelunkyGen/
- Mark Brown, Boss Keys (mazmorras de Zelda): https://zeldauniverse.net/2017/01/26/explore-zelda-dungeon-design-in-mark-browns-youtube-series-boss-keys/
- Métricas para juegos de exploración: https://cs.wellesley.edu/~pmwh/mvmap/papers/meg/metrics_for_exploration_games.pdf
- Megadungeons clásicas: Undermountain, Barrowmaze, Stonehell, Castle Greyhawk, Rappan Athuk.
