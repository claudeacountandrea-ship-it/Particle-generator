# Informe técnico: generador de mazmorras y ciudades (Particle-generator / `ciudad/`)

Versión medida: commit `9cf39a5` de la rama `claude/dungeon-generator-diagonals-1gwgam`.
Las métricas se tomaron el 2026-10-16 con Node 22, en el contenedor de la nube (sin GPU).
Este informe solo documenta: no se cambió código.

## 0. Resumen
- **Qué es:** un generador procedural escrito en JavaScript puro, sin dependencias, que corre igual en Node y en el navegador.
- **Base:** un generador de mazmorras con diagonales (`Halls`). Encima va un motor que convierte esa mazmorra en una ciudad
  para un juego de zombis: calles, veredas, barrios, lotes, edificios con cuartos, varios pisos, escaleras, puentes entre techos
  y una ruta jugable de A a B.
- **Salida:**
  - un modelo en memoria;
  - piezas para TruWorlds (`Block`, `Wedge`, `Ball`, `Cylinder`), repartidas en chunks de 800 piezas como máximo;
  - un visor 2D (`ciudad/index.html`).
- **Tamaño típico** (`n=12`): mapa de unas 509×509 celdas (1 celda = 2 m, o sea ~1 km de lado), unos 165 edificios, unos 590 cuartos
  y unas 27.000 piezas. Se genera en unos 21 s y se exporta en 0,5 s.

## 1. Arquitectura y pipeline

### Archivos
| Archivo | Líneas | Rol |
|---|---|---|
| `ciudad/mazmorra_base.js` | 1856 | Base que se arma sola desde `editor/index.html` con `construir_base.js`. Contiene: `Build` (l.12), que es la rejilla de cuartos de celda y la pintura de regiones; `Grand` (l.287), la mazmorra recursiva compacta; `Halls` (l.439), la mazmorra de salas y pasillos sinuosos con diagonales que usa el motor; `floorView` (l.1737), que calcula el suelo real y alcanzable; y `checkRules` (l.1784), el verificador de reglas |
| `ciudad/motor_ciudad.js` | 1323 | `MotorCiudad.generate(o)`: convierte la mazmorra en ciudad (todas las etapas de abajo) |
| `ciudad/ciudad_diagonal.js` | 368 | `generate` (l.10), el modo «mazmorra pintada»; `toParts` (l.88), la exportación a piezas; `draw` (l.258), el visor |
| `ciudad/ciudad.js` | 443 | Tabla `MEDIDAS` y modo cuadrícula (`Ciudad.generate`, l.16). Es el modo más antiguo y simple |
| `ciudad/exportar.js` | 28 | Línea de comandos: escribe `index.json` y `chunk_XX.json` |
| `ciudad/auditar.js` | 18 | Revisa que cada tipo de edificio tenga su programa mínimo de cuartos |
| `ciudad/index.html` | — | Visor con selector de piso, rutas, contornos y tipos de edificio |

### Entradas
`MotorCiudad.generate({ seed, n, ...opciones })`. Las opciones están en la sección 2.

### Semilla y determinismo
- `rng` (l.11) es un PRNG *mulberry32*.
- Para generar la mazmorra, `Math.random` se reemplaza un momento por `rng(seed)` (l.21–22) y después se restaura.
- El resto del motor usa `R = rng(seed ^ 0x3c6ef372)` (l.23).
- Se comprobó que Node y Chromium dan exactamente el mismo hash de la rejilla `q` y la misma cantidad de bordes, escaleras y puentes.

### Estructura de datos central
- **Rejilla de cuartos de celda:** `q: Int32Array(C·R·4)`. Cada celda tiene 4 triángulos (N, E, S, O) con una etiqueta de región.
  El índice es `(y·C + x)·4 + k`.
- **Regla de vértices:** una celda es entera o está partida por *una* diagonal completa (d1: N=E | S=O, o d2: N=O | S=E).
  Nunca media diagonal y nunca dos diagonales en X. Así las diagonales son de primera clase: no son celdas en escalera.
