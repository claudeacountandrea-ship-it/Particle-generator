// Ciudad con diagonales sobre la base del generador de mazmorras (mazmorra_base.js):
// pasillos → calles, salas → casas (sus particiones son los cuartos), paredes del medio → rejas, compuertas → portones,
// huecos → ruinas, sala del jefe → mercado, entrada → A, bajada → refugio B. Las paredes diagonales salen como una pieza girada.
(function (root) {
  'use strict';
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const parseW = k => k.split('|').map(s => s.split(',').map(Number));
  const WALLISH = new Set(['exterior', 'interior', 'medianera', 'ventana', 'ventanaRota']);

  function generate(o = {}) {
    const seed = (o.seed ?? 7) >>> 0, n = o.n ?? 19;
    const old = Math.random; Math.random = rng(seed); // la base usa Math.random: con semilla sale siempre igual
    let m; try { m = root.MazmorraBase.Halls(n, undefined, null, { central: true, rmin: 4, rmax: 8, round: true }); } finally { Math.random = old; }
    const R = rng(seed ^ 0x5bd1e995), chance = p => R() < p;
    const W = m.size, H = m.rows, C4 = W - 1, q = m._q, kinds = m._kinds;
    const lab = (x, y, k) => (x < 0 || y < 0 || x >= C4 || y >= H - 1) ? 0 : q[(y * C4 + x) * 4 + k];
    const kindOf = l => { const k = l ? kinds[l] : 'out'; return k === 'gal' ? 'corr' : k === 'rock' || !k ? 'out' : k; };
    // etiquetas marcadas por la base: 2 entrada, 1 bajada, 4 jefe, 5 camino
    const markLab = v => { const c = new Map(); for (const [k, val] of Object.entries(m.marks)) if (val === v) { const [x, y] = k.split(',').map(Number); for (let i = 0; i < 4; i++) { const l = lab(x, y, i); if (l) c.set(l, (c.get(l) || 0) + 1); } } let best = 0, bn = 0; for (const [l, k] of c) if (k > bn) { bn = k; best = l; } return best; };
    const startL = markLab(2), goalL = markLab(1), bossL = markLab(4);
    const routeCells = Object.entries(m.marks).filter(([, v]) => v === 5 || v === 2 || v === 1).map(([k]) => k.split(',').map(Number));
    // casas: salas unidas por puertas entre salas forman una casa (sus particiones son los cuartos); nunca el mercado ni la entrada
    const doors = new Set(m.doors), par = new Map(), find = l => { while (par.has(l) && par.get(l) !== l) l = par.get(l); return l; };
    for (const k of doors) {
      const [[ax, ay], [bx, by]] = parseW(k); let L1, L2;
      if (ay === by) { const x = Math.min(ax, bx); L1 = lab(x, ay - 1, 2); L2 = lab(x, ay, 0); } else if (ax === bx) { const y = Math.min(ay, by); L1 = lab(ax - 1, y, 1); L2 = lab(ax, y, 3); } else { const x = Math.min(ax, bx), y = Math.min(ay, by); L1 = lab(x, y, 0); L2 = lab(x, y, 2); }
      if (kindOf(L1) !== 'room' || kindOf(L2) !== 'room' || [L1, L2].some(l => l === bossL || l === startL || l === goalL)) continue;
      const a = find(L1), b = find(L2); if (a !== b) par.set(a, b);
    }
    const houseOf = l => find(l), houses = new Map();
    for (let i = 0; i < q.length; i++) { const l = q[i]; if (!l || kindOf(l) !== 'room') continue; const hl = houseOf(l), c = i >> 2, x = c % C4, y = (c / C4) | 0; let h = houses.get(hl); if (!h) houses.set(hl, h = { label: hl, rooms: new Set(), quarters: 0, sx: 0, sy: 0 }); h.rooms.add(l); h.quarters++; h.sx += x + 0.5; h.sy += y + 0.5; }
    for (const h of houses.values()) {
      h.area = h.quarters / 4; h.cx = h.sx / h.quarters; h.cy = h.sy / h.quarters;
      h.type = h.label === bossL ? 'mercado' : h.label === startL ? 'entrada' : h.area > 140 ? (chance(0.5) ? 'almacen' : 'edificio') : h.area < 60 && chance(0.25) ? 'tienda' : 'casa';
    }
    const A = houses.get(houseOf(startL)), B = houses.get(houseOf(goalL));
    if (B) B.refuge = true, B.final = true;
    if (A && B) for (const t of [1 / 3, 2 / 3]) { // refugios en el camino
      const tx = A.cx + (B.cx - A.cx) * t, ty = A.cy + (B.cy - A.cy) * t;
      const h = [...houses.values()].filter(h => !h.refuge && h.type !== 'mercado' && h.type !== 'entrada').sort((a, b) => Math.hypot(a.cx - tx, a.cy - ty) - Math.hypot(b.cx - tx, b.cy - ty))[0];
      if (h) h.refuge = true;
    }
    // cada borde según lo que separa
    const segs = [];
    for (const k of new Set(m.walls)) {
      const [[ax, ay], [bx, by]] = parseW(k); let L1, L2, dir, line, pos;
      if (ay === by) { const x = Math.min(ax, bx); L1 = lab(x, ay - 1, 2); L2 = lab(x, ay, 0); dir = 'h'; line = ay; pos = x; }
      else if (ax === bx) { const y = Math.min(ay, by); L1 = lab(ax - 1, y, 1); L2 = lab(ax, y, 3); dir = 'v'; line = ax; pos = y; }
      else { const x = Math.min(ax, bx), y = Math.min(ay, by); L1 = lab(x, y, 0); L2 = lab(x, y, 2); dir = (bx - ax) * (by - ay) > 0 ? 'd1' : 'd2'; line = dir === 'd1' ? x - y : x + y; pos = x; }
      const k1 = kindOf(L1), k2 = kindOf(L2), door = doors.has(k), ks = [k1, k2].sort().join('|');
      let cls;
      if (k1 === 'out' || k2 === 'out') cls = door ? 'entrada' : 'muralla';
      else if (ks === 'corr|corr') cls = door ? 'porton' : 'reja';
      else if (ks === 'corr|room') cls = door ? 'puerta' : 'exterior';
      else if (ks === 'room|room') cls = door ? 'puerta' : houseOf(L1) === houseOf(L2) ? 'interior' : 'medianera';
      else cls = door ? 'puerta' : 'ruina'; // hueco con pasillo o sala
      const room = k1 === 'room' ? houseOf(L1) : k2 === 'room' ? houseOf(L2) : 0;
      segs.push({ a: [ax, ay], b: [bx, by], dir, line, pos, cls, room });
    }
    // ventanas en las paredes que dan a la calle: tramos rectos, nunca en la punta ni junto a una puerta
    const byLine = new Map();
    for (const s of segs) { const key = s.dir + ':' + s.line; if (!byLine.has(key)) byLine.set(key, new Map()); byLine.get(key).set(s.pos, s); }
    for (const line of byLine.values()) {
      const ps = [...line.keys()].sort((a, b) => a - b);
      let run = [];
      const flush = () => {
        const nRun = run.length;
        for (let i = 1 + Math.floor(R() * 2); i <= nRun - 2; i += 3) {
          const s = run[i], prev = line.get(s.pos - 1), next = line.get(s.pos + 1);
          if ([prev, next].some(t => t && (t.cls === 'puerta' || t.cls === 'porton'))) continue;
          const h = houses.get(s.room); s.cls = h && h.refuge ? 'ventana' : chance(h && h.type === 'tienda' ? 0.3 : 0.18) ? 'ventanaRota' : 'ventana';
        }
        run = [];
      };
      for (const p of ps) { const s = line.get(p); if (s.cls === 'exterior' && run.length && (run[run.length - 1].pos === p - 1 && run[run.length - 1].room === s.room)) run.push(s); else { flush(); if (s.cls === 'exterior') run.push(s); } }
      flush();
    }
    const count = c => segs.filter(s => s.cls === c).length, types = [...houses.values()];
    const stats = {
      casas: types.filter(h => h.type === 'casa').length, tiendas: types.filter(h => h.type === 'tienda').length, edificios: types.filter(h => h.type === 'edificio').length, almacenes: types.filter(h => h.type === 'almacen').length,
      refugios: types.filter(h => h.refuge).length, cuartos: types.reduce((t, h) => t + h.rooms.size, 0), puertas: count('puerta'), ventanasCerradas: count('ventana'), ventanasRotas: count('ventanaRota'), rejas: count('reja'), portones: count('porton'),
      tramosDiagonales: segs.filter(s => s.dir[0] === 'd').length, ruta: routeCells.length,
    };
    return { seed, n, W, H, C4, q, kinds, kindOf, lab, segs, houses, houseOf, nRooms: [...houses.values()].reduce((t, h) => t + h.rooms.size, 0), startL, goalL, bossL, routeCells, stats };
  }

  // ---------- piezas TruWorlds: mismas medidas arcade que la ciudad en cuadrícula (Ciudad.MEDIDAS)
  function toParts(c, o = {}) {
    const M = { ...(root.Ciudad ? root.Ciudad.MEDIDAS : { studsPorMetro: 4, celda: 2, pared: 4, puerta: 3, alfeizar: 1, reja: 2, grosor: 0.5 }), ...(o.medidas || {}) };
    const k = M.studsPorMetro, C = M.celda * k, WALL_H = M.pared * k, DOOR_H = M.puerta * k, SILL = M.alfeizar * k, TH = M.grosor * k, FENCE_H = M.reja * k;
    const chunkCells = o.chunk ?? 32, maxPer = o.maxPerChunk ?? 800, { W, H, C4, q } = c;
    const X = x => +(x * C - (W - 1) * C / 2).toFixed(3), Z = y => +(y * C - (H - 1) * C / 2).toFixed(3);
    const col = h => { const v = parseInt(h.slice(1), 16); return [+((v >> 16) / 255).toFixed(3), +(((v >> 8) & 255) / 255).toFixed(3), +((v & 255) / 255).toFixed(3)]; };
    const parts = [], add = (name, shape, pos, size, color, material, rot, cx, cy) => parts.push({ name, shape, pos: pos.map(v => +v.toFixed(3)), size: size.map(v => +v.toFixed(3)), rot: rot || [0, 0, 0], color: col(color), material, _c: [cx, cy] });
    const greedy = keyAt => {
      const seen = new Uint8Array(C4 * (H - 1)), out = [], Wc = C4, Hc = H - 1;
      for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) {
        const i = y * Wc + x; if (seen[i]) continue; const kk = keyAt(x, y); if (kk == null) continue;
        let w = 1; while (x + w < Wc && !seen[i + w] && keyAt(x + w, y) === kk) w++;
        let h = 1; grow: while (y + h < Hc) { for (let t = 0; t < w; t++) if (seen[(y + h) * Wc + x + t] || keyAt(x + t, y + h) !== kk) break grow; h++; }
        for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) seen[(y + b) * Wc + x + a] = 1;
        out.push({ x, y, w, h, k: kk });
      }
      return out;
    };
    const cellLabels = (x, y) => { const i = (y * C4 + x) * 4; return [q[i], q[i + 1], q[i + 2], q[i + 3]]; };
    const anyIn = (x, y) => cellLabels(x, y).some(l => c.kindOf(l) !== 'out');
    const fullRoom = (x, y) => { const ls = cellLabels(x, y); return ls.every(l => l === ls[0]) && c.kindOf(ls[0]) === 'room' ? c.houseOf(ls[0]) : null; };
    const FLOOR = { casa: ['#a07850', 'Wood'], tienda: ['#c8c2b4', 'Marble'], edificio: ['#8f8a80', 'SmoothSurface'], almacen: ['#7c7a74', 'Gravel'], mercado: ['#b9b09c', 'Marble'], entrada: ['#8aa05a', 'Grass'] };
    const ROOF = { casa: '#8c4a3a', tienda: '#5a6470', edificio: '#4e4a46', almacen: '#6d6f73', entrada: '#6d6f73' };
    // suelo de calle bajo toda la ciudad, pisos de las casas encima, escombros en los huecos
    for (const g of greedy((x, y) => anyIn(x, y) ? 1 : null)) add('Calle', 'Block', [X(g.x + g.w / 2), -0.5, Z(g.y + g.h / 2)], [g.w * C, 1, g.h * C], '#3d4045', 'SmoothSurface', null, g.x + g.w / 2, g.y + g.h / 2);
    for (const g of greedy(fullRoom)) { const h = c.houses.get(g.k), [cl, mt] = h.refuge ? ['#c9a43a', 'Wood'] : FLOOR[h.type]; add('Piso', 'Block', [X(g.x + g.w / 2), -0.3, Z(g.y + g.h / 2)], [g.w * C, 1, g.h * C], cl, mt, null, g.x + g.w / 2, g.y + g.h / 2); }
    for (const g of greedy((x, y) => { const ls = cellLabels(x, y); return ls.every(l => c.kindOf(l) === 'pillar') ? 1 : null; })) add('Ruina', 'Block', [X(g.x + g.w / 2), WALL_H / 4, Z(g.y + g.h / 2)], [g.w * C, WALL_H / 2, g.h * C], '#4a4038', 'Gravel', null, g.x + g.w / 2, g.y + g.h / 2);
    if (o.roofs !== false) for (const g of greedy((x, y) => { const l = fullRoom(x, y); return l && l !== c.houseOf(c.bossL) ? l : null; })) {
      const h = c.houses.get(g.k); add('Techo', 'Block', [X(g.x + g.w / 2), WALL_H + 0.5, Z(g.y + g.h / 2)], [g.w * C + TH, 1, g.h * C + TH], h.refuge ? '#d4a017' : ROOF[h.type], 'SmoothSurface', null, g.x + g.w / 2, g.y + g.h / 2);
    }
    // bordes: tramos rectos (también diagonales) fusionados en una pieza por capa
    const LAYERS = [
      { name: 'Pared', test: s => WALLISH.has(s.cls) && !s.cls.startsWith('ventana'), y0: 0, y1: WALL_H, th: TH, color: '#d8cfc0', mat: 'SmoothSurface' },
      { name: 'Muralla', test: s => s.cls === 'muralla', y0: 0, y1: WALL_H + k, th: TH * 2, color: '#7a4b3a', mat: 'Brick' },
      { name: 'Ruina', test: s => s.cls === 'ruina', y0: 0, y1: WALL_H / 2, th: TH, color: '#5a4d42', mat: 'Brick' },
      { name: 'Dintel', test: s => s.cls === 'puerta' || s.cls.startsWith('ventana'), y0: DOOR_H, y1: WALL_H, th: TH, color: '#d8cfc0', mat: 'SmoothSurface' },
      { name: 'Alfeizar', test: s => s.cls.startsWith('ventana'), y0: 0, y1: SILL, th: TH, color: '#d8cfc0', mat: 'SmoothSurface' },
      { name: 'VentanaCerrada', test: s => s.cls === 'ventana', y0: SILL, y1: DOOR_H, th: TH * 0.3, color: '#9cc9e6', mat: 'SmoothSurface' },
      { name: 'Reja', test: s => s.cls === 'reja', y0: 0, y1: FENCE_H, th: TH * 0.4, color: '#6f757c', mat: 'Metal' },
    ];
    const lines = new Map();
    for (const s of c.segs) { const key = s.dir + ':' + s.line; if (!lines.has(key)) lines.set(key, []); lines.get(key).push(s); }
    for (const L of LAYERS) for (const segs of lines.values()) {
      const on = segs.filter(L.test).sort((a, b) => a.pos - b.pos);
      for (let i = 0; i < on.length;) {
        let j = i; while (j + 1 < on.length && on[j + 1].pos === on[j].pos + 1) j++;
        const s0 = on[i], s1 = on[j], dir = s0.dir, diag = dir[0] === 'd';
        const pts = [s0.a, s0.b, s1.a, s1.b], sx = pts.map(p => p[0]), sy = pts.map(p => p[1]);
        const x0 = Math.min(...sx), x1 = Math.max(...sx), y0 = Math.min(...sy), y1 = Math.max(...sy), n = j - i + 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const len = n * C * (diag ? Math.SQRT2 : 1) + L.th, ry = dir === 'h' ? 0 : dir === 'v' ? 90 : dir === 'd1' ? -45 : 45;
        add(L.name, 'Block', [X(cx), (L.y0 + L.y1) / 2, Z(cy)], [len, L.y1 - L.y0, L.th], L.color, L.mat, [0, ry, 0], cx, cy);
        i = j + 1;
      }
    }
    // chunks
    const byKey = new Map();
    for (const p of parts) { const [cx, cy] = p._c, kk = Math.floor(cx / chunkCells) + '_' + Math.floor(cy / chunkCells); delete p._c; if (!byKey.has(kk)) byKey.set(kk, []); byKey.get(kk).push(p); }
    const chunks = [];
    for (const [kk, ps] of [...byKey.entries()].sort()) {
      const [i, j] = kk.split('_').map(Number), center = [X((i + 0.5) * chunkCells), 0, Z((j + 0.5) * chunkCells)];
      for (let s = 0, part = 0; s < ps.length; s += maxPer, part++) chunks.push({ name: `CiudadD_${i}_${j}` + (ps.length > maxPer ? '_' + 'abcdefgh'[part] : ''), center, parts: ps.slice(s, s + maxPer) });
    }
    const at = h => [X(h.cx), 3 * k, Z(h.cy)];
    const A = c.houses.get(c.houseOf(c.startL));
    const spawns = {
      PlayerStart: A ? { pos: at(A), nota: 'punto A: el patio de entrada de la ciudad' } : null,
      refugios: [...c.houses.values()].filter(h => h.refuge).map((h, i) => ({ nombre: h.final ? 'B (refugio final)' : 'Refugio ' + (i + 1), pos: at(h), casa: h.type })),
    };
    return { parts, chunks, spawns, medidas: M, scale: { studsPorCelda: C, alturaPared: WALL_H, alturaPuerta: DOOR_H, mapaStuds: [(W - 1) * C, (H - 1) * C], mapaMetros: [(W - 1) * M.celda, (H - 1) * M.celda] } };
  }

  // ---------- dibujo para el visor
  const COLS = { calle: '#45494f', out: '#0f1113', ruina: '#3a332c', casa: '#c9a77c', tienda: '#b9c4cc', edificio: '#a39d93', almacen: '#8d8a83', mercado: '#b6ad98', entrada: '#7f9150', refugio: '#e8b23a' };
  function draw(g, c, s, opt = {}) {
    const { C4, H, q } = c;
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < C4; x++) for (let kq = 0; kq < 4; kq++) {
      const l = q[(y * C4 + x) * 4 + kq], kd = c.kindOf(l); let col;
      if (kd === 'out') col = COLS.out; else if (kd === 'corr') col = COLS.calle; else if (kd === 'pillar') col = COLS.ruina;
      else { const h = c.houses.get(c.houseOf(l)); col = h.refuge ? COLS.refugio : COLS[h.type]; }
      const tri = [[[x, y], [x + 1, y]], [[x + 1, y], [x + 1, y + 1]], [[x + 1, y + 1], [x, y + 1]], [[x, y + 1], [x, y]]][kq];
      g.fillStyle = col; g.beginPath(); g.moveTo(tri[0][0] * s, tri[0][1] * s); g.lineTo(tri[1][0] * s, tri[1][1] * s); g.lineTo((x + .5) * s, (y + .5) * s); g.closePath(); g.fill();
    }
    if (opt.route) { g.fillStyle = 'rgba(95,211,232,.55)'; for (const [x, y] of c.routeCells) g.fillRect(x * s + s * .2, y * s + s * .2, s * .6, s * .6); }
    const ST = {
      exterior: ['#121416', .32], interior: ['#121416', .26], medianera: ['#121416', .32], muralla: ['#7a4b3a', .5], ruina: ['#5a4d42', .3],
      puerta: ['#c0782f', .22], ventana: ['#8ecae6', .2], ventanaRota: ['#ff8a1f', .26, [.2, .15]], reja: ['#c5ccd3', .16, [.25, .2]], porton: ['#7fe08a', .16, [.08, .3]],
    };
    g.lineCap = 'round';
    for (const sg of c.segs) {
      const st = ST[sg.cls]; if (!st) continue;
      if (sg.cls === 'ventana') { g.strokeStyle = '#121416'; g.lineWidth = Math.max(1.5, s * .32); g.setLineDash([]); g.beginPath(); g.moveTo(sg.a[0] * s, sg.a[1] * s); g.lineTo(sg.b[0] * s, sg.b[1] * s); g.stroke(); }
      g.strokeStyle = st[0]; g.lineWidth = Math.max(1, s * st[1]); g.setLineDash(st[2] ? st[2].map(v => v * s) : []);
      g.beginPath(); g.moveTo(sg.a[0] * s, sg.a[1] * s); g.lineTo(sg.b[0] * s, sg.b[1] * s); g.stroke();
    }
    g.setLineDash([]);
    const mark = (h, t) => { if (!h) return; const r = Math.max(9, s * 2.4); g.fillStyle = t === 'A' ? '#7fe08a' : '#e8b23a'; g.beginPath(); g.arc(h.cx * s, h.cy * s, r, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#111'; g.font = `800 ${Math.round(r * 1.2)}px Saira Condensed, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, h.cx * s, h.cy * s + 1); };
    mark(c.houses.get(c.houseOf(c.startL)), 'A');
    let k = 0; for (const h of c.houses.values()) if (h.refuge) mark(h, h.final ? 'B' : 'R' + (++k));
  }

  root.CiudadDiagonal = { generate, toParts, draw };
})(typeof window !== 'undefined' ? window : globalThis);
