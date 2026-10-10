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
46. **Galerías en diagonal = un rectángulo largo girado 45°** (la avenida), no un cuadro grande.
   Se dibuja entero encima de lo que haya: pasillo de 2 al centro (con puerta a los pasillos en sus
   dos puntas), una fila de cuartitos a cada lado (cada uno una casilla de largo, puerta al pasillo
   central) y la pared exterior una sola diagonal recta que pasa por las esquinas de las casillas
   vecinas. Ningún pasillo recto entra a la avenida por los costados. Va en las grandes diagonales
   del mapa (retícula espejo, casillas iguales ahí), 1–2 por mapa, separada una casilla de la esquina.
   El salón diagonal dentro de un bloque ya no se usa (dejaba triángulos grandes).
47. **Rombos = cuadrados girados, sin triángulos.** Un rombo metido en un cuadro de la retícula
   siempre deja 4 triángulos en las esquinas: ya no se hace. El rombo vive en el medio de cada avenida
   diagonal: el pasillo central se abre en un cuadrado girado tan ancho como la avenida (vacío, grande,
   puntas planas de 2), con puerta a cada mitad del pasillo. La sala del jefe es siempre cuadrada con columnas.
48. **Pasillos diagonales cortos**: un tramo diagonal suelto es de una casilla y luego gira; lo largo
   en diagonal es solo la avenida (3 casillas), y no la cruza ni toca ningún pasillo recto (sus esquinas
   exteriores tampoco llevan pasillo).

49. **Compuertas junto a las puertas**: donde la puerta de una sala da a un pasillo recto de 2, se
   cierra el pasillo justo al lado (a 1 de la puerta, a veces a los dos lados) con una compuerta: una
   pared de 2 a lo ancho que es toda puerta. Ahí se elige: entrar a la sala o abrir la compuerta y
   seguir. La compuerta solo va donde las paredes del pasillo siguen rectas (nada más llega a sus
   puntas), nunca deja un trozo de pasillo menor de 4×4, y el revisor la acepta como puerta buena.
50. **Mapa circular**: el contorno general es un círculo con ondulación suave (orgánico), no el
   cuadrado de la retícula. Tamaño por defecto 16×16 casillas (hay 20×20). Las avenidas diagonales
   se ponen dentro del círculo, entre el borde y la sala del jefe, apuntando al centro.
   La generación grande descarta el intento que deje alguna parte cerrada sin acceso.
51. **Muchas más particiones en los pasillos que rodean las salas**: además de las compuertas junto a
   las puertas (ahora casi siempre), cada tramo recto de pasillo de 8 o más lleva a menudo una
   compuerta a mitad: el pasillo se vuelve una cadena de tramos (~35–40 compuertas en 16×16).
52. **Los pasillos sin salida se aprovechan como cuartos**: un tramo de pasillo que solo lleva a las
   puertas de unas salas se vuelve una **antesala** (cuarto propio, su boca es una puerta a lo ancho del
   pasillo, solo donde las paredes siguen rectas); las salas que daban a él ahora abren a la antesala.
53. La avenida diagonal se recorta al contorno del mapa (no sobresale del círculo).
54. **Mezcla de particiones en los pasillos**: compuertas (pared de 2 que es toda puerta) y **pasos
   estrechos** (media pared + puerta de 1). Van junto a casi todas las puertas de salas, a 1/4–1/2–3/4
   de los tramos largos y en las bocas de los cruces (~35–50 en 16×16).
55. **Toda sala tiene entrada real**: ninguna sala puede tener su única puerta hacia el exterior (lo negro).
   En la vista ⬛ una puerta hacia afuera solo cuenta como entrada si está en el borde del mapa; si no,
   esa sala sale gris (cerrada) y la generación descarta ese intento.
56. **Entrada**: el pasillo de entrada sube desde el borde de abajo hasta un punto del contorno que no
   tenga nada del mapa debajo (no cruza salas). Lo que quede sin ningún acceso vuelve a ser roca.
57. **Sin salas casi triángulo**: una sala pequeña (≤ 60 celdas) con forma de triángulo se une a la sala
   vecina con más pared en común (queda un trapecio), o si no tiene sala al lado, al pasillo (ensanche).
   Una sola pasada, para que no se encadene.
58. **Tramos de pasillo cortos**: se corta el tramo más largo con compuertas o pasos estrechos (también
   en pasillos diagonales y justo pasada cada vuelta en L) hasta que ninguno pase de 40 cuadrados o no
   quede sitio limpio. Donde la pared de una sala llega al pasillo, la partición continúa esa pared
   (media pared) y la puerta de 1 va en el lado limpio.
59. **Engaños**: (a) compuerta justo pasada una vuelta en L: desde antes parece la puerta de un cuarto y
   es el camino; (b) puertas en ángulo en las esquinas (una a sala, otra que sigue el pasillo);
   (c) **salas de paso disfrazadas**: una sala que toca dos tramos de pasillo distintos recibe puerta a
   ambos (≈ 1 cada 30 casillas): parece un cuarto más y es un atajo.

