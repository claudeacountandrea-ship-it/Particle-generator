# Ciudad zombi

Generador de ciudad para un juego de zombis con refugios: se va del punto A al punto B por calles, patios y casas.
Está separado del generador de mazmorras (`editor/`), que no se tocó.

- `ciudad.js`: el generador (`Ciudad.generate`) y la exportación a piezas TruWorlds (`Ciudad.toParts`). Funciona en el navegador y en Node.
- `index.html`: el visor. Ábrelo en el navegador, elige semilla y tamaño, y mira la ruta A→B.
- `exportar.js`: escribe las piezas para TruWorlds.
- `export/semilla_7/`: una ciudad ya exportada (semilla 7, tamaño medio 150×110 celdas).

## Para la sesión de TruWorlds: qué archivo leer

1. Lee `ciudad/export/semilla_7/index.json`: tiene el total de piezas, la lista de chunks con su centro y cantidad, los spawns y las medidas.
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

Semilla 7, tamaño medio: **2.413 piezas en 20 chunks**. Las paredes rectas ya vienen fusionadas en una sola pieza por tramo.

| Tamaño | Celdas | Metros | Piezas (semilla 7) |
|---|---|---|---|
| Chica | 110×80 | 220×160 m | ~1.500 |
| Media | 150×110 | 300×220 m | ~2.400 |
| Grande | 200×150 | 400×300 m | ~4.800 |

### Spawns (en `index.json` → `spawns`)
- `PlayerStart`: punto A, en la entrada oeste de la ciudad, sobre la calle del anillo.
- `refugios`: 2 refugios intermedios y B (refugio final). La posición es el centro del cuarto con la puerta principal.

### Nombres de las piezas
| Nombre | Qué es |
|---|---|
| `Calle`, `Plaza`, `Parque`, `Patio`, `Piso` | Suelos |
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
node ciudad/exportar.js --semilla=7 --tamano=150x110
```
La salida queda en `ciudad/export/semilla_<n>/`. La misma semilla y el mismo tamaño dan siempre la misma ciudad.

## Qué genera
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
- Calles en diagonal y manzanas giradas.
