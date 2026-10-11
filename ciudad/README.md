# Ciudad zombi

Generador de ciudad para un juego de zombis con refugios: se va del punto A al punto B por calles, patios y casas.
Está separado del generador de mazmorras (`editor/`), que no se tocó. Tiene tres modos:

- **Ciudad (motor derivado, el principal)**: `motor_ciudad.js` usa la mazmorra como plantilla y la transforma en ciudad,
  con sus **reglas de vértices**: cada celda es entera o partida por una sola diagonal completa (nunca en X, nunca media),
  sin filos a 45°, sin esquinas de 90° (bisel), cuartos de 4 de ancho o más, puertas que no tocan otra pared. Se mide con el
  mismo `checkRules` de la mazmorra (semilla 7: 0 cruces, 0 huecos finos, 0 espacios chicos, 0 paredes sueltas, ~8 filos y
  ~8 esquinas que quedan en bordes difíciles).
  - **Sin muralla**: no es una mazmorra; la ciudad se abre al campo. Solo el contorno es simétrico; el interior es libre.
  - **Calles con jerarquía**: calzada para autos (calles de 6 → 4 de calzada + veredas; avenidas desde el borde hasta la
    plaza, más anchas y con **mediana**), **veredas** pegadas a cada manzana (con bordillo), y las calles de menos de 3 de
    ancho son **pasajes peatonales** (personas y bicis).
  - **Plaza** al centro, siempre rodeada de **césped** (con reja y varias entradas) y luego de **pista**.
  - **Zonas**: comercio y oficinas junto a la plaza, condominios en el anillo medio, suburbio afuera, parques.
  - **Casas**: cada manzana se parte en lotes que dan a la calle. Casas **adosadas** (comparten pared con la vecina, patio
    atrás) y **sueltas** (rodeadas de su jardín). Cada casa es un conjunto de **3 a 7 cuartos** de tamaño parejo; el jardín
    tiene reja y **al menos 2 entradas**; las puertas son de **2 de ancho**. Cada casa se pinta con su propio tono.
  - **Centro comercial en pesa** (anclas en las puntas, pasillo con locales, pasaje al medio), nunca delgado.
  - **Ingeniería vial**: algunas casas que obligaban a un rodeo se derriban y queda calle nueva.
  - **A y B lo más lejos posible**: A es la calle del borde más lejana a la plaza (B); se revisa que se llegue a todo.
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
- `export/ciudad_semilla_7/`: **la ciudad del motor** (n=12, ~12.100 piezas en 76 chunks, máx. 372).
- `export/diagonal_semilla_7/`: ciudad diagonal ya exportada (19×19, **5.468 piezas, 25 chunks, máx. 391**).
- `export/cuadricula_semilla_7/`: ciudad en cuadrícula ya exportada (150×110 celdas, 2.413 piezas).

## Para la sesión de TruWorlds: qué archivo leer

1. Lee `ciudad/export/ciudad_semilla_7/index.json` (o `diagonal_semilla_7` / `cuadricula_semilla_7`): tiene el total de piezas, la lista de chunks con su centro y cantidad, los spawns y las medidas.
2. Construye cada `chunk_XX.json` en una llamada. Cada chunk tiene `{name, center, parts}`, y cada pieza es
   `{name, shape, pos, size, rot, color, material}`:
   - `shape` es Block, Ball o Cylinder;
   - `pos` y `size` están en studs;
   - `rot` va en grados, en orden Y,X,Z;
   - `color` es RGB de 0 a 1;
   - `material` es uno de: SmoothSurface, Wood, Marble, Grass, Gravel, Brick, Metal, Glow.
   Los chunks tienen como máximo 800 piezas; en la semilla 7 el mayor tiene 228.
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
| `Calle`, `Vereda`, `Pasaje`, `Plaza`, `Parque`, `Patio`, `Piso` | Suelos |
| `Pared` | Pared completa |
| `Muralla` | Borde de la ciudad (ladrillo) |
| `Dintel` | La parte de pared sobre una puerta o ventana |
| `Alfeizar` | La pared bajo una ventana |
| `VentanaCerrada` | Vidrio que no se abre; las ventanas rotas no tienen vidrio y se pueden trepar |
| `Reja` | Metal, de 2 m de alto |
| `Techo` | Uno por bloque de casa. Si no quieres techos, sáltalos por nombre |
| `Auto`, `AutoCabina` | Autos abandonados y choques |
| `Tronco`, `Copa`, `Fuente`, `FuenteAgua` | Árboles y fuentes |

Las puertas son huecos en la pared, sin hoja.

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
node ciudad/exportar.js --semilla=7 --n=12                          # ciudad (n: 10, 12 o 14)
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
