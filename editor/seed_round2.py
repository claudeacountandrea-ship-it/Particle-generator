import json, sys
sys.path.insert(0,'/tmp/claude-0/tools')
def wk(a,b):
    p,q=(a,b) if (a[1],a[0])<=(b[1],b[0]) else (b,a)
    return f"{p[0]},{p[1]}|{q[0]},{q[1]}"
def segs(a,b):
    dx=(b[0]>a[0])-(b[0]<a[0]); dy=(b[1]>a[1])-(b[1]<a[1]); c=a; out=[]
    while c!=b:
        n=(c[0]+dx,c[1]+dy); out.append(wk(c,n)); c=n
    return out
def poly(*pts, closed=False):
    pts=list(pts)+([pts[0]] if closed else []); o=[]
    for a,b in zip(pts,pts[1:]): o+=segs(a,b)
    return o
def door(a,b):
    """centered door on straight run a→b: even length → 2, odd → 1"""
    s=segs(a,b); L=len(s); w=2 if L%2==0 else 1
    i=(L-w)//2; return s[i:i+w]
def room(x0,y0,x1,y1,doors=()):
    """room with 1-step bevelled corners; columns at bevel ends; doors on named sides"""
    T=((x0+1,y0),(x1-1,y0)); R=((x1,y0+1),(x1,y1-1)); B=((x1-1,y1),(x0+1,y1)); L=((x0,y1-1),(x0,y0+1))
    w=poly(T[0],T[1],R[0],R[1],B[0],B[1],L[0],L[1],closed=True)
    d=[]
    for side in doors: d+=door(*{'T':T,'R':R,'B':B,'L':L}[side])
    c=[f"{x},{y}" for x,y in (T+R+B+L)]
    return w,d,c
pads=[]
def add(i,title,desc,w,d,c,W=13,H=15,kind='good'):
    pads.append(dict(id=f"g{i:02d}",author="claude",order=100+i,title=title,desc=desc,size=W,rows=H,
                     walls=sorted(set(w)),doors=sorted(set(d)),columns=sorted(set(c)),ask=True,reply="",kind=kind))

# G1 room 8 wide (straight 6 → door 2), 7 tall (straight 5 → door 1)
w,d,c=room(2,3,10,10,'TR')
add(1,"Revisa: sala biselada con 2 puertas",
"Apliqué tus reglas:\n• Esquinas con bisel (1 diagonal) y columnas en los extremos del bisel.\n• Puertas al centro de la pared: arriba la pared recta mide 6 (par) → puerta de 2; a la derecha mide 5 (impar) → puerta de 1.\n\n¿Lo apruebas o lo corriges?",w,d,c)

# G2 room with door 1 on bottom and a width-1 corridor leaving it
w,d,c=room(3,2,10,9,'B')
dd=door((9,9),(4,9)); xs=sorted({int(p.split(',')[0]) for k in dd for p in k.split('|')})
w+=poly((xs[0],9),(xs[0],14))+poly((xs[-1],9),(xs[-1],14))
add(2,"Revisa: sala + pasillo de 1",
"Sala de pared recta impar (5) → puerta de 1 al centro abajo. Desde la puerta sale un pasillo recto del mismo ancho que la puerta (1).\n\nRegla que supongo: el pasillo que sale de una puerta tiene el ancho de esa puerta. ¿Correcto?",w,d,c)

# G3 horizontal width-2 corridor turning up-right into diagonal width-2; diagonal door at the end
top=poly((0,10),(4,10),(9,5)); bot=poly((0,12),(6,12),(11,7))
end=poly((9,5),(11,7))
add(3,"Revisa: codo recto → diagonal hacia arriba",
"Como tu 'Pizarra 2' pero girando hacia arriba. Pasillo recto de 2; la pared de afuera gira 2 puntos después que la de adentro, así el tramo diagonal también mide 2 puertas (diferencia par entre diagonales).\n\nAl final cierro con una puerta diagonal de 2.\n\nPregunta: en tu Pizarra 2 pusiste columna solo en una esquina del giro. ¿Cuándo va columna en un giro de pasillo?",
top+bot+end,end,["4,10","6,12"])

# G4 door on the bevel + width-1 diagonal corridor going up-left
w,d,c=room(5,8,11,14,'RB')
bev=wk((5,9),(6,8)); d.append(bev)
w+=poly((5,9),(1,5))+poly((6,8),(2,4))
add(4,"Revisa: puerta en el bisel",
"El bisel mide 1 (impar) → puerta de 1 en la diagonal. De ahí sale un pasillo diagonal de ancho 1 (las dos paredes diagonales separadas por 2, número par).\n\nTambién puse puertas de 2 al centro de las paredes de 4.\n\n¿Se permite poner puertas en los biseles?",w,d,c)

# G5 T junction of width-2 corridors
w=poly((0,5),(12,5))+poly((0,7),(5,7),(5,14))+poly((7,14),(7,7),(12,7))
add(5,"Revisa: cruce en T",
"Pasillo horizontal de 2 y otro vertical de 2 que llega desde abajo. Las columnas van en las dos esquinas donde se unen.\n\n¿Así se unen los pasillos o la unión necesita bisel también?",w,[],["5,7","7,7"])

# G6 deliberate mistake: diagonal corridor with odd separation (3)
w=poly((1,3),(9,11))+poly((4,3),(11,10))
add(6,"¿Mal? diagonal con separación impar",
"Creo que esto está MAL según tu regla: las paredes diagonales están separadas 3 (impar), y no se puede cerrar con puertas enteras.\n\nSi estoy en lo correcto, déjalo como 'a evitar'.",w,[],[],kind='avoid')

# G7 deliberate mistake: off-centre door
w,d,c=room(2,3,10,10,'')
d=segs((3,3),(9,3))[0:2]
add(7,"¿Mal? puerta fuera del centro",
"Puerta de 2 pegada a la esquina en vez del centro. Según tu regla, las puertas van siempre al medio, así que lo marqué 'a evitar'.\n\n¿Correcto?",w,d,c,kind='avoid')

# G8 big octagon, bevel of 2, door 2 on the bevel
x0,y0,x1,y1=1,2,11,12
pts=[(x0+2,y0),(x1-2,y0),(x1,y0+2),(x1,y1-2),(x1-2,y1),(x0+2,y1),(x0,y1-2),(x0,y0+2)]
w=poly(*pts,closed=True)
d=door((x0+2,y0),(x1-2,y0))+segs((x1-2,y0),(x1,y0+2))+door((x1-2,y1),(x0+2,y1))
c=[f"{x},{y}" for x,y in pts]
add(8,"Revisa: sala con bisel grande",
"Bisel de 2 en vez de 1 (sala casi octogonal). El bisel de arriba a la derecha mide 2 (par) → toda la diagonal es una puerta de 2. Arriba y abajo, paredes de 6 → puertas de 2.\n\n¿El bisel puede ser de 2 o más, o siempre es de 1?",w,d,c)

ops=[]
for p in pads:
    pid=p.pop('id'); f=f"/tmp/claude-0/s/{pid}.json"; json.dump(p,open(f,'w'),ensure_ascii=False)
    ops.append({"op":"set","collection":"sketches","doc_id":pid,"file_path":f})
    json.dump(dict(p,id=pid),open(f"/tmp/claude-0/s/show_{pid}.json",'w'),ensure_ascii=False)
json.dump(ops,open('/tmp/claude-0/s/ops2.json','w'))
