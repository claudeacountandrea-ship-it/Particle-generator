import fs from 'fs';
const vk=(x,y)=>x+','+y;
function wk(a,b){const [p,q]=(a[1]<b[1]||(a[1]===b[1]&&a[0]<=b[0]))?[a,b]:[b,a];return vk(p[0],p[1])+'|'+vk(q[0],q[1]);}
const parseW = k => k.split('|').map(s => s.split(',').map(Number));
eval(fs.readFileSync('/tmp/claude-0/grand2.js','utf8').replace('const Grand','globalThis.Grand').replace('const Build','globalThis.Build').replace('const bevelRect','globalThis.bevelRect').replace('const rombo','globalThis.rombo'));
const R = (x0,y0,x1,y1,b=0) => bevelRect(x0,y0,x1,y1,b);
// shapes: [name, f]; later shapes paint over earlier ones. links: [nameA, nameB]. out: [name, 'bottom'|'top'] door to outside
function arch(W, H, shapes, links, out, mirror) {
  const B = Build(W, H), L = {};
  const all = mirror ? shapes.flatMap(([n, f]) => [[n, f], [n + "'", (x, y) => f(W - 1 - x, y)]]) : shapes;
  for (const [n, f] of all) { L[n] = L[n] || B.label('room'); B.paint(f, L[n]); }
  B.snap();
  let segs = B.segments(); const runs = B.runs(segs), doors = [];
  const allLinks = mirror ? links.flatMap(([a, b]) => [[a, b], [a.endsWith('|') ? a.slice(0, -1) : a + "'", b.endsWith('|') ? b.slice(0, -1) : b + "'"]]) : links;
  for (let [a, b] of allLinks) {
    a = a.replace('|', ''); b = b.replace('|', '');
    if (!L[a] || !L[b]) { console.error('missing', a, b); continue; }
    const key = Math.min(L[a], L[b]) + ',' + Math.max(L[a], L[b]), run = runs.get(key);
    if (!run) { console.error('no wall between', a, b); continue; }
    doors.push(...B.door(run));
  }
  for (const [n, side] of out) {
    const o = segs.filter(s => (s.a === L[n] || s.b === L[n]) && (!s.a || !s.b) && s.d === 'h');
    const ys = o.map(s => s.line), y = side === 'bottom' ? Math.max(...ys) : Math.min(...ys);
    doors.push(...B.door(o.filter(s => s.line === y).sort((a, b) => a.pos - b.pos)));
  }
  const walls = segs.map(s => s.k), ws = new Set(walls), deg = new Map();
  for (const k of walls) for (const p of parseW(k)) { const v = vk(...p); deg.set(v, (deg.get(v) || 0) + 1); }
  return { size: W, rows: H, walls, doors: [...new Set(doors)].filter(k => ws.has(k)), columns: [...deg].filter(([, d]) => d >= 3).map(([v]) => v) };
}
const pads = [];
// 1. Egyptian tomb: a long axis going down into the rock, gates, antechamber, side annex, pillared burial hall
{
  const W = 41, H = 61, c = 20;
  const sh = [
    ['entrada', R(c - 3, 52, c + 3, 58, 2)],
    ['pasillo1', R(c - 1, 40, c + 1, 52)], ['pasillo2', R(c - 1, 30, c + 1, 40)],
    ['antecamara', R(c - 8, 22, c + 8, 30, 2)],
    ['anexo', R(c + 8, 24, c + 16, 30, 2)],
    ['pasillo3', R(c - 1, 18, c + 1, 22)],
    ['sala_pilares', R(c - 12, 4, c + 12, 18, 3)],
    ['camara', rombo(c, 11, 5)],
    ['almacen_izq', R(c - 18, 6, c - 12, 16, 2)], ['almacen_der', R(c + 12, 6, c + 18, 16, 2)],
  ];
  const m = arch(W, H, sh, [['entrada','pasillo1'],['pasillo1','pasillo2'],['pasillo2','antecamara'],['antecamara','anexo'],['antecamara','pasillo3'],['pasillo3','sala_pilares'],['sala_pilares','camara'],['sala_pilares','almacen_izq'],['sala_pilares','almacen_der']], [['entrada','bottom']]);
  for (const [x, y] of [[c-9,8],[c+9,8],[c-9,14],[c+9,14]]) m.columns.push(vk(x, y));
  pads.push({ id: 'ar1', title: 'Arquitectura: tumba egipcia (eje)', ...m, desc:
    'Tumba de eje: se entra por abajo y se baja por un pasillo largo cortado por puertas (cada puerta es una etapa). ' +
    'Antecámara con un anexo lateral (callejón con propósito: tesoro o trampa). Al fondo, la sala de pilares con dos almacenes simétricos y, en el centro, la cámara funeraria en rombo.\n\n' +
    'Ideas para el generador: un eje principal, cada tramo cerrado por una puerta, simetría alrededor del final, la sala más importante en el centro y al fondo.' });
}
// 2. Cruciform crypt: a crossing (rombo) with four arms, aisles along the nave, apse at the top
{
  const W = 49, H = 57, c = 24;
  const sh = [
    ['nave', R(c - 4, 26, c + 4, 52, 0)],
    ['nartex', R(c - 10, 48, c + 10, 54, 2)],
    ['nave_lat_izq', R(c - 10, 26, c - 4, 48)], ['nave_lat_der', R(c + 4, 26, c + 10, 48)],
    ['brazo_izq', R(4, 12, c - 4, 26, 3)], ['brazo_der', R(c + 4, 12, W - 5, 26, 3)],
    ['cabecera', R(c - 6, 2, c + 6, 12, 3)],
    ['crucero', rombo(c, 19, 7)],
    ['capilla_izq', R(4, 4, c - 8, 12, 2)], ['capilla_der', R(c + 8, 4, W - 5, 12, 2)],
  ];
  const m = arch(W, H, sh, [['nartex','nave'],['nartex','nave_lat_izq'],['nartex','nave_lat_der'],['nave','crucero'],['nave_lat_izq','brazo_izq'],['nave_lat_der','brazo_der'],['crucero','brazo_izq'],['crucero','brazo_der'],['crucero','cabecera'],['brazo_izq','capilla_izq'],['brazo_der','capilla_der']], [['nartex','bottom']]);
  pads.push({ id: 'ar2', title: 'Arquitectura: cripta en cruz', ...m, desc:
    'Planta en cruz, como una catedral: nártex (entrada), nave central con dos naves laterales paralelas (dos caminos que vuelven a juntarse: bucle), crucero en rombo donde se cruzan los brazos, capillas al final de cada brazo y la cabecera arriba.\n\n' +
    'Ideas: caminos paralelos que se reúnen, un cruce central como sala principal, simetría izquierda-derecha y salas pequeñas en los extremos.' });
}
// 3. Zelda-style ring: sanctum in the middle, ring corridor cut by doors, rooms around, key room off to one side
{
  const W = 49, H = 49, c = 24;
  const sh = [
    ['anillo_s', R(8, 32, 40, 40, 0)], ['anillo_n', R(8, 8, 40, 16, 0)], ['anillo_o', R(8, 8, 16, 40, 0)], ['anillo_e', R(32, 8, 40, 40, 0)],
    ['patio', R(16, 16, 32, 32)],
    ['santuario', rombo(c, c, 7)],
    ['entrada', R(c - 4, 40, c + 4, 46, 2)],
    ['sala_no', R(10, 2, 24, 8, 2)], ['sala_ne', R(24, 2, 38, 8, 2)], ['sala_o', R(2, 16, 8, 32, 2)], ['sala_e', R(40, 16, 46, 32, 2)],
    ['llave', R(40, 34, 46, 46, 2)],
  ];
  const m = arch(W, H, sh, [['entrada','anillo_s'],['anillo_s','anillo_o'],['anillo_o','anillo_n'],['anillo_n','anillo_e'],['anillo_e','llave'],['anillo_o','sala_o'],['anillo_n','sala_no'],['anillo_n','sala_ne'],['anillo_e','sala_e'],['anillo_s','patio'],['patio','santuario']], [['entrada','bottom']]);
  pads.push({ id: 'ar3', title: 'Arquitectura: anillo estilo Zelda', ...m, desc:
    'Se entra al anillo; el santuario central (rombo) se ve desde el principio, pero para llegar hay que recorrer todo el anillo, que está cortado en tramos por puertas. La llave está en una sala al final del recorrido (este). Entre el anillo sur y el este no hay puerta: hay que dar toda la vuelta.\n\n' +
    'Ideas: meta visible pero lejana, recorrido circular, salas en las esquinas, llave y cerradura.' });
}
// 4. Hub with shortcuts (Dark Souls): central hub, three long winding wings that end next to the hub with a shortcut door
{
  const W = 57, H = 49;
  const sh = [
    ['ala_o1', R(2, 20, 24, 28)], ['ala_o2', R(2, 2, 10, 20)], ['ala_o3', R(10, 2, 24, 10)], ['fin_o', R(16, 10, 26, 20)],
    ['ala_e1', R(32, 20, 54, 28)], ['ala_e2', R(46, 28, 54, 46)], ['ala_e3', R(32, 38, 46, 46)], ['fin_e', R(30, 28, 40, 38)],
    ['ala_n1', R(26, 2, 34, 20)], ['ala_n2', R(34, 2, 46, 10)], ['fin_n', R(32, 10, 42, 22, 2)],
    ['entrada', R(18, 38, 30, 46, 2)], ['pasillo_ent', R(26, 28, 30, 38)],
    ['hub', rombo(28, 24, 6)],
  ];
  const m = arch(W, H, sh, [['entrada','pasillo_ent'],['pasillo_ent','hub'],['hub','ala_o1'],['ala_o1','ala_o2'],['ala_o2','ala_o3'],['ala_o3','fin_o'],['fin_o','hub'],['hub','ala_e1'],['ala_e1','ala_e2'],['ala_e2','ala_e3'],['ala_e3','fin_e'],['fin_e','hub'],['hub','ala_n1'],['ala_n1','ala_n2'],['ala_n2','fin_n']], [['entrada','bottom']]);
  pads.push({ id: 'ar4', title: 'Arquitectura: centro con atajos (Dark Souls)', ...m, desc:
    'Un salón central (rombo) del que salen alas largas que dan la vuelta. Cada ala termina en una sala pegada otra vez al centro, con una puerta-atajo de regreso: el recorrido largo se “cierra” y la próxima vez es corto.\n\n' +
    'Ideas: un centro que se conecta con todo, recorridos que se enroscan y atajos que vuelven al centro.' });
}
const w = [];
pads.forEach((p, i) => {
  const { id, ...d } = p; Object.assign(d, { author: 'claude', ask: true, reply: '', kind: 'good', order: 50 + i, createdAt: Date.now() + i, marks: {} });
  const f = `/tmp/claude-0/s/${id}.json`; fs.writeFileSync(f, JSON.stringify(d)); fs.writeFileSync(`/tmp/claude-0/s/show_${id}.json`, JSON.stringify(d));
  w.push({ op: 'set', collection: 'sketches', doc_id: id, file_path: f });
  console.error(id, d.title, d.walls.length, d.doors.length);
});
console.log(JSON.stringify(w));