- **Etiquetas:** `kinds[l]` da el tipo de cada etiqueta (`corr` = calzada, `vereda`, `plaza`, `pasaje`, `room`, `patio`, `parque`,
  `parking`, `rotonda`, `cantero`, `cancha`, `helipuerto`, `agua`, `out`).
- **Edificios:** `houses: Map(id → {type, zone, rooms:Set, patio, pisos, altura, anexo, torre…})`, más `houseOfL[l]` y `roleOf` (el uso de cada cuarto).
- **Bordes:** `segs`, con un segmento por cada borde entre dos etiquetas. Su `cls` puede ser `exterior`, `medianera`, `puerta`,
  `ventana`, `reja`, `porton`, `garaje`, `bordillo`, `mediana`, `muro`…
- **Pisos:** `pisos[]` lleva los bordes de cada planta superior, más `escaleras[]` y `puentes[]`.

### Etapas de `MotorCiudad.generate` (archivo `motor_ciudad.js`, número de línea al lado)
1. **Mazmorra semilla** (l.22): `Halls(n, …, {central, rmin:4, rmax:8, round:true})`.
   - Rejilla de casillas con pasos desiguales (8 a 14).
   - Silueta redonda con ondulación.
   - Avenidas diagonales con rombos.
   - Pasillos sinuosos, callejones sin salida y antesalas.
2. **Simetría opcional** (l.29) y **escala ×4 por cuartos** (l.40): el pasillo de 2 pasa a ser una calle de 8 y la sala, una manzana.
   Las diagonales siguen limpias porque se escala por cuartos.
3. **Margen, anillo de asfalto y autopistas** (l.41–56), y **caminos rurales a granjas** (l.66).
4. **Trazado por etapas** (l.80–133):
   - la silueta se parte en barrios con cortes recursivos rectos o a 45° (tipo BSP, con codos);
   - cada corte es una avenida de 16 o 12;
   - dentro de los barrios quedan las calles orgánicas de la mazmorra (o una cuadrícula irregular si `trazado:'cuadricula'`).
5. **Ensanche y limpieza morfológica:**
   - ensanche (l.134);
   - componentes por tipo (l.146);
   - huecos chicos → calle, huecos grandes → parque (l.154);
   - calles sueltas que se unen a la red (l.157);
   - jerarquía de vías (l.171).
6. **Geometría vial:**
   - chaflán de esquinas de manzana (l.197);
   - puntas a 45° truncadas (l.212);
   - pasajes peatonales sin salida (l.230);
   - **rotondas** octogonales en los cruces de vías principales (l.244);
   - **plazuelas** donde sobra asfalto (l.258);
   - islas verdes (l.269);
   - veredas (l.275–283).
7. **Lotes y edificios** (l.290–757):
   - zonas por distancia a la plaza: centro, anillo medio, suburbio (l.313);
   - barrios con estilo propio (l.562).
   - Herramientas de partición:
     - `cut` (l.318): corte en «T» contra paredes, que nunca deja filos;
     - `cutAt` y `cutAtDepth`;
     - `rectIn` (l.362): el rectángulo máximo, recto o a 45°;
     - `bspLeaves` y `splitN`: BSP;
     - `splitW`: corte ponderado por programa.
   - **Programas de cuartos** con pesos `[peso, área mínima, atracción a la calle]` (`PROG`, l.497). Por ejemplo, el baño pesa 0,4 y la sala 2.
   - **Plantillas** por tipo:
     - por franjas (l.409);
     - centro comercial en «pesa» (l.390);
     - mansión simétrica, escuela con patio de recreo, mercado, condominio con pasillo;
     - recintos especiales como mini ciudades con anexos (`ANEXOS`), torres de vigilancia, cancha o helipuerto (l.545+).
   - Fusión de pedazos sueltos (l.717); los anexos de un solo cuarto se suman al vecino (l.724).
   - **Derribos viales** (l.740): se demuelen casas que obligan a un rodeo largo.
8. **Bordes y reparación** (l.758–913):
   - bordes rectos y diagonales desde las etiquetas;
   - bucle de reparación con las reglas de la mazmorra (l.789): si una pared causa un filo, una esquina de 90° o un cruce, los dos cuartos se juntan;
   - `normalize` (l.792), que aplica la regla de vértices;
   - `sierra` (l.807), que quita las pilas de medias celdas;
   - `bisel` (l.814), que bisela las veredas;
   - vereda pareja de 1 celda (l.882);
   - entrada única de autos a cada estacionamiento (l.889);
   - las calles imposibles pasan a plazuela (l.900).
