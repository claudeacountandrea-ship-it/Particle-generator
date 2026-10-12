# Ciudad zombi

Generador de ciudad para un juego de zombis con refugios: se va del punto A al punto B por calles, patios y casas.
Está separado del generador de mazmorras (`editor/`), que no se tocó. Tiene tres modos:

- **Ciudad (motor derivado, el principal)**: `motor_ciudad.js` usa la mazmorra como plantilla y la transforma en ciudad,
  con sus **reglas de vértices**: cada celda es entera o partida por una sola diagonal completa (nunca en X, nunca media),
  sin filos a 45°, sin esquinas de 90° (bisel), cuartos de 4 de ancho o más, puertas que no tocan otra pared. Se mide con el
  mismo `checkRules` de la mazmorra (semilla 7: 0 cruces, 0 huecos finos, 0 espacios chicos, 0 paredes sueltas, ~8 filos y
  ~8 esquinas que quedan en bordes difíciles).
  - **Sin muralla**: la ciudad termina en un **anillo de asfalto** y de ahí salen **2–3 autopistas** (8 de ancho, con
    mediana) hasta el borde del mapa: la salida hacia otra ciudad. A está en la punta de la autopista más lejana a la plaza.
    Solo el contorno es simétrico; el interior es libre.
  - **Calles con jerarquía**: calzada para autos (calles de 6 → 4 de calzada + veredas; avenidas desde el borde hasta la
    plaza, más anchas y con **mediana**), **veredas** pegadas a cada manzana (con bordillo), y las calles de menos de 3 de
    ancho son **pasajes peatonales** (personas y bicis).
  - **Proporciones** (1 cuadro = 2 m arcade, todo ~1,5× más grande que lo real): un **auto mide 2** de ancho y un
    **carril 3** (el carril es más ancho que el auto). Calle normal: **8 = 6 de calzada (un carril por sentido) + 1 de vereda
    por lado**. Anillo de 8; autopistas y avenida central de **2 carriles por sentido con mediana** (16). Ningún tramo de
    calzada queda con menos de 3. Las veredas siguen las diagonales sin escalones ni dientes de sierra.
  - **Cuartos donde entra un auto**: al menos 5 de ancho, de unos 30 a 45 cuadros (5×6 a 6×8).
  - **Barrios**: cada barrio es una región entre **vías principales** (anillo, autopistas, avenidas radiales, avenida
    central, anillo de la plaza), que son su límite. Cada uno tiene nombre y estilo (casas sueltas o adosadas, tamaño de casa
    y de cuartos, tono de fachada y techo) y sus casas se parecen entre sí.
  - **Rotondas (óvalos)** donde se cruzan vías principales: el cruce se abre en un octógono con una isla de pasto.
  - **Plaza con diseño**: fuente octogonal al centro, anillo para caminar, senderos en cruz y 4 canteros de pasto con las
    esquinas biseladas, árboles y bancas; alrededor, el césped con reja y la pista.
  - **Centro comercial como recinto**: terreno propio con estacionamiento grande hacia la calle y planta en pesa limpia
    (tiendas ancla en las puntas, pasillo, locales de 5 a los dos lados, entrada al medio y **patio de comidas**).
  - **Edificios especiales = recintos propios**: cada uno en su terreno cercado, separado de las casas, con **estacionamiento
    al frente que llega a la calle**, portón de 4 del estacionamiento al terreno y el edificio de planta limpia en el medio.
  - **Borde**: el anillo de asfalto y las autopistas llevan **vereda a ambos lados**. Una **avenida-autopista** de 12
    (veredas + calzada con mediana) cruza la ciudad pasando junto a la plaza.
  - **Calzada para vehículos**: ningún tramo de calzada queda con menos de 3 de ancho (lo más angosto pasa a vereda).
  - **Pasajes**: callejones peatonales sin salida (2 de ancho) que entran hasta el medio de algunas manzanas, con
    **tachos de basura**.
  - **Edificios especiales con plantilla** (casi iguales cada vez, mismas reglas; se repiten según el tamaño):
    **hospital** (urgencias y quirófano en las puntas, pasillo, habitaciones), **comisaría** (recepción, oficinas, celdas,
    patio de presos), **bomberos** (cochera con portones de 4 para los camiones, dormitorio, cocina, oficina),
    **base militar** y **cárcel** en las afueras (recinto con **muro alto**, una sola entrada, edificios adentro),
    **parque con lago** (estilo inglés) y **juegos para niños** en los parques chicos (tobogán, columpio, arenero).
  - **Rejas en las calles**: cruzan la calle de vereda a vereda y casi siempre dejan un paso de 2; algunas la cierran
    (solo si igual se llega a todo por otro lado: hay que rodear).
  - **Estacionamientos** (P): algunos lotes del centro y del anillo medio se sacrifican para estacionar.
  - **Plaza** al centro, siempre rodeada de **césped** (con reja y varias entradas) y luego de **pista**.
  - **Zonas**: comercio y oficinas junto a la plaza, condominios en el anillo medio, suburbio afuera, parques.
  - **Casas**: cada manzana se parte en lotes que dan a la calle. Casas **adosadas** (comparten pared con la vecina, patio
    atrás) y **sueltas** (rodeadas de su jardín). Cada casa es un conjunto de **3 a 7 cuartos** de tamaño parejo con su uso:
    **sala** (puerta principal de 2), **garaje** (portón de 3 a la calle, en casas de 4 cuartos o más), **cocina** (puerta
    trasera al patio), **baño** y **dormitorios**; las grandes, condominios y oficinas tienen **salida de emergencia**
    (hasta 3 entradas). El jardín tiene reja y al menos 2 entradas propias (portón o un **hueco roto**).
  - **Tiendas** con 2 puertas principales (salvo una minitienda), local y depósito; oficinas con recepción.
  - **Centro comercial en pesa** (anclas en las puntas, pasillo de 4, locales enfrentados, pasaje al medio), hecho con
    cortes válidos de la rejilla; nunca delgado (al menos 30×18).
  - **Ingeniería vial**: algunas casas que obligaban a un rodeo se derriban y queda calle nueva.
  - **Misma semilla, misma ciudad** en el navegador y en Node (no se usa `sort` con azar, que cambia entre versiones).
  - Visor: zoom hasta ×10 con la rueda, arrastrar para moverse, **nombres de cuartos** al acercar y **contorno de casas**
    (cada casa con su color) activable.
