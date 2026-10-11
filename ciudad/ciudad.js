// Ciudad zombi: generador de ciudad (calles, manzanas, casas con cuartos, rejas, plazas, autos chocados)
// y su exportación a piezas para TruWorlds. Funciona en el navegador (window.Ciudad) y en Node (globalThis.Ciudad).
// Rejilla de celdas: 1 celda = 2 personas (2 m arcade = 8 studs, ver MEDIDAS). Las paredes, puertas, ventanas y rejas viven en los bordes entre celdas.
(function (root) {
  'use strict';
  const T = { VOID: 0, STREET: 1, PLAZA: 2, PARK: 3, YARD: 4, FLOOR: 5, CAR: 6, TREE: 7, FOUNT: 8 };
  const E = { NONE: 0, WALL: 1, DOOR: 2, WIN: 3, WINOPEN: 4, FENCE: 5, GATE: 6, BIGDOOR: 7 };
  const PASS = [1, 0, 1, 0, 1, 0, 1, 1]; // por tipo de borde: se puede cruzar
  const BLOCKED = new Set([T.CAR, T.TREE, T.FOUNT]);

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function generate(o = {}) {
    const seed = (o.seed ?? 1) >>> 0, W = o.w ?? 150, H = o.h ?? 110;
    const R = rng(seed), rnd = (a, b) => a + Math.floor(R() * (b - a + 1)), chance = p => R() < p;
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const N = W * H, cell = new Uint8Array(N).fill(T.STREET), under = new Uint8Array(N), room = new Int32Array(N).fill(-1), lotOf = new Int32Array(N).fill(-1);
    const vE = new Uint8Array((W + 1) * H), hE = new Uint8Array(W * (H + 1)); // vE: borde a la izquierda de (x,y); hE: borde arriba de (x,y)
    const I = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const ei = (x1, y1, x2, y2) => x2 !== x1 ? [vE, y1 * (W + 1) + Math.max(x1, x2)] : [hE, Math.max(y1, y2) * W + x1];
    const getE = (a, b, c, d) => { const [A, i] = ei(a, b, c, d); return A[i]; };
    let log = null; // cambios de la prueba en curso (para deshacer)
    const setE = (a, b, c, d, v) => { const [A, i] = ei(a, b, c, d); if (log) log.push([A, i, A[i]]); A[i] = v; };
    const setC = (i, t) => { if (log) log.push([cell, i, cell[i]], [under, i, under[i]]); if (BLOCKED.has(t)) under[i] = cell[i]; cell[i] = t; };
    const streets = [], blocks = [], lots = [], houses = [], rooms = [], cars = [], piles = [], trees = [], founts = [];
    const feats = { medianas: 0, rejasCalle: 0, rejasParciales: 0, choques: 0, autos: 0 };

    // ---------- calles: anillo exterior y división de manzanas (avenidas, calles, callejones)
    const RING = 4;
    streets.push({ x: 0, y: 0, w: W, h: RING, dir: 'h', width: RING, ring: true }, { x: 0, y: H - RING, w: W, h: RING, dir: 'h', width: RING, ring: true },
      { x: 0, y: RING, w: RING, h: H - 2 * RING, dir: 'v', width: RING, ring: true }, { x: W - RING, y: RING, w: RING, h: H - 2 * RING, dir: 'v', width: RING, ring: true });
    const split = (r, d) => {
      const longX = r.w >= r.h, L = longX ? r.w : r.h, minB = 14;
      const sw = d === 0 ? (chance(0.5) ? 10 : 8) : d === 1 ? (chance(0.5) ? 6 : 4) : (chance(0.22) ? 2 : 4);
      if (L < 2 * minB + sw || (L <= 46 && d >= 2 && chance(0.45))) return leaf(r);
      const p = rnd(minB, L - minB - sw);
      if (longX) { streets.push({ x: r.x + p, y: r.y, w: sw, h: r.h, dir: 'v', width: sw, depth: d }); split({ x: r.x, y: r.y, w: p, h: r.h }, d + 1); split({ x: r.x + p + sw, y: r.y, w: r.w - p - sw, h: r.h }, d + 1); }
      else { streets.push({ x: r.x, y: r.y + p, w: r.w, h: sw, dir: 'h', width: sw, depth: d }); split({ x: r.x, y: r.y, w: r.w, h: p }, d + 1); split({ x: r.x, y: r.y + p + sw, w: r.w, h: r.h - p - sw }, d + 1); }
    };
    const fillR = (r, t) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cell[I(x, y)] = t; };
    function leaf(r) {
      const minS = Math.min(r.w, r.h), maxS = Math.max(r.w, r.h);
      if (maxS / minS >= 2.4 && minS <= 18 && chance(0.4)) return plaza(r, 'paseo');
      if (minS >= 22 && chance(0.28)) return chance(0.5) ? plaza(r, 'plaza') : park(r);
      lotsOf(r);
    }
    function plaza(r, kind) {
      blocks.push({ ...r, kind }); fillR(r, T.PLAZA);
      if (kind === 'paseo') { // plaza alargada: fila de árboles al medio
        const alongX = r.w >= r.h, L = alongX ? r.w : r.h, mid = alongX ? r.y + (r.h >> 1) : r.x + (r.w >> 1);
        for (let t = 2; t < L - 2; t += 4) { const [x, y] = alongX ? [r.x + t, mid] : [mid, r.y + t]; setC(I(x, y), T.TREE); trees.push([x, y]); }
      } else {
        const s = minOf(r) >= 18 ? 4 : 2, fx = r.x + ((r.w - s) >> 1), fy = r.y + ((r.h - s) >> 1);
        for (let y = fy; y < fy + s; y++) for (let x = fx; x < fx + s; x++) setC(I(x, y), T.FOUNT);
        founts.push({ x: fx, y: fy, s });
        for (const [x, y] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) { setC(I(x, y), T.TREE); trees.push([x, y]); }
      }
    }
    const minOf = r => Math.min(r.w, r.h);
    function park(r) {
      blocks.push({ ...r, kind: 'parque' }); fillR(r, T.PARK);
      for (let x = r.x; x < r.x + r.w; x++) { setE(x, r.y - 1, x, r.y, E.FENCE); setE(x, r.y + r.h - 1, x, r.y + r.h, E.FENCE); }
      for (let y = r.y; y < r.y + r.h; y++) { setE(r.x - 1, y, r.x, y, E.FENCE); setE(r.x + r.w - 1, y, r.x + r.w, y, E.FENCE); }
      // portones de 2 en el medio de la mayoría de los lados
      const mx = r.x + (r.w >> 1), my = r.y + (r.h >> 1);
      shuffle([0, 1, 2, 3]).forEach((s, k) => {
        if (k >= 2 && !chance(0.5)) return;
        for (const t of [-1, 0]) {
          if (s === 0) setE(mx + t, r.y - 1, mx + t, r.y, E.GATE); else if (s === 2) setE(mx + t, r.y + r.h - 1, mx + t, r.y + r.h, E.GATE);
          else if (s === 3) setE(r.x - 1, my + t, r.x, my + t, E.GATE); else setE(r.x + r.w - 1, my + t, r.x + r.w, my + t, E.GATE);
        }
      });
      for (let y = r.y + 2; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) {
        if (!chance(0.09)) continue; let ok = true;
        for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (cell[I(x + dx, y + dy)] === T.TREE) { ok = false; break; }
        if (ok) { setC(I(x, y), T.TREE); trees.push([x, y]); }
      }
    }

    // ---------- manzanas: una o dos filas de lotes que miran a la calle
    function lotsOf(r) {
      blocks.push({ ...r, kind: 'manzana' });
      const alongX = r.w >= r.h, L = alongX ? r.w : r.h, D = alongX ? r.h : r.w;
      const rows = D >= 18 ? [[0, D >> 1, alongX ? 'N' : 'W'], [D >> 1, D - (D >> 1), alongX ? 'S' : 'E']]
        : [[0, D, chance(0.5) ? (alongX ? 'N' : 'W') : (alongX ? 'S' : 'E')]];
      for (const [d0, dd, face] of rows) {
        let u = 0;
        while (u < L) {
          let w = rnd(7, 12); if (L - u - w < 7) w = L - u;
          if (w > 18) w = (L - u) >> 1;
          const rect = alongX ? { x: r.x + u, y: r.y + d0, w, h: dd } : { x: r.x + d0, y: r.y + u, w: dd, h: w };
          makeLot(rect, face, rows.length === 1);
          u += w;
        }
      }
    }
    function makeLot(rect, face, through) {
      const id = lots.length, NS = face === 'N' || face === 'S', lw = NS ? rect.w : rect.h, ld = NS ? rect.h : rect.w;
      const P = (u, v) => face === 'N' ? [rect.x + u, rect.y + v] : face === 'S' ? [rect.x + u, rect.y + rect.h - 1 - v] : face === 'W' ? [rect.x + v, rect.y + u] : [rect.x + rect.w - 1 - v, rect.y + u];
      const fdir = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[face];
      let type = 'casa';
      if (lw >= 13 && ld >= 12) type = chance(0.5) ? 'almacen' : 'edificio';
      else if (chance(0.07)) type = 'baldio';
      else if (chance(0.2)) type = 'tienda';
      const lot = { id, rect, face, fdir, through, type, house: -1 };
      lots.push(lot);
      for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) { cell[I(x, y)] = T.YARD; lotOf[I(x, y)] = id; }
      if (type === 'baldio') return;
      let sb = 0, hd, hw = lw;
      if (type === 'casa') { sb = ld >= 14 && chance(0.3) ? 2 : 0; const av = ld - sb; hd = av <= 9 ? av : rnd(Math.max(6, av - 8), av - 3); if (lw >= 10 && chance(0.35)) hw = lw - 2; }
      else if (type === 'tienda') hd = ld <= 10 ? ld : rnd(8, ld - 3);
      else if (type === 'almacen') hd = ld - (ld >= 16 ? rnd(3, 5) : 0);
      else hd = ld - (ld >= 15 ? 3 : 0);
      const hid = houses.length, h = { id: hid, lot: id, type, rooms: [], front: -1, back: -1, side: hw < lw, refuge: false, sb, hd, hw };
      houses.push(h); lot.house = hid;
      const locs = [];
      const bsp = (rc, minA, role) => {
        const canU = rc.w >= 8, canV = rc.h >= 8, a = rc.w * rc.h;
        if ((!canU && !canV) || a <= minA || (a <= minA * 2 && chance(0.5))) { locs.push({ ...rc, role }); return; }
        if (canU && (!canV || rc.w > rc.h || (rc.w === rc.h && chance(0.5)))) { const p = rnd(4, rc.w - 4); bsp({ u: rc.u, v: rc.v, w: p, h: rc.h }, minA, role); bsp({ u: rc.u + p, v: rc.v, w: rc.w - p, h: rc.h }, minA, role); }
        else { const p = rnd(4, rc.h - 4); bsp({ u: rc.u, v: rc.v, w: rc.w, h: p }, minA, role); bsp({ u: rc.u, v: rc.v + p, w: rc.w, h: rc.h - p }, minA, role); }
      };
      if (type === 'tienda') { const fd = hd >= 9 ? rnd(5, Math.min(7, hd - 4)) : hd; locs.push({ u: 0, v: sb, w: hw, h: fd, role: 'tienda' }); if (fd < hd) bsp({ u: 0, v: sb + fd, w: hw, h: hd - fd }, 30, 'depósito'); }
      else if (type === 'almacen') {
        if (hw >= 12 && hd >= 10 && chance(0.7)) { const ow = rnd(4, 5), oh = rnd(4, 6); locs.push({ u: 0, v: sb, w: hw - ow, h: hd, role: 'almacén' }, { u: hw - ow, v: sb, w: ow, h: oh, role: 'oficina' }); if (hd - oh >= 4) locs.push({ u: hw - ow, v: sb + oh, w: ow, h: hd - oh, role: 'bodega' }); else locs[1].h = hd; }
        else locs.push({ u: 0, v: sb, w: hw, h: hd, role: 'almacén' });
      } else bsp({ u: 0, v: sb, w: hw, h: hd }, type === 'edificio' ? 24 : 30, '');
      for (const l of locs) {
        const rid = rooms.length, [ax, ay] = P(l.u, l.v), [bx, by] = P(l.u + l.w - 1, l.v + l.h - 1);
        const rm = { id: rid, house: hid, role: l.role, x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by), area: l.w * l.h, front: l.v === sb, back: l.v + l.h === sb + hd };
        rooms.push(rm); h.rooms.push(rid);
        for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) { cell[I(x, y)] = T.FLOOR; room[I(x, y)] = rid; }
      }
      // cada cuarto con su uso según la arquitectura de la casa
      const rs = h.rooms.map(i => rooms[i]), big = a => a.slice().sort((p, q) => q.area - p.area)[0], yard = sb + hd < ld;
      const fr = big(rs.filter(r => r.front)); h.front = fr.id;
      if (type === 'casa') {
        fr.role = 'sala'; const coc = big(rs.filter(r => r !== fr && r.back)); if (coc) coc.role = 'cocina';
        if (yard) h.back = (coc || (fr.back ? fr : null))?.id ?? -1;
        const rest = rs.filter(r => !r.role).sort((p, q) => p.area - q.area); if (rest.length >= 2 && rest[0].area <= 30) rest[0].role = 'baño'; rest.forEach(r => { r.role = r.role || 'dormitorio'; });
      } else if (type === 'edificio') { fr.role = 'vestíbulo'; rs.forEach(r => { r.role = r.role || 'depto'; }); if (yard) h.back = big(rs.filter(r => r.back))?.id ?? -1; }
      else if (yard) h.back = big(rs.filter(r => r.back))?.id ?? -1;
    }

    split({ x: RING, y: RING, w: W - 2 * RING, h: H - 2 * RING }, 0);

    // ---------- paredes y rejas: todo borde entre cuartos distintos es pared, todo patio se cierra con reja
    const kindE = (a, b) => {
      if (a < 0 || b < 0) return E.WALL; // borde del mapa: muro de la ciudad
      const ca = cell[a], cb = cell[b];
      if (ca === T.FLOOR || cb === T.FLOOR) return ca === T.FLOOR && cb === T.FLOOR && room[a] === room[b] ? E.NONE : E.WALL;
      if (ca === T.YARD && cb === T.YARD) return lotOf[a] !== lotOf[b] ? E.FENCE : E.NONE;
      if (ca === T.YARD || cb === T.YARD) return E.FENCE;
      if ((ca === T.PARK) !== (cb === T.PARK) && (ca === T.PARK || cb === T.PARK) && under[a] !== T.PARK && under[b] !== T.PARK) return E.FENCE;
      return E.NONE;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) { const i = y * (W + 1) + x; if (!vE[i]) vE[i] = kindE(x > 0 ? I(x - 1, y) : -1, x < W ? I(x, y) : -1); }
    for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!hE[i]) hE[i] = kindE(y > 0 ? I(x, y - 1) : -1, y < H ? I(x, y) : -1); }

    // ---------- puertas y ventanas: tramos de pared de cada cuarto
    const nkey = (x, y) => !inb(x, y) ? 'v' : cell[I(x, y)] === T.FLOOR ? 'r' + room[I(x, y)] : cell[I(x, y)] === T.YARD ? 'y' + lotOf[I(x, y)] : 't' + (under[I(x, y)] || cell[I(x, y)]);
    const sideRuns = (x0, y0, x1, y1, ok = () => true) => {
      const out = [];
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const cs = [];
        if (dy) { const y = dy < 0 ? y0 : y1; for (let x = x0; x <= x1; x++) cs.push([x, y]); } else { const x = dx < 0 ? x0 : x1; for (let y = y0; y <= y1; y++) cs.push([x, y]); }
        let cur = null;
        for (const [x, y] of cs) { if (!ok(x, y)) { cur = null; continue; } const k = nkey(x + dx, y + dy); if (!cur || cur.k !== k) { cur = { k, dx, dy, cells: [] }; out.push(cur); } cur.cells.push([x, y]); }
      }
      return out;
    };
    const roomRuns = r => sideRuns(r.x0, r.y0, r.x1, r.y1);
    // abre un tramo en su centro (nunca pegado a las puntas si el tramo lo permite)
    const openRun = (run, kind, w = 1) => {
      const n = run.cells.length; w = Math.min(w, n); const s = Math.floor((n - w) / 2);
      for (let k = 0; k < w; k++) { const [x, y] = run.cells[s + k]; setE(x, y, x + run.dx, y + run.dy, kind); }
    };
    const longest = runs => runs.sort((a, b) => b.cells.length - a.cells.length)[0];
    const isDoor = e => e === E.DOOR || e === E.BIGDOOR || e === E.GATE;
    for (const h of houses) {
      const lot = lots[h.lot], [fx, fy] = lot.fdir, rs = h.rooms.map(i => rooms[i]);
      // puerta principal: a la calle (o al jardín delantero)
      const fr = longest(roomRuns(rooms[h.front]).filter(r => r.dx === fx && r.dy === fy && r.k[0] !== 'r'));
      if (fr) openRun(fr, h.type === 'almacen' ? E.BIGDOOR : E.DOOR, h.type === 'almacen' ? 3 : h.type === 'tienda' ? 2 : 1);
      // puerta trasera: al patio
      if (h.back >= 0) { const br = longest(roomRuns(rooms[h.back]).filter(r => r.dx === -fx && r.dy === -fy && r.k === 'y' + lot.id)); if (br) openRun(br, h.type === 'almacen' ? E.BIGDOOR : E.DOOR, h.type === 'almacen' ? 2 : 1); }
      // puerta lateral al pasillo de costado
      if (h.side && chance(0.4)) { const sr = longest(rs.flatMap(r => roomRuns(r).filter(q => q.k === 'y' + lot.id && (q.dx !== 0) !== (fx !== 0) && q.cells.length >= 3))); if (sr) openRun(sr, E.DOOR); }
      // puertas interiores: árbol desde la sala + algún atajo
      const adj = new Map();
      for (const r of rs) for (const q of roomRuns(r)) {
        if (q.k[0] !== 'r') continue; const j = +q.k.slice(1); if (rooms[j].house !== h.id || j < r.id) continue;
        const key = r.id + ',' + j, prev = adj.get(key); if (!prev || q.cells.length > prev.cells.length) adj.set(key, q);
      }
      const seen = new Set([h.front]), pairs = shuffle([...adj.entries()]), used = new Set();
      let grew = true;
      while (grew) { grew = false; for (const [key, q] of pairs) { const [a, b] = key.split(',').map(Number); if (seen.has(a) !== seen.has(b)) { openRun(q, E.DOOR); seen.add(a); seen.add(b); used.add(key); grew = true; } } }
      for (const [key, q] of pairs) if (!used.has(key) && q.cells.length >= 4 && chance(0.2)) openRun(q, E.DOOR);
      // ventanas: en las paredes que dan a calle, plaza o patio; cerradas (no se abren) o rotas (se puede entrar)
      const pOpen = { casa: 0.2, tienda: 0.3, edificio: 0.15, almacen: 0.08 }[h.type];
      for (const r of rs) for (const q of roomRuns(r)) {
        if (q.k[0] === 'r' || q.k === 'v') continue;
        const n = q.cells.length; if (n < 3) continue;
        const vitrina = h.type === 'tienda' && r.role === 'tienda' && q.dx === fx && q.dy === fy;
        const step = vitrina ? 2 : h.type === 'almacen' ? 4 : 3;
        const eAt = k => { const [x, y] = q.cells[k]; return getE(x, y, x + q.dx, y + q.dy); };
        for (let k = 1 + rnd(0, 1); k <= n - 2; k += step) {
          if (eAt(k) !== E.WALL || isDoor(eAt(k - 1)) || isDoor(eAt(k + 1)) || [eAt(k - 1), eAt(k + 1)].some(e => e === E.WIN || e === E.WINOPEN) && !vitrina) continue;
          const [x, y] = q.cells[k]; setE(x, y, x + q.dx, y + q.dy, chance(pOpen) ? E.WINOPEN : E.WIN);
        }
      }
    }
    // portones y huecos en las rejas de los patios
    for (const lot of lots) {
      const r = lot.rect, [fx, fy] = lot.fdir, bald = lot.type === 'baldio';
      const runs = sideRuns(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1, (x, y) => cell[I(x, y)] === T.YARD).filter(q => q.k[0] !== 'r' && q.k !== 'v');
      for (const q of runs) {
        const front = q.dx === fx && q.dy === fy, back = q.dx === -fx && q.dy === -fy, street = q.k[0] === 't';
        if (front && street) { if (!bald || chance(0.7)) openRun(q, E.GATE, bald ? rnd(2, 3) : 2); }
        else if (back && street) { if (chance(bald ? 0.7 : 0.5)) openRun(q, E.GATE, 2); }
        else if (street) { if (chance(0.3)) openRun(q, E.GATE, 2); }
        else if (q.k[0] === 'y' && q.cells.length >= 3 && chance(bald ? 0.5 : 0.12)) openRun(q, E.GATE, 1);
      }
    }

    // ---------- alcance: desde A, cruzando puertas, portones y ventanas rotas
    const A = [1, H >> 1];
    setE(-1, A[1] - 1, 0, A[1] - 1, E.NONE); setE(-1, A[1], 0, A[1], E.NONE); // entrada de la ciudad
    const reach = () => {
      const seen = new Uint8Array(N), q = [I(A[0], A[1])]; seen[q[0]] = 1;
      while (q.length) { const i = q.pop(), x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = I(nx, ny);
          if (seen[j] || BLOCKED.has(cell[j]) || !PASS[getE(x, y, nx, ny)]) continue; seen[j] = 1; q.push(j); } }
      return seen;
    };
    // prueba un cambio en la calle: si deja algo sin acceso, se deshace
    const tryFeat = fn => {
      const before = reach(); log = []; fn(); const changes = log; log = null;
      const after = reach();
      for (let i = 0; i < N; i++) if (before[i] && !after[i] && !BLOCKED.has(cell[i])) { for (let k = changes.length - 1; k >= 0; k--) { const [A2, j, v] = changes[k]; A2[j] = v; } return false; }
      return true;
    };
    const along = s => s.dir === 'v' ? s.h : s.w;
    const at = (s, t, c) => s.dir === 'v' ? [s.x + c, s.y + t] : [s.x + t, s.y + c]; // t: a lo largo, c: a lo ancho
    const crossE = (s, t, c, v) => { const [x, y] = at(s, t, c); s.dir === 'v' ? setE(x, y - 1, x, y, v) : setE(x - 1, y, x, y, v); }; // reja de lado a lado
    const nearDoor = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const e = getE(x, y, x + dx, y + dy); return e === E.DOOR || e === E.BIGDOOR || e === E.GATE || e === E.WINOPEN; });
    for (const s of shuffle(streets.slice())) {
      const L = along(s), w = s.width;
      // reja al medio de las avenidas: dos carriles, con pasos cada tanto y frente a cada calle que llega
      if (w >= 6 && L > 16 && (s.depth === 0 || chance(0.6))) {
        if (tryFeat(() => {
          const c = w >> 1; let gap = rnd(10, 18);
          for (let t = 2; t < L - 2; t++) {
            const [x, y] = at(s, t, c), side = s.dir === 'v' ? [I(Math.max(0, x - c - 1), y), I(Math.min(W - 1, x + w - c), y)] : [I(x, Math.max(0, y - c - 1)), I(x, Math.min(H - 1, y + w - c))];
            if (--gap <= 0) { if (gap <= -1) gap = rnd(12, 20); continue; }
            if (side.some(j => cell[j] === T.STREET)) continue;
            s.dir === 'v' ? setE(x - 1, y, x, y, E.FENCE) : setE(x, y - 1, x, y, E.FENCE);
          }
        })) { feats.medianas++; s.median = true; }
      }
      if (s.ring || L < 12) continue;
      // reja de lado a lado: obliga a rodear; si cortaría algo, queda parcial (paso de 2)
      if (chance(0.22)) {
        const t = rnd(4, L - 4);
        if (tryFeat(() => { for (let c = 0; c < w; c++) crossE(s, t, c, E.FENCE); })) feats.rejasCalle++;
        else if (w > 2 && tryFeat(() => { const g = chance(0.5) ? 0 : w - 2; for (let c = 0; c < w; c++) if (c < g || c >= g + 2) crossE(s, t, c, E.FENCE); })) feats.rejasParciales++;
      } else if (w >= 4 && chance(0.25)) {
        const t = rnd(4, L - 4), g = rnd(0, w - 2);
        if (tryFeat(() => { for (let c = 0; c < w; c++) if (c < g || c >= g + 2) crossE(s, t, c, E.FENCE); })) feats.rejasParciales++;
      }
      // choque múltiple: autos atravesados que tapan la calle
      if (w >= 4 && chance(0.12)) {
        const t = rnd(4, L - 7), cells = [];
        for (let k = 0; k < 3; k++) for (let c = 0; c < w; c++) cells.push(at(s, t + k, c));
        if (cells.every(([x, y]) => cell[I(x, y)] === T.STREET && !nearDoor(x, y)) && tryFeat(() => cells.forEach(([x, y]) => setC(I(x, y), T.CAR)))) {
          feats.choques++; const [x, y] = at(s, t, 0); piles.push({ x, y, w: s.dir === 'v' ? w : 3, h: s.dir === 'v' ? 3 : w, dir: s.dir, n: Math.max(2, w >> 1) });
        }
      }
    }
    // autos abandonados sueltos: 2×4, siempre dejan un paso de 2
    const COLORS = ['#b23a2e', '#2e5fa8', '#d9d4c7', '#3c3f44', '#c9a227', '#4f7a3a', '#7a2f5c'];
    for (const s of streets) {
      if (s.width < 4) continue; const L = along(s), n = Math.floor(L / rnd(9, 16));
      for (let k = 0; k < n; k++) {
        const t = rnd(3, L - 7), c = 2 * rnd(0, (s.width >> 1) - 1), cs = [];
        for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) cs.push(at(s, t + a, c + b));
        if (!cs.every(([x, y]) => cell[I(x, y)] === T.STREET && !nearDoor(x, y))) continue;
        let ok = true; // a lo ancho debe quedar al menos 2 libre en cada fila
        for (let a = -1; a <= 4 && ok; a++) { let free = 0; for (let cc = 0; cc < s.width; cc++) { if (cc === c || cc === c + 1) continue; const [x, y] = at(s, t + a, cc); if (inb(x, y) && cell[I(x, y)] === T.STREET) free++; } if (free < 2) ok = false; }
        if (!ok) continue;
        if (!tryFeat(() => cs.forEach(([x, y]) => setC(I(x, y), T.CAR)))) continue;
        const [x0, y0] = at(s, t, c);
        cars.push({ x: x0, y: y0, w: s.dir === 'v' ? 2 : 4, h: s.dir === 'v' ? 4 : 2, rot: (R() - 0.5) * 24, color: COLORS[rnd(0, COLORS.length - 1)] });
        feats.autos++;
      }
    }

    // ---------- refugios: una sola entrada (la puerta principal) y ventanas cerradas
    const center = h => { const rs = h.rooms.map(i => rooms[i]); return [rs.reduce((s, r) => s + (r.x0 + r.x1) / 2, 0) / rs.length, rs.reduce((s, r) => s + (r.y0 + r.y1) / 2, 0) / rs.length]; };
    const seen0 = reach();
    const okRefuge = h => h.type !== 'almacen' && h.rooms.some(i => { const r = rooms[i]; return seen0[I(r.x0, r.y0)]; });
    const cand = houses.filter(okRefuge);
    const pickNear = (tx, ty) => cand.filter(h => !h.refuge).sort((a, b) => { const [ax, ay] = center(a), [bx, by] = center(b); return Math.hypot(ax - tx, (ay - ty) * 0.6) - Math.hypot(bx - tx, (by - ty) * 0.6); })[0];
    const Bh = pickNear(W - 1, H / 2), mids = [pickNear(W / 3, H * (0.3 + 0.4 * R())), pickNear(2 * W / 3, H * (0.3 + 0.4 * R()))];
    const refuges = [mids[0], mids[1], Bh].filter(Boolean);
    refuges.forEach(h => { h.refuge = true; });
    for (const h of refuges) {
      const fr = rooms[h.front], [fx, fy] = lots[h.lot].fdir;
      for (const r of h.rooms.map(i => rooms[i])) for (const q of roomRuns(r)) {
        if (q.k[0] === 'r' && rooms[+q.k.slice(1)].house === h.id) continue;
        const main = r === fr && q.dx === fx && q.dy === fy;
        for (const [x, y] of q.cells) { const e = getE(x, y, x + q.dx, y + q.dy); if (e === E.WINOPEN) setE(x, y, x + q.dx, y + q.dy, E.WIN); else if (!main && isDoor(e)) setE(x, y, x + q.dx, y + q.dy, E.WALL); }
      }
      h.rooms.forEach(i => { rooms[i].refugio = true; });
    }

    // ---------- ruta de A a B (trepar una ventana rota cuesta más que caminar) y ruta solo por calles
    const route = noHouses => {
      if (!Bh) return null;
      const goal = new Set(); Bh.rooms.forEach(i => { const r = rooms[i]; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) goal.add(I(x, y)); });
      const dist = new Int32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), buckets = [[I(A[0], A[1])]]; dist[I(A[0], A[1])] = 0;
      for (let d = 0; d < buckets.length; d++) for (const i of buckets[d] || []) {
        if (dist[i] !== d) continue;
        if (goal.has(i)) { const p = []; for (let j = i; j >= 0; j = prev[j]) p.push([j % W, (j / W) | 0]); return { path: p.reverse(), cost: d }; }
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = I(nx, ny), e = getE(x, y, nx, ny);
          if (BLOCKED.has(cell[j]) || !PASS[e]) continue;
          if (noHouses && ((cell[j] === T.FLOOR && !goal.has(j)) || e === E.WINOPEN)) continue;
          const nd = d + (e === E.WINOPEN ? 4 : 1);
          if (nd < dist[j]) { dist[j] = nd; prev[j] = i; (buckets[nd] = buckets[nd] || []).push(j); }
        }
      }
      return null;
    };
    for (let i = 0; i < N; i++) if (!BLOCKED.has(cell[i])) under[i] = cell[i];
    const main = route(false), viaStreets = route(true);

    const count = v => { let n = 0; for (const a of [vE, hE]) for (const e of a) if (e === v) n++; return n; };
    const stats = {
      manzanas: blocks.filter(b => b.kind === 'manzana').length, plazas: blocks.filter(b => b.kind === 'plaza').length, paseos: blocks.filter(b => b.kind === 'paseo').length, parques: blocks.filter(b => b.kind === 'parque').length,
      casas: houses.filter(h => h.type === 'casa').length, tiendas: houses.filter(h => h.type === 'tienda').length, edificios: houses.filter(h => h.type === 'edificio').length, almacenes: houses.filter(h => h.type === 'almacen').length,
      baldios: lots.filter(l => l.type === 'baldio').length, cuartos: rooms.length, puertas: count(E.DOOR) + count(E.BIGDOOR), ventanasCerradas: count(E.WIN), ventanasRotas: count(E.WINOPEN), portones: count(E.GATE),
      ...feats, arboles: trees.length, ruta: main ? main.cost : null, rutaCalles: viaStreets ? viaStreets.cost : null,
    };
    return { seed, W, H, T, E, cell, under, room, lotOf, vE, hE, streets, blocks, lots, houses, rooms, cars, piles, trees, founts, A, B: Bh ? Bh.id : -1, refuges: refuges.map(h => h.id), route: main, routeStreets: viaStreets, stats };
  }

  // ---------- exportación a piezas TruWorlds (studs; Y arriba; el norte del mapa mira a -Z)
  // Medidas arcade: números redondos en metros de Blender (1 m = 4 studs), pensadas para un personaje de ~3 m
  // (proporción de juego, no realista: lo que en la vida mide 2 aquí mide 3). Cambia esta tabla y todo se rehace a escala.
  const MEDIDAS = {
    studsPorMetro: 4,  // TruWorlds: 1 m de Blender = 4 studs
    personaje: 3,      // alto de referencia del personaje (m)
    celda: 2,          // 1 celda = 2 personas de ancho (m); un callejón de 2 celdas = 4 m
    pared: 4,          // alto de pared = altura del techo (m)
    puerta: 3,         // alto de puerta (m); ancho = 1 celda
    alfeizar: 1,       // la ventana va de 1 m a 3 m
    reja: 2,           // alto de reja (m)
    grosor: 0.5,       // grosor de pared (m)
  };
  function toParts(m, o = {}) {
    const M = { ...MEDIDAS, ...(o.medidas || {}) }, k = M.studsPorMetro, C = M.celda * k, WALL_H = M.pared * k, DOOR_H = M.puerta * k, SILL = M.alfeizar * k, TH = M.grosor * k, FENCE_H = M.reja * k;
    const chunkCells = o.chunk ?? 32, maxPer = o.maxPerChunk ?? 800, sc = C / 6; // sc: tamaño de autos y árboles respecto a la celda base
    const { W, H, cell, under, room, vE, hE } = m, X = x => +(x * C - W * C / 2).toFixed(3), Z = y => +(y * C - H * C / 2).toFixed(3);
    const parts = [], col = h => { const n = parseInt(h.slice(1), 16); return [+((n >> 16) / 255).toFixed(3), +(((n >> 8) & 255) / 255).toFixed(3), +((n & 255) / 255).toFixed(3)]; };
    const add = (name, shape, pos, size, color, material, rot = [0, 0, 0], cx, cy) => parts.push({ name, shape, pos: pos.map(v => +v.toFixed(3)), size: size.map(v => +v.toFixed(3)), rot, color: col(color), material, _c: [cx, cy] });
    // suelos: rectángulos fusionados por tipo (y por casa)
    const groundKey = (x, y) => { const i = y * W + x, t = under[i] || cell[i]; return t === T.FLOOR ? 'piso:' + m.rooms[room[i]].house : t === T.STREET ? 'calle' : t === T.PLAZA ? 'plaza' : t === T.PARK ? 'parque' : t === T.YARD ? 'patio' : null; };
    const GROUND = { calle: ['#3d4045', 'SmoothSurface'], plaza: ['#b9b09c', 'Marble'], parque: ['#5f8a3e', 'Grass'], patio: ['#7d8f4e', 'Grass'] };
    const FLOORC = { casa: ['#a07850', 'Wood'], tienda: ['#c8c2b4', 'Marble'], edificio: ['#8f8a80', 'SmoothSurface'], almacen: ['#7c7a74', 'Gravel'] };
    const greedy = keyAt => {
      const seen = new Uint8Array(W * H), out = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (seen[i]) continue; const k = keyAt(x, y); if (k == null) continue;
        let w = 1; while (x + w < W && !seen[i + w] && keyAt(x + w, y) === k) w++;
        let h = 1; grow: while (y + h < H) { for (let t = 0; t < w; t++) if (seen[(y + h) * W + x + t] || keyAt(x + t, y + h) !== k) break grow; h++; }
        for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) seen[(y + b) * W + x + a] = 1;
        out.push({ x, y, w, h, k });
      }
      return out;
    };
    for (const g of greedy(groundKey)) {
      const house = g.k.startsWith('piso:') ? m.houses[+g.k.slice(5)] : null;
      const [c, mat] = house ? (house.refuge ? ['#c9a43a', 'Wood'] : FLOORC[house.type]) : GROUND[g.k];
      add(house ? 'Piso' : g.k[0].toUpperCase() + g.k.slice(1), 'Block', [X(g.x + g.w / 2), -0.5, Z(g.y + g.h / 2)], [g.w * C, 1, g.h * C], c, mat, undefined, g.x + g.w / 2, g.y + g.h / 2);
    }
    // techos: uno por rectángulo de casa
    if (o.roofs !== false) {
      const ROOF = { casa: '#8c4a3a', tienda: '#5a6470', edificio: '#4e4a46', almacen: '#6d6f73' };
      for (const g of greedy((x, y) => { const i = y * W + x; return cell[i] === T.FLOOR ? m.rooms[room[i]].house : null; })) {
        const h = m.houses[g.k];
        add('Techo', 'Block', [X(g.x + g.w / 2), WALL_H + 0.5, Z(g.y + g.h / 2)], [g.w * C + TH, 1, g.h * C + TH], h.refuge ? '#d4a017' : ROOF[h.type], 'SmoothSurface', undefined, g.x + g.w / 2, g.y + g.h / 2);
      }
    }
    // paredes, dinteles, alféizares, vidrios y rejas: tramos rectos fusionados en una sola pieza
    const LAYERS = [
      { name: 'Pared', test: e => e === E.WALL, y0: 0, y1: WALL_H, th: TH, color: '#d8cfc0', mat: 'SmoothSurface' },
      { name: 'Dintel', test: e => e === E.DOOR || e === E.BIGDOOR || e === E.WIN || e === E.WINOPEN, y0: DOOR_H, y1: WALL_H, th: TH, color: '#d8cfc0', mat: 'SmoothSurface' },
      { name: 'Alfeizar', test: e => e === E.WIN || e === E.WINOPEN, y0: 0, y1: SILL, th: TH, color: '#d8cfc0', mat: 'SmoothSurface' },
      { name: 'VentanaCerrada', test: e => e === E.WIN, y0: SILL, y1: DOOR_H, th: TH * 0.3, color: '#9cc9e6', mat: 'SmoothSurface' },
      { name: 'Reja', test: e => e === E.FENCE, y0: 0, y1: FENCE_H, th: TH * 0.4, color: '#6f757c', mat: 'Metal' },
    ];
    for (const L of LAYERS) {
      for (let y = 0; y <= H; y++) { let a = -1; for (let x = 0; x <= W; x++) { const on = x < W && L.test(hE[y * W + x]); if (on && a < 0) a = x; if (!on && a >= 0) { const border = y === 0 || y === H, n = x - a;
        add(border && L.name === 'Pared' ? 'Muralla' : L.name, 'Block', [X(a + n / 2), (L.y0 + L.y1) / 2 + (border ? k / 2 : 0), Z(y)], [n * C + L.th, L.y1 - L.y0 + (border ? k : 0), L.th * (border ? 2 : 1)], border ? '#7a4b3a' : L.color, border ? 'Brick' : L.mat, undefined, a + n / 2, y); a = -1; } } }
      for (let x = 0; x <= W; x++) { let a = -1; for (let y = 0; y <= H; y++) { const on = y < H && L.test(vE[y * (W + 1) + x]); if (on && a < 0) a = y; if (!on && a >= 0) { const border = x === 0 || x === W, n = y - a;
        add(border && L.name === 'Pared' ? 'Muralla' : L.name, 'Block', [X(x), (L.y0 + L.y1) / 2 + (border ? k / 2 : 0), Z(a + n / 2)], [L.th * (border ? 2 : 1), L.y1 - L.y0 + (border ? k : 0), n * C + L.th], border ? '#7a4b3a' : L.color, border ? 'Brick' : L.mat, undefined, x, a + n / 2); a = -1; } } }
    }
    // autos (carrocería + cabina), choques, árboles, fuentes
    const car = (cx, cy, alongZ, rot, color, tilt = 0) => {
      const ry = (alongZ ? 0 : 90) + rot;
      add('Auto', 'Block', [X(cx), 1.6 * sc, Z(cy)], [2 * C - 2 * sc, 3 * sc, 4 * C - 3 * sc], color, 'Metal', [0, +ry.toFixed(1), tilt], cx, cy);
      add('AutoCabina', 'Block', [X(cx), 4 * sc, Z(cy)], [2 * C - 3 * sc, 2 * sc, 2 * C], '#2b2f36', 'SmoothSurface', [0, +ry.toFixed(1), tilt], cx, cy);
    };
    for (const c of m.cars) car(c.x + c.w / 2, c.y + c.h / 2, c.h > c.w, c.rot, c.color);
    for (const p of m.piles) for (let k = 0; k < p.n; k++) {
      const t = (k + 0.5) / p.n, cx = p.dir === 'v' ? p.x + t * p.w : p.x + 1.5, cy = p.dir === 'v' ? p.y + 1.5 : p.y + t * p.h;
      car(cx, cy, p.dir !== 'v', (k % 2 ? 1 : -1) * (25 + 10 * k), ['#8c2f25', '#3a5f8f', '#9a9488'][k % 3], k % 2 ? 8 : -6);
    }
    for (const [x, y] of m.trees) { add('Tronco', 'Cylinder', [X(x + 0.5), 4 * sc, Z(y + 0.5)], [8 * sc, 1.6 * sc, 1.6 * sc], '#5b4330', 'Wood', [0, 0, 90], x + 0.5, y + 0.5); add('Copa', 'Ball', [X(x + 0.5), 10 * sc, Z(y + 0.5)], [9 * sc, 9 * sc, 9 * sc], '#3f6b2f', 'Grass', undefined, x + 0.5, y + 0.5); }
    for (const f of m.founts) { add('Fuente', 'Cylinder', [X(f.x + f.s / 2), 1.5 * sc, Z(f.y + f.s / 2)], [3 * sc, f.s * C, f.s * C], '#9aa3a8', 'Marble', [0, 0, 90], f.x + f.s / 2, f.y + f.s / 2); add('FuenteAgua', 'Cylinder', [X(f.x + f.s / 2), 3.05 * sc, Z(f.y + f.s / 2)], [0.2 * sc, f.s * C - 2 * sc, f.s * C - 2 * sc], '#4f8fc0', 'Glow', [0, 0, 90], f.x + f.s / 2, f.y + f.s / 2); }
    // chunks por zona del mapa (máx. maxPer piezas cada uno)
    const byKey = new Map();
    for (const p of parts) { const [cx, cy] = p._c, k = Math.min(Math.floor(cx / chunkCells), Math.floor((W - 1) / chunkCells)) + '_' + Math.min(Math.floor(cy / chunkCells), Math.floor((H - 1) / chunkCells)); delete p._c; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); }
    const chunks = [];
    for (const [k, ps] of [...byKey.entries()].sort()) {
      const [i, j] = k.split('_').map(Number), center = [X((i + 0.5) * chunkCells), 0, Z((j + 0.5) * chunkCells)];
      for (let s = 0, part = 0; s < ps.length; s += maxPer, part++) chunks.push({ name: `Ciudad_${i}_${j}` + (ps.length > maxPer ? '_' + 'abcdefgh'[part] : ''), center, parts: ps.slice(s, s + maxPer) });
    }
    const roomCenter = r => [X((r.x0 + r.x1 + 1) / 2), 3 * sc, Z((r.y0 + r.y1 + 1) / 2)];
    const spawns = {
      PlayerStart: { pos: [X(m.A[0] + 0.5), 3 * sc, Z(m.A[1] + 0.5)], nota: 'punto A: entrada oeste de la ciudad, sobre la calle del anillo' },
      refugios: m.refuges.map((hid, k) => { const h = m.houses[hid], r = m.rooms[h.front]; return { nombre: hid === m.B ? 'B (refugio final)' : 'Refugio ' + (k + 1), pos: roomCenter(r), casa: h.type }; }),
    };
    return { parts, chunks, spawns, medidas: M, scale: { studsPorCelda: C, alturaPared: WALL_H, alturaPuerta: DOOR_H, mapaStuds: [W * C, H * C], mapaMetros: [W * M.celda, H * M.celda] } };
  }

  root.Ciudad = { generate, toParts, MEDIDAS, T, E, PASS };
})(typeof window !== 'undefined' ? window : globalThis);