9. **Puertas y usos de los cuartos** (l.928–1040):
   - baño en un rincón y pasillo distribuidor (l.928);
   - programa mínimo obligatorio (`PROG_MIN`, l.940);
   - puerta principal en el tramo más largo hacia la calle;
   - puertas interiores en **árbol** (árbol de expansión sobre la adyacencia de cuartos), con el baño como hoja (l.954);
   - portones de parques y plaza (l.1038).
10. **Caminos y conectividad** (l.1042–1107):
    - Dijkstra sobre el grafo de cuartos de celda: la ventana rota cuesta más y la mediana se salta;
    - entrada A en el borde más lejano a la plaza (l.1061);
    - **«nada encerrado»** (l.1068): todo espacio al que no se llega desde A recibe una puerta o portón hacia uno alcanzable;
    - rejas en las calles que solo cierran si existe otro camino (l.1083).
11. **Tráfico** (l.1108–1134): mediana en las rectas, carriles de 3, flechas por la derecha y giro antihorario en las rotondas.
12. **Ruta principal estilo Left 4 Dead** (l.1135):
    - Dijkstra ponderado (`walkW`) en el que el interior cuesta 1, el patio o estacionamiento 2, la vereda 3 y la calle 6;
    - pasa por 5 a 7 edificios elegidos en zigzag a ±12–28 % del largo, a un lado y al otro de A→B;
    - penaliza volver a pisar los mismos cuartos.
13. **Transitabilidad** (l.1161), **refugios** (l.1169) y **destino B** = la plaza (l.1186).
14. **Pisos** (l.1189):
    - misma planta arriba, para que las reglas se sigan cumpliendo;
    - condominios = departamentos apilados;
    - torres corporativas con fachada desde el piso 3.
15. **Puentes y tablas entre techos** (l.1202); **escaleras** recta, en U o caracol, giradas con la casa (l.1219); **plantas superiores** (l.1270).
16. **Objetos** (l.1307): apagados por defecto («solo construcciones»).
17. **Retorno** (l.1319): el modelo completo.

### Exportación (`ciudad_diagonal.js`, `toParts`, l.88)
- Las regiones se convierten en rectángulos de forma voraz (greedy).
- Las paredes diagonales son tramos girados ±45°.
- Las medias celdas del piso son bandas a 45° de ancho C/√2.
- Las rampas son `Wedge` con `ry = atan2(-dx, -dy)`.
- Las piezas se reparten en chunks por zona.
- Formato de pieza: `{name, shape, pos, size, rot (grados, orden Y,X,Z), color 0-1, material}`.

### Algoritmos usados
- BSP y cortes recursivos (barrios, lotes, cuartos).
- Morfología sobre máscaras de cuartos (`grow`, `erode`).
- Union-find (componentes, reglas).
- Dijkstra (rutas, alcance).
- Árbol de expansión (puertas).
- Plantillas paramétricas (edificios especiales).
- Reparación por reglas (fusionar regiones hasta cumplir).
- **No usa WFC** ni gramáticas de formas formales.

## 2. Parámetros

### `MotorCiudad.generate(o)`
| Opción | Valor por defecto | Efecto |
|---|---|---|
| `seed` | 7 | Semilla |
| `n` | 12 | Casillas de la mazmorra por lado (10, 12, 14 o 16) |
| `escala` | 4 | Factor de escala de mazmorra a ciudad (pasillo de 2 → calle de 8) |
| `ensanche` | 0 | Celdas que crece la calle sobre las manzanas |
| `margen` | 50 | Celdas de campo alrededor (anillo, autopistas, granjas) |
| `simetria` | false | Refleja la mitad del mapa |
| `contorno` | true | Silueta simétrica |
| `granjas` | true | 1 o 2 caminos rurales que terminan en una granja |
| `trazado` | `'barrios'` (implícito) | `'mazmorra'` = solo calles de la mazmorra; `'cuadricula'` = cuadrícula irregular en los barrios |
| `barrioArea` | 9000 | Área objetivo de un barrio, en celdas |
| `avenidaCentral` | true (solo en `trazado:'mazmorra'`) | Avenida-autopista que cruza la ciudad |
| `derribos` | max(2, round(n/4)) | Casas demolidas para abrir calle |
| `reparar` | 8 | Pasadas del bucle de reparación por reglas |
| `veredaPareja` | true | Rehace todas las veredas con 1 celda de ancho |
| `objetos` | false | Juegos, árboles, bancas y tachos |