## 🎲 Suerte (no hay ayuda de dónde está nada)
60. **Entrada desde afuera** del primer piso, por un lado al azar (abajo, arriba, derecha o izquierda);
   el pasillo de entrada no cruza nada del mapa.
61. **Sala del jefe donde toque**: cualquier sitio con espacio, pero nunca junto a la entrada (a más de
   media anchura del mapa). Es opcional; tiene columnas.
62. **Bajada al piso siguiente donde toque**: una sala grande elegida al azar entre las que están a 40% o más
   de la distancia máxima desde la entrada: a veces a media distancia, a veces al fondo. Nada la anuncia.
63. Sin anillos ni pistas de dónde está el jefe o la bajada. Si un intento no tiene puerta de entrada en
   el borde, se vuelve a generar.
64. **Escondidos**: la sala del jefe tiene una sola puerta, hacia su vecino más hondo (salvo que algún
   cuarto detrás solo se abra a ella). La bajada al 2º piso se sortea entre los espacios a 75% o más de la
   profundidad máxima (en puertas desde la entrada), y si hay, en un callejón sin salida. Medido: jefe a
   ~15 puertas, bajada a ~15 de ~17 de profundidad máxima (antes 7 y 8).
65. **Un poco menos de puertas, no muchas menos**: puertas sala↔sala al azar 20% (antes 30%), y se tapia
   una cuarta parte de las conexiones sobrantes (las que solo cierran una vuelta), sin aislar nada.
   Sin límite de puertas por sala: más decisiones es mejor. Medido: vueltas 54 → 37, profundidad máx
   14 → 18, jefe y bajada a ~18 puertas de la entrada (antes ~15).
66. **Bisel proporcional**: el bisel de la esquina de una sala junto a una vuelta de pasillo es de 2 solo
   si esa sala mide 8 o más de ancho; si no, 1. (Salas rectas 46% → 58%, octágonos ~0.)
67. Meta siguiente: ninguna sala con esquinas de más de 180° (cóncavas); los pasillos sí pueden tenerlas.
68. **Salas sin esquinas de más de 180°**: casi todas eran escalones de 1 casilla (una sala se mete en el
   hueco de la esquina de su vecina junto al pasillo). Corrección: en cada esquina así se prueba quitar el
   escalón (1–4 casillas) o rellenar el hueco, y se queda lo que deje menos esquinas malas sin crear huecos
   finos. Se aplica en la limpieza y otra vez al final. Salas sin esquinas así: 67% → ~74%.
69. **Salas en diagonal en todo el mapa**: las avenidas (rombo + filas de cuartitos inclinados) ya no van solo en
   las grandes diagonales: se sortean en cualquier parte dentro del contorno, separadas entre sí (hasta 5 en
   16×16, 3 en 10–12). Salas inclinadas: ~7 → ~17 por mapa. (Se deshizo la protección de pasillos diagonales
   de ayer: dejaba salas gigantes y deformes.)
70. **Barrios en diagonal (mínimo 30% de salas en diagonal)**: 1 barrio (10–12) o 2 (14+) por mapa, cada uno un
   cuadrado girado 45° construido con una cuadrícula girada: todas sus salas son rombos o rectángulos inclinados
   (cada celda girada: rombo entero 25%, o partida en dos rectángulos 75%), y sus pasillos van en diagonal,
   también por el borde del barrio (60% de los tramos del borde abiertos) para poder rodearlo. Se colocan al azar
   dentro del contorno; las avenidas que chocan con un barrio se quitan; el jefe y la entrada no lo cruzan.
   Medido: salas en diagonal 31% (16×16: ~58 de ~187; 12×12: ~32 de ~105).
71. **Barrios repartidos y separados**: en vez de 1–2 grandes, hasta 5 barrios más chicos (3×3 celdas giradas, o
   2×2 si no cabe), cada uno puesto lo más lejos posible de los otros y con un pasillo o más de separación.
   Casi todas sus celdas se parten en dos salas. Si al final hay menos de 30% de salas en diagonal, el mapa se
   vuelve a generar (hasta 3 veces). Medido: 35% (16×16), 33% (12×12).
72. **Los pasillos diagonales de los barrios también llevan particiones**: compuerta en medio de cada tramo (85%),
   y todos sus puntos cuentan para cortar los tramos demasiado largos.
73. **Rombos sueltos y cuadrados sueltos (no solo barrios)**: además de los barrios (hasta 3, de 3×3 celdas
   giradas), hasta 12 rombos sueltos (16×16; 7 en 12×12) repartidos entre las salas cuadradas. Cada uno es un
   «barrio» de una sola celda girada: su sitio queda fuera de la cuadrícula recta (los pasillos rectos lo rodean, nunca
   lo cruzan) y lleva su propio pasillo diagonal por parte de su borde, que se une a los pasillos rectos, así que se
   puede rodear y también lleva compuertas. La mitad es un rombo entero y la otra mitad dos rectángulos girados.
   Dentro de cada barrio de 3×3 hay una sala cuadrada suelta. Así las diagonales no se notan como una comunidad.
