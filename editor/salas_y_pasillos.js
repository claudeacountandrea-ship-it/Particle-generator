// ---------- rooms and winding corridors ----------
// A coarse lattice every 10 points. Cells hold rooms (squares 8×8 with bevel 1, or 18×8 / 18×18
// with bevel 1 or 2, or rombos with flat tips of 2). Corridors 2 wide run along the cell edges and
// diagonally across free cells, grown as a winding maze (it prefers to turn, so it coils and
// snakes between rooms) that branches; every room opens onto a corridor beside it and corridor
// ends that lead to no room are cut back.
const Halls = (() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[rnd(0, a.length - 1)];
  const G = 10, M = 3;
  // cave: optional {W, H, cells: Set("x,y"), start} painted by the player
  return function halls(n = 8, m = n, cave = null) {
    if (cave) { n = Math.floor((cave.W - 2 * M - 1) / G); m = Math.floor((cave.H - 2 * M - 1) / G); }
    const W = cave ? cave.W : G * n + 2 * M + 1, H = cave ? cave.H : G * m + 2 * M + 1, B = Build(W, H);
    const N = (i, j) => [M + G * i, M + G * j]; // lattice node
    const nid = (i, j) => j * (n + 1) + i, cid = (i, j) => j * n + i;
    const painted = cave ? (x, y) => cave.cells.has(vk(Math.floor(x), Math.floor(y))) : () => true;
    const cellIn = (i, j) => { if (!cave) return true; let a = 0; for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (painted(M + G * i + x + .5, M + G * j + y + .5)) a++; return a / (G * G) >= 0.3; };
    const nodeIn = (i, j) => !cave || [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([a, b]) => i + a >= 0 && j + b >= 0 && i + a < n && j + b < m && cellIn(i + a, j + b));
    // ---- 1. rooms in cells ----
    const cell = Array.from({ length: n * m }, () => null); // {room id, kind}
    const rooms = [];
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      if (cell[cid(i, j)] || !cellIn(i, j) || Math.random() > 0.42) continue;
      let w = 1, h = 1;
      const free = (a, b) => a < n && b < m && !cell[cid(a, b)] && cellIn(a, b);
      const r = Math.random();
      if (r < 0.15 && free(i + 1, j) && free(i, j + 1) && free(i + 1, j + 1)) { w = 2; h = 2; }
      else if (r < 0.3 && free(i + 1, j)) w = 2; else if (r < 0.45 && free(i, j + 1)) h = 2;
      const kind = w === 2 && h === 2 && Math.random() < 0.5 ? 'rb' : 'sq'; // rombos only when big, so they read as rombos
      const room = { i, j, w, h, kind, bevel: w * h === 1 ? 1 : rnd(1, 2) }; // small rooms: bevel 1, so they stay square
      rooms.push(room);
      for (let b = j; b < j + h; b++) for (let a = i; a < i + w; a++) cell[cid(a, b)] = room;
    }
    // ---- 2. corridor maze over the lattice nodes ----
    const edges = new Map(); // key → {a, b, diag, cellKey}
    const ekey = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
    const inside = new Set(); // edges inside a big room are not corridors
    for (const r of rooms) for (let b = r.j; b <= r.j + r.h; b++) for (let a = r.i; a <= r.i + r.w; a++) {
      if (a > r.i && a < r.i + r.w && b >= r.j && b <= r.j + r.h) inside.add('v' + a + ',' + b);
      if (b > r.j && b < r.j + r.h && a >= r.i && a <= r.i + r.w) inside.add('h' + a + ',' + b);
    }
    const nodeBlocked = (i, j) => rooms.some(r => i > r.i && i < r.i + r.w && j > r.j && j < r.j + r.h);
    const usedDiagCell = new Set();
    const neighbours = (i, j) => {
      const out = [];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a > n || b > m || !nodeIn(a, b) || nodeBlocked(a, b)) continue;
        // a straight edge inside a 2-wide room is not allowed
        const r1 = di ? cell[cid(Math.min(i, a), j)] : null, r2 = di ? (j > 0 ? cell[cid(Math.min(i, a), j - 1)] : null) : null;
        const r3 = dj ? cell[cid(i, Math.min(j, b))] : null, r4 = dj ? (i > 0 ? cell[cid(i - 1, Math.min(j, b))] : null) : null;
        if ((r1 && r1 === r2) || (r3 && r3 === r4)) continue;
        out.push([a, b, false]);
      }
      for (const [di, dj] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a > n || b > m || !nodeIn(a, b) || nodeBlocked(a, b)) continue;
        const ci = Math.min(i, a), cj = Math.min(j, b);
        if (cell[cid(ci, cj)] || usedDiagCell.has(cid(ci, cj)) || (cave && !cellIn(ci, cj))) continue;
        out.push([a, b, true]);
      }
      return out;
    };
    // start: where the painting began, or the middle of the bottom edge
    let si = n >> 1, sj = m;
    if (cave && cave.start) { const [x, y] = cave.start.split(',').map(Number); si = Math.round((x - M) / G); sj = Math.round((y - M) / G); }
    if (!nodeIn(si, sj) || nodeBlocked(si, sj)) { outer: for (let j = m; j >= 0; j--) for (let i = 0; i <= n; i++) if (nodeIn(i, j) && !nodeBlocked(i, j)) { si = i; sj = j; break outer; } }
    const seen = new Set([nid(si, sj)]), stack = [[si, sj, null]];
    while (stack.length) {
      // growing tree: mostly the newest node (long winding ways), sometimes an older one (branches)
      const k = Math.random() < 0.85 ? stack.length - 1 : rnd(0, stack.length - 1);
      const [i, j, last] = stack[k];
      const opts = neighbours(i, j).filter(([a, b]) => !seen.has(nid(a, b)));
      if (!opts.length) { stack.splice(k, 1); continue; }
      // winding: prefer to turn (that is what makes the snakes and spirals), diagonals now and then
      let w = opts.map(([a, b, d]) => { const dir = [a - i, b - j] + ''; return (d ? 0.6 : 1) * (last && dir === last ? 0.35 : 1); });
      let t = Math.random() * w.reduce((s, v) => s + v, 0), c = 0; for (; c < opts.length - 1; c++) { t -= w[c]; if (t <= 0) break; }
      const [a, b, d] = opts[c];
      if (d) usedDiagCell.add(cid(Math.min(i, a), Math.min(j, b)));
      edges.set(ekey(nid(i, j), nid(a, b)), { a: [i, j], b: [a, b], diag: d });
      seen.add(nid(a, b)); stack.push([a, b, [a - i, b - j] + '']);
    }
    // ---- 3. each room opens onto a corridor edge beside it ----
    const roomDoors = [];
    for (const r of rooms) {
      const sides = [];
      for (let a = r.i; a < r.i + r.w; a++) { sides.push([[a, r.j], [a + 1, r.j]], [[a, r.j + r.h], [a + 1, r.j + r.h]]); }
      for (let b = r.j; b < r.j + r.h; b++) { sides.push([[r.i, b], [r.i, b + 1]], [[r.i + r.w, b], [r.i + r.w, b + 1]]); }
      const onTree = sides.filter(([p, q]) => edges.has(ekey(nid(...p), nid(...q))));
      const cand = onTree.length ? onTree : sides.filter(([p, q]) => seen.has(nid(...p)) && seen.has(nid(...q)) && !nodeBlocked(...p) && !nodeBlocked(...q));
      if (!cand.length) continue;
      const nDoors = r.w * r.h > 1 && Math.random() < 0.5 ? 2 : 1;
      for (const s of [...cand].sort(() => Math.random() - .5).slice(0, nDoors)) {
        edges.set(ekey(nid(...s[0]), nid(...s[1])), { a: s[0], b: s[1], diag: false });
        roomDoors.push([r, s]);
      }
    }
    // ---- 4. cut back corridor ends that lead to no room ----
    const needed = new Set(roomDoors.map(([, s]) => ekey(nid(...s[0]), nid(...s[1]))));
    const startKey = nid(si, sj);
    for (let changed = true; changed;) {
      changed = false;
      const deg = new Map(); for (const e of edges.values()) for (const p of [e.a, e.b]) deg.set(nid(...p), (deg.get(nid(...p)) || 0) + 1);
      for (const [k, e] of edges) {
        if (needed.has(k)) continue;
        if ([e.a, e.b].some(p => deg.get(nid(...p)) === 1 && nid(...p) !== startKey)) { edges.delete(k); changed = true; }
      }
    }
    // a few loops between corridors (shortcuts)
    let loops = 0;
    for (let t = 0; t < n * m * 0.08; t++) {
      const i = rnd(0, n), j = rnd(0, m); if (!seen.has(nid(i, j))) continue;
      const [a, b, d] = pick(neighbours(i, j).length ? neighbours(i, j) : [[i, j, false]]);
      const k = ekey(nid(i, j), nid(a, b)); if (a === i && b === j || edges.has(k) || !seen.has(nid(a, b))) continue;
      const touches = new Set(); for (const e of edges.values()) { touches.add(nid(...e.a)); touches.add(nid(...e.b)); }
      if (!touches.has(nid(i, j)) || !touches.has(nid(a, b))) continue;
      if (d) usedDiagCell.add(cid(Math.min(i, a), Math.min(j, b)));
      edges.set(k, { a: [i, j], b: [a, b], diag: d }); loops++;
    }
    // ---- 5. paint ----
    const corr = B.label('corr');
    const nodeLinks = new Map();
    for (const e of edges.values()) for (const [p, q] of [[e.a, e.b], [e.b, e.a]]) {
      const k = nid(...p); if (!nodeLinks.has(k)) nodeLinks.set(k, []); nodeLinks.get(k).push([q[0] - p[0], q[1] - p[1]]);
    }
    for (const e of edges.values()) {
      const [x1, y1] = N(...e.a), [x2, y2] = N(...e.b), dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
      if (e.diag) {
        const along = (x, y) => (x - x1) * dx + (y - y1) * dy, perp = (x, y) => (x - x1) * dy - (y - y1) * dx, L = along(x2, y2);
        B.paint((x, y) => Math.abs(perp(x, y)) <= 2 && along(x, y) >= 0 && along(x, y) <= L, corr);
      } else {
        const lo = [Math.min(x1, x2) - 1, Math.min(y1, y2) - 1], hi = [Math.max(x1, x2) + 1, Math.max(y1, y2) + 1];
        B.paint((x, y) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1], corr);
      }
    }
    // corridor turns: no 90° corners (cut outside, fill inside with a diagonal of 2)
    const cuts = [];
    for (const [k, L] of nodeLinks) {
      const i = k % (n + 1), j = (k / (n + 1)) | 0, [cx, cy] = N(i, j);
      B.paint((x, y) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1, corr);
      const orth = L.filter(([a, b]) => !(a && b)), has = (a, b) => orth.some(d => d[0] === a && d[1] === b);
      if (L.length !== orth.length || orth.length < 2) continue;
      for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        if (!has(sx, 0) && !has(0, sy)) cuts.push((x, y) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1 && sx * (x - cx) + sy * (y - cy) > 0);
        if (has(sx, 0) && has(0, sy)) B.paint((x, y) => sx * (x - cx) >= 1 && sy * (y - cy) >= 1 && sx * (x - cx) + sy * (y - cy) <= 4, corr, [0]);
      }
    }
    for (const f of cuts) B.paint(f, 0, [corr]);
    // rooms: squares with a bevel of 1 or 2, rombos with tips of 2
    for (const r of rooms) {
      const [x0, y0] = N(r.i, r.j), x1 = x0 + G * r.w, y1 = y0 + G * r.h;
      const l = B.label('room'); r.label = l;
      if (r.kind === 'rb') {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = (x1 - x0) / 2 - 1;
        B.paint((x, y) => Math.abs(x - cx) <= R && Math.abs(y - cy) <= R && Math.abs(x - cx) + Math.abs(y - cy) <= R + 1, l);
      } else {
        // the bevel pockets become corridor when a corridor passes there, so no thin gaps
        B.paint(bevelRect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0), corr, [0]);
        B.paint(bevelRect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, r.bevel), l);
      }
    }
    // the way in: a corridor from the start node to the map edge
    { const [sx, sy] = N(si, sj); if (!cave) B.paint((x, y) => Math.abs(x - sx) <= 1 && y >= sy && y <= H, corr); }
    B.snap(); B.pieces();
    // corridor scraps that touch nothing become rock
    for (let l = 1; l < B.next; l++) if (B.kinds[l] === 'corr' && l !== corr && B.area(l)) B.paint(() => true, 0, [l]); // closed scraps nobody can reach
    B.snap(); B.thin(); B.snap(); B.spikes();
    // ---- 6. doors ----
    const segs = B.segments(), runs = B.runs(segs), deg = new Map();
    for (const s of segs) for (const p of parseW(s.k)) { const v = vk(...p); deg.set(v, (deg.get(v) || 0) + 1); }
    const doors = [];
    for (const [r, s] of roomDoors) {
      // the run of the room wall along that cell edge
      const [p, q] = s.map(t => N(...t)), horiz = p[1] === q[1];
      const run = segs.filter(g => (g.a === r.label || g.b === r.label) && (g.a === corr || g.b === corr) &&
        (horiz ? g.d === 'h' && Math.abs(g.line - p[1]) <= 1 && g.pos >= Math.min(p[0], q[0]) && g.pos < Math.max(p[0], q[0])
               : g.d === 'v' && Math.abs(g.line - p[0]) <= 1 && g.pos >= Math.min(p[1], q[1]) && g.pos < Math.max(p[1], q[1]))).sort((u, v) => u.pos - v.pos);
      const lines = [...new Set(run.map(g => g.line))];
      const best = lines.map(L => run.filter(g => g.line === L)).sort((u, v) => v.length - u.length)[0];
      const d = best && B.safeDoor(best, deg); if (d) doors.push(...d);
    }
    if (!cave) { // the entrance: the bottom edge of the map
      const out = segs.filter(g => g.d === 'h' && g.line === H - 1 && (g.a === corr || g.b === corr)).sort((u, v) => u.pos - v.pos);
      if (out.length) doors.push(...out.map(g => g.k));
    }
    let floor = 0; for (const v of B.q) if (v) floor++;
    const nDiag = [...edges.values()].filter(e => e.diag).length;
    return {
      size: W, rows: H, walls: segs.map(s => s.k), doors: [...new Set(doors)], columns: [],
      title: cave ? 'Masmorra construida sobre tu cueva' : `Salas y pasillos ${n}×${m}`,
      desc: `${rooms.length} salas (cuadradas 8×8 con bisel 1, dobles o grandes con bisel 1 o 2, y rombos con puntas de 2). ` +
        `Pasillos de 2 que serpentean entre ellas: crecen como un laberinto que prefiere girar (vueltas y espirales), se ramifican y a veces cortan en diagonal (${nDiag} tramos diagonales). ` +
        `Cada sala abre a un pasillo vecino; los pasillos que no llevan a ninguna sala se cortan. ${loops} atajos.\n• Piso usado: ${Math.round(100 * floor / B.q.length)}%.\n\nMarca con 🖍 los errores y explica abajo.`,
    };
  };
})();