### `Halls` (base)
| Parámetro | Valor |
|---|---|
| Paso de la rejilla | 8, 10, 12 o 14 |
| Salas (`rmin`–`rmax`) | 4–8 celdas de lado |
| Silueta | `round: true` |
| Sala central | `central: true` (será la plaza) |
| Avenidas diagonales | 1, 2 o 3 según `n` |

### Medidas (`ciudad.js`, tabla `MEDIDAS`; 1 m = 4 studs)
| Medida | Valor |
|---|---|
| Celda | 2 m |
| Pared y altura de piso | 4 m |
| Puerta | 3 m de alto, 1 celda de ancho |
| Reja | 2 m |
| Grosor de pared | 0,5 m |

### Anchos de vía
| Vía | Ancho |
|---|---|
| Calle | 8 (calzada 6 = 2 carriles de 3) |
| Avenida | 16 o 12 |
| Anillo y autopistas | con mediana |
| Pasaje peatonal | 2 |
| Vereda | 1 celda |
| Isla de rotonda | radio 5 |
| Corte de rotonda | dx+dy < 20 |

### Exportación (`exportar.js`)
`--semilla`, `--n`, `--ligera` (sin plantas superiores, sin piso interior, sin marcas y con techo simple),
`--zona=x,y,w,h`, `--pisos=no`, `--pisoInterior=no`, `--techos=no`, `--marcas=no`.

## 3. Diagonales, conectividad, callejones, variedad y determinismo

### Diagonales
- Son nativas de la rejilla de cuartos de celda: cada pared diagonal recorre la diagonal completa de una celda.
- Los cortes (`cut`, `cutAt`) solo terminan en «T» contra una pared perpendicular. Por eso nunca quedan filos de 45° contra la nada ni dos diagonales cruzadas.
- `checkRules` verifica después: celdas delgadas (`thin`), cuartos diminutos (`tiny`), esquinas de 90°, puertas mal puestas (`badDoors`),
  ángulos agudos (`sharp`) y cuchillas (`blades`).
- Las casas en diagonal giran también su escalera.
- En la exportación, las medias celdas se cubren con bandas a 45°, así que no quedan huecos triangulares.

### Conectividad
- **Garantizada por construcción**, en tres pasos:
  - las calles sueltas se conectan o se convierten (l.157 y l.900);
  - «nada encerrado» (l.1068) le abre una puerta a todo espacio que no se alcanza;
  - las rejas que cierran una calle solo se ponen si queda otro camino.
- **Resultado medido:** se alcanza a pie el 99,2 % a 100 % del suelo caminable, y en 5 de 6 mapas el 100 % de los edificios (ver sección 6).
- **Ojo:** `autos.redesSeparadas` vale 1 fijo en el código (l.1164). Se supone por construcción (`sinCalleSuelta`), pero **no se mide**.

### Callejones sin salida
- **En la mazmorra:** algunos tramos quedan como callejones reales y otros pasan a ser antesalas (l.837–841 de `mazmorra_base.js`, 60 %).
- **En la ciudad:**
  - pasajes peatonales sin salida, de 2 de ancho (5 a 11 por mapa);
  - las rejas que cierran calle obligan a rodear;
  - las puertas interiores en árbol hacen que cada cuarto hoja tenga una sola puerta.