- **Mazmorra pintada** (`ciudad_diagonal.js`): la mazmorra tal cual con capa de ciudad (la versión anterior).

- **Diagonal (base mazmorra, el principal)**: parte del generador de mazmorras con sus diagonales y formas ya pulidas y le
  pone encima la capa de ciudad: pasillos → calles, salas → casas (sus particiones son los cuartos; las salas unidas por
  puertas forman una casa), paredes del medio de los pasillos → rejas, compuertas → portones, huecos → ruinas, sala del jefe →
  mercado, entrada → A, bajada → refugio B. Las paredes que dan a la calle llevan ventanas (cerradas o rotas).
  Las paredes en diagonal salen como **una sola pieza girada 45°** en Y.
- **Cuadrícula**: ciudad recta con manzanas, lotes, patios, plazas, parques, avenidas y autos (ver abajo).

- `motor_ciudad.js`: el motor de ciudad (`MotorCiudad.generate`); lo exporta y dibuja `ciudad_diagonal.js`.
- `ciudad_diagonal.js`: modo mazmorra pintada, más la exportación (`toParts`) y el dibujo de los dos modos con diagonales.
- `mazmorra_base.js`: el generador de mazmorras empaquetado. Se arma con `node ciudad/construir_base.js` desde `editor/index.html`;
  vuelve a correrlo cuando mejore la mazmorra y la ciudad hereda las mejoras.
- `ciudad.js`: modo cuadrícula y la tabla `MEDIDAS` que usan los dos modos.
- `index.html`: el visor. Elige modo, semilla y tamaño, y mira la ruta A→B.
- `exportar.js`: escribe las piezas para TruWorlds.
- `export/ciudad_semilla_7/`: **la ciudad del motor con pisos** (n=12, ~25.000 piezas: plantas de arriba, escaleras y puentes entre techos).
- `export/ciudad_semilla_7_ligera/`: la misma ciudad **sin plantas de arriba ni piso de color dentro de las casas** (~14.600 piezas, bajo el tope de 15.000).
- `export/diagonal_semilla_7/`: ciudad diagonal ya exportada (19×19, **5.468 piezas, 25 chunks, máx. 391**).
- `export/cuadricula_semilla_7/`: ciudad en cuadrícula ya exportada (150×110 celdas, 2.413 piezas).

## Para la sesión de TruWorlds: qué archivo leer

