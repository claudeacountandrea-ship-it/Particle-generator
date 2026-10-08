# Reglas del generador de masmorras (borrador)

Sacadas de las pizarras del editor (`editor/index.html`). Estado: **por confirmar**
con la ronda 2 de ejemplos (`seed_round2.py`).

## Base
- Grid de vértices. Cada vértice conecta con sus 8 vecinos: una pared es un tramo
  recto (E/S) o diagonal (SE/SO) entre dos vecinos.
- Columna = vértice marcado.
- Puerta = tramo de pared existente convertido (las puertas son un subconjunto de las paredes).

## Confirmadas por el usuario
1. **Salas cuadradas o en rombo, sin bisel.** La sala octogonal (esquinas cortadas)
   se evita. Ancho y largo se miden en puertas/paredes enteras: nunca media pared.
   El generador usa lados pares para que la puerta de 2 quede centrada.
   *(cambiado: antes las salas llevaban bisel)*
2. **Puertas al centro** de la pared: si el tramo recto mide un número **par** → puerta de 2;
   si es **impar** → puerta de 1. *(pizarra "¿Así es una puerta?")*
3. **Pasillos de ancho 1 o 2 puertas**, también en diagonal. *(pizarra "Pasillo diagonal")*
4. **Nunca medias puertas**: dos paredes diagonales paralelas (`x-y=c` o `x+y=c`)
   deben estar separadas por un número **par** de `c` (2 → ancho 1, 4 → ancho 2).
   Separación impar = pasillo imposible. *(pizarras "Codo" marcada a evitar, "Pizarra 1" y "Pizarra 2")*
5. **Giro recto → diagonal**: la pared de afuera gira después que la de adentro, de forma que se cumpla la regla 4.
   Con pasillo de 2: la diferencia entre los puntos de giro es 2 → diagonal de 2. *(Pizarra 2)*
6. **No se cruzan diagonales en X** dentro de una celda. *(pizarra marcada a evitar)*
7. **Salas en rombo**: cuadrado girado 45°, lados diagonales. El generador las hace
   con punta (sin puntas rectas) para no caer en forma octogonal. *(pizarra "Cuarto cuadrado en rombo")*
9. **Paredes cruzadas delimitan el espacio de una pared** (por confirmar cómo se aplica).
8. **Cruces diagonales**: un pasillo diagonal puede tener una rama perpendicular,
   también diagonal. *(pizarra "Dibuja: un cruce de pasillos")*

## Laberinto
Botones **🧩 4×4 / 7×7 / 10×10** en `editor/index.html`. Nodos cada 8 puntos: cruces,
salas cuadradas 6×6 (solo pasillos rectos) o rombos de lado 4 (solo pasillos diagonales).
Árbol aleatorio + algunos bucles, pasillos de 2, diagonales nunca cruzadas. El piso se
calcula por celda (llena, vacía o media celda cortada por una diagonal), así toda pared
es un tramo entero. Revisión: modo **🖍 Marcar piso** con colores error / dudoso / bien.

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