### Variedad
Hay variedad a varios niveles:
- la mazmorra base: pasos desiguales, avenidas diagonales y silueta ondulada;
- los cortes de barrio;
- el estilo de cada barrio: casas sueltas o adosadas, tamaño, tono;
- 20 tipos de edificio (casa, condominio, mansión, tienda, kiosco, taller, oficinas, corporativo, comida, súper, almacén, mercado,
  centro comercial, escuela, hospital, comisaría, bomberos, base militar, cárcel, lago);
- 1 o 2 pisos por edificio, hasta 5 (torres hasta 12 de fachada).

Entre semillas cambian el tamaño del mapa (501 a 525), los edificios (151 a 174) y los cuartos (542 a 638).

### Determinismo
La misma semilla y la misma `n` dan el mismo mapa, en Node y en el navegador (verificado por hash).

**Limitación:** durante la mazmorra se reemplaza `Math.random` global. No es reentrante: dos generaciones en paralelo en el mismo hilo se pisarían.

## 4. Rendimiento

| Semilla / n | Mapa (celdas) | Generación | Exportación | Piezas completa | Piezas ligera |
|---|---|---|---|---|---|
| 7 / 12 | 509×509 | **20,9 s** (proceso solo) | 0,45 s | 27.854 | 16.743 |
| 3 / 12 | 501×501 | 42,8 s\* | 0,51 s | 27.388 | 15.156 |
| 11 / 12 | 509×509 | 46,0 s\* | 0,51 s | 26.711 | 16.602 |
| 21 / 12 | 509×509 | 51,9 s\* | 0,45 s | 28.532 | 16.901 |
| 42 / 12 | 525×525 | 44,3 s\* | 0,53 s | 26.371 | 15.177 |
| 7 / 10 | 445×445 | 35,6 s\* | 0,51 s | 19.276 | 11.719 |

\* Medidas con 6 procesos en paralelo en el mismo contenedor. Un proceso solo tarda unos 20 s con `n=12`.

**Otros números de la exportación:**
- La zona de prueba (`--zona=226,46,60,60`) tiene unas 510 piezas.
- Hay entre 145 y 157 chunks de 800 piezas como máximo cada uno.

**Lo que no hay:**
- No hay perfil por etapa. Por la estructura, el costo está en las pasadas morfológicas sobre ~1 millón de cuartos de celda,
  el bucle de reparación (`reparar: 8`) y los Dijkstra de las rutas.
- No hay generación incremental ni por chunks: siempre se genera la ciudad entera.

## 5. Qué falta, qué es básico y bugs conocidos

### Falta
- **Subidas:** todo el suelo está a una sola altura. Solo los pisos de los edificios suben.
- **Obstáculos en la ruta principal:** rejas, autos, demoliciones y casas destruidas.
- **Alcantarillas y subterráneos.**
- **Interiores:** no hay muebles, estantes ni props. Por decisión de la usuaria hoy son «solo construcciones».
- **Tráfico y IA:** no hay simulación de tráfico ni de navegación. Solo marcas de carril y flechas.
- **Ciudad menos limpia:** no hay escombros, baldíos ni rejas rotas como capa propia.
- **Calidad sin automatizar:** no hay tests unitarios en el repo. La verificación se hace con scripts ad hoc (reglas, auditoría, hash).

### Básico o mejorable
- **Modo cuadrícula** (`ciudad.js`): es el más antiguo y simple.
- **Ruta principal:**
  - elige edificios por cercanía a puntos de paso; no hay diseño de ritmo ni de tensión;
  - todavía no sube a los pisos.
- **Torres de vigilancia:** salen chicas y pocas (0 a 4). No siempre quedan en las esquinas reales.
- **Cajones de estacionamiento:** solo en estacionamientos rectos. Los que están en diagonal no tienen.
- **Versión `--ligera`:** queda entre 15.100 y 16.900 piezas, por encima de la meta de 15.000.

### Bugs y residuos conocidos (por mapa de `n=12`)
- **Reglas que no llegan a cero:**
  - esquinas de 90°: 23 a 38;
  - ángulos agudos: 9 a 25, la mayoría en veredas, patios y bocas de pasaje;
  - puertas mal puestas: 2 a 5.
- **Programa incompleto en algunos edificios** (auditoría, semilla 7):
  - 5 de 56 casas sin dormitorio;
  - 2 de 13 locales de comida sin cocina;
  - 2 departamentos de condominio incompletos;
  - 1 casa y la comisaría sin entrada detectada.