1. Lee `ciudad/export/ciudad_semilla_7/index.json` (o `diagonal_semilla_7` / `cuadricula_semilla_7`): tiene el total de piezas, la lista de chunks con su centro y cantidad, los spawns y las medidas.
2. Construye cada `chunk_XX.json` en una llamada. Cada chunk tiene `{name, center, parts}`, y cada pieza es
   `{name, shape, pos, size, rot, color, material}`:
   - `shape` es Block, Ball, Cylinder o Wedge (las escaleras y el tobogán);
   - `pos` y `size` están en studs;
   - `rot` va en grados, en orden Y,X,Z;
   - `color` es RGB de 0 a 1;
   - `material` es uno de: SmoothSurface, Wood, Marble, Grass, Gravel, Brick, Metal, Glow.
   Los chunks tienen como máximo 800 piezas; en la semilla 7 el mayor tiene 764 (303 en la ligera).
3. Las posiciones son absolutas en el mundo: el mapa está centrado en el origen, con Y hacia arriba y el norte del mapa mirando a -Z. El `center` de cada chunk sirve solo como referencia; no hace falta mover nada.
4. El suelo son piezas (calles, plazas, patios, pisos) de 1 stud de grueso con la cara de arriba en y = 0.

Las paredes rectas (y diagonales) ya vienen fusionadas en una sola pieza por tramo. Las diagonales llevan `rot: [0, ±45, 0]`
con la convención de Roblox (girar en Y lleva el eje X hacia (cos, 0, −sin)); si en la captura salen espejadas, invierte el signo.
Los pisos y techos de las salas en diagonal se arman con rectángulos y dejan sin cubrir el medio triángulo de la celda cortada (se ve la calle debajo).

| Tamaño | Celdas | Metros | Piezas (semilla 7) |
|---|---|---|---|
| Chica | 110×80 | 220×160 m | ~1.500 |
| Media | 150×110 | 300×220 m | ~2.400 |
| Grande | 200×150 | 400×300 m | ~4.800 |

### Spawns (en `index.json` → `spawns`)
- `plaza`: centro de la plaza (llegada, B) en el modo ciudad.
- `PlayerStart`: punto A. En diagonal es el patio de entrada; en cuadrícula, la entrada oeste sobre la calle del anillo.
- `refugios`: 2 refugios intermedios y B (refugio final). La posición es el centro del cuarto con la puerta principal.

### Nombres de las piezas
| Nombre | Qué es |
|---|---|
| `Calle`, `Vereda`, `Pasaje`, `Estacionamiento`, `Plaza`, `Parque`, `Patio`, `Piso` | Suelos |
| `Pared` | Pared completa |
| `Muralla` | Borde de la ciudad (ladrillo) |
| `Dintel` | La parte de pared sobre una puerta o ventana |
| `Alfeizar` | La pared bajo una ventana |
| `VentanaCerrada` | Vidrio que no se abre; las ventanas rotas no tienen vidrio y se pueden trepar |
| `Reja` | Metal, de 2 m de alto |
| `Muro` | Muro alto de base militar y cárcel |
| `TachoBasura`, `Tobogan`, `Columpio`, `Arenero`, `Banca`, `FuenteCentro` | Objetos de pasajes, juegos y plaza |
| `Agua`, `Juegos`, `Estacionamiento`, `Rotonda`, `Cantero` | Suelos especiales |
| `Techo` | Techo de cada edificio, a la altura de su último piso. Si no quieres techos, sáltalos por nombre |
| `Losa` | Piso de las plantas de arriba (con el hueco de la escalera) |
| `ParedP2`, `DintelP2`, `VentanaArribaP2` (y `P3`, `P4`) | Paredes de las plantas de arriba; arriba la ventana es un vidrio sobre la pared entera |
| `Escalera`, `EscaleraU`, `Descanso`, `EscaleraCaracol`, `EscaleraEje` | Una rampa (Wedge) por piso (dos de medio piso y un descanso en la U), con la parte baja hacia la entrada; la de caracol lleva un eje. Si la rampa sale al revés, gira 180° en Y |
| `TablaTecho`, `PuenteTecho`, `Baranda` | Tablas (1 a 3 celdas) y puentes (4 a 8) de techo a techo; si los techos tienen distinta altura van inclinados |
| `Auto`, `AutoCabina` | Autos abandonados y choques |
| `Tronco`, `Copa`, `Fuente`, `FuenteAgua` | Árboles y fuentes |

Las puertas son huecos en la pared, sin hoja.

## Cuartos, pisos, escaleras y puentes (modo ciudad)
- **Tamaño de cada cuarto según su uso** (tabla `PROG` en `motor_ciudad.js`): la sala pesa 2 (la más grande, da a la calle y
  tiene la puerta principal), el garaje 1,4, la cocina 1,05 (hacia el patio, con la puerta de atrás), el dormitorio 1 y el baño
  0,4 (el más chico de los privados; puede tener 3 de ancho). Medido en la semilla 7: la sala sale ~1,6 veces el cuarto más
  grande que le sigue, y el baño ~0,6 de la cocina o un dormitorio.
