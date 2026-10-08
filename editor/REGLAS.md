# Reglas del generador de masmorras (borrador)

Sacadas de las pizarras del editor (`editor/index.html`). Estado: **por confirmar**
con la ronda 2 de ejemplos (`seed_round2.py`).

## Base
- Grid de vértices. Cada vértice conecta con sus 8 vecinos: una pared es un tramo
  recto (E/S) o diagonal (SE/SO) entre dos vecinos.
- Columna = vértice marcado.
- Puerta = tramo de pared existente convertido (las puertas son un subconjunto de las paredes).

## Confirmadas por el usuario
1. **Salas con bisel**: las esquinas se cortan con una diagonal; columnas en los
   extremos del bisel. *(pizarra "Sala cuadrada")*
2. **Puertas al centro** de la pared: si el tramo recto mide un número **par** → puerta de 2;
   si es **impar** → puerta de 1. *(pizarra "¿Así es una puerta?")*
3. **Pasillos de ancho 1 o 2 puertas**, también en diagonal. *(pizarra "Pasillo diagonal")*
4. **Nunca medias puertas**: dos paredes diagonales paralelas (`x-y=c` o `x+y=c`)
   deben estar separadas por un número **par** de `c` (2 → ancho 1, 4 → ancho 2).
   Separación impar = pasillo imposible. *(pizarras "Codo" marcada a evitar, "Pizarra 1" y "Pizarra 2")*
5. **Giro recto → diagonal**: la pared de afuera gira después que la de adentro, de forma que se cumpla la regla 4.
   Con pasillo de 2: la diferencia entre los puntos de giro es 2 → diagonal de 2. *(Pizarra 2)*
6. **No se cruzan diagonales en X** dentro de una celda. *(pizarra marcada a evitar)*

## Preguntas abiertas (ronda 2)
- ¿El pasillo que sale de una puerta tiene el ancho de esa puerta?
- ¿Cuándo va columna en un giro de pasillo?
- ¿Se puede poner puerta en un bisel?
- ¿Las uniones en T necesitan bisel?
- ¿El bisel puede medir 2 o más?