- **Cuartos fuera de rango:**
  - el más chico mide 2 celdas (semilla 7): un fragmento;
  - el más grande, unas 650 celdas (hangar o ancla de centro comercial).
- **Transitabilidad:**
  - `redesSeparadas` no se mide (ver sección 3);
  - con `n=10`, un edificio de 103 queda fuera del alcance a pie.

## 6. Métricas medidas (commit `9cf39a5`, `n=12` salvo donde se indica)

| Métrica | s7 | s3 | s11 | s21 | s42 | s7 n10 |
|---|---|---|---|---|---|---|
| Edificios | 174 | 151 | 162 | 161 | 169 | 103 |
| Cuartos | 638 | 542 | 584 | 547 | 611 | 370 |
| Suelo caminable alcanzable desde A | 100 % | 100 % | 100 % | 100 % | 99,9 % | 99,2 % |
| Edificios alcanzables a pie | 174/174 | 151/151 | 162/162 | 161/161 | 169/169 | 102/103 |
| Cuartos sin puerta | 0 | 0 | 0 | 0 | 0 | 0 |
| Cuartos con una sola puerta (hojas del árbol) | 154 (24 %) | 140 (26 %) | 147 (25 %) | 127 (23 %) | 169 (28 %) | 97 (26 %) |
| Edificios con puerta a la calle | 126 | 113 | 111 | 105 | 132 | 61 |
| Calzada (celdas) | 49.503 | 47.325 | 49.394 | 47.477 | 47.217 | 37.144 |
| Ruta directa A→B: pasos / rodeo | 924 / 1,18 | 702 / 1,15 | 810 / 1,23 | 1008 / 1,22 | 926 / 1,11 | 720 / 1,18 |
| Ruta principal: celdas / rodeo / % por dentro | 1169 / 4,01 / 24 % | 831 / 3,69 / 18 % | 1135 / 4,43 / 30 % | 941 / 3,08 / 26 % | 855 / 2,86 / 25 % | 763 / 3,38 / 22 % |
| Cruces de diagonales | 0 | 0 | 0 | 0 | 0 | 0 |
| Esquinas 90° / agudos / puertas mal | 33 / 16 / 2 | 23 / 11 / 3 | 32 / 25 / 5 | 38 / 9 / 3 | 30 / 18 / 3 | 35 / 12 / 1 |
| Delgados / diminutos / cuchillas | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

### Tamaño de cuartos, en celdas de 2×2 m
| Semilla | Mínimo | p10 | Mediana | p90 | Máximo | Media |
|---|---|---|---|---|---|---|
| s7 | 2 | 19,5 | 40 | 72 | 647 | 46,6 |
| s3 | 14 | 20 | 40 | 71,5 | 490 | 46,4 |
| s11 | 9 | 18 | 40 | 73 | 446 | 48,8 |
| s21 | 11 | 19,5 | 40 | 79 | 522 | 48,7 |
| s42 | 11,5 | 17,5 | 36 | 71,5 | 430 | 44,4 |

La mediana de unas 40 celdas equivale a unos 160 m² en medidas arcade (personaje de unos 3 m).

### Reparto del suelo (semilla 7, en celdas)
| Tipo | Celdas |
|---|---|
| Campo | 137.675 |
| Calzada | 49.503 |
| Cuartos | 29.747 |
| Patios | 12.309 |
| Veredas | 12.259 |
| Parques | 7.539 |
| Estacionamientos | 2.803 |
| Juegos | 1.915 |
| Plaza | 1.812 |
| Canteros | 1.564 |
| Rotondas | 496 |

### Pisos (semilla 7)
- Pisos máximos: 5.
- 135 escaleras y 52 puentes o tablas entre techos.

### Cómo repetir las mediciones
- `node ciudad/exportar.js --semilla=N` da las piezas.
- `transitabilidad` está en `index.json`.
- `node ciudad/auditar.js 7` da la auditoría de programas.
- Las reglas se miden con `MazmorraBase.checkRules(W, H, paredes, puertas, columnas)` sobre `segs`.
