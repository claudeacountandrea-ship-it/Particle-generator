# Reglas del generador de masmorras (borrador)

Sacadas de las pizarras del editor (`editor/index.html`). Estado: **por confirmar**
con la ronda 2 de ejemplos (`seed_round2.py`).

## Base
- Grid de vértices. Cada vértice conecta con sus 8 vecinos: una pared es un tramo
  recto (E/S) o diagonal (SE/SO) entre dos vecinos.
- Columna = vértice marcado.
- Puerta = tramo de pared existente convertido (las puertas son un subconjunto de las paredes).

## Confirmadas por el usuario
1. **Evitar ángulos de 90°.** Las salas cuadradas llevan **bisel de 2** en cada esquina,
   salvo la esquina que cae sobre una pared compartida con otra sala. Los giros de pasillo
   también llevan bisel (afuera se corta, adentro se rellena). Ancho y largo en paredes
   enteras, nunca media pared.
2. **Puertas al centro** de la pared: si el tramo recto mide un número **par** → puerta de 2;
   si es **impar** → puerta de 1. *(pizarra "¿Así es una puerta?")*
3. **Pasillos de ancho 1 o 2 puertas**, también en diagonal. *(pizarra "Pasillo diagonal")*
4. **Nunca medias puertas**: dos paredes diagonales paralelas (`x-y=c` o `x+y=c`)
   deben estar separadas por un número **par** de `c` (2 → ancho 1, 4 → ancho 2).
   Separación impar = pasillo imposible. *(pizarras "Codo" marcada a evitar, "Pizarra 1" y "Pizarra 2")*
5. **Giro recto → diagonal**: la pared de afuera gira después que la de adentro, de forma que se cumpla la regla 4.
   Con pasillo de 2: la diferencia entre los puntos de giro es 2 → diagonal de 2. *(Pizarra 2)*
6. **No se cruzan diagonales en X** dentro de una celda. *(pizarra marcada a evitar)*
7. **Salas en rombo**: cuadrado girado 45°, lados diagonales **pares** (4 o 6) y en cada
   una de las 4 esquinas una **punta recta de 2**.
11. **Puertas en las paredes, no en el bisel/punta.** Rombo: puertas en sus lados diagonales
   (pasillos diagonales). Cuadrado: puertas en sus lados rectos. El bisel o la punta solo se
   usaría como puerta si no hay otra opción.
12. **Sin pasillos ciegos**: todo pasillo termina en una sala.
13. **Salas en serpiente**: una sala grande dividida por muros internos con puertas en extremos
   alternos, para que haya que zigzaguear. *(pizarra "cuarto laberinto semi-zigzag")*
14. **Salas pegadas sin conexión directa**: comparten pared pero se llega dando la vuelta por un
   pasillo que las rodea. *(pizarra "cuartos separados pero con misma pared")*
15. Pasillos de ancho 1 también valen.
10. **Salas grandes** (10×10, 14×14) y **salas vecinas que comparten pared**, con puerta de 2 al centro.
9. **Paredes cruzadas delimitan el espacio de una pared** (por confirmar cómo se aplica).
8. **Cruces diagonales**: un pasillo diagonal puede tener una rama perpendicular,
   también diagonal. *(pizarra "Dibuja: un cruce de pasillos")*

## Laberinto
Botones **🧩 4×4 / 6×6 / 8×8** en `editor/index.html`. Nodos cada 14 puntos: cruces,
salas cuadradas 10×10 o 14×14 (solo pasillos rectos) o rombos con puntas de 2 (rectos y
diagonales). Las salas de 14 llenan su celda, así que las vecinas comparten pared.
Árbol aleatorio + bucles, pasillos de 2, diagonales nunca cruzadas ni apretadas entre dos
salas. El piso se etiqueta por cuarto de celda (vacío / pasillo / sala n) y cada celda queda
entera o partida por una diagonal, así toda pared es un tramo entero. Zoom ＋ － y ✋ Mover. Revisión: modo **🖍 Marcar piso** con colores error / dudoso / bien.

## Generador de piezas
`editor/index.html` → botón **🎲 Generar ejemplo**: sala cuadrada con bisel o sala en
rombo, 1–2 puertas centradas, pasillos del ancho de la puerta que pueden girar 45°
(regla 5). Valida bordes, cruces en X y que los pasillos no se metan en la sala.

## Preguntas abiertas (ronda 2)
- ¿El pasillo que sale de una puerta tiene el ancho de esa puerta?
- ¿Cuándo va columna en un giro de pasillo?
- ¿Se puede poner puerta en un bisel?
- ¿Las uniones en T necesitan bisel?
- ¿El bisel puede medir 2 o más?

