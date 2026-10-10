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
  // opts: {central, rmin, rmax} — the boss hall in the middle (with columns); rooms are rmin..rmax squares across (1 square = 2 people), bigger ones are split into little rooms
  return function halls(n = 8, m = n, cave = null, opts = {}) {
    if (cave) { n = Math.floor((cave.W - 2 * M - 1) / G); m = Math.floor((cave.H - 2 * M - 1) / G); }
    // the lattice is not even: columns and rows are 8, 10, 12 or 14 wide, so rooms differ in size
    // (a cave keeps the even 10, to follow the painting)
    // scale: one square holds 2 people. A corridor is 2 squares; a room is between rmin and rmax
    // squares across (the lattice pitch is the room plus its share of the corridor bands)
    const rmin = Math.max(4, opts.rmin || 4), rmax = Math.max(rmin, opts.rmax || 8);
    const pitches = []; for (let p = rmin + 2; p <= rmax + 2; p += 2) pitches.push(p); if (!pitches.length) pitches.push(rmin + 2);
    const mid = pitches[pitches.length >> 1];
    const pitch = () => cave ? G : pick([...pitches, mid, mid]);
    // the pitches mirror (left = right) and rows repeat the columns, so both great diagonals of the map
    // are square casillas all the way: room for diagonal avenues
    // round map: the outline is a circle with a slow wobble (organic), not the square of the lattice
    const round = !cave && !!opts.round, ph1 = Math.random() * 7, ph2 = Math.random() * 7;
    const inShape = (i, j) => { if (!round) return true; const u = (i + 0.5 - n / 2) / (n / 2), v = (j + 0.5 - m / 2) / (m / 2), t = Math.atan2(v, u);
      return Math.hypot(u, v) <= 1.0 + 0.07 * Math.sin(3 * t + ph1) + 0.05 * Math.sin(5 * t + ph2); };
    // diagonal avenues: where they go is chosen first, so their casillas get one even pitch (a straight rectangle)
    const avLen = 3, avPlan = [];
    if (!cave && n === m && n >= 8) {
      // avenues anywhere (not only on the great diagonals): each brings a rombo and a row of turned little rooms on
      // both sides, so rooms in diagonal are as common as straight ones. Each sits wholly inside the outline,
      // with a casilla of margin, and apart from the others.
      const want = n >= 14 ? 3 : n >= 10 ? 2 : 1, used = new Set();
      const footprint = (i0, j0, sg) => { const f = []; for (let t = 0; t < avLen; t++) f.push([i0 + t, j0 + sg * t]); for (let t = 0; t + 1 < avLen; t++) f.push([i0 + t + 1, j0 + sg * t], [i0 + t, j0 + sg * (t + 1)]); return f; };
      for (let tries = 0; tries < 400 && avPlan.length < want; tries++) {
        const sg = Math.random() < 0.5 ? 1 : -1, i0 = rnd(1, n - avLen - 1), j0 = sg > 0 ? rnd(1, m - avLen - 1) : rnd(avLen, m - 2);
        const f = footprint(i0, j0, sg), ring = new Set(); for (const [i, j] of f) for (let b = -1; b <= 1; b++) for (let a2 = -1; a2 <= 1; a2++) ring.add((i + a2) + ',' + (j + b));
        if ([...ring].some(k => { const [i, j] = k.split(',').map(Number); return i < 0 || j < 0 || i >= n || j >= m || !inShape(i, j) || used.has(k); })) continue;
        avPlan.push([i0, j0, sg]); for (const [i, j] of f) for (let b = -1; b <= 1; b++) for (let a2 = -1; a2 <= 1; a2++) used.add((i + a2) + ',' + (j + b));
      }
    }
    // the casillas of an avenue must be square: its columns and rows take one pitch
    const even = new Set(); for (const [i0, j0, sg] of avPlan) for (let t = 0; t < avLen; t++) { even.add(i0 + t); even.add(j0 + sg * t); }
    const px = []; for (let i = 0; i < n; i++) px.push(i < (n + 1) >> 1 ? (even.has(i) && !cave ? mid : pitch()) : px[n - 1 - i]);
    for (const i of even) px[i] = mid;
    const py = []; for (let j = 0; j < m; j++) py.push(m === n ? px[j] : pitch());
    const X = [M], Y = [M]; for (let i = 0; i < n; i++) X.push(X[i] + px[i]); for (let j = 0; j < m; j++) Y.push(Y[j] + py[j]);
    const W = cave ? cave.W : X[n] + M + 1, H = cave ? cave.H : Y[m] + M + 1, B = Build(W, H);
    const N = (i, j) => [X[i], Y[j]]; // lattice node
    const cw = i => X[i + 1] - X[i], ch = j => Y[j + 1] - Y[j], square = (i, j, w = 1, h = 1) => X[i + w] - X[i] === Y[j + h] - Y[j];
    const nid = (i, j) => j * (n + 1) + i, cid = (i, j) => j * n + i;
    const painted = cave ? (x, y) => cave.cells.has(vk(Math.floor(x), Math.floor(y))) : () => true;
    // ---- diagonal quarters (barrios en diagonal): rotated squares of the map built on a lattice turned 45°:
    // every room in them is a rombo or a turned rectangle, every corridor runs in diagonal, also along their edge
    // (so a route can go round them). u = x + y and v = x − y; a district is |u − Uc| ≤ D, |v − Vc| ≤ D. ----
    const casOf = (x, y) => { let i = 0, j = 0; while (i < n - 1 && X[i + 1] <= x) i++; while (j < m - 1 && Y[j + 1] <= y) j++; return [i, j]; };
    const inMapPt = (x, y) => { if (x < X[0] || y < Y[0] || x > X[n] || y > Y[m]) return false; const [i, j] = casOf(x, y); return inShape(i, j); };
    // the way in comes from outside the map, from a side chosen by luck (down, up, right or left)
    const entDir = cave ? [0, 1] : pick([[0, 1], [0, -1], [1, 0], [-1, 0]]);
    const ex = entDir[0] ? (entDir[0] > 0 ? n : 0) : n / 2, ey = entDir[1] ? (entDir[1] > 0 ? m : 0) : m / 2;
    // the boss hall's spot is chosen first (luck, far from the entrance), so the diagonal quarters leave room for it
    const bossCs = n >= 14 && m >= 14 ? 3 : 2, bossCas = new Set(); let bossPre = null;
    if (!cave && opts.central !== false && n >= 6 && m >= 6) {
      const s1 = [], s2 = [];
      for (let cj = 1; cj + bossCs < m; cj++) for (let ci = 1; ci + bossCs < n; ci++) {
        let ok = true; for (let b = cj - 1; b <= cj + bossCs && ok; b++) for (let a2 = ci - 1; a2 <= ci + bossCs && ok; a2++) if (!inShape(a2, b)) ok = false;
        if (!ok) continue; const d = Math.hypot(ci + bossCs / 2 - ex, cj + bossCs / 2 - ey);
        if (d >= 0.5 * Math.max(n, m)) s1.push([ci, cj]); else if (d >= 0.3 * Math.max(n, m)) s2.push([ci, cj]); }
      bossPre = s1.length ? pick(s1) : s2.length ? pick(s2) : null;
      if (bossPre) for (let b = bossPre[1] - 1; b <= bossPre[1] + bossCs; b++) for (let a2 = bossPre[0] - 1; a2 <= bossPre[0] + bossCs; a2++) bossCas.add(cid(a2, b));
    }
    const districts = [], distCas = new Set(), DP = 14; // DP: pitch of the turned lattice (in u units): rooms ~7 squares across
    if (!cave && opts.districts !== false && n >= 8) {
      // several smaller quarters spread over the map: each new one is the candidate farthest from those already placed
      const want = n >= 14 ? 5 : n >= 10 ? 5 : 3, avCas = new Set();
      for (let round = 0; round < want; round++) {
       let bestC = null, bestD = -1;
       for (let tries = 0; tries < 260; tries++) {
        const K = n >= 14 || tries < 120 ? (n >= 10 ? 3 : 2) : 2, D = K * DP / 2;
        const xc = X[0] + Math.round(Math.random() * (X[n] - X[0])), yc = Y[0] + Math.round(Math.random() * (Y[m] - Y[0])), Uc = xc + yc, Vc = xc - yc;
        // the whole diamond (and a margin of 3) inside the outline
        const Rr = D + 3, vx = [[xc + Rr, yc], [xc, yc + Rr], [xc - Rr, yc], [xc, yc - Rr]]; let ok = true;
        for (let e = 0; e < 4 && ok; e++) for (let t = 0; t <= 8 && ok; t++) { const [ax, ay] = vx[e], [bx, by] = vx[(e + 1) & 3]; if (!inMapPt(ax + (bx - ax) * t / 8, ay + (by - ay) * t / 8)) ok = false; }
        if (!ok) continue;
        const mine = []; for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const x = X[i] + cw(i) / 2, y = Y[j] + ch(j) / 2; if (Math.abs(x + y - Uc) < D + 2 && Math.abs(x - y - Vc) < D + 2) mine.push([i, j]); }
        if (mine.some(([i, j]) => distCas.has(cid(i, j)) || bossCas.has(cid(i, j)))) continue;
        if (districts.some(d => Math.abs(d.Uc - Uc) < d.D + D + 12 && Math.abs(d.Vc - Vc) < d.D + D + 12)) continue; // a corridor's width and more apart
        const far = districts.length ? Math.min(...districts.map(d => Math.hypot(d.xc - xc, d.yc - yc))) : Math.random();
        if (far > bestD) { bestD = far; bestC = { Uc, Vc, D, K, xc, yc, mine }; }
       }
       if (!bestC) break;
       districts.push(bestC); for (const [i, j] of bestC.mine) distCas.add(cid(i, j));
      }
    }
    // loose rombos: single turned rooms dropped among the straight rooms, spread apart — each a quarter of one turned
    // cell, with its own diagonal corridor along part of its edge, so it never cuts the straight corridors and a way
    // can go round it
    const nLoose = { n: 0 };
    if (!cave && opts.districts !== false && n >= 8) {
      const wantL = n >= 18 ? 17 : n >= 14 ? 12 : n >= 10 ? 7 : 3, Dl = DP / 2;
      for (let round = 0; round < wantL; round++) {
        let best = null, bestD = -1;
        for (let tries = 0; tries < 150; tries++) {
          const xc = X[0] + Math.round(Math.random() * (X[n] - X[0])), yc = Y[0] + Math.round(Math.random() * (Y[m] - Y[0])), Uc = xc + yc, Vc = xc - yc;
          const Rr = Dl + 3, vx = [[xc + Rr, yc], [xc, yc + Rr], [xc - Rr, yc], [xc, yc - Rr]]; if (!vx.every(([x, y]) => inMapPt(x, y))) continue;
          if (districts.some(d => { const g = d.loose ? 4 : 8; return Math.abs(d.Uc - Uc) < d.D + Dl + g && Math.abs(d.Vc - Vc) < d.D + Dl + g; })) continue;
          const mine = []; for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const x = X[i] + cw(i) / 2, y = Y[j] + ch(j) / 2; if (Math.abs(x + y - Uc) < Dl + 2 && Math.abs(x - y - Vc) < Dl + 2) mine.push([i, j]); }
          if (mine.some(([i, j]) => distCas.has(cid(i, j)) || bossCas.has(cid(i, j)))) continue;
          const far = Math.min(1e9, ...districts.map(d => Math.hypot(d.xc - xc, d.yc - yc)));
          if (far > bestD) { bestD = far; best = { Uc, Vc, D: Dl, K: 1, xc, yc, mine, loose: true }; }
        }
        if (!best) break;
        districts.push(best); for (const [i, j] of best.mine) distCas.add(cid(i, j)); nLoose.n++;
      }
    }
    // avenues that fall on a diagonal quarter are dropped (the quarter is already all diagonal)
    for (let k = avPlan.length - 1; k >= 0; k--) { const [i0, j0, sg] = avPlan[k]; let hit = false; for (let t = -1; t <= avLen; t++) for (let e = -1; e <= 1; e++) for (const [i, j] of [[i0 + t, j0 + sg * t + e], [i0 + t + e, j0 + sg * t]]) if (i >= 0 && j >= 0 && i < n && j < m && (distCas.has(cid(i, j)) || bossCas.has(cid(i, j)))) hit = true; if (hit) avPlan.splice(k, 1); }
    const cellIn = (i, j) => { if (distCas.has(cid(i, j))) return false; if (!cave) return inShape(i, j); let a = 0; for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (painted(M + G * i + x + .5, M + G * j + y + .5)) a++; return a / (G * G) >= 0.3; };
    const nodeIn = (i, j) => !(cave || round || distCas.size) || [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([a, b]) => i + a >= 0 && j + b >= 0 && i + a < n && j + b < m && cellIn(i + a, j + b));
    // ---- 1. rooms in cells ----
    const cell = Array.from({ length: n * m }, () => null); // {room id, kind}
    const rooms = [];
    // every cell is a room (rooms that share a wall where no corridor passes), except a few kept
    // free so a corridor may cross them diagonally
    const freeCell = new Set();
    // diagonal avenues: 3 or 4 casillas kept free along a great diagonal, crossed later by one straight diagonal corridor
    const avenues = [], avenueInner = new Set(), avenueCells = new Set(), avenueSide = new Set(), avenueEndBlock = new Map();
    {
      const len = avLen;
      for (const [i0, j0, sg] of avPlan) {
        const cs = []; for (let t = 0; t < len; t++) cs.push([i0 + t, j0 + sg * t]);
        if (cs.some(([i, j]) => cell[cid(i, j)] || !square(i, j) || !cellIn(i, j))) continue;
        // the casillas on both sides become plain single rooms: the gallery's little rooms are cut from them
        const sides = []; for (let t = 0; t + 1 < len; t++) { const [a, b] = cs[t]; sides.push([a + 1, b], [a, b + sg]); }
        if (sides.some(([i, j]) => i < 0 || j < 0 || i >= n || j >= m || !cellIn(i, j) || (cell[cid(i, j)] && !cell[cid(i, j)].side))) continue;
        for (const [i, j] of cs) { freeCell.add(cid(i, j)); avenueCells.add(cid(i, j)); }
        for (const [i, j] of sides) avenueSide.add(cid(i, j));
        for (const [i, j] of sides) if (!cell[cid(i, j)]) { const r = { i, j, w: 1, h: 1, kind: 'sq', bevel: 1, side: true }; rooms.push(r); cell[cid(i, j)] = r; }
        const av = cs.map(([i, j]) => sg > 0 ? [[i, j], [i + 1, j + 1]] : [[i + 1, j], [i, j + 1]]);
        avenues.push(av);
        // its inner points take no straight corridor: nothing crosses the long rectangle
        const cnt = new Map(); for (const [a, b] of av) for (const q of [a, b]) cnt.set(q + '', (cnt.get(q + '') || 0) + 1);
        for (const [k, c] of cnt) if (c === 2) avenueInner.add(k);
        // the other two corners of each of its casillas lie on the rectangle's outer wall: no corridor there either
        for (const [i, j] of cs) for (const q of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) if (!cnt.has(q + '')) avenueInner.add(q + '');
        // at its two ends no straight corridor may go in along its sides either
        const ends = [...cnt].filter(([, c]) => c === 1).map(([k]) => k.split(',').map(Number));
        const [e0, e1] = ends, ddx = Math.sign(e1[0] - e0[0]), ddy = Math.sign(e1[1] - e0[1]);
        avenueEndBlock.set(e0 + '', [[ddx, 0], [0, ddy]]); avenueEndBlock.set(e1 + '', [[-ddx, 0], [0, -ddy]]);
      }
    }
    // the boss hall: anywhere (luck), but never beside the entrance — at least half the map away from it
    if (!cave && opts.central !== false && n >= 6 && m >= 6) {
      const cs = bossCs, spots = [], spots2 = [];
      for (let cj = 0; cj + cs <= m; cj++) for (let ci = 0; ci + cs <= n; ci++) {
        let ok = true; for (let b = cj - 1; b <= cj + cs && ok; b++) for (let a2 = ci - 1; a2 <= ci + cs && ok; a2++) { const inside = a2 >= ci && a2 < ci + cs && b >= cj && b < cj + cs;
          if (inside && (cell[cid(a2, b)] || freeCell.has(cid(a2, b)) || !cellIn(a2, b))) ok = false;
          if (!inside && (a2 < 0 || b < 0 || a2 >= n || b >= m || !cellIn(a2, b))) ok = false; } // a ring of casillas round it stays in the map
        if (!ok) continue;
        const d = Math.hypot(ci + cs / 2 - ex, cj + cs / 2 - ey);
        if (d >= 0.5 * Math.max(n, m)) spots.push([ci, cj]); else if (d >= 0.3 * Math.max(n, m)) spots2.push([ci, cj]);
      }
      const sp = bossPre && [...spots, ...spots2].some(([a, b]) => a === bossPre[0] && b === bossPre[1]) ? bossPre : spots.length ? pick(spots) : spots2.length ? pick(spots2) : null;
      if (sp) { const [ci, cj] = sp, c0 = { i: ci, j: cj, w: cs, h: cs, kind: 'sq', bevel: 2, special: 'central' };
        rooms.push(c0); for (let b = cj; b < cj + cs; b++) for (let a2 = ci; a2 < ci + cs; a2++) cell[cid(a2, b)] = c0; }
    }
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      if (cell[cid(i, j)] || freeCell.has(cid(i, j)) || !cellIn(i, j)) continue;
      if (square(i, j) && Math.random() < 0.4) { freeCell.add(cid(i, j)); continue; }
      let w = 1, h = 1;
      const free = (a, b) => a < n && b < m && !cell[cid(a, b)] && !freeCell.has(cid(a, b)) && cellIn(a, b);
      const r = Math.random();
      // galleries: a long corridor with little rooms (partitions) on both sides
      if (r < 0.05 && free(i + 1, j) && free(i + 2, j)) {
        const big = free(i, j + 1) && free(i + 1, j + 1) && free(i + 2, j + 1); if (!big) continue; // only wide galleries: their little rooms are at least 5 deep
        const g = { i, j, w: 3, h: 2, kind: 'gal', axis: 'x', bevel: 1 }; rooms.push(g);
        for (let b = j; b < j + g.h; b++) for (let a = i; a < i + 3; a++) cell[cid(a, b)] = g;
        continue;
      }
      if (r < 0.09 && free(i, j + 1) && free(i, j + 2)) {
        const big = free(i + 1, j) && free(i + 1, j + 1) && free(i + 1, j + 2); if (!big) continue;
        const g = { i, j, w: 2, h: 3, kind: 'gal', axis: 'y', bevel: 1 }; rooms.push(g);
        for (let b = j; b < j + 3; b++) for (let a = i; a < i + g.w; a++) cell[cid(a, b)] = g;
        continue;
      }
      // diagonal galleries: a long hall at 45° across a square block, little rooms along both its walls
      if (false) { // the diagonal hall boxed in a block left big triangles: not used
        const k = free(i + 2, j) && free(i + 2, j + 1) && free(i, j + 2) && free(i + 1, j + 2) && free(i + 2, j + 2) && Math.random() < 0.5 ? 3 : 2;
        if (Math.abs((X[i + k] - X[i]) - (Y[j + k] - Y[j])) <= 2) {
          const g = { i, j, w: k, h: k, kind: 'dgal', bevel: 1, slash: Math.random() < 0.5 }; rooms.push(g);
          for (let b = j; b < j + k; b++) for (let a = i; a < i + k; a++) cell[cid(a, b)] = g;
          continue;
        }
      }
      if (r < 0.36 && free(i + 1, j) && free(i, j + 1) && free(i + 1, j + 1)) { w = 2; h = 2; }
      else if (r < 0.3 && free(i + 1, j)) w = 2; else if (r < 0.45 && free(i, j + 1)) h = 2;
      // rombos only over 2×2 casillas (nearly square is enough): a small one would read as an octagon
      let near = Math.abs((X[i + w] - X[i]) - (Y[j + h] - Y[j])) <= 2;
      const kind = 'sq'; // no rombo inside a square of the lattice: it always leaves 4 triangles; rombos live in the avenues
      // some rombos are big: 3×3 casillas, empty inside
      if (kind === 'rb' && Math.random() < 0.35 && [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]].every(([a, b]) => free(i + a, j + b)) && Math.abs((X[i + 3] - X[i]) - (Y[j + 3] - Y[j])) <= 2) { w = 3; h = 3; }
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
    const nodeBlocked = (i, j) => avenueInner.has(i + ',' + j) || rooms.some(r => i > r.i && i < r.i + r.w && j > r.j && j < r.j + r.h);
    const usedDiagCell = new Set();
    const neighbours = (i, j) => {
      const out = [];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a > n || b > m || !nodeIn(a, b) || nodeBlocked(a, b)) continue;
        if ((avenueEndBlock.get(i + ',' + j) || []).some(([u, v]) => u === di && v === dj) || (avenueEndBlock.get(a + ',' + b) || []).some(([u, v]) => u === -di && v === -dj)) continue;
        // never through a diagonal quarter (casillas on both sides kept for it): only round it
        { const f = di ? [[Math.min(i, a), j], [Math.min(i, a), j - 1]] : [[i, Math.min(j, b)], [i - 1, Math.min(j, b)]];
          if (f.every(([p, q]) => p >= 0 && q >= 0 && p < n && q < m && distCas.has(cid(p, q)))) continue; }
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
        if (cell[cid(ci, cj)] || usedDiagCell.has(cid(ci, cj)) || avenueCells.has(cid(ci, cj)) || !square(ci, cj) || ((cave || round) && !cellIn(ci, cj))) continue;
        out.push([a, b, true]);
      }
      return out;
    };
    // start: where the painting began, or the middle of the bottom edge
    let si = n >> 1, sj = m;
    if (cave && cave.start) { const [x, y] = cave.start.split(',').map(Number); si = Math.round((x - M) / G); sj = Math.round((y - M) / G); }
    // the way in comes up from the bottom edge of the map: the start is a point on the outline with nothing
    // of the dungeon below it (so the entrance corridor crosses no room), as low and as central as possible
    // nothing of the dungeon between the start point and the map edge on the entrance side
    const openOut = (i, j) => { const [dx, dy] = entDir;
      if (dy) { for (let jj = dy > 0 ? j : j - 1; dy > 0 ? jj < m : jj >= 0; jj += dy) for (const ii of [i - 1, i]) if (ii >= 0 && ii < n && (cellIn(ii, jj) || distCas.has(cid(ii, jj)))) return false; }
      else { for (let ii = dx > 0 ? i : i - 1; dx > 0 ? ii < n : ii >= 0; ii += dx) for (const jj of [j - 1, j]) if (jj >= 0 && jj < m && (cellIn(ii, jj) || distCas.has(cid(ii, jj)))) return false; }
      return true; };
    if (!cave) { let best = null, bs = -1e9; for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) if ((entDir[0] ? j > 0 && j < m : i > 0 && i < n) && nodeIn(i, j) && !nodeBlocked(i, j) && openOut(i, j)) {
        const sc = (i * entDir[0] + j * entDir[1]) * 100 - (entDir[0] ? Math.abs(j - m / 2) : Math.abs(i - n / 2)); if (sc > bs) { bs = sc; best = [i, j]; } } if (best) [si, sj] = best; }
    if (!nodeIn(si, sj) || nodeBlocked(si, sj)) { outer: for (let j = m; j >= 0; j--) for (let i = 0; i <= n; i++) if (nodeIn(i, j) && !nodeBlocked(i, j)) { si = i; sj = j; break outer; } }
    const seen = new Set([nid(si, sj)]), stack = [[si, sj, null]];
    while (stack.length) {
      // growing tree: mostly the newest node (long winding ways), sometimes an older one (branches)
      const k = Math.random() < 0.7 ? stack.length - 1 : rnd(0, stack.length - 1); // more often an older node: more branches
      const [i, j, last] = stack[k];
      const opts = neighbours(i, j).filter(([a, b]) => !seen.has(nid(a, b)));
      if (!opts.length) { stack.splice(k, 1); continue; }
      // winding: prefer to turn (that is what makes the snakes and spirals), diagonals now and then
      let w = opts.map(([a, b, d]) => { const dir = [a - i, b - j] + ''; return (d ? 2 : 1) * (last && dir === last ? 0.35 : 1); }); // diagonals stay short: one casilla, then a turn
      let t = Math.random() * w.reduce((s, v) => s + v, 0), c = 0; for (; c < opts.length - 1; c++) { t -= w[c]; if (t <= 0) break; }
      const [a, b, d] = opts[c];
      if (d) usedDiagCell.add(cid(Math.min(i, a), Math.min(j, b)));
      edges.set(ekey(nid(i, j), nid(a, b)), { a: [i, j], b: [a, b], diag: d });
      seen.add(nid(a, b)); stack.push([a, b, [a - i, b - j] + '']);
    }
    // the avenues: one straight diagonal corridor each (a shortcut across the map)
    const avenueKeys = new Set();
    for (const av of avenues) {
      if (av.some(([a, b]) => usedDiagCell.has(cid(Math.min(a[0], b[0]), Math.min(a[1], b[1]))))) continue;
      for (const [a, b] of av) { usedDiagCell.add(cid(Math.min(a[0], b[0]), Math.min(a[1], b[1]))); const k = ekey(nid(...a), nid(...b)); edges.set(k, { a, b, diag: true }); avenueKeys.add(k); seen.add(nid(...a)); seen.add(nid(...b)); }
    }
    for (const c of freeCell) if (!usedDiagCell.has(c)) {
      const i = c % n, j = (c / n) | 0, room = { i, j, w: 1, h: 1, kind: 'sq', bevel: 1 };
      rooms.push(room); cell[c] = room;
    }
    // ---- 3. each room opens onto a corridor edge beside it ----
    const roomDoors = [], lacking = [];
    for (const r of rooms) {
      const sides = [];
      for (let a = r.i; a < r.i + r.w; a++) { sides.push([[a, r.j], [a + 1, r.j]], [[a, r.j + r.h], [a + 1, r.j + r.h]]); }
      for (let b = r.j; b < r.j + r.h; b++) { sides.push([[r.i, b], [r.i, b + 1]], [[r.i + r.w, b], [r.i + r.w, b + 1]]); }
      r.sides = sides;
      const onTree = sides.filter(([p, q]) => edges.has(ekey(nid(...p), nid(...q))));
      if (!onTree.length) { lacking.push(r); continue; }
      const cand = onTree;
      const nDoors = r.kind === 'gal' || r.kind === 'dgal' ? rnd(3, 5) : r.w * r.h > 1 && Math.random() < 0.5 ? 2 : 1;
      for (const s of [...cand].sort(() => Math.random() - .5).slice(0, nDoors)) {
        edges.set(ekey(nid(...s[0]), nid(...s[1])), { a: s[0], b: s[1], diag: false });
        roomDoors.push([r, s]);
      }
    }
    // ---- 4. cut back corridor ends that lead to no room ----
    let nDead = 0; const needed = new Set([...roomDoors.map(([, s]) => ekey(nid(...s[0]), nid(...s[1]))), ...avenueKeys]);
    const startKey = nid(si, sj);
    // some ends that lead nowhere stay as true dead ends (one or two stretches long): a way that only ends
    { const deg = new Map(); for (const e of edges.values()) for (const p of [e.a, e.b]) deg.set(nid(...p), (deg.get(nid(...p)) || 0) + 1);
      for (const [k, e] of edges) { if (e.diag || Math.random() >= 0.35) continue; const lf = [e.a, e.b].find(p => deg.get(nid(...p)) === 1 && nid(...p) !== startKey); if (!lf) continue;
        needed.add(k); nDead++; if (Math.random() < 0.5) { const o = lf === e.a ? e.b : e.a; for (const [k2, e2] of edges) if (k2 !== k && !e2.diag && (nid(...e2.a) === nid(...o) || nid(...e2.b) === nid(...o)) && deg.get(nid(...o)) === 2) { needed.add(k2); break; } } } }
    for (let changed = true; changed;) {
      changed = false;
      const deg = new Map(); for (const e of edges.values()) for (const p of [e.a, e.b]) deg.set(nid(...p), (deg.get(nid(...p)) || 0) + 1);
      for (const [k, e] of edges) {
        if (needed.has(k)) continue;
        if ([e.a, e.b].some(p => deg.get(nid(...p)) === 1 && nid(...p) !== startKey)) { edges.delete(k); changed = true; }
      }
    }
    // rooms with no corridor beside them: join them to what is left of the maze by the shortest way
    for (const r of lacking) {
      const tree = new Set(); for (const e of edges.values()) { tree.add(nid(...e.a)); tree.add(nid(...e.b)); }
      if (!tree.size) tree.add(startKey);
      const goals = new Map(); for (const sd of r.sides) for (const p of sd) if (!nodeBlocked(...p)) goals.set(nid(...p), sd);
      const prev = new Map(), q = []; for (const t of tree) { prev.set(t, null); q.push(t); }
      let hit = null;
      for (let h = 0; h < q.length && hit === null; h++) {
        const k = q[h], i = k % (n + 1), j = (k / (n + 1)) | 0;
        if (goals.has(k)) { hit = k; break; }
        for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
          if (a < 0 || b < 0 || a > n || b > m || nodeBlocked(a, b) || ((cave || round) && !nodeIn(a, b))) continue;
          const kk = nid(a, b); if (prev.has(kk)) continue; prev.set(kk, k); q.push(kk);
        }
      }
      if (hit === null) continue;
      for (let k = hit; prev.get(k) !== null; k = prev.get(k)) {
        const p = prev.get(k), A = [k % (n + 1), (k / (n + 1)) | 0], Bn = [p % (n + 1), (p / (n + 1)) | 0];
        edges.set(ekey(k, p), { a: A, b: Bn, diag: false });
      }
      // the door: a side of the room that touches the node reached
      const sd = r.sides.find(([p, q]) => [nid(...p), nid(...q)].includes(hit) && !nodeBlocked(...p) && !nodeBlocked(...q));
      if (sd) { edges.set(ekey(nid(...sd[0]), nid(...sd[1])), { a: sd[0], b: sd[1], diag: false }); roomDoors.push([r, sd]); }
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
    const linkCount = new Map(); for (const e of edges.values()) for (const p of [e.a, e.b]) linkCount.set(nid(...p), (linkCount.get(nid(...p)) || 0) + 1);
    const leaf = p => linkCount.get(nid(...p)) === 1 && nid(...p) !== nid(si, sj);
    const wideLine = new Map();
    for (const e of edges.values()) {
      const [x1, y1] = N(...e.a), [x2, y2] = N(...e.b), dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
      if (e.diag) {
        const along = (x, y) => (x - x1) * dx + (y - y1) * dy, perp = (x, y) => (x - x1) * dy - (y - y1) * dx, L = along(x2, y2);
        B.paint((x, y) => Math.abs(perp(x, y)) <= 2 && along(x, y) >= 0 && along(x, y) <= L, corr, null, [Math.min(x1, x2) - 3, Math.min(y1, y2) - 3, Math.max(x1, x2) + 3, Math.max(y1, y2) + 3]);
      } else {
        // a band 2 wide; it goes past a node only where that node is not a dead end
        const ea = leaf(e.a) ? 0 : 1, eb = leaf(e.b) ? 0 : 1, first = (x1 < x2 || y1 < y2);
        const lo = [Math.min(x1, x2) - (dx ? (first ? ea : eb) : 1), Math.min(y1, y2) - (dy ? (first ? ea : eb) : 1)];
        const hi = [Math.max(x1, x2) + (dx ? (first ? eb : ea) : 1), Math.max(y1, y2) + (dy ? (first ? eb : ea) : 1)];
        // now and then a long stretch is a double corridor, 4 wide: later a wall down its middle makes it two
        // corridors side by side, one wall shared (a choice of lane at each end)
        const lk = (dx ? 'h' : 'v') + (dx ? y1 : x1); if (!wideLine.has(lk)) wideLine.set(lk, Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0); // the whole line alike
        if (!cave && wideLine.get(lk)) { const sd = wideLine.get(lk);
          if (dx) { if (sd < 0) lo[1] -= 2; else hi[1] += 2; } else { if (sd < 0) lo[0] -= 2; else hi[0] += 2; } }
        B.paint((x, y) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1], corr, null, [lo[0], lo[1], hi[0], hi[1]]);
      }
    }
    // gates: some straight corridor stretches are closed by a wall with a door across the corridor,
    // so a stretch becomes a small chamber to open on the way
    const gateSegs = [];
    for (const e of edges.values()) {
      if (true) continue; // gates removed: a door across a 2-wide corridor always touches both walls
      const [x1, y1] = N(...e.a), [x2, y2] = N(...e.b), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (y1 === y2) gateSegs.push(wk([mx, my - 1], [mx, my]), wk([mx, my], [mx, my + 1]));
      else gateSegs.push(wk([mx - 1, my], [mx, my]), wk([mx, my], [mx + 1, my]));
    }
    const isCorr = (p, q) => { const e = edges.get(ekey(nid(...p), nid(...q))); return !!e && !e.diag; };
    // corridor turns and crossings: the room corner inside the turn is bevelled (fill), the corner
    // outside the turn is cut so the corridor never shows a 90° corner
    const cuts = [];
    for (const [k, L] of nodeLinks) {
      const i = k % (n + 1), j = (k / (n + 1)) | 0, [cx, cy] = N(i, j);
      const nb = [cx - 5, cy - 5, cx + 5, cy + 5];
      if (L.length === 1 && k !== nid(si, sj)) continue; // dead end: no square cap
      B.paint((x, y) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1, corr, null, nb);
      const has = (a, b) => L.some(d => d[0] === a && d[1] === b);
      for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        if (has(sx, sy)) continue; // a diagonal corridor leaves the node this way
        // bevel in proportion to the room in that corner: 2 only when that room is 8 or more across
        // (a bevel of 2 on a room of 4–6 eats a third of its wall and it stops reading as a square)
        const ci2 = sx > 0 ? i : i - 1, cj2 = sy > 0 ? j : j - 1, rc = ci2 >= 0 && cj2 >= 0 && ci2 < n && cj2 < m ? cell[cid(ci2, cj2)] : null;
        const across = rc ? Math.min(X[rc.i + rc.w] - X[rc.i], Y[rc.j + rc.h] - Y[rc.j]) - 2 : (ci2 >= 0 && cj2 >= 0 && ci2 < n && cj2 < m ? Math.min(cw(ci2), ch(cj2)) - 2 : 0);
        const legs = 3 + (across >= 8 && Math.random() < 0.5 ? 1 : 0); // bevel 1, or 2 on big rooms
        if (has(sx, 0) && has(0, sy)) B.paint((x, y) => sx * (x - cx) >= 1 && sy * (y - cy) >= 1 && sx * (x - cx) + sy * (y - cy) <= legs, corr, [0], nb);
        else if (!has(sx, 0) && !has(0, sy) && L.length >= 2) cuts.push([nb, (x, y) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1 && sx * (x - cx) + sy * (y - cy) > 0]);
      }
    }
    for (const [bb, f] of cuts) B.paint(f, 0, [corr], bb);
    // dead ends: a corridor stretch that only leads to the doors of some rooms becomes an anteroom
    // (a room of its own, its mouth one door across the corridor); those rooms then open onto it
    const anteDoors = [];
    for (const e of edges.values()) {
      if (e.diag || leaf(e.a) === leaf(e.b) || Math.random() < 0.6) continue; // the rest stay dead ends
      const [x1, y1] = N(...(leaf(e.a) ? e.b : e.a)), [x2, y2] = N(...(leaf(e.a) ? e.a : e.b));
      const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1), L = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      if (L < 10) continue; // under 2×8 it would be smaller than a square
      const al = (x, y) => (x - x1) * dx + (y - y1) * dy, pp = (x, y) => Math.abs((x - x1) * dy - (y - y1) * dx);
      const l = B.label('room');
      B.paint((x, y) => al(x, y) > 2 && pp(x, y) <= 1, l, [corr], [Math.min(x1, x2) - 2, Math.min(y1, y2) - 2, Math.max(x1, x2) + 2, Math.max(y1, y2) + 2]);
      const mx = x1 + 2 * dx, my = y1 + 2 * dy;
      if (dx) anteDoors.push(wk([mx, my - 1], [mx, my]), wk([mx, my], [mx, my + 1])); else anteDoors.push(wk([mx - 1, my], [mx, my]), wk([mx, my], [mx + 1, my]));
    }
    // rooms fill their cells; on a side with no corridor they reach the middle of the band and share
    // the wall with the room next door (no rock left between rooms)
    const ext = (i, j, side) => { // side: 0 left, 1 right, 2 top, 3 bottom
      const [a, b] = side === 0 ? [i - 1, j] : side === 1 ? [i + 1, j] : side === 2 ? [i, j - 1] : [i, j + 1];
      if (a < 0 || b < 0 || a >= n || b >= m || !cellIn(a, b)) return false;
      const p = side === 0 ? [i, j] : side === 1 ? [i + 1, j] : side === 2 ? [i, j] : [i, j + 1];
      const q = side <= 1 ? [p[0], p[1] + 1] : [p[0] + 1, p[1]];
      return !isCorr(p, q);
    };
    const cellRect = (i, j) => { const [x0, y0] = N(i, j), x1 = X[i + 1], y1 = Y[j + 1]; return [x0 + (ext(i, j, 0) ? 0 : 1), y0 + (ext(i, j, 2) ? 0 : 1), x1 - (ext(i, j, 1) ? 0 : 1), y1 - (ext(i, j, 3) ? 0 : 1)]; };
    for (const r of rooms) {
      const l = B.label('room'); r.label = l; r.labels = [l];
      const rects = []; for (let b = r.j; b < r.j + r.h; b++) for (let a = r.i; a < r.i + r.w; a++) rects.push(cellRect(a, b));
      const inR = (x, y) => rects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
      const [x0, y0] = N(r.i, r.j), x1 = X[r.i + r.w], y1 = Y[r.j + r.h], rb = [x0 - 1, y0 - 1, x1 + 1, y1 + 1];
      if (r.kind === 'gal') {
        // hall along the long axis; little rooms on both sides, each one opening onto the hall
        B.paint(inR, l, [0], rb);
        B.kinds[l] = 'gal';
        const along = r.axis === 'x', L0 = along ? x0 + 1 : y0 + 1, L1 = along ? x1 - 1 : y1 - 1;
        const T0 = along ? y0 + 1 : x0 + 1, T1 = along ? y1 - 1 : x1 - 1, depth = (T1 - T0) > 10 ? 5 : 3;
        r.cubicles = [];
        for (const side of [0, 1]) {
          let a = L0;
          while (L1 - a >= 4) {
            const b = L1 - a < 10 ? L1 : a + rnd(5, 7);
            const c = B.label('room'), lo = side ? T1 - depth : T0 - 1, hi = side ? T1 + 1 : T0 + depth, a0 = a;
            B.paint((x, y) => { const u = along ? x : y, v = along ? y : x; return u >= a0 && u <= b && v >= lo && v <= hi; }, c, [l], rb);
            r.cubicles.push(c); r.labels.push(c); a = b;
          }
        }
      } else if (r.kind === 'dgal') {
        // u runs along the hall (corner to corner of the block), v across it; walls fall on cell diagonals.
        // The hall and its two rows of little rooms make a whole rectangle turned 45° inside the block;
        // the hall goes on to both corners (its way in), the two big triangles left are rooms
        const S = Math.min(x1 - x0, y1 - y0), ox = r.slash ? x0 + S : x0, oy = y0, dx = r.slash ? -1 : 1;
        const U = (x, y) => dx * (x - ox) + (y - oy), V = (x, y) => dx * (x - ox) - (y - oy);
        const hw = r.w >= 3 ? 3 : 2, d = r.w >= 3 ? 6 : 5, e = hw + d, L = 2 * S - 2 * e;
        const nc = Math.max(1, Math.floor(L / 8)), cuts = []; for (let t = 0; t <= nc; t++) cuts.push(e + 2 * Math.round(t * L / nc / 2));
        B.paint(inR, l, [0], rb); B.kinds[l] = 'gal'; // the hall: all that is not a little room or a corner room
        r.cubicles = [];
        for (const side of [1, -1]) {
          for (let t = 0; t < nc; t++) {
            const c = B.label('room'), a0 = cuts[t], a1 = cuts[t + 1];
            B.paint((x, y) => { const u = U(x, y), v = side * V(x, y); return inR(x, y) && v > hw && v <= e && u > a0 && u <= a1; }, c, [l], rb);
            r.cubicles.push(c); r.labels.push(c);
          }
          const t = B.label('room');
          B.paint((x, y) => inR(x, y) && side * V(x, y) > e, t, [l], rb); r.labels.push(t);
        }
      } else if (r.kind === 'rb') {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.min(x1 - x0, y1 - y0) / 2 - 1;
        B.paint(inR, corr, [0], rb); // the corners around it are corridor, so its doors go on the diagonal sides
        B.paint((x, y) => Math.abs(x - cx) <= R && Math.abs(y - cy) <= R && Math.abs(x - cx) + Math.abs(y - cy) <= R + 1, l, null, rb);
        // no ring around it: the corners of its square become little rooms around it
        const linked = (i, j) => nodeLinks.has(nid(i, j)) ? nodeLinks.get(nid(i, j)).length : 0;
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
          let k = 0;
          for (let t = 0; t * 2 <= r.w; t++) k += linked(sx < 0 ? r.i + t : r.i + r.w - t, sy < 0 ? r.j : r.j + r.h);
          for (let t = 1; t * 2 <= r.h; t++) k += linked(sx < 0 ? r.i : r.i + r.w, sy < 0 ? r.j + t : r.j + r.h - t);
          return { sx, sy, k };
        });
        // only the corner where the most corridors arrive stays corridor (the way in): no plaza around it
        const keep = [...corners].sort((a, b) => b.k - a.k)[0];
        for (const c of corners) if (c !== keep) B.paint((x, y) => inR(x, y) && c.sx * (x - cx) > 0 && c.sy * (y - cy) > 0, B.label('room'), [corr], rb);
      } else B.paint(inR, l, [0], rb);
    }
    // a cell crossed by a diagonal corridor: its leftover triangles join a room beside them
    for (const c of usedDiagCell) {
      const i = c % n, j = (c / n) | 0, [x0, y0] = N(i, j), G = cw(i);
      const owner = (a, b, side) => (a >= 0 && b >= 0 && a < n && b < m && cell[cid(a, b)] && cell[cid(a, b)].label && ext(a, b, side)) ? cell[cid(a, b)].label : 0;
      const L1 = owner(i, j - 1, 3) || owner(i + 1, j, 0), L2 = owner(i, j + 1, 2) || owner(i - 1, j, 1);
      const diagDown = edges.has(ekey(nid(i, j), nid(i + 1, j + 1))); // "\" crossing
      // upper-right / lower-left halves for "\", upper-left / lower-right for "/"
      B.paint((x, y) => x >= x0 && x <= x0 + G && y >= y0 && y <= y0 + G && (diagDown ? (x - x0) > (y - y0) : (x - x0) + (y - y0) < G), L1, [0], [x0, y0, x0 + G, y0 + G]);
      B.paint((x, y) => x >= x0 && x <= x0 + G && y >= y0 && y <= y0 + G && (diagDown ? (x - x0) < (y - y0) : (x - x0) + (y - y0) > G), L2, [0], [x0, y0, x0 + G, y0 + G]);
    }
    // diagonal galleries = the avenues: a long rectangle turned 45°, stamped whole over what is there.
    // A corridor of 2 runs down its middle (in at both ends); on each side a row of little rooms, each one
    // casilla long, its outer wall one straight diagonal through the corners of the casillas beside it
    const diagCubes = [], avenueHalls = [], avenueRombos = [];
    for (const av of avenues) {
      if (!av.every(([a, b]) => edges.has(ekey(nid(...a), nid(...b))))) continue;
      const ends = []; { const c = new Map(); for (const e of av) for (const q of e) c.set(q + '', [(c.get(q + '') || [0])[0] + 1, q]); for (const [n1, q] of c.values()) if (n1 === 1) ends.push(q); }
      const [px, py] = N(...ends[0]), [qx, qy] = N(...ends[1]), dx = Math.sign(qx - px), dy = Math.sign(qy - py), G = cw(Math.min(av[0][0][0], av[0][1][0]));
      const along = (x, y) => (x - px) * dx + (y - py) * dy, perp = (x, y) => (x - px) * dy - (y - py) * dx, Lu = along(qx, qy);
      const bb = [Math.min(px, qx) - G, Math.min(py, qy) - G, Math.max(px, qx) + G, Math.max(py, qy) + G];
      const inMap = (x, y) => { if (!round) return true; let i = 0, j = 0; while (i < n - 1 && X[i + 1] <= x) i++; while (j < m - 1 && Y[j + 1] <= y) j++; return cellIn(i, j); };
      const hall = B.label('gal'), notCorr = [...Array(B.next + 64).keys()].filter(l => l !== corr);
      B.paint((x, y) => { const u = along(x, y); return u >= 0 && u <= Lu && Math.abs(perp(x, y)) <= 2 && inMap(x, y); }, hall, null, bb);
      avenueHalls.push(hall);
      // in its middle the hall opens into a rombo: a square turned 45°, as wide as the avenue (its tips get flat later)
      const cm0 = 2 * G * Math.floor(Lu / (2 * G) / 2), cm1 = cm0 + 2 * G;
      const chamber = B.label('room'); avenueRombos.push(chamber);
      B.paint((x, y) => { const u = along(x, y); return u > cm0 && u <= cm1 && Math.abs(perp(x, y)) <= G && inMap(x, y); }, chamber, notCorr, bb);
      for (const side of [1, -1]) for (let k = 0; k * G < Lu; k++) {
        if (k * G >= cm0 && k * G < cm1) continue;
        const cu = B.label('room'), a0 = k * G, a1 = Math.min(Lu, (k + 1) * G);
        B.paint((x, y) => { const u = along(x, y), v = side * perp(x, y); return v > 2 && v <= G && u > a0 && u <= a1 && inMap(x, y); }, cu, notCorr, bb);
        diagCubes.push([cu, hall]);
      }
    }
    // paint the diagonal quarters over whatever the straight lattice left there (never over the boss hall or an avenue)
    const distRooms = [], distEdges = [];
    for (const dq of districts) {
      const { Uc, Vc, D, K } = dq, U0 = Uc - D, V0 = Vc - D, C4 = W - 1, QCq = [[.5, 1 / 6], [5 / 6, .5], [.5, 5 / 6], [1 / 6, .5]];
      const keep = new Set([...avenueHalls, ...avenueRombos, ...diagCubes.map(([c]) => c), ...rooms.filter(r => r.special).map(r => r.label)]);
      const x0 = Math.floor((U0 + V0) / 2) - 3, x1 = Math.ceil((U0 + 2 * D + V0 + 2 * D) / 2) + 3, y0 = Math.floor((U0 - V0 - 2 * D) / 2) - 3, y1 = Math.ceil((U0 + 2 * D - V0) / 2) + 3;
      const put = (f, l) => { for (let y = Math.max(0, y0); y < Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W - 1, x1); x++) for (let k = 0; k < 4; k++) {
        const i = (y * C4 + x) * 4 + k; if (keep.has(B.q[i])) continue; const px = x + QCq[k][0], py = y + QCq[k][1]; if (!inMapPt(px, py)) continue; if (f(px + py, px - py)) B.q[i] = typeof l === 'function' ? l(px + py, px - py) : l; } };
      // rooms: each turned cell a rombo, or split in two turned rectangles
      for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
        const ua = U0 + a * DP, vb = V0 + b * DP, rr = dq.loose ? (Math.random() < 0.5 ? 0 : 0.12 + 0.88 * Math.random()) : Math.random(), l1 = B.label('room'), l2 = rr < 0.12 ? l1 : B.label('room');
        const half = rr < 0.56 ? 'u' : 'v';
        put((u, v) => u > ua && u < ua + DP && v > vb && v < vb + DP, (u, v) => (half === 'u' ? u < ua + DP / 2 : v < vb + DP / 2) ? l1 : l2);
        for (const l of new Set([l1, l2])) { const r = { kind: 'diag', label: l, labels: [l] }; rooms.push(r); distRooms.push(r); }
      }
      // corridors: a winding tree over the turned lattice, with a few loops; the outer lines are open more often,
      // so a route can go round the quarter
      const nodes = (K + 1) * (K + 1), nidd = (a, b) => b * (K + 1) + a, seenD = new Set(), ed = [];
      const st = [[rnd(0, K), rnd(0, K)]]; seenD.add(nidd(...st[0]));
      while (st.length) { const k = Math.random() < 0.8 ? st.length - 1 : rnd(0, st.length - 1), [a, b] = st[k];
        const nb = [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]].filter(([p, q]) => p >= 0 && q >= 0 && p <= K && q <= K && !seenD.has(nidd(p, q)));
        if (!nb.length) { st.splice(k, 1); continue; } const [p, q] = pick(nb); seenD.add(nidd(p, q)); ed.push([a, b, p, q]); st.push([p, q]); }
      for (let a = 0; a < K; a++) for (const b of [0, K]) if (Math.random() < 0.6) ed.push([a, b, a + 1, b]);
      for (let b = 0; b < K; b++) for (const a of [0, K]) if (Math.random() < 0.6) ed.push([a, b, a, b + 1]);
      for (const [a, b, p, q] of ed) {
        const ua = U0 + Math.min(a, p) * DP, ub = U0 + Math.max(a, p) * DP, va = V0 + Math.min(b, q) * DP, vb2 = V0 + Math.max(b, q) * DP;
        distEdges.push(a === p ? { u: ua, v0: va, v1: vb2 } : { v: va, u0: ua, u1: ub });
        if (a === p) put((u, v) => Math.abs(u - ua) <= 2 && v >= va - 2 && v <= vb2 + 2, corr); else put((u, v) => Math.abs(v - va) <= 2 && u >= ua - 2 && u <= ub + 2, corr);
      }
      // a loose square in the quarter: a straight room on an inner crossing; its sides cut the tips of the four
      // turned rooms round it flat
      if (K >= 3) { const a = rnd(1, K - 1), b = rnd(1, K - 1), uN = U0 + a * DP, vN = V0 + b * DP, xs = (uN + vN) / 2, ys = (uN - vN) / 2, hs = 5, lq = B.label('room');
        put((u, v) => { const x = (u + v) / 2, y = (u - v) / 2; return Math.abs(x - xs) <= hs && Math.abs(y - ys) <= hs; }, lq);
        const r = { kind: 'sq1', label: lq, labels: [lq] }; rooms.push(r); }
    }
    // the way in: a corridor from the start node to the map edge
    { const [sx, sy] = N(si, sj), [dx, dy] = entDir;
      if (!cave) B.paint((x, y) => dy ? Math.abs(x - sx) <= 1 && (dy > 0 ? y >= sy : y <= sy) : Math.abs(y - sy) <= 1 && (dx > 0 ? x >= sx : x <= sx), corr); }
    // rock shut inside the dungeon (bits left at corners and by diagonals) joins the room beside it
    const fillRock = () => { const C4 = W - 1, R4 = H - 1, q = B.q, out = new Uint8Array(q.length), st = [];
      const nbr = i => { const c = i >> 2, k = i & 3, x = c % C4, y = (c / C4) | 0, o = [c * 4 + ((k + 1) & 3), c * 4 + ((k + 3) & 3)];
        if (k === 0) o.push(y > 0 ? ((y - 1) * C4 + x) * 4 + 2 : -1); if (k === 2) o.push(y < R4 - 1 ? ((y + 1) * C4 + x) * 4 : -1);
        if (k === 3) o.push(x > 0 ? (y * C4 + x - 1) * 4 + 1 : -1); if (k === 1) o.push(x < C4 - 1 ? (y * C4 + x + 1) * 4 + 3 : -1); return o; };
      for (let i = 0; i < q.length; i++) if (!q[i] && nbr(i).includes(-1)) { out[i] = 1; st.push(i); }
      while (st.length) for (const j of nbr(st.pop())) if (j >= 0 && !q[j] && !out[j]) { out[j] = 1; st.push(j); }
      for (let pass = 0; pass < 12; pass++) { let left = 0;
        for (let i = 0; i < q.length; i++) if (!q[i] && !out[i]) { const c = {}; for (const j of nbr(i)) if (j >= 0 && q[j] && B.kinds[q[j]] !== 'corr') c[q[j]] = (c[q[j]] || 0) + 1;
          const to = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; if (to) q[i] = +to; else left++; }
        if (!left) break; }
      // what is still shut in (a triangle between corridors) becomes a small room of its own
      for (let i = 0; i < q.length; i++) if (!q[i] && !out[i]) { const l = B.label('room'), st2 = [i]; q[i] = l; while (st2.length) for (const j of nbr(st2.pop())) if (j >= 0 && !q[j] && !out[j]) { q[j] = l; st2.push(j); } } };
    fillRock();
    B.snap(); B.pieces();
    // corridor scraps that touch nothing become rock
    for (let l = 1; l < B.next; l++) if (B.kinds[l] === 'corr' && l !== corr && B.area(l)) B.paint(() => true, 0, [l]); // closed scraps nobody can reach
    B.snap(); B.spikes();
    // ---- partitions: rooms longer than pmax get a new wall across (never leaving a part under pmin) ----
    // every room bigger than the maximum is split into little rooms to explore (never under the minimum)
    const pmin = cave ? Math.max(4, opts.pmin || 4) : rmin, pmax = cave ? opts.pmax || 1e9 : rmax + 2, splitPairs = [];
    const boxOf = l => { let a = 1e9, b = 1e9, c = -1, d = -1; const C4 = W - 1; for (let i = 0; i < B.q.length; i += 4) if (B.q[i] === l || B.q[i + 2] === l) { const cc = i >> 2, x = cc % C4, y = (cc / C4) | 0; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } return [a, b, c + 1, d + 1]; };
    if (pmax < 1e9) {
      const todo = rooms.filter(r => r.kind === 'sq' && r.label && !r.special).map(r => r.label);
      for (let guard = 0; todo.length && guard < 2000; guard++) {
        const l = todo.pop(), [a, b, c, d] = boxOf(l), w = c - a, h = d - b;
        if (Math.max(w, h) <= pmax) continue;
        const vertical = w >= h, len = vertical ? w : h; if (len < 2 * pmin) continue;
        const cut = (vertical ? a : b) + rnd(pmin, len - pmin), n2 = B.label('room');
        B.paint((x, y) => (vertical ? x : y) > cut, n2, [l], [a, b, c, d]);
        splitPairs.push([l, n2]); todo.push(l, n2);
      }
      B.snap();
    }
    // ---- clean up: nothing thinner than 2, no space smaller than 4×4 (it joins its biggest neighbour) ----
    // spaces under 4×4 join the neighbour they share most wall with
    const tidy = () => { fillRock(); B.snap(); B.pieces(); for (let pass = 0; pass < 4; pass++) {
      const sg = B.segments(), area = new Float64Array(B.next); let merged = 0;
      for (const v of B.q) area[v] += 0.25;
      for (let l = 1; l < B.next; l++) {
        const a = area[l]; if (!a || a >= 16 || B.kinds[l] === 'pillar') continue;
        const sh = new Map(); for (const g of sg) { const o = g.a === l ? g.b : g.b === l ? g.a : -1; if (o > 0) sh.set(o, (sh.get(o) || 0) + 1); }
        const best = [...sh].sort((p, q) => q[1] - p[1])[0];
        if (best) { B.paint(() => true, best[0], [l]); merged++; }
      }
      B.snap(); if (!merged) break;
    } };
    for (let round = 0; round < 4; round++) {
      B.thin(); B.snap(); B.spikes(); B.bevelCorners(); tidy();
      let fixed = 0; for (let t = 0; t < 4; t++) { const k = B.cornerFix() + B.reflexFix(l => B.kinds[l] === 'room'); fixed += k; if (!k) break; }
      if (!fixed) break;
    }
    // ---- no rooms that are nearly triangles: such a room joins the neighbouring room it shares most wall
    // with (a triangle left by a diagonal corridor, or cut by a partition, becomes part of a trapezoid) ----
    let nTri = 0;
    { const cubes = new Set(diagCubes.map(([c]) => c)), keep = new Set([...avenueRombos, ...avenueHalls, ...rooms.filter(r => r.special).map(r => r.label)]);
      const QC = [[.5, 1 / 6], [5 / 6, .5], [.5, 5 / 6], [1 / 6, .5]], C4 = W - 1;
      for (let pass = 0; pass < 1; pass++) { // one pass: a merged room must not snowball
        const st = new Map();
        for (let i = 0; i < B.q.length; i++) { const l = B.q[i]; if (!l || B.kinds[l] !== 'room') continue; const c = i >> 2, x = c % C4 + QC[i & 3][0], y = ((c / C4) | 0) + QC[i & 3][1];
          if (!st.has(l)) st.set(l, [0, 1e9, -1e9, 1e9, -1e9, 1e9, -1e9, 1e9, -1e9]); const a = st.get(l); a[0]++;
          a[1] = Math.min(a[1], x); a[2] = Math.max(a[2], x); a[3] = Math.min(a[3], y); a[4] = Math.max(a[4], y); a[5] = Math.min(a[5], x + y); a[6] = Math.max(a[6], x + y); a[7] = Math.min(a[7], x - y); a[8] = Math.max(a[8], x - y); }
        const sg = B.segments(); let merged = 0;
        for (const [l, a] of st) {
          if (keep.has(l)) continue;
          const area = a[0] / 4, fO = area / ((a[2] - a[1] + 2 / 3) * (a[4] - a[3] + 2 / 3)), fR = area / ((a[6] - a[5] + 1) * (a[8] - a[7] + 1) / 2);
          if (Math.max(fO, fR) >= 0.66 || area > 60) continue;
          const sh = new Map(); for (const g of sg) { const o = g.a === l ? g.b : g.b === l ? g.a : -1; if (o > 0 && B.kinds[o] === 'room' && !keep.has(o)) sh.set(o, (sh.get(o) || 0) + 1); }
          let best = [...sh].sort((p, q) => q[1] - p[1])[0];
          if (!best) { // no room beside it: it becomes a widening of the corridor it touches
            let c = 0; for (const g of sg) if ((g.a === l && g.b === corr) || (g.b === l && g.a === corr)) c++; if (c) best = [corr, c]; }
          if (!best) continue;
          B.paint(() => true, best[0], [l]); merged++; nTri++;
        }
        if (!merged) break;
        B.snap(); tidy(); for (let t = 0; t < 4 && B.cornerFix(); t++);
      }
    }
    // ---- columns in the boss hall: little square pillars in two rows, one each side of a middle nave,
    // never closer than 2 to a wall or to each other's gap ----
    const bossHall = rooms.find(r => r.special === 'central');
    let nPillars = 0;
    if (bossHall && bossHall.label && bossHall.kind !== 'rb') { // a rombo stays empty
      const l = bossHall.label, C4 = W - 1, whole = (x, y) => { if (x < 0 || y < 0 || x >= C4 || y >= H - 1) return false; const i = (y * C4 + x) * 4; return B.q[i] === l && B.q[i + 1] === l && B.q[i + 2] === l && B.q[i + 3] === l; };
      const [a, b, c, d] = boxOf(l), mx = (a + c) >> 1, my = (b + d) >> 1, xs = [], ys = [];
      xs.push(mx + 2, mx - 3); for (let t = 0; t < 20; t++) ys.push(my + 2 + 4 * t, my - 3 - 4 * t); // two colonnades along a nave to the throne
      for (const x of xs) for (const y of ys) {
        let ok = true; for (let v = -2; v <= 2 && ok; v++) for (let u = -2; u <= 2 && ok; u++) if (!whole(x + u, y + v)) ok = false;
        if (!ok) continue;
        const pl = B.label('pillar'), i = ((y * C4) + x) * 4; for (let k = 0; k < 4; k++) B.q[i + k] = pl; nPillars++;
      }
    }
    // ---- corridors no wider than 2: where the corridor opens wider, its middle is taken out — a room of its own when
    // there is room for one (4×4 or more: the way goes round it like a donut), leaving a ring of 2 ----
    let nIsl = 0, nDiv = 0;
    if (!cave) { const C4 = W - 1, R4 = H - 1, q = B.q, N4 = C4 * R4, dist = new Int16Array(N4);
      const full = c => { for (let k = 0; k < 4; k++) { const v = q[c * 4 + k]; if (!v || B.kinds[v] !== 'corr') return false; } return true; };
      for (let c = 0; c < N4; c++) dist[c] = full(c) ? 999 : 0;
      for (let y = 0; y < R4; y++) for (let x = 0; x < C4; x++) { const c = y * C4 + x; if (!dist[c]) continue; let d = 999; // forward pass (Chebyshev)
        if (x === 0 || y === 0 || x === C4 - 1 || y === R4 - 1) d = 1;
        else for (const [a, b] of [[-1, 0], [-1, -1], [0, -1], [1, -1]]) d = Math.min(d, dist[(y + b) * C4 + x + a] + 1); dist[c] = d; }
      for (let y = R4 - 1; y >= 0; y--) for (let x = C4 - 1; x >= 0; x--) { const c = y * C4 + x; if (!dist[c] || x === 0 || y === 0 || x === C4 - 1 || y === R4 - 1) continue;
        for (const [a, b] of [[1, 0], [1, 1], [0, 1], [-1, 1]]) dist[c] = Math.min(dist[c], dist[(y + b) * C4 + x + a] + 1); }
      const core = new Uint8Array(N4); for (let c = 0; c < N4; c++) if (dist[c] >= 3) core[c] = 1;
      // what holds a 4×4 block of core becomes a room; the rest of the core, where it holds a 2×2 block, a pillar
      const blockCover = (src, K) => { const mk = new Uint8Array(N4); for (let y = 0; y + K <= R4; y++) for (let x = 0; x + K <= C4; x++) { let ok = true;
        for (let v = 0; v < K && ok; v++) for (let u = 0; u < K && ok; u++) if (!src[(y + v) * C4 + x + u]) ok = false; if (ok) for (let v = 0; v < K; v++) for (let u = 0; u < K; u++) mk[(y + v) * C4 + x + u] = 1; } return mk; };
      const isl = blockCover(core, 4), rest = core.map((v, c) => v && !isl[c] ? 1 : 0), wall2 = blockCover(rest, 2);
      const flood = (mk, make) => { const seen = new Uint8Array(N4); for (let c0 = 0; c0 < N4; c0++) { if (!mk[c0] || seen[c0]) continue; const l = make(), st = [c0]; seen[c0] = 1;
        while (st.length) { const c = st.pop(); for (let k = 0; k < 4; k++) q[c * 4 + k] = l; const x = c % C4, y = (c / C4) | 0;
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + a, yy = y + b, cc = yy * C4 + xx; if (xx >= 0 && yy >= 0 && xx < C4 && yy < R4 && mk[cc] && !seen[cc]) { seen[cc] = 1; st.push(cc); } } } } };
      flood(isl, () => { const l = B.label('room'); rooms.push({ kind: 'isl', label: l, labels: [l] }); nIsl++; return l; });
      // where the corridor is 6 or more across but has no room for an island, a solid wall goes down its middle,
      // 2 thick and at least 8 long: the way splits in two lanes of 2 and joins again (a choice)
      { const seen = new Uint8Array(N4); for (let c0 = 0; c0 < N4; c0++) { if (!wall2[c0] || seen[c0]) continue; const comp = [c0], st = [c0]; seen[c0] = 1;
          while (st.length) { const c = st.pop(), x = c % C4, y = (c / C4) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + a, yy = y + b, cc = yy * C4 + xx; if (xx >= 0 && yy >= 0 && xx < C4 && yy < R4 && wall2[cc] && !seen[cc]) { seen[cc] = 1; st.push(cc); comp.push(cc); } } }
          const xs = comp.map(c => c % C4), ys = comp.map(c => (c / C4) | 0), len = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 1;
          if (comp.length < 20 || len < 8) continue; // (its bevelled tips still leave it over 4×4)
          const l = B.label('pillar'); for (const c of comp) for (let k = 0; k < 4; k++) q[c * 4 + k] = l; nDiv++; } }
      if (nIsl || nDiv) B.bevelCorners();
    }
    // last pass: rooms with no corner of more than 180° (after triangles and partitions moved things)
    for (let t = 0; t < 4; t++) { const k = B.reflexFix(l => B.kinds[l] === 'room') + B.cornerFix(); if (!k) break; }
    B.thin(); B.snap(); B.spikes(); tidy(); for (let t = 0; t < 2 && B.cornerFix(); t++);
    // a solid block that came out under 4×4 (bevels and clean-up shave it) joins what lies round it
    { const sg = B.segments(), area = new Float64Array(B.next); for (const v of B.q) area[v] += 0.25;
      for (let l = 1; l < B.next; l++) { if (B.kinds[l] !== 'pillar' || !area[l] || area[l] >= 16) continue;
        const sh = new Map(); for (const g of sg) { const o = g.a === l ? g.b : g.b === l ? g.a : -1; if (o > 0) sh.set(o, (sh.get(o) || 0) + 1); }
        const best = [...sh].sort((p, q) => q[1] - p[1])[0]; if (best) B.paint(() => true, best[0], [l]); } }
    // ---- 6. doors ----
    const segs = B.segments(), runs = B.runs(segs), deg = new Map();
    for (const s of segs) for (const p of parseW(s.k)) { const v = vk(...p); deg.set(v, (deg.get(v) || 0) + 1); }
    const doors = []; let entranceOK = !!cave;
    { // an anteroom's mouth is a door across the corridor: only where both corridor walls run straight past it
      const ws0 = new Set(segs.map(g => g.k));
      for (let t = 0; t < anteDoors.length; t += 2) {
        const pair = [anteDoors[t], anteDoors[t + 1]]; if (!pair.every(k => ws0.has(k))) continue;
        const pts = pair.flatMap(parseW), mid = pts.find((q, i) => pts.findIndex(o => o[0] === q[0] && o[1] === q[1]) !== i);
        const ends = pts.filter(q => !(q[0] === mid[0] && q[1] === mid[1]));
        const ok = deg.get(vk(...mid)) === 2 && ends.every(q => { const ax = q[0] === mid[0]; const a1 = ax ? [q[0] - 1, q[1]] : [q[0], q[1] - 1], a2 = ax ? [q[0] + 1, q[1]] : [q[0], q[1] + 1]; return deg.get(vk(...q)) === 3 && ws0.has(wk(q, a1)) && ws0.has(wk(q, a2)); });
        if (ok) doors.push(...pair);
      }
    }
    const opened = new Set();
    for (const r of rooms) if (r.kind === 'rb') { // rombo: a door in the middle of a diagonal side
      const run = runs.get(Math.min(r.label, corr) + ',' + Math.max(r.label, corr)); const d = run && B.safeDoor(run, deg); if (d) { doors.push(...d); opened.add(r); }
    }
    for (const [p1, p2] of splitPairs) { const run = runs.get(Math.min(p1, p2) + ',' + Math.max(p1, p2)); const d = run && B.safeDoor(run, deg); if (d) doors.push(...d); }
    for (const [r, s] of roomDoors) {
      if (r.kind === 'rb') continue;
      // the run of the room wall along that cell edge
      const [p, q] = s.map(t => N(...t)), horiz = p[1] === q[1];
      const run = segs.filter(g => (r.labels.includes(g.a) || r.labels.includes(g.b)) && (g.a === corr || g.b === corr) &&
        (horiz ? g.d === 'h' && Math.abs(g.line - p[1]) <= 1 && g.pos >= Math.min(p[0], q[0]) && g.pos < Math.max(p[0], q[0])
               : g.d === 'v' && Math.abs(g.line - p[0]) <= 1 && g.pos >= Math.min(p[1], q[1]) && g.pos < Math.max(p[1], q[1]))).sort((u, v) => u.pos - v.pos);
      const lines = [...new Set(run.map(g => g.line))];
      const best = lines.map(L => run.filter(g => g.line === L)).sort((u, v) => v.length - u.length)[0];
      const d = best && B.safeDoor(best, deg); if (d) { doors.push(...d); opened.add(r); }
    }
    // a room still without a door gets one on its longest wall with a corridor
    for (const r of rooms) if (!opened.has(r)) for (const l of r.labels) {
      const run = runs.get(Math.min(l, corr) + ',' + Math.max(l, corr)); const d = run && B.safeDoor(run, deg); if (d) { doors.push(...d); break; }
    }
    // galleries: every little room opens onto the hall
    for (const r of rooms) if (r.kind === 'gal' || r.kind === 'dgal') for (const c of r.cubicles) {
      const run = runs.get(Math.min(c, r.label) + ',' + Math.max(c, r.label)); const d = run && B.safeDoor(run, deg); if (d) doors.push(...d);
    }
    // the little rooms along diagonal corridors open onto the corridor
    for (const [c, h] of diagCubes) { const run = runs.get(Math.min(c, h) + ',' + Math.max(c, h)); const d = run && B.safeDoor(run, deg); if (d) doors.push(...d); }
    // the avenue's hall opens at its ends onto the corridors
    for (const h of avenueHalls) { const run = runs.get(Math.min(h, corr) + ',' + Math.max(h, corr)); const d = run && B.safeDoor(run, deg); if (d) doors.push(...d); }
    // the rombo in the middle of the avenue opens onto both halves of the hall
    for (const c of avenueRombos) for (const [key, run] of runs) { const [a, b] = key.split(',').map(Number); if ((a === c || b === c) && B.kinds[a === c ? b : a] === 'gal') { const d = B.safeDoor(run, deg); if (d) doors.push(...d); } }
    // partitions: some rooms open straight into the room next door (rooms in a row to cross)
    const roomLabels = new Set(rooms.flatMap(r => r.labels || []));
    let nPart = 0;
    for (const [key, run] of runs) {
      const [a, b] = key.split(',').map(Number);
      if (!roomLabels.has(a) || !roomLabels.has(b) || Math.random() > 0.2) continue;
      const d = B.safeDoor(run, deg); if (d) { doors.push(...d); nPart++; }
    }
    // gates only where the corridor really is (both sides corridor floor)
    const wallSet = new Set(segs.map(g => g.k));
    const gates = gateSegs.filter(k => !wallSet.has(k));
    if (!cave) { // the entrance: on the map's edge, on the side the way in comes from
      const [dx, dy] = entDir, edgeLine = dy > 0 ? H - 1 : dx > 0 ? W - 1 : 0, dd = dy ? 'h' : 'v';
      const out = segs.filter(g => g.d === dd && g.line === edgeLine && (g.a === corr || g.b === corr)).sort((u, v) => u.pos - v.pos);
      if (out.length) { doors.push(...out.map(g => g.k)); entranceOK = true; }
    }
    // any space nobody can reach yet gets a door to a reached neighbour (repeat until all are in)
    let segs2 = segs, merges = 0, nIslSolid = 0, nSolid = 0; const islL = new Set(rooms.filter(r => r.kind === 'isl').map(r => r.label));
    for (let pass = 0; pass < 12; pass++) {
      const segs = segs2;
      const allD = new Set([...doors, ...gates]), adjL = new Map();
      for (const g of segs) if (allD.has(g.k)) for (const [u, v] of [[g.a, g.b], [g.b, g.a]]) { if (!adjL.has(u)) adjL.set(u, []); adjL.get(u).push(v); }
      const reached = new Set([corr]), qq = [corr]; while (qq.length) for (const v of adjL.get(qq.pop()) || []) if (v && !reached.has(v)) { reached.add(v); qq.push(v); } // 0 = rock/outside never counts
      let added = 0; const pend = [], bossL = rooms.find(r => r.special === 'central')?.label;
      const present = new Uint8Array(B.next); for (const v of B.q) present[v] = 1;
      for (let l = 1; l < B.next; l++) {
        if (reached.has(l) || !present[l] || B.kinds[l] === 'pillar') continue;
        // every straight stretch of wall with a reached neighbour, longest first; a door that touches no wall wins
        const cand = segs.filter(g => (g.a === l && reached.has(g.b)) || (g.b === l && reached.has(g.a)));
        const groups = new Map(); for (const g of cand) { const k = g.d + ':' + g.line + ':' + Math.min(g.a, g.b) + ',' + Math.max(g.a, g.b); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
        const runsL = []; for (const G of groups.values()) { G.sort((p, q) => p.pos - q.pos); let r = [G[0]]; for (let i = 1; i <= G.length; i++) { if (i < G.length && G[i].pos === G[i - 1].pos + 1) { r.push(G[i]); continue; } runsL.push(r); if (i < G.length) r = [G[i]]; } }
        runsL.sort((p, q) => q.length - p.length);
        let d = null; for (const r of runsL) { d = B.safeDoor(r, deg); if (d) break; }
        if (d) { doors.push(...d); added++; }
        else if (runsL.length) pend.push([l, runsL[0][0]]);
      }
      // no door fits without touching a wall: the space joins its reached neighbour — only once no other door could be
      // placed this pass (a neighbour reached later may still give it a proper door; the boss hall is never merged)
      if (!added) for (const [l, g] of pend) { if (bossL === l) continue;
        if (islL.has(l) && B.area(l) >= 16) { B.paint(() => true, B.label('pillar'), [l]); islL.delete(l); nIslSolid++; added++; merges++; continue; } // an island with no room for a door stays a solid block: the hole is kept
        const to = g.a === l ? g.b : g.a;
        if (B.kinds[to] === 'corr' && B.area(l) >= 16) { B.paint(() => true, B.label('pillar'), [l]); nSolid++; added++; merges++; continue; } // not a wider corridor: a solid block
        B.paint(() => true, to, [l]); added++; merges++; }
      if (!added) break;
      if (merges) { merges = 0; for (let t = 0; t < 4 && B.cornerFix(); t++); tidy(); segs2 = B.segments(); const ws = new Set(segs2.map(g => g.k)); for (let i = doors.length - 1; i >= 0; i--) if (!ws.has(doors[i])) doors.splice(i, 1);
        deg.clear(); for (const s of segs2) for (const p of parseW(s.k)) { const v = vk(...p); deg.set(v, (deg.get(v) || 0) + 1); } }
    }
    // what still has no way in (only rock or other shut spaces around it) is given back to the rock
    { const allD = new Set(doors), adjL = new Map();
      for (const g of segs2) if (allD.has(g.k)) for (const [u, v] of [[g.a, g.b], [g.b, g.a]]) { if (!adjL.has(u)) adjL.set(u, []); adjL.get(u).push(v); }
      const reached = new Set([corr]), qq = [corr]; while (qq.length) for (const v of adjL.get(qq.pop()) || []) if (v && !reached.has(v)) { reached.add(v); qq.push(v); }
      const present = new Uint8Array(B.next); for (const v of B.q) present[v] = 1; let cut = 0;
      for (let l = 1; l < B.next; l++) if (present[l] && !reached.has(l) && B.kinds[l] !== 'pillar') { B.paint(() => true, 0, [l]); cut++; }
      if (cut) { segs2 = B.segments(); const ws = new Set(segs2.map(g => g.k)); for (let i = doors.length - 1; i >= 0; i--) if (!ws.has(doors[i])) doors.splice(i, 1);
        deg.clear(); for (const s2 of segs2) for (const q of parseW(s2.k)) { const v = vk(...q); deg.set(v, (deg.get(v) || 0) + 1); } } }
    const segsF = segs2;
    // ---- compuertas: beside a room's door, the corridor is closed by a gate (a wall of 2 across it,
    // all door), so at that door one chooses: go into the room, or open the gate and go on ----
    const halfWalls = [], divCols = []; let nThrough = 0, maxPiece = 0, nGateAll = 0, nDivWall = 0, nDivSegs = 0;
    if (!cave && opts.gates !== false) {
      const wallSet = new Set(segsF.map(g => g.k)), doorSet = new Set(doors), isCorrQ = (x, y) => B.Q(x, y, 0) === corr && B.Q(x, y, 2) === corr && B.Q(x, y, 1) === corr && B.Q(x, y, 3) === corr;
      const plain = k => wallSet.has(k) && !doorSet.has(k), degF = new Map();
      for (const g of segsF) for (const q of parseW(g.k)) degF.set(q + '', (degF.get(q + '') || 0) + 1);
      const placed = []; // {segs, c: centre, ends, half}
      let minGap = 5; const spaced = (x, y) => placed.every(pl => Math.hypot(pl.c[0] - x, pl.c[1] - y) >= minGap);
      const straightAt = (q, d) => degF.get(q + '') === 2 && plain(wk([q[0] - d[0], q[1] - d[1]], q)) && plain(wk(q, [q[0] + d[0], q[1] + d[1]]));
      // a gate across a straight corridor: (h) the corridor runs along x; L = the wall line on one side, sd = towards the other wall
      const tryOrtho = (h, L, gu, sd) => {
        const P = (u, v) => h ? [u, v] : [v, u], dir = h ? [1, 0] : [0, 1];
        const e1 = P(gu, L), e2 = P(gu, L + 2 * sd), c = P(gu, L + sd);
        if (degF.has(c + '')) return null;
        // where a room's wall meets the corridor wall, the partition carries that wall on across the
        // corridor as a narrow pass: half wall on that side, the door of 1 on the clean side
        const wallOk = q => plain(wk([q[0] - dir[0], q[1] - dir[1]], q)) && plain(wk(q, [q[0] + dir[0], q[1] + dir[1]]));
        const s1 = straightAt(e1, dir), s2 = straightAt(e2, dir);
        let forced; if (s1 && s2) forced = undefined; else if (s1 && wallOk(e2)) forced = 0; else if (s2 && wallOk(e1)) forced = 1; else return null;
        for (const u of [gu - 1, gu]) for (const v of sd > 0 ? [L, L + 1] : [L - 1, L - 2]) { const [x, y] = P(u, v); if (!isCorrQ(x, y)) return null; }
        if (!spaced(...c)) return null;
        return { segs: [wk(e1, c), wk(c, e2)], c, ends: [e1, e2], ortho: true, forced };
      };
      // a wider gate (3 or 4 across, all door) where the corridor is that wide: both walls run straight past it
      const tryOrthoW = (h, L, gu, sd, w) => {
        if (w === 2) return tryOrtho(h, L, gu, sd);
        const P = (u, v) => h ? [u, v] : [v, u], dir = h ? [1, 0] : [0, 1], pts = []; for (let i = 0; i <= w; i++) pts.push(P(gu, L + i * sd));
        if (pts.slice(1, -1).some(q => degF.has(q + ''))) return null;
        if (!straightAt(pts[0], dir) || !straightAt(pts[w], dir)) return null;
        for (const u of [gu - 1, gu]) for (let i = 0; i < w; i++) { const v = sd > 0 ? L + i : L - 1 - i, [x, y] = P(u, v); if (!isCorrQ(x, y)) return null; }
        const c = pts[w >> 1]; if (!spaced(...c)) return null;
        return { segs: pts.slice(1).map((q, i) => wk(pts[i], q)), c, ends: [pts[0], pts[w]], ortho: false };
      };
      // a gate across a diagonal corridor, at the centre point c of a casilla it crosses (direction d)
      const tryDiag = (c, d) => {
        const p = [d[1], -d[0]], e1 = [c[0] - p[0], c[1] - p[1]], e2 = [c[0] + p[0], c[1] + p[1]];
        // the corridor walls must run straight past both ends (a room's door there is fine: door beside a gate)
        const along = q => degF.get(q + '') === 2 && plain(wk([q[0] - d[0], q[1] - d[1]], q)) && plain(wk(q, [q[0] + d[0], q[1] + d[1]])); // never at a door's edge: a door stays between two columns
        if (!along(e1) || !along(e2) || degF.has(c + '')) return null;
        for (const [x, y] of [[c[0] - 1, c[1] - 1], [c[0], c[1] - 1], [c[0] - 1, c[1]], [c[0], c[1]]]) if (!isCorrQ(x, y)) return null;
        if (!spaced(...c)) return null;
        return { segs: [wk(e1, c), wk(c, e2)], c, ends: [e1, e2], ortho: false };
      };
      const put = g => { if (!g) return false; g.half = g.forced !== undefined ? g.forced : g.ortho && Math.random() < 0.35 ? (Math.random() < 0.5 ? 0 : 1) : -1; placed.push(g); return true; };
      // 0) two corridors with one wall between them: where a straight corridor runs 4–6 wide for 10 squares or more,
      //    a thin wall goes down its middle, and each lane gets a gate one square in from each end of that wall:
      //    at each end one chooses a lane (the gates elsewhere then cut the lanes like any corridor)
      const dividers = [], dvC = W - 1, dvR = H - 1;
      for (const h of [true, false]) {
        const P = (u, v) => h ? [u, v] : [v, u], dir = h ? [1, 0] : [0, 1], U = h ? dvC : dvR, V = h ? dvR : dvC;
        const cc = (u, v) => { if (u < 0 || v < 0 || u >= U || v >= V) return false; const [x, y] = h ? [u, v] : [v, u]; return isCorrQ(x, y); };
        const used = new Set();
        for (let v = 2; v < V - 1; v++) {
          const ok = u => { let up = 0, dn = 0; while (up < 7 && cc(u, v - 1 - up)) up++; while (dn < 7 && cc(u, v + dn)) dn++; return up >= 2 && dn >= 2 && up + dn <= 6 && Math.abs(up - dn) <= 1 ? [up, dn] : null; };
          for (let u = 0; u < U; u++) {
            const w0 = ok(u); if (!w0 || used.has(u + ',' + v)) continue;
            let u1 = u; while (u1 + 1 < U && (() => { const w1 = ok(u1 + 1); return w1 && w1[0] === w0[0] && w1[1] === w0[1]; })()) u1++;
            const a = u + 1, b = u1, [up, dn] = w0; // the wall runs from vertex a to vertex b
            if (b - a < 10) { u = u1; continue; }
            let clear = true; for (let t = a; t <= b && clear; t++) if (degF.has(P(t, v) + '')) clear = false;
            // a lane gate at vertex t: from the middle wall out to the corridor wall, square to a straight plain wall there
            const lane = (t, sd) => { const n2 = sd < 0 ? up : dn, e = P(t, v + sd * n2); if (!straightAt(e, dir)) return null; const pts = []; for (let i = 0; i <= n2; i++) pts.push(P(t, v + sd * i));
              if (pts.slice(1, -1).some(q => degF.has(q + ''))) return null; return { segs: pts.slice(1).map((q, i) => wk(pts[i], q)), c: pts[n2 >> 1], ends: [pts[0], pts[n2]], ortho: false, half: -1 }; };
            const find2 = (t0, step, sd) => { for (let k = 0; k < 3; k++) { const g = lane(t0 + step * k, sd); if (g) return g; } return null; };
            // (the two lanes' gates never meet at the same point of the middle wall: one square apart)
            const lanes = [-1, 1].map(sd => [find2(a + (sd < 0 ? 1 : 2), 2, sd), find2(b - (sd < 0 ? 1 : 2), -2, sd)]).filter(([g1, g2]) => g1 && g2);
            if (!clear) { u = u1; continue; }
            const segs = []; for (let t = a; t < b; t++) segs.push(wk(P(t, v), P(t + 1, v)));
            dividers.push({ segs, lanes });
            for (const k of segs) { wallSet.add(k); for (const q of parseW(k)) degF.set(q + '', (degF.get(q + '') || 0) + 1); }
            for (const [g1, g2] of lanes) placed.push(g1, g2);
            for (let t = u; t <= u1; t++) for (let dv = -3; dv <= 3; dv++) used.add(t + ',' + (v + dv));
            u = u1;
          }
        }
      }
      // 1) beside the doors of the rooms (one side, sometimes both)
      const byLine = new Map();
      for (const k of doors) { const [[x1, y1], [x2, y2]] = parseW(k); if (x1 !== x2 && y1 !== y2) continue; const h = y1 === y2, key = (h ? 'h' : 'v') + (h ? y1 : x1), pos = h ? Math.min(x1, x2) : Math.min(y1, y2); if (!byLine.has(key)) byLine.set(key, []); byLine.get(key).push(pos); }
      const doorRuns = [];
      for (const [key, list] of byLine) { const h = key[0] === 'h', L = +key.slice(1); list.sort((a, b) => a - b); for (let t = 0; t < list.length;) { let e = t; while (e + 1 < list.length && list[e + 1] === list[e] + 1) e++; doorRuns.push([h, L, list[t], list[e] + 1]); t = e + 1; } }
      for (const [h, L, a, b] of doorRuns.sort(() => Math.random() - 0.5)) {
        if (Math.random() < 0.05) continue;
        // the gate goes at the column that ends the door's wall (where a room wall meets the corridor wall): it carries
        // that wall on across the corridor, and the door stays in the middle of its wall between two columns
        const pt = v => h ? [v, L] : [L, v], dir = h ? [1, 0] : [0, 1];
        let cl = a - 1; while (cl > a - 30 && straightAt(pt(cl), dir)) cl--;
        let cr = b + 2; while (cr < b + 30 && straightAt(pt(cr), dir)) cr++;
        const sides = Math.random() < 0.25 ? [cl, cr] : [Math.random() < 0.5 ? cl : cr];
        for (const sd of [1, -1]) { const got = sides.map(gu => put(tryOrtho(h, L, gu, sd))); if (got.some(Boolean)) break; }
      }
      // 2) along the stretches, at the mouths of crossings, and just past every L turn (seen from the stretch
      //    before the turn, that gate looks like a door into a room: it is the way on)
      const links = new Map(); for (const e of edges.values()) for (const q of [e.a, e.b]) { const k = q + ''; if (!links.has(k)) links.set(k, []); links.get(k).push(e); }
      const isL = q => { const L = links.get(q + '') || []; if (L.length !== 2 || L.some(e => e.diag)) return false; const d = L.map(e => { const o = e.a + '' === q + '' ? e.b : e.a; return [o[0] - q[0], o[1] - q[1]]; }); return d[0][0] * d[1][0] + d[0][1] * d[1][1] === 0; };
      const orthoAt = []; // every place a gate could go on a straight edge, every 2 squares
      for (const e of edges.values()) {
        if (e.diag) continue;
        const [x1, y1] = N(...e.a), [x2, y2] = N(...e.b), h = y1 === y2, Lh = Math.abs(x2 - x1) + Math.abs(y2 - y1), s0 = h ? Math.min(x1, x2) : Math.min(y1, y2), fixed = h ? y1 : x1;
        const first = (h ? x1 < x2 : y1 < y2) ? e.a : e.b, last = first === e.a ? e.b : e.a;
        for (let d = 2; d <= Lh - 2; d++) orthoAt.push([h, fixed - 1, s0 + d]);
        if (Lh < 6) continue;
        const want = (Lh >= 16 ? [1 / 4, 1 / 2, 3 / 4] : Lh >= 11 ? [1 / 3, 2 / 3] : [1 / 2]).map(t => [Math.round(t * Lh), 0.88]);
        for (const [q, d] of [[first, 3], [last, Lh - 3]]) { const nL = (links.get(q + '') || []).length; if (nL >= 3) want.push([d, 0.88]); else if (isL(q)) want.push([d, 0.75]); }
        for (const [d, pr] of want) if (Math.random() < pr) put(tryOrtho(h, fixed - 1, s0 + d, 1));
      }
      const diagAt = []; for (const e of edges.values()) if (e.diag && corr) { const [x1, y1] = N(...e.a), [x2, y2] = N(...e.b); diagAt.push([[(x1 + x2) / 2, (y1 + y2) / 2], [Math.sign(x2 - x1), Math.sign(y2 - y1)]]); }
      // the corridors of the diagonal quarters get gates too: at the middle of each stretch, and as candidates
      // all along it for the longest-stretch cutting below
      for (const e of distEdges) {
        const pts = []; if (e.u !== undefined) { for (let v = e.v0 + 3; v <= e.v1 - 3; v++) if ((e.u + v) % 2 === 0) pts.push([[(e.u + v) / 2, (e.u - v) / 2], [1, -1]]); }
        else { for (let u = e.u0 + 3; u <= e.u1 - 3; u++) if ((u + e.v) % 2 === 0) pts.push([[(u + e.v) / 2, (u - e.v) / 2], [1, 1]]); }
        diagAt.push(...pts);
        // near the middle, but not where a room wall meets the corridor wall (try outwards from the middle)
        if (Math.random() < 0.9) { const h = pts.length >> 1, order = pts.map((_, i) => i).sort((a, b) => Math.abs(a - h) - Math.abs(b - h)); for (const i of order) if (put(tryDiag(...pts[i]))) break; }
      }
      for (const [c, d] of diagAt) if (Math.random() < 0.5 && Number.isInteger(c[0]) && Number.isInteger(c[1])) put(tryDiag(c, d));
      // 3) no stretch of corridor longer than 40 squares: the longest is cut again and again
      const C4 = W - 1, R4 = H - 1, Qi = (x, y, k) => (y * C4 + x) * 4 + k;
      const pieces = () => {
        const blk = new Set([...placed.flatMap(g => g.segs), ...dividers.flatMap(d => d.segs)]), par = new Map(), find = i => { while (par.get(i) !== i) { par.set(i, par.get(par.get(i))); i = par.get(i); } return i; };
        const join = (a, b) => { if (!par.has(a) || !par.has(b)) return; a = find(a); b = find(b); if (a !== b) par.set(a, b); };
        for (let i = 0; i < B.q.length; i++) if (B.q[i] === corr) par.set(i, i);
        for (let y = 0; y < R4; y++) for (let x = 0; x < C4; x++) {
          const d1 = blk.has(wk([x, y], [x + 1, y + 1])), d2 = blk.has(wk([x + 1, y], [x, y + 1]));
          if (!d2) { join(Qi(x, y, 0), Qi(x, y, 1)); join(Qi(x, y, 2), Qi(x, y, 3)); }
          if (!d1) { join(Qi(x, y, 0), Qi(x, y, 3)); join(Qi(x, y, 1), Qi(x, y, 2)); }
          if (x + 1 < C4 && !blk.has(wk([x + 1, y], [x + 1, y + 1]))) join(Qi(x, y, 1), Qi(x + 1, y, 3));
          if (y + 1 < R4 && !blk.has(wk([x, y + 1], [x + 1, y + 1]))) join(Qi(x, y, 2), Qi(x, y + 1, 0));
        }
        const size = new Map(); for (const i of par.keys()) { const r = find(i); size.set(r, (size.get(r) || 0) + 1); }
        return { find, size, has: i => par.has(i) };
      };
      const sq = q => q / 8; // quarters → squares of corridor length (2 wide)
      // besides the lattice places, any point along a real corridor wall (the corridor as finally drawn): straight
      // walls give a gate across from that wall, diagonal walls a gate across the diagonal corridor
      const wallCand = [];
      for (const g of segsF) { if (doorSet.has(g.k)) continue; const cs = g.a === corr ? -1 : g.b === corr ? 1 : 0; if (!cs) continue;
        if (g.d === 'h') for (const x of [g.pos, g.pos + 1]) wallCand.push(['o', [true, g.line, x, cs], [x, g.line + cs]]);
        else if (g.d === 'v') for (const y of [g.pos, g.pos + 1]) wallCand.push(['o', [false, g.line, y, cs], [g.line + cs, y]]);
        else { const x = g.pos, y = g.d === 'd1' ? x - g.line : g.line - x, d = g.d === 'd1' ? [1, 1] : [1, -1], pp = [d[1], -d[0]], sgn = g.d === 'd1' ? -cs : -cs;
          for (const q of g.d === 'd1' ? [[x, y], [x + 1, y + 1]] : [[x + 1, y], [x, y + 1]]) wallCand.push(['d', [[q[0] + sgn * pp[0], q[1] + sgn * pp[1]], d], [q[0] + sgn * pp[0], q[1] + sgn * pp[1]], q, [sgn * pp[0], sgn * pp[1]]]); } }
      // a wider gate across a diagonal corridor (3 or 4 steps), from wall point q across in steps st
      const tryDiagW = (q, st, d, w) => {
        const pts = []; for (let i = 0; i <= w; i++) pts.push([q[0] + i * st[0], q[1] + i * st[1]]);
        const along = r => degF.get(r + '') === 2 && plain(wk([r[0] - d[0], r[1] - d[1]], r)) && plain(wk(r, [r[0] + d[0], r[1] + d[1]]));
        if (!along(pts[0]) || !along(pts[w])) return null;
        for (const r of pts.slice(1, -1)) { if (degF.has(r + '')) return null; for (const [x, y] of [[r[0] - 1, r[1] - 1], [r[0], r[1] - 1], [r[0] - 1, r[1]], [r[0], r[1]]]) if (!isCorrQ(x, y)) return null; }
        const c = pts[w >> 1]; if (!spaced(...c)) return null;
        return { segs: pts.slice(1).map((r, i) => wk(pts[i], r)), c, ends: [pts[0], pts[w]], ortho: false };
      };
      // the most general gate: a straight line (across, or diagonal) of 2–4 steps from one wall point to another,
      // crossing only corridor, its ends on a plain stretch of wall (not where walls meet)
      const wallPts = [...new Set(segsF.filter(g => (g.a === corr || g.b === corr) && !doorSet.has(g.k)).flatMap(g => parseW(g.k).map(q => q + '')))].map(t => t.split(',').map(Number));
      const cellsOfSeg = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]); return dx && dy ? [[x, y]] : dx ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]; };
      const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      const wdMemo = new Map(), wallDirs = q => { const key = q[0] + ',' + q[1]; let out = wdMemo.get(key); if (!out) { out = []; for (const st of STEPS) if (wallSet.has(wk(q, [q[0] + st[0], q[1] + st[1]]))) out.push(st); wdMemo.set(key, out); } return out; };
      // the wall runs straight through q, square to the gate (no corner at the door's end: no sharp tip, no door against a wall)
      // (a wall coming from behind, away from the corridor, is fine: the gate carries it on across)
      const squareEnd = (q, st) => { const ds = wallDirs(q).filter(d => !(d[0] === -st[0] && d[1] === -st[1])); return ds.length === 2 && ds[0][0] === -ds[1][0] && ds[0][1] === -ds[1][1] && ds[0][0] * st[0] + ds[0][1] * st[1] === 0 && ds.every(d => plain(wk(q, [q[0] + d[0], q[1] + d[1]]))); };
      // steps: the gate's path; across a diagonal corridor of odd width it takes one straight step in the middle
      const tryPath = (e1, steps) => {
        const w = steps.length, pts = [e1]; for (const st of steps) { const r = pts[pts.length - 1]; pts.push([r[0] + st[0], r[1] + st[1]]); }
        const st = steps[0], st2 = steps[w - 1];
        if (!squareEnd(pts[0], st) || !squareEnd(pts[w], [-st2[0], -st2[1]])) return null;
        for (const r of pts.slice(1, -1)) if (degF.has(r + '')) return null;
        for (let i = 0; i < w; i++) for (const [x, y] of cellsOfSeg(pts[i], pts[i + 1])) if (!isCorrQ(x, y)) return null;
        const segs = pts.slice(1).map((r, i) => wk(pts[i], r)); if (segs.some(k => wallSet.has(k))) return null;
        const c = pts[w >> 1]; if (!spaced(...c)) return null;
        return { segs, c, ends: [pts[0], pts[w]], ortho: false };
      };
      const nearBig = (inBig, [cx, cy]) => inBig(cx, cy) || inBig(cx - 1, cy) || inBig(cx, cy - 1) || inBig(cx - 1, cy - 1);
      minGap = 4;
      // each round, one more gate in every stretch still too long (they are apart, so they do not get in each other's way)
      // how well a gate cuts its stretch: the smaller of the two parts it leaves (0 if the way still goes round it,
      // or if a part would be under 4×4)
      const splitScore = (g, pcSize) => {
        const blk = new Set([...placed.flatMap(p => p.segs), ...dividers.flatMap(d => d.segs), ...g.segs]);
        const sideQ = k => { const [[x1, y1], [x2, y2]] = parseW(k), x = Math.min(x1, x2), y = Math.min(y1, y2);
          if (y1 === y2) return [Qi(x, y - 1, 2), Qi(x, y, 0)]; if (x1 === x2) return [Qi(x - 1, y, 1), Qi(x, y, 3)];
          return (x2 - x1) * (y2 - y1) > 0 ? [Qi(x, y, 0), Qi(x, y, 2)] : [Qi(x, y, 0), Qi(x, y, 1)]; };
        const [sa, sb] = sideQ(g.segs[0]); if (B.q[sa] !== corr || B.q[sb] !== corr) return 0;
        const seen = new Set([sa]), st = [sa]; let n = 0;
        while (st.length) { const i = st.pop(); n++; if (i === sb) return 0; const c = i >> 2, k = i & 3, x = c % C4, y = (c / C4) | 0, nb = [];
          const d1 = blk.has(wk([x, y], [x + 1, y + 1])), d2 = blk.has(wk([x + 1, y], [x, y + 1]));
          if (k === 0) { if (!d2) nb.push(c * 4 + 1); if (!d1) nb.push(c * 4 + 3); if (y > 0 && !blk.has(wk([x, y], [x + 1, y]))) nb.push(Qi(x, y - 1, 2)); }
          if (k === 1) { if (!d2) nb.push(c * 4); if (!d1) nb.push(c * 4 + 2); if (x < C4 - 1 && !blk.has(wk([x + 1, y], [x + 1, y + 1]))) nb.push(Qi(x + 1, y, 3)); }
          if (k === 2) { if (!d2) nb.push(c * 4 + 3); if (!d1) nb.push(c * 4 + 1); if (y < R4 - 1 && !blk.has(wk([x, y + 1], [x + 1, y + 1]))) nb.push(Qi(x, y + 1, 0)); }
          if (k === 3) { if (!d2) nb.push(c * 4 + 2); if (!d1) nb.push(c * 4); if (x > 0 && !blk.has(wk([x, y], [x, y + 1]))) nb.push(Qi(x - 1, y, 1)); }
          for (const j of nb) if (!seen.has(j) && B.q[j] === corr) { seen.add(j); st.push(j); } }
        const small = Math.min(n, pcSize - n); return small >= 64 ? small : 0; };
      // each round, in every stretch still too long, a few possible gates are weighed and the one that best cuts it goes in
      const tryIn = (pc, big) => {
          const inBig = (x, y) => pc.has(Qi(x, y, 0)) && pc.find(Qi(x, y, 0)) === big, cands = [], MAX = 8;
          const add = g => { if (g && cands.length < MAX && !cands.some(o => o.segs.some(k => g.segs.includes(k)))) cands.push(g); return cands.length >= MAX; };
          const opts = [...orthoAt.map(o => ['o', o]), ...diagAt.map(o => ['d', o])].filter(([t, o]) => t === 'o' ? (o[0] ? inBig(o[2], o[1]) : inBig(o[1], o[2])) : inBig(o[0][0], o[0][1])).sort(() => Math.random() - 0.5);
          for (const [t, o] of opts) if (add(t === 'o' ? tryOrtho(o[0], o[1], o[2], 1) : tryDiag(o[0], o[1]))) break;
          if (cands.length < MAX) { const wc = wallCand.filter(w => nearBig(inBig, w[2])).sort(() => Math.random() - 0.5);
            out: for (const w of [2, 3, 4]) for (const [t, o, , q, st] of wc) if (add(t === 'o' ? tryOrthoW(o[0], o[1], o[2], o[3], w) : w === 2 ? tryDiag(o[0], o[1]) : tryDiagW(q, st, o[1], w))) break out; }
          if (cands.length < MAX) { const wp = wallPts.filter(q => nearBig(inBig, q)).sort(() => Math.random() - 0.5);
            const paths = st => { const out = []; for (const w of [2, 3, 4, 5]) out.push(Array(w).fill(st));
              if (st[0] && st[1]) for (const w of [1, 2, 3]) for (const o of [[st[0], 0], [0, st[1]]]) { const a = Array(w).fill(st); a.splice(w >> 1, 0, o); out.push(a); }
              return out.sort((a, b) => a.length - b.length); };
            out2: for (const q of wp) for (const st of STEPS) for (const path of paths(st)) if (add(tryPath(q, path))) break out2; }
          if (!cands.length) return false;
          const size = pc.size.get(big); let best = cands[0], bs = -1; for (const g of cands) { const sc = splitScore(g, size); if (sc > bs) { bs = sc; best = g; } }
          return put(best);
      };
      for (let guard = 0; guard < 60; guard++) {
        const pc = pieces(), bigs = [...pc.size].filter(([, z]) => sq(z) > 40).sort((p, q) => q[1] - p[1]);
        maxPiece = sq(Math.max(0, ...pc.size.values())); if (!bigs.length) break;
        let any = false; for (const [big] of bigs.slice(0, 8)) if (tryIn(pc, big)) any = true;
        if (!any) break;
      }
      // 4) a gate that leaves a bit of corridor smaller than 4×4 is taken away again
      const gk = () => placed.flatMap(g => g.half < 0 ? g.segs : [g.segs[g.half]]), hk = () => placed.flatMap(g => g.half < 0 ? [] : [g.segs[1 - g.half]]);
      for (let pass = 0; pass < 12 && placed.length; pass++) {
        const r = checkRules(W, H, new Set([...segsF.map(g => g.k), ...gk(), ...hk(), ...dividers.flatMap(d => d.segs)]), new Set([...doors, ...gk()]), new Set(dividers.flatMap(d => [parseW(d.segs[0])[0] + '', parseW(d.segs[d.segs.length - 1])[1] + ''])));
        // a gate that breaks the rules itself (a door against another wall, a sharp tip at its end) goes
        const badK = new Set(r.badDoors), sharpP = new Set(r.sharp.map(([x, y]) => x + ',' + y)); let gone = 0;
        for (let i = placed.length - 1; i >= 0; i--) if (placed[i].segs.some(k => badK.has(k)) || placed[i].segs.some(k => parseW(k).some(q => sharpP.has(q + '')))) { placed.splice(i, 1); gone++; }
        if (gone) continue;
        const tiny = new Set(r.tiny.map(([x, y]) => x + ',' + y)); if (!tiny.size) break;
        // one gate per tiny bit is enough to undo it (the gates round it that are not needed stay)
        const explained = new Set();
        for (let i = placed.length - 1; i >= 0; i--) { const [p1, p2] = placed[i].ends, hits = [];
          for (let x = Math.min(p1[0], p2[0]) - 1; x <= Math.max(p1[0], p2[0]); x++) for (let y = Math.min(p1[1], p2[1]) - 1; y <= Math.max(p1[1], p2[1]); y++) if (tiny.has(x + ',' + y)) hits.push(x + ',' + y);
          if (!hits.length || hits.every(h => explained.has(h))) continue;
          const bit = new Set(hits), st = [...hits]; while (st.length) { const [x, y] = st.pop().split(',').map(Number); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + a) + ',' + (y + b); if (tiny.has(k) && !bit.has(k)) { bit.add(k); st.push(k); } } }
          for (const k of bit) explained.add(k); placed.splice(i, 1); }
      }
      // the middle wall stands free between two columns (its tips): the two lanes part there and meet again.
      // Its lane gates are a choice, not needed: one that went (a rule broken) leaves the rest
      for (const d of dividers) d.keep = true;
      gates.push(...gk()); halfWalls.push(...hk()); nGateAll = placed.length;
      nDivWall = dividers.filter(d => d.keep).length; const dvSegs = dividers.filter(d => d.keep).flatMap(d => d.segs); halfWalls.push(...dvSegs); nDivSegs = dvSegs.length;
      for (const d of dividers) if (d.keep) { const pts = d.segs.flatMap(parseW); const cnt = new Map(); for (const q of pts) cnt.set(q + '', (cnt.get(q + '') || 0) + 1); for (const [k, c] of cnt) if (c === 1) divCols.push(k); }
      // 5) disguised ways through: a room touching two different stretches of corridor gets a door to each,
      //    so what looks like one more room is in fact the way on
      { const pc = pieces(), degA = new Map(degF); for (const k of [...gates, ...halfWalls]) for (const q of parseW(k)) degA.set(q + '', (degA.get(q + '') || 0) + 1);
        const plainRoom = new Set(rooms.filter(r => r.kind === 'sq' && !r.special).flatMap(r => r.labels || []));
        const byRoom = new Map(); // room label → piece → segments
        for (const g of segsF) { if (doorSet.has(g.k) || g.d === 'd1' || g.d === 'd2') continue; const rl = plainRoom.has(g.a) && g.b === corr ? g.a : plainRoom.has(g.b) && g.a === corr ? g.b : 0; if (!rl) continue;
          const [[x1, y1]] = parseW(g.k), ci = g.d === 'h' ? (g.a === corr ? Qi(g.pos, g.line - 1, 2) : Qi(g.pos, g.line, 0)) : (g.a === corr ? Qi(g.line - 1, g.pos, 1) : Qi(g.line, g.pos, 3));
          if (!pc.has(ci)) continue; const pid = pc.find(ci); if (!byRoom.has(rl)) byRoom.set(rl, new Map()); const m2 = byRoom.get(rl); if (!m2.has(pid)) m2.set(pid, []); m2.get(pid).push(g); }
        const doorPieces = new Map(); for (const k of doors) { const g = segsF.find(s => s.k === k); if (!g || g.d === 'd1' || g.d === 'd2') continue; const rl = g.a === corr ? g.b : g.b === corr ? g.a : 0; if (!rl) continue; const ci = g.d === 'h' ? (g.a === corr ? Qi(g.pos, g.line - 1, 2) : Qi(g.pos, g.line, 0)) : (g.a === corr ? Qi(g.line - 1, g.pos, 1) : Qi(g.line, g.pos, 3)); if (!pc.has(ci)) continue; if (!doorPieces.has(rl)) doorPieces.set(rl, new Set()); doorPieces.get(rl).add(pc.find(ci)); }
        const target = Math.round(n * m / 30);
        for (const [rl, m2] of [...byRoom].sort(() => Math.random() - 0.5)) {
          if (nThrough >= target || m2.size < 2) continue;
          const has = doorPieces.get(rl) || new Set(); if (!has.size) continue;
          for (const [pid, list] of m2) { if (has.has(pid)) continue;
            const groups = new Map(); for (const g of list) { const k = g.d + g.line; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
            let d = null; for (const G2 of groups.values()) { G2.sort((p, q) => p.pos - q.pos); let run = [G2[0]]; const runs2 = []; for (let i = 1; i <= G2.length; i++) { if (i < G2.length && G2[i].pos === G2[i - 1].pos + 1) { run.push(G2[i]); continue; } runs2.push(run); if (i < G2.length) run = [G2[i]]; } for (const r2 of runs2.sort((p, q) => q.length - p.length)) { if (r2.length >= 3) d = B.safeDoor(r2, degA); if (d) break; } if (d) break; }
            if (d) { doors.push(...d); nThrough++; break; } }
        }
      }
      maxPiece = Math.round(maxPiece);
    }
    // ---- hard to find: the boss hall gets a single door, onto its deepest neighbour; the way down to the
    // next floor is drawn among the deepest spaces (counted in doors from the entrance), a dead end if possible ----
    let forcedGoal = 0, bossDepth = -1, goalDepth = -1, maxDepth = 0, nWalled = 0;
    if (!cave) {
      const C4 = W - 1, R4 = H - 1, n4 = C4 * R4 * 4, Qi = (x, y, k) => (y * C4 + x) * 4 + k;
      // the spaces only depend on the walls (doors are walls too), which do not change here: worked out once
      const part = (() => {
        const ws = new Set([...segsF.map(g => g.k), ...gates, ...halfWalls]);
        const par = new Int32Array(n4).map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
        for (let y = 0; y < R4; y++) for (let x = 0; x < C4; x++) {
          const d1 = ws.has(wk([x, y], [x + 1, y + 1])), d2 = ws.has(wk([x + 1, y], [x, y + 1]));
          if (!d2) { join(Qi(x, y, 0), Qi(x, y, 1)); join(Qi(x, y, 2), Qi(x, y, 3)); }
          if (!d1) { join(Qi(x, y, 0), Qi(x, y, 3)); join(Qi(x, y, 1), Qi(x, y, 2)); }
          if (x + 1 < C4 && !ws.has(wk([x + 1, y], [x + 1, y + 1]))) join(Qi(x, y, 1), Qi(x + 1, y, 3));
          if (y + 1 < R4 && !ws.has(wk([x, y + 1], [x + 1, y + 1]))) join(Qi(x, y, 2), Qi(x, y + 1, 0));
        }
        const sideOf = k => { const [[ax, ay], [bx, by]] = parseW(k);
          if (ay === by) { const x = Math.min(ax, bx); return [ay > 0 ? find(Qi(x, ay - 1, 2)) : -1, ay < R4 ? find(Qi(x, ay, 0)) : -1]; }
          if (ax === bx) { const y = Math.min(ay, by); return [ax > 0 ? find(Qi(ax - 1, y, 1)) : -1, ax < C4 ? find(Qi(ax, y, 3)) : -1]; }
          const x = Math.min(ax, bx), y = Math.min(ay, by); return [find(Qi(x, y, 0)), find(Qi(x, y, 2))]; };
        const memo = new Map(), side = k => { let r = memo.get(k); if (!r) { r = sideOf(k); memo.set(k, r); } return r; };
        return { find, sideOf: side };
      })();
