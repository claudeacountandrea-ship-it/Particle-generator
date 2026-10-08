import json
def wk(a,b):
    p,q=(a,b) if (a[1],a[0])<=(b[1],b[0]) else (b,a)
    return f"{p[0]},{p[1]}|{q[0]},{q[1]}"
def poly(*pts, closed=False):
    pts=list(pts)+([pts[0]] if closed else [])
    out=[]
    for a,b in zip(pts,pts[1:]):
        dx=(b[0]>a[0])-(b[0]<a[0]); dy=(b[1]>a[1])-(b[1]<a[1]); c=a
        while c!=b:
            n=(c[0]+dx,c[1]+dy); out.append(wk(c,n)); c=n
    return out
cols=lambda *p:[f"{x},{y}" for x,y in p]
pads=[]
def add(i,title,desc,walls,columns,size=9,ask=False):
    pads.append(dict(id=f"c{i:02d}",author="claude",order=i,title=title,desc=desc,size=size,walls=walls,columns=columns,ask=ask,reply=""))

add(1,"Sala cuadrada",
"Lo más básico: 4 paredes rectas que unen puntos vecinos. Pongo una columna en cada esquina porque ahí la pared cambia de dirección (idea: la columna 'sostiene' el giro).\n\nRazón para el generador: si las esquinas siempre llevan columna, el modelo aprende una regla simple. ¿Es así en tu sistema o las columnas son opcionales?",
poly((1,1),(7,1),(7,7),(1,7),closed=True), cols((1,1),(7,1),(7,7),(1,7)), ask=True)

add(2,"Sala octogonal",
"Misma sala pero con las esquinas cortadas en diagonal. Cada diagonal va de un punto a su vecino en esquina (la conexión SE/SO).\n\nRazón: con 8 vecinos por punto salen ángulos de 45°, así que las salas pueden ser octógonos, no solo cajas. Columnas en los 8 cambios de dirección.",
poly((3,1),(5,1),(7,3),(7,5),(5,7),(3,7),(1,5),(1,3),closed=True), cols((3,1),(5,1),(7,3),(7,5),(5,7),(3,7),(1,5),(1,3)))

add(3,"¿Así es una puerta?",
"Mi suposición: una puerta es un hueco en la pared, de 2 espacios de ancho, con una columna a cada lado (jambas).\n\nPregunta: ¿cómo marcas tú una puerta? ¿Solo un hueco, un hueco con columnas, o necesitas otro símbolo? Corrige el dibujo si quieres.",
poly((0,4),(3,4))+poly((5,4),(8,4)), cols((3,4),(5,4)), ask=True)

add(4,"Pasillo diagonal",
"Dos paredes diagonales paralelas. Ojo con el ancho: en diagonal, 1 paso de grid mide ~1.41 (raíz de 2). Si separo las paredes 3 puntos en horizontal, el pasillo mide ~2.1 de ancho real, parecido a un pasillo recto de 2.\n\nPregunta: ¿te importa que el ancho diagonal sea un poco distinto del recto, o lo quieres igual siempre?",
poly((0,1),(7,8))+poly((2,0),(8,6)), [], ask=True)

add(5,"Codo: recto que gira a 45°",
"Pasillo horizontal de 2 de ancho que gira en diagonal. Columna en cada punto donde la pared dobla.\n\nRazón: esta es la pieza clave de tu sistema, el paso de rectas a diagonales. Si el generador aprende bien los codos, puede unir cualquier sala con cualquier pasillo.",
poly((0,2),(3,2),(8,7))+poly((0,4),(2,4),(6,8)), cols((3,2),(2,4)))

add(6,"Sala con pilares",
"Sala grande con columnas sueltas en el interior (no tocan ninguna pared).\n\nRazón: una columna sola = pilar, que da estructura y cobertura en combate. ¿Las columnas sueltas tienen sentido para ti o siempre van pegadas a paredes?",
poly((0,0),(8,0),(8,8),(0,8),closed=True), cols((0,0),(8,0),(8,8),(0,8),(3,3),(5,3),(3,5),(5,5)), ask=True)

add(7,"¿Se pueden cruzar diagonales?",
"Dentro de una celda caben dos diagonales que se cruzan en X (SE y SO entre los mismos 4 puntos).\n\nPregunta: ¿esto está permitido o es un error? Si está prohibido, el generador debería tener esa regla.",
poly((3,3),(4,4))+poly((4,3),(3,4))+poly((1,3),(3,3))+poly((4,4),(6,4)), [], size=7, ask=True)

add(8,"Dibuja: un cruce de pasillos",
"Pizarra vacía para ti. ¿Cómo se unen dos pasillos? Dibuja un cruce o una T, mezclando rectas y diagonales si quieres, y explica abajo por qué.",
[], [], ask=True)

add(9,"Dibuja: tu sala típica",
"Pizarra vacía. Dibuja una sala como te la imaginas en tu masmorra (puede ser pequeña) y cuéntame para qué sirve y por qué tiene esa forma.",
[], [], ask=True)

ops=[{"action":"set","collection":"sketches","doc_id":p.pop("id"),"data":p} for p in pads]
json.dump(ops,open("ops.json","w"))
print(len(ops))