## Correcciones de la gran masmorra
16. **Nada de espacios de 1 entre paredes**: o comparten pared o dejan sitio para pasar (≥ 2).
17. **Una puerta no puede chocar con otra pared**: ni en sus extremos ni en medio.
18. **Columnas apagadas por ahora** (tapaban uniones malas). Más adelante: columnas hechas solo de
   pared (cuadrado, rombo u octógono). Los puntos son minicolumnas en las uniones.
19. La gran masmorra debe ser **ordenada y usar rectas y diagonales**: esqueleto con avenidas
   diagonales desde el gran salón, después el relleno.

20. **Objetivo: laberinto de minicuartos** que se recorre adelante/atrás/lados y en diagonal
   (más adelante también arriba/abajo con pisos).
21. **Pasillo de 1 de ancho: solo muy corto**, para pasar a otra zona cercana.

## Laberinto de minicuartos (🧩) y cueva pintada (🕳 → 🏗)
- Mosaico de octágonos (12×12, bisel 4), rombos con puntas de 2 entre cada 4 octágonos y
  pasajes cortos entre octágonos vecinos. Todo comparte pared; no quedan huecos.
- Movimientos: octágono↔octágono por pasaje (recto), rombo↔rombo por pasaje (recto),
  octágono↔rombo por el bisel (diagonal).
- Caminos por crecimiento en profundidad (largos y enroscados, para perderse) + pocos bucles;
  la meta es el octágono más profundo, con un cuarto dentro.
- **Pasillos que rodean salas**: muchos octágonos son una sala octogonal más chica con un pasillo
  anillo alrededor que sigue su forma (2 de ancho en recto, 1 en los diagonales cortos). El anillo
  está cortado en dos mitades por particiones: una compuerta (forma de C, hay que dar la vuelta)
  o ninguna (se cruza por la sala). Los rombos son cruces de pasillo.
- **Cueva pintada**: el jugador pinta con el dedo; se usan solo las piezas que caen sobre la
  pintura, las partes separadas se unen por el camino más corto, la entrada está donde empezó
  a pintar.

## Corrección (salas y pasillos)
22. **Nada de "círculos"**: salas **cuadradas normales con bisel de 1 o 2**, o **rombos** con puntas
   de 1–2. Biseles de 4 o más solo en estructuras especiales. (Se descartó el mosaico de octágonos.)
23. **Pasillos que pasan entre las salas**: serpentean, hacen vueltas/espirales y se ramifican;
   no son anillos alrededor de cada sala.

## Generador actual: 🧩 Salas y pasillos (`salas_y_pasillos.js`)
- Cuadrícula gruesa cada 10 puntos. Salas en casillas: 8×8 (bisel 1), 18×8 o 18×18 (bisel 1–2),
  rombos solo en salas grandes.
- Pasillos de 2 por los bordes de las casillas y en diagonal por casillas libres, crecidos como
  laberinto que prefiere girar (serpiente/espiral) y se ramifica; giros con bisel.
- Cada sala abre a un pasillo vecino; los pasillos que no llevan a ninguna sala se cortan; pocos atajos.
- Lo usa también 🏗 Construir sobre la cueva.

## Particiones en pasadizos
24. **Galerías**: un pasadizo (de 2, o grande de 8) con cuartitos a ambos lados separados por
   paredes nuevas. Cada cuartito abre al pasadizo; algunos tienen otra puerta que sigue en otra
   dirección (hasta 5 salidas); los demás son cámaras para enemigos o premios.
25. **Compuertas**: algunos tramos de pasillo se cierran con una pared con puerta de lado a lado,
   así cada tramo es un minicuarto que se abre para avanzar. Nunca delante de la puerta de una sala.
26. **Vista de piso** (⬛): blanco = piso al que se llega desde la entrada; negro = afuera;
   gris oscuro = encerrado sin acceso (roca maciza o una sala sin puerta).

## (descartado) 🪨 Cueva por pasos (`cueva_por_pasos.js`) — aprovechar todo el espacio
27. **Nada de roca desperdiciada adentro**: la cueva (pintada o excavada por "gusanos") se parte
   entera en cámaras; cada pared separa dos cámaras. Paredes solo rectas o a 45° (distancia de
   tablero de ajedrez entre semillas en puntos pares). Borde de la cueva suavizado.
28. **Se avanza por pasos**: camino principal largo de la entrada (abajo) a la cámara más profunda.
   Algunos pasos tienen **alternativa** (saltar a la cámara siguiente o ir por una cámara lateral que
   vuelve 2–3 pasos después). Cámaras sin salida = premios/enemigos. **Atajos** entre cámaras
   vecinas que estaban lejos por el camino (hasta 3, ahorran 10–30 pasos).
29. Las cámaras largas hacen de tramos de pasillo (sin pasillos que desperdicien espacio).

## Masmorra de salas y pasillos v2 — arquitectura sin espacio perdido
30. **La idea es arquitectura, no cueva** (la cueva por pasos se descartó).
31. **Toda casilla es sala** (chica, doble, grande, rombo o galería). Donde no pasa pasillo las
   salas vecinas llegan a la mitad y **comparten pared**: no queda roca entre salas (~85% de piso).