- **Pisos**: casa 1 o 2 (2 si tiene menos de 4 cuartos abajo; más seguido en el centro), condominio 2 a 4 (un departamento
  por piso, con la misma planta), oficinas 2 o 3, tienda 1 o 2, centro comercial 2 o 3, hospital, escuela, comisaría y
  bomberos 2, base militar, cárcel y almacén 1. Las plantas de arriba repiten las paredes de la de abajo (así cumplen las
  mismas reglas de la rejilla); las puertas a la calle pasan a ventanas y los tramos largos ciegos ganan ventanas.
- **Usos arriba**: en una casa, dormitorio principal, dormitorios, baño y el hall donde llega la escalera; un condominio repite
  el departamento; los edificios repiten sus usos (los garajes pasan a oficinas o habitaciones).
- **Escaleras**: solo el área y su entrada. Recta de 2×4 (2×5 en edificios grandes) que entra por un lado corto, o en U de
  4×4 (dos tramos de medio piso con descanso al fondo); caracol de 2×2 solo si no entra otra. Van en el mismo lugar en todos los pisos, pegadas a una pared, sin tapar puertas, en la sala, el hall, el pasillo o
  la recepción. Datos en `escaleras` (x, y, w, h, entrada N/E/S/O, pisos, techo).
- **Puentes entre techos**: entre edificios a 1–8 celdas sobre suelo libre (patios, pasajes, calles angostas), 2 celdas de
  ancho, como mucho 2 por edificio (3 en los grandes). Un edificio con puente tiene escalera hasta el techo. Datos en
  `puentes` (x1, y1, x2, y2, tipo tabla/puente, casaA, casaB, pisosA, pisosB).
- **Escuela**: dirección, recepción y enfermería al frente; el patio de recreo (pasto, sin techo) al medio con las aulas
  alrededor (dos lados y el fondo), gimnasio y baños.
- **Centro comercial**: locales más grandes y abiertos enteros al pasillo (sin pared delante); los anaqueles van después.
- **Mansiones**: en el suburbio, en medio de su jardín cercado, simétricas: hall y salón al centro, un ala con comedor y cocina y
  otra con biblioteca y sala de juegos; 2 pisos con dormitorios arriba.
- **Veredas**: las esquinas de 90° de las veredas (con la calle, el campo o un parque) se biselan a 45°, en varias pasadas
  (primero las puntas, después los rincones); la punta de una vereda nunca se afila.
- **Óvalos**: isla de pasto de radio 5 con un anillo de 2 carriles marcado; nunca pegados al campo ni a la plaza.
- **Veredas que se tocan por una punta** (sobre todo junto al campo): la esquina se cierra con media celda en diagonal.
- **Sierra de medias celdas**: al crecer una forma con diagonales, sus lados rectos quedaban como una pila de medias celdas
  (la sierra «≶»); esas celdas se vuelven enteras antes del bisel y otra vez después de la reparación de esquinas.
- **Sentido del tráfico** (por la derecha): a cada lado de la mediana, carriles de 3 con línea blanca entre ellos y flechas
  cada 10 celdas; en los óvalos se gira en sentido antihorario. En la exportación salen como `LineaCarril` y `FlechaCarril`
  (piezas planas) y en `index.json` → `spawns.sentidoTrafico` (posición y dirección) para que los autos sigan los carriles.
- **Decoración**: las islas de los óvalos y las islas verdes quedan marcadas (estrella en el visor, `spawns.decoracion` en
  `index.json`) para poner ahí una estatua, un letrero o un árbol.
- **Islas verdes**: donde la calzada sobra (muy ancha en todas direcciones) se pone una isla octogonal de pasto.
- **Estacionamientos**: la vereda de delante pasa a ser calzada: entrada grande de autos desde la pista.
- **Anchos mínimos**: un lote de menos de 6 de ancho no es casa ni oficina: queda de área verde (letreros, decoración). Un
  cuarto más de 2,6 veces largo que ancho se parte en dos (sala y comedor, cocina y lavandería, dos dormitorios).
- **Condominios**: pasillo desde la calle hacia adentro con departamentos (sala y dormitorio) a los dos lados, o a un lado si
  es angosto; la escalera en el pasillo o un departamento; 3 a 5 pisos.
- **Baño y pasillo**: el baño es el cuarto privado chico con menos vecinos (en un rincón, con pared afuera) y tiene una
  sola puerta: nunca se pasa por él a otro cuarto. En casas de 5 cuartos o más, el cuarto privado que toca a 3 o más es el
  pasillo (distribuidor), y arriba sigue siendo pasillo.