74. **Compuertas en los pasillos diagonales de los barrios**: se prueba desde el medio del tramo hacia afuera hasta
   encontrar un punto donde cabe, y se permite que quede junto a la puerta de una sala (antes casi nunca cabía).
   Medido: ~24 compuertas diagonales por mapa (antes ~8).
75. **La sala del jefe siempre existe**: su lugar se elige antes que los barrios (por suerte, lejos de la entrada) y los
   barrios, rombos sueltos y avenidas lo respetan. Antes, en ~8 de cada 10 mapas los barrios ocupaban todo el sitio
   y no había jefe. Además, una sala sin puerta posible solo se funde con su vecina cuando ya no se puede poner
   ninguna otra puerta en esa vuelta (un vecino alcanzado después puede darle su puerta), y la del jefe nunca se funde.
76. **Nada corta los pasillos ni tapa la entrada**: los pasillos rectos nunca pasan por dentro de un barrio o rombo
   suelto (solo por su borde). Antes un rombo suelto pintado encima de la cuadrícula cortaba pasillos: la parte
   cortada se perdía entera como resto (a veces con la entrada y sus compuertas) y el mapa fallaba la entrada ~2 veces
   antes de salir bien (cada fallo es un dibujo entero más); ahora casi nunca.
77. **Rapidez**: la revisión de esquinas de más de 180° (la parte más lenta) se hizo ~2 veces más rápida dando el mismo
   resultado; con eso y sin los fallos de entrada, un dibujo tarda ~4–5 s en vez de ~10–15 s. Si faltan salas en
   diagonal se dibuja hasta 4 veces y se queda el mejor. Medido: salas en diagonal 16×16 entre 32% y 38%, 12×12
   entre 30% y 41%; sin fallos de reglas, todos con entrada y con jefe.
78. **Pasillos de 2, no más anchos**: donde el pasillo se abre más (manchas de pasillo más anchas que una sala), su
   centro se saca dejando un anillo de 2 de ancho: si cabe 4×4 o más, es una **sala isla** que el camino rodea como
   una dona (si no le cabe puerta queda como bloque sólido); si el pasillo mide 6 o más pero no cabe una isla, va una
   **pared al medio** (bloque sólido de 2 de grueso y 8 o más de largo) que parte el camino en dos y vuelve a juntarse:
   otra decisión. Un bloque sólido que queda menor de 4×4 se junta con lo que lo rodea.
79. **Compuertas en todo el pasillo real**: además de los puntos de la cuadrícula, se prueban compuertas en cualquier
   punto de las paredes del pasillo tal como quedó dibujado, de 2, 3 o 4 de ancho, rectas o diagonales (en un pasillo
   diagonal de ancho impar, la compuerta da un paso recto en el medio). Siempre cruzan en ángulo recto a una pared que
   sigue derecha en los dos extremos (o donde llega la pared de una sala desde atrás, que así cruza el pasillo).
   Cada vuelta pone una compuerta en cada tramo que sigue siendo demasiado largo. Si una compuerta deja un trocito
   menor de 4×4, se quita solo una de las que lo rodean (antes se quitaban todas); una compuerta que deja una
   puerta contra otra pared o un filo también se quita. Medido: tramos de pasillo entre compuertas 33 → 64 por mapa
   (16×16) y 48 → 81 (19×19); el tramo más grande 3453 → 934 (16×16). Pasillo de 5 o más de ancho: 8% → 5%.
80. **Callejones sin salida y más ramas**: el laberinto de pasillos se ramifica más (70% sigue el camino nuevo, antes
   85%) y ~35% de las puntas que no llevan a ninguna sala quedan como callejón sin salida (1 o 2 tramos); solo 40%
   de las puntas con salas se vuelve antesala (antes 75%).
81. **Mapa 20% más grande**: el tamaño por defecto es 19×19 (antes 16×16), con más rombos sueltos (hasta 17).
82. **Salas raras (codos, V)**: se probó partirlas con una pared recta en dos partes regulares, pero casi siempre deja
   filos de 45° o paredes sueltas, así que no se usa. Lo que sí las bajó: los trocitos de sala menores de 4×4 vuelven
   a juntarse con el vecino de más pared (como antes). Siguen ~6% codos y ~7% irregulares.
83. **Rapidez**: el mapa de espacios para tapiar puertas y esconder al jefe se calcula una vez (no en cada prueba), y la
   limpieza de huecos finos cuenta sin ordenar; mismo resultado. En el navegador: ~5 s (16×16), ~14 s (19×19).