32. **Bisel solo donde corresponde**: esquinas de sala que dan a un giro/cruce de pasillo llevan
   bisel 1 o 2 (y el pasillo no muestra 90°); esquinas contra otra sala quedan rectas.
33. **Diagonales con propósito**: un pasillo diagonal cruza una casilla reservada y sus dos
   triángulos se suman a las salas vecinas (salas con una pared diagonal), sin triángulos sueltos.
34. **Particiones**: puertas entre salas vecinas (salas en fila), galerías con cuartitos y
   compuertas en pasillos. Toda zona encerrada recibe una puerta: nada queda sin acceso.

## 🏰 Generación grande (botón "Generar masmorra grande")
- Tamaño 8×8 a 16×16 casillas (hasta 167×167 puntos).
- **Forma central**: un gran rombo o una gran sala con bisel 2 en el centro (morado).
- **Sala inicial** (verde): la primera a la que se llega desde la entrada; **sala final** (dorado):
  la más profunda. **Ruta** (azul): el camino real de una a otra, respetando paredes y puertas.
- **Particiones con mínimo y máximo**: toda sala más larga que el máximo se parte con una pared nueva
  con puerta, sin dejar partes más cortas que el mínimo (minicuartos dentro de salas).
- **Particiones por barrios**: no se parte todo. Solo algunos grupos de salas se dividen (zonas de
  minicuartos); el resto quedan salas enteras grandes, para que el plano tenga contraste.
- **Retícula irregular**: columnas y filas de 8, 10, 12 o 14 puntos, así las salas tienen tamaños
  distintos (no todo es la misma cuadrícula). Los pasillos diagonales solo cruzan casillas cuadradas.

## 🔍 Reglas duras (las revisa el botón "Revisar reglas" y la generación grande)
35. **Nada más fino que 2**: ninguna pared puede quedar a 1 de otra pared (ni piso ni roca de 1).
36. **Ningún espacio menor de 4×4**: lo que queda más chico se une a su vecino con más pared en común.
37. **Sin esquinas de 90°**: toda esquina recta se bisela medio cuadro, y toda punta en "V" de dos
   diagonales se aplana con una punta de 2 (el borde del mapa puede quedar recto).
38. **Ninguna puerta toca otra pared**: si una zona no admite una puerta limpia, se une a la zona
   vecina en vez de poner una puerta mala.
- La generación grande prueba hasta 3 veces y se queda con la que rompe menos reglas; el resultado de
  la revisión queda escrito al final de la descripción. 🔍 marca en rojo lo que falle en cualquier dibujo.
39. **Sin filos**: ninguna punta en "V" ni pared a 45° contra otra. Donde la pared compartida entre
   dos salas llega a un pasillo y las dos salas tenían bisel (una "Y" que se mete en el camino), los
   biseles se quitan y queda una **T** limpia (esquina recta permitida porque es pared compartida).
40. **Sin paredes sueltas** dentro de un espacio (pared con el mismo espacio a los dos lados).
41. **Rombos sin anillo**: alrededor de un rombo solo una esquina de su cuadro es pasillo (la entrada);
   las otras esquinas son cuartitos, no una plaza de pasillo que lo rodea.

## 📏 Escala y proporción
42. **1 cuadrado del grid = 2 personas.** Pasillo = 2 cuadrados (caben 4 personas).
43. **Salas con mínimo y máximo** (por defecto 4 a 8 cuadrados de lado). Toda sala mayor que el
   máximo se parte con paredes y puertas en **minicuartos para explorar** (nunca menores que el mínimo).
44. **Sala del jefe** en el centro: la más grande, pero ya no gigantesca (2×2 o 3×3 casillas de la
   retícula fina), con **columnas** de paredes (pilares de 1×1) en dos filas a los lados de una nave
   central, siempre a 2 o más de cualquier pared. Las columnas no cuentan como espacio cerrado ni como esquina.
45. **Equilibrio de formas**: rombos solo de 2×2 casillas (uno chico se ve como octágono), pero
   frecuentes (~1 de cada 10 salas; basta que el cuadro sea casi cuadrado). Pasillos diagonales más
   frecuentes (~10 tramos en 12×12), y sus triángulos sobrantes dan salas con una pared diagonal.
46. **Galerías en diagonal**: un salón a 45° que cruza un bloque de 2×2 o 3×3 casillas de esquina a
   esquina (por ahí se entra), con una fila de cuartitos en cada pared; las paredes entre cuartitos
   son diagonales perpendiculares al salón (una "T" girada, permitida). Los dos triángulos grandes
   que sobran son salas.
47. **Rombos vacíos y grandes**: un rombo no lleva columnas ni particiones; algunos ocupan 3×3 casillas.
   Si la sala del jefe sale rombo, queda vacía; si sale cuadrada, lleva las columnas.