- **Casas sin partir**: si el lote tiene forma rara y no se puede partir, la casa es el núcleo (2 celdas hacia adentro) y el
  borde queda de jardín. Un cuarto suelto grande ya no se pega como anexo a la vecina: pasa a ser jardín (de la vecina o
  público). Un cuarto demasiado grande para su uso se parte en dos (la sala hasta 2,6 cuartos normales, el resto hasta 2).
- **Antejardín**: en la mitad de los barrios la casa se retira 3 de la vereda y se entra por un jardín al frente.
- **Mercado** (1, o 2 en ciudades grandes): nave de puestos grande y depósito, frigorífico, baños y carga al fondo, con
  estacionamiento. **Comida rápida** en el centro y el anillo medio: comedor al frente, cocina y baño.
- **Visor**: «Contornos» rodea cada lote (casa + jardín) y cada parque, juegos o lago; «Tipo de edificio» escribe casa,
  condominio, tienda u oficinas con sus pisos (por ejemplo «condominio 3P»). El selector «Piso» muestra la calle, los pisos 2 a 4 (lo que no llega queda oscuro) y los techos con los puentes.

## Medidas arcade (fáciles de cambiar)
Las medidas no son realistas, son de juego: números redondos en metros de Blender (1 m = 4 studs), pensados para un
personaje de unos 3 m. Lo que en la vida mide 2, aquí mide 3. Están todas en la tabla `MEDIDAS` de `ciudad.js`:

| Medida | Metros | Studs |
|---|---|---|
| Celda (2 personas de ancho) | 2 | 8 |
| Pared y altura del techo | 4 | 16 |
| Puerta (alto; el ancho es 1 celda) | 3 | 12 |
| Ventana | de 1 a 3 | de 4 a 12 |
| Reja | 2 | 8 |
| Grosor de pared | 0,5 | 2 |

Con estas medidas se cumple lo de TruWorlds: puertas de 8 studs o más, techos de 10 o más y calles de 12 o más (el callejón más angosto mide 16).

## Regenerar
```
node ciudad/exportar.js --semilla=7 --n=12                          # ciudad (n: 10, 12, 14 o 16 = enorme)
node ciudad/exportar.js --semilla=7 --ligera                        # sin plantas de arriba ni piso interior (~15.000 piezas)
                                                                    # sueltos: --pisos=no  --pisoInterior=no  --techos=no
node ciudad/exportar.js --semilla=7 --modo=diagonal --n=19          # mazmorra pintada
node ciudad/exportar.js --semilla=7 --modo=cuadricula --tamano=150x110
```
La salida queda en `ciudad/export/<modo>_semilla_<n>/`. El modo diagonal tarda unos 10 s en 19×19. La misma semilla y el mismo tamaño dan siempre la misma ciudad.

## Qué genera el modo cuadrícula
- **Calles**: un anillo alrededor, avenidas de 8 o 10 de ancho con reja al medio (dos carriles y pasos cada tanto), calles de 4 o 6 y callejones de 2.
- **Rejas en las calles**: algunas cortan la calle de lado a lado y obligan a rodear; otras dejan un paso de 2. Nunca dejan nada sin acceso.
- **Autos abandonados**: siempre dejan al menos 2 libres. Los choques múltiples tapan la calle.
- **Manzanas** con una o dos filas de lotes. Cada lote es uno de estos:
  - **casa**: sala con la puerta a la calle, cocina con la puerta al patio, dormitorios y baño;
  - **tienda**: puerta doble y vitrinas, con depósito atrás;
  - **edificio**: vestíbulo y departamentos;
  - **almacén**: portón de 3, oficina y bodega;
  - **baldío**: rejas rotas, sirve de atajo entre calles.
- **Patios** cerrados con reja, con portones a la calle y algunos huecos entre patios vecinos (atajos).
- **Ventanas** cerradas (no se abren) o rotas (se pueden trepar, cuesta más que caminar).
- **Plazas** con fuente, **paseos** (plazas alargadas con árboles) y **parques** con reja y portones.
- **Refugios**: 2 en el camino y B al final. Tienen una sola entrada y todas las ventanas cerradas.
- **Ruta A→B**: el visor marca la ruta más corta (pasando por casas y ventanas) y la ruta solo por calles, para ver cuánto ahorra el atajo.

## Pendiente
- Generador de puente: una pista muy ancha con obstáculos, huecos y autos chocados.
- Autos y choques en el modo diagonal (las calles de 2 no dejan espacio sin taparlas).
