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
      const cand = [];
      for (const [sg, fromStart] of [[1, true], [1, false], [-1, true], [-1, false]]) {
        for (let k = 1; k + avLen <= n / 2 - (n >= 14 ? 1.5 : 1); k++) {
          const i0 = fromStart ? k : n - avLen - k, cells = []; for (let t = 0; t < avLen; t++) { const i = i0 + t; cells.push([i, sg > 0 ? i : n - 1 - i]); }
          if (cells.every(([i, j]) => i >= 0 && j >= 0 && i < n && j < m && inShape(i, j))) { cand.push([i0, sg]); break; }
        }
      }
      avPlan.push(...cand.sort(() => Math.random() - 0.5).slice(0, n >= 10 ? 2 : 1)); // more than 2 left messy ends against the round outline
    }
    const even = new Set(); for (const [i0] of avPlan) for (let t = 0; t < avLen; t++) { even.add(i0 + t); even.add(n - 1 - i0 - t); }
    const px = []; for (let i = 0; i < n; i++) px.push(i < (n + 1) >> 1 ? (even.has(i) && !cave ? mid : pitch()) : px[n - 1 - i]);
    for (const i of even) px[i] = mid;
    const py = []; for (let j = 0; j < m; j++) py.push(m === n ? px[j] : pitch());
    const X = [M], Y = [M]; for (let i = 0; i < n; i++) X.push(X[i] + px[i]); for (let j = 0; j < m; j++) Y.push(Y[j] + py[j]);
    const W = cave ? cave.W : X[n] + M + 1, H = cave ? cave.H : Y[m] + M + 1, B = Build(W, H);
    const N = (i, j) => [X[i], Y[j]]; // lattice node
    const cw = i => X[i + 1] - X[i], ch = j => Y[j + 1] - Y[j], square = (i, j, w = 1, h = 1) => X[i + w] - X[i] === Y[j + h] - Y[j];
    const nid = (i, j) => j * (n + 1) + i, cid = (i, j) => j * n + i;
    const painted = cave ? (x, y) => cave.cells.has(vk(Math.floor(x), Math.floor(y))) : () => true;
    const cellIn = (i, j) => { if (!cave) return inShape(i, j); let a = 0; for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (painted(M + G * i + x + .5, M + G * j + y + .5)) a++; return a / (G * G) >= 0.3; };
    const nodeIn = (i, j) => !(cave || round) || [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([a, b]) => i + a >= 0 && j + b >= 0 && i + a < n && j + b < m && cellIn(i + a, j + b));
    // ---- 1. rooms in cells ----
    const cell = Array.from({ length: n * m }, () => null); // {room id, kind}
    const rooms = [];
    // every cell is a room (rooms that share a wall where no corridor passes), except a few kept
    // free so a corridor may cross them diagonally
    const freeCell = new Set();
    // the way in comes from outside the map, from a side chosen by luck (down, up, right or left)
    const entDir = cave ? [0, 1] : pick([[0, 1], [0, -1], [1, 0], [-1, 0]]);
    const ex = entDir[0] ? (entDir[0] > 0 ? n : 0) : n / 2, ey = entDir[1] ? (entDir[1] > 0 ? m : 0) : m / 2;
    // diagonal avenues: 3 or 4 casillas kept free along a great diagonal, crossed later by one straight diagonal corridor
    const avenues = [], avenueInner = new Set(), avenueCells = new Set(), avenueSide = new Set(), avenueEndBlock = new Map();
    {
      const len = avLen;
      for (const [i0, sg] of avPlan) {
        const cs = []; for (let t = 0; t < len; t++) { const i = i0 + t, j = sg > 0 ? i : n - 1 - i; cs.push([i, j]); }
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
      const cs = n >= 14 && m >= 14 ? 3 : 2, spots = [], spots2 = [];
      for (let cj = 0; cj + cs <= m; cj++) for (let ci = 0; ci + cs <= n; ci++) {
        let ok = true; for (let b = cj - 1; b <= cj + cs && ok; b++) for (let a2 = ci - 1; a2 <= ci + cs && ok; a2++) { const inside = a2 >= ci && a2 < ci + cs && b >= cj && b < cj + cs;
          if (inside && (cell[cid(a2, b)] || freeCell.has(cid(a2, b)) || !cellIn(a2, b))) ok = false;
          if (!inside && (a2 < 0 || b < 0 || a2 >= n || b >= m || !cellIn(a2, b))) ok = false; } // a ring of casillas round it stays in the map
        if (!ok) continue;
        const d = Math.hypot(ci + cs / 2 - ex, cj + cs / 2 - ey);
        if (d >= 0.5 * Math.max(n, m)) spots.push([ci, cj]); else if (d >= 0.3 * Math.max(n, m)) spots2.push([ci, cj]);
      }
      const sp = spots.length ? pick(spots) : spots2.length ? pick(spots2) : null;
      if (sp) { const [ci, cj] = sp, c0 = { i: ci, j: cj, w: cs, h: cs, kind: 'sq', bevel: 2, special: 'central' };
        rooms.push(c0); for (let b = cj; b < cj + cs; b++) for (let a2 = ci; a2 < ci + cs; a2++) cell[cid(a2, b)] = c0; }
    }
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      if (cell[cid(i, j)] || freeCell.has(cid(i, j)) || !cellIn(i, j)) continue;
      if (square(i, j) && Math.random() < 0.55) { freeCell.add(cid(i, j)); continue; }
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
      if (dy) { for (let jj = dy > 0 ? j : j - 1; dy > 0 ? jj < m : jj >= 0; jj += dy) for (const ii of [i - 1, i]) if (ii >= 0 && ii < n && cellIn(ii, jj)) return false; }
      else { for (let ii = dx > 0 ? i : i - 1; dx > 0 ? ii < n : ii >= 0; ii += dx) for (const jj of [j - 1, j]) if (jj >= 0 && jj < m && cellIn(ii, jj)) return false; }
      return true; };
    if (!cave) { let best = null, bs = -1e9; for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) if ((entDir[0] ? j > 0 && j < m : i > 0 && i < n) && nodeIn(i, j) && !nodeBlocked(i, j) && openOut(i, j)) {
        const sc = (i * entDir[0] + j * entDir[1]) * 100 - (entDir[0] ? Math.abs(j - m / 2) : Math.abs(i - n / 2)); if (sc > bs) { bs = sc; best = [i, j]; } } if (best) [si, sj] = best; }
    if (!nodeIn(si, sj) || nodeBlocked(si, sj)) { outer: for (let j = m; j >= 0; j--) for (let i = 0; i <= n; i++) if (nodeIn(i, j) && !nodeBlocked(i, j)) { si = i; sj = j; break outer; } }
    const seen = new Set([nid(si, sj)]), stack = [[si, sj, null]];
    while (stack.length) {
      // growing tree: mostly the newest node (long winding ways), sometimes an older one (branches)
      const k = Math.random() < 0.85 ? stack.length - 1 : rnd(0, stack.length - 1);
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
    const needed = new Set([...roomDoors.map(([, s]) => ekey(nid(...s[0]), nid(...s[1]))), ...avenueKeys]);
    const startKey = nid(si, sj);
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
      if (e.diag || leaf(e.a) === leaf(e.b) || Math.random() < 0.25) continue;
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
      const diagDown = edges.has(ekey(nid(i, j), nid(i + 1, j + 1))); // "\" crossing
      // each half goes to the room it touches along one of its legs; the half's two corners on the diagonal
      // would make that room a 45° tip at the far end, so the tip is cut flat (2 long) and given to the corridor
      const up = owner(i, j - 1, 3), rt = owner(i + 1, j, 0), dn = owner(i, j + 1, 2), lf = owner(i - 1, j, 1);
      // [label, which leg it shares, cut test]
      const H1 = diagDown ? (up ? [up, (x, y) => y > y0 + G - 2] : rt ? [rt, (x, y) => x < x0 + 2] : [0, () => false])  // upper-right half
                          : (up ? [up, (x, y) => y > y0 + G - 2] : lf ? [lf, (x, y) => x > x0 + G - 2] : [0, () => false]); // upper-left half
      const H2 = diagDown ? (dn ? [dn, (x, y) => y < y0 + 2] : lf ? [lf, (x, y) => x > x0 + G - 2] : [0, () => false])  // lower-left half
                          : (dn ? [dn, (x, y) => y < y0 + 2] : rt ? [rt, (x, y) => x < x0 + 2] : [0, () => false]); // lower-right half
      const in1 = (x, y) => x >= x0 && x <= x0 + G && y >= y0 && y <= y0 + G && (diagDown ? (x - x0) > (y - y0) : (x - x0) + (y - y0) < G);
      const in2 = (x, y) => x >= x0 && x <= x0 + G && y >= y0 && y <= y0 + G && (diagDown ? (x - x0) < (y - y0) : (x - x0) + (y - y0) > G);
      for (const [inH, [L, tip]] of [[in1, H1], [in2, H2]]) {
        B.paint((x, y) => inH(x, y) && !tip(x, y), L, [0], [x0, y0, x0 + G, y0 + G]);
        if (L) B.paint((x, y) => inH(x, y) && tip(x, y), corr, [0], [x0, y0, x0 + G, y0 + G]);
      }
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
        { // a room with a long slanted wall (3+ in a row, not a bevel) is not cut: cutting it leaves 45° tips
          const by = new Map(); for (const g of B.segments()) if ((g.a === l || g.b === l) && (g.d === 'd1' || g.d === 'd2')) { const k = g.d + g.line; if (!by.has(k)) by.set(k, []); by.get(k).push(g.pos); }
          let slant = false; for (const P of by.values()) { P.sort((u, v) => u - v); let run = 1; for (let i = 1; i < P.length; i++) { run = P[i] === P[i - 1] + 1 ? run + 1 : 1; if (run >= 3) slant = true; } }
          if (slant) continue; }
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
        const a = area[l]; if (!a || a >= 16) continue;
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
    // last pass: rooms with no corner of more than 180° (after triangles and partitions moved things)
    for (let t = 0; t < 4; t++) { const k = B.reflexFix(l => B.kinds[l] === 'room') + B.cornerFix(); if (!k) break; }
    B.thin(); B.snap(); B.spikes(); tidy(); for (let t = 0; t < 2 && B.cornerFix(); t++);
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
    let segs2 = segs, merges = 0;
    for (let pass = 0; pass < 8; pass++) {
      const segs = segs2;
      const allD = new Set([...doors, ...gates]), adjL = new Map();
      for (const g of segs) if (allD.has(g.k)) for (const [u, v] of [[g.a, g.b], [g.b, g.a]]) { if (!adjL.has(u)) adjL.set(u, []); adjL.get(u).push(v); }
      const reached = new Set([corr]), qq = [corr]; while (qq.length) for (const v of adjL.get(qq.pop()) || []) if (v && !reached.has(v)) { reached.add(v); qq.push(v); } // 0 = rock/outside never counts
      let added = 0;
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
        else if (runsL.length) { // no door fits without touching a wall: the space joins its reached neighbour
          const g = runsL[0][0], to = g.a === l ? g.b : g.a; B.paint(() => true, to, [l]); added++; merges++;
        }
      }
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
    const halfWalls = []; let nThrough = 0, maxPiece = 0;
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
      // a gate across a diagonal corridor, at the centre point c of a casilla it crosses (direction d)
      const tryDiag = (c, d) => {
        const p = [d[1], -d[0]], e1 = [c[0] - p[0], c[1] - p[1]], e2 = [c[0] + p[0], c[1] + p[1]];
        if (!straightAt(e1, d) || !straightAt(e2, d) || degF.has(c + '')) return null;
        for (const [x, y] of [[c[0] - 1, c[1] - 1], [c[0], c[1] - 1], [c[0] - 1, c[1]], [c[0], c[1]]]) if (!isCorrQ(x, y)) return null;
        if (!spaced(...c)) return null;
        return { segs: [wk(e1, c), wk(c, e2)], c, ends: [e1, e2], ortho: false };
      };
      const put = g => { if (!g) return false; g.half = g.forced !== undefined ? g.forced : g.ortho && Math.random() < 0.35 ? (Math.random() < 0.5 ? 0 : 1) : -1; placed.push(g); return true; };
      // 1) beside the doors of the rooms (one side, sometimes both)
      const byLine = new Map();
      for (const k of doors) { const [[x1, y1], [x2, y2]] = parseW(k); if (x1 !== x2 && y1 !== y2) continue; const h = y1 === y2, key = (h ? 'h' : 'v') + (h ? y1 : x1), pos = h ? Math.min(x1, x2) : Math.min(y1, y2); if (!byLine.has(key)) byLine.set(key, []); byLine.get(key).push(pos); }
      const doorRuns = [];
      for (const [key, list] of byLine) { const h = key[0] === 'h', L = +key.slice(1); list.sort((a, b) => a - b); for (let t = 0; t < list.length;) { let e = t; while (e + 1 < list.length && list[e + 1] === list[e] + 1) e++; doorRuns.push([h, L, list[t], list[e] + 1]); t = e + 1; } }
      for (const [h, L, a, b] of doorRuns.sort(() => Math.random() - 0.5)) {
        if (Math.random() < 0.05) continue;
        const sides = Math.random() < 0.25 ? [a - 1, b + 1] : [Math.random() < 0.5 ? a - 1 : b + 1];
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
      for (const [c, d] of diagAt) if (Math.random() < 0.5 && Number.isInteger(c[0]) && Number.isInteger(c[1])) put(tryDiag(c, d));
      // 3) no stretch of corridor longer than 40 squares: the longest is cut again and again
      const C4 = W - 1, R4 = H - 1, Qi = (x, y, k) => (y * C4 + x) * 4 + k;
      const pieces = () => {
        const blk = new Set([...placed.flatMap(g => g.segs)]), par = new Map(), find = i => { while (par.get(i) !== i) { par.set(i, par.get(par.get(i))); i = par.get(i); } return i; };
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
      minGap = 4;
      for (let guard = 0; guard < 80; guard++) {
        const pc = pieces(); let big = -1, bs = 0; for (const [r, z] of pc.size) if (z > bs) { bs = z; big = r; }
        maxPiece = sq(bs); if (sq(bs) <= 40) break;
        const inBig = (x, y) => pc.has(Qi(x, y, 0)) && pc.find(Qi(x, y, 0)) === big;
        const opts = [...orthoAt.map(o => ['o', o]), ...diagAt.map(o => ['d', o])].filter(([t, o]) => t === 'o' ? (o[0] ? inBig(o[2], o[1]) : inBig(o[1], o[2])) : inBig(o[0][0], o[0][1])).sort(() => Math.random() - 0.5);
        let done = false; for (const [t, o] of opts) { if (put(t === 'o' ? tryOrtho(o[0], o[1], o[2], 1) : tryDiag(o[0], o[1]))) { done = true; break; } }
        if (!done) break;
      }
      // 4) a gate that leaves a bit of corridor smaller than 4×4 is taken away again
      const gk = () => placed.flatMap(g => g.half < 0 ? g.segs : [g.segs[g.half]]), hk = () => placed.flatMap(g => g.half < 0 ? [] : [g.segs[1 - g.half]]);
      for (let pass = 0; pass < 6 && placed.length; pass++) {
        const r = checkRules(W, H, new Set([...segsF.map(g => g.k), ...gk(), ...hk()]), new Set([...doors, ...gk()]));
        const tiny = new Set(r.tiny.map(([x, y]) => x + ',' + y)); if (!tiny.size) break;
        for (let i = placed.length - 1; i >= 0; i--) { const [p1, p2] = placed[i].ends; let hit = false;
          for (let x = Math.min(p1[0], p2[0]) - 1; x <= Math.max(p1[0], p2[0]) && !hit; x++) for (let y = Math.min(p1[1], p2[1]) - 1; y <= Math.max(p1[1], p2[1]); y++) if (tiny.has(x + ',' + y)) { hit = true; break; }
          if (hit) placed.splice(i, 1); }
      }
      gates.push(...gk()); halfWalls.push(...hk());
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
      const graph = () => {
        const ws = new Set([...segsF.map(g => g.k), ...gates, ...halfWalls]), ds = new Set([...doors, ...gates]);
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
        const floorS = v => v >= 0 && B.q[v] !== 0, adj = new Map(); let entry = -1;
        for (const k of ds) { const [a, b] = sideOf(k); if (floorS(a) && floorS(b)) { if (a === b) continue; if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); } else if (floorS(a) || floorS(b)) entry = floorS(a) ? a : b; }
        const depth = new Map(); if (entry >= 0) { depth.set(entry, 0); const q = [entry]; for (let i = 0; i < q.length; i++) for (const v of adj.get(q[i]) || []) if (!depth.has(v)) { depth.set(v, depth.get(q[i]) + 1); q.push(v); } }
        return { find, sideOf, adj, depth, floorS };
      };
      // a few less doors: a quarter of the spare connections (the ones that only close a loop) are walled up
      // again, never cutting anything off — the dungeon stays full of choices but goes a little deeper
      { const g0 = graph(), total = g0.depth.size, pairs = new Map();
        for (const k of doors) { const [a, b] = g0.sideOf(k); if (!g0.floorS(a) || !g0.floorS(b) || a === b) continue; const key = Math.min(a, b) + '-' + Math.max(a, b); if (!pairs.has(key)) pairs.set(key, []); pairs.get(key).push(k); }
        const allP = new Set(); for (const k of [...doors, ...gates]) { const [a, b] = g0.sideOf(k); if (g0.floorS(a) && g0.floorS(b) && a !== b) allP.add(Math.min(a, b) + '-' + Math.max(a, b)); }
        const loops = allP.size - total + 1; let target = Math.round(loops / 4), cut = 0;
        for (const [, ks] of [...pairs].sort(() => Math.random() - 0.5)) {
          if (cut >= target) break;
          const idx = ks.map(k => doors.indexOf(k)); for (const k of ks) doors.splice(doors.indexOf(k), 1);
          if (graph().depth.size < total) doors.push(...ks); else cut++;
        }
        nWalled = cut; }
      const degA = new Map(); for (const k of [...segsF.map(g => g.k), ...gates, ...halfWalls]) for (const q of parseW(k)) degA.set(vk(...q), (degA.get(vk(...q)) || 0) + 1);
      const boss = rooms.find(r => r.special === 'central');
      if (boss && boss.label) {
        const bl = boss.label; let bi = -1; for (let i = 0; i < n4; i++) if (B.q[i] === bl) { bi = i; break; }
        if (bi >= 0) {
          let g = graph(); const bs = g.find(bi), saved = [...doors], before = g.depth.size;
          // its doors go, except those that are the only way into a space behind it
          const bdoors = doors.filter(k => g.sideOf(k).includes(bs));
          for (const k of bdoors) doors.splice(doors.indexOf(k), 1);
          g = graph();
          for (const k of bdoors) { const o = g.sideOf(k).find(v => v !== bs); if (o !== undefined && g.floorS(o) && !g.depth.has(o)) doors.push(k); }
          g = graph();
          // the walls of the boss hall, grouped by the space on their other side, in straight runs
          const groups = new Map();
          for (const sg of segsF) { if (sg.a !== bl && sg.b !== bl) continue; const o = g.sideOf(sg.k).find(v => v !== g.find(bi)); if (o === undefined || !g.depth.has(o)) continue;
            const key = o + ':' + sg.d + ':' + sg.line; if (!groups.has(key)) groups.set(key, { d: g.depth.get(o), list: [] }); groups.get(key).list.push(sg); }
          const runs2 = []; for (const { d, list } of groups.values()) { list.sort((p, q) => p.pos - q.pos); let r = [list[0]]; for (let i = 1; i <= list.length; i++) { if (i < list.length && list[i].pos === list[i - 1].pos + 1) { r.push(list[i]); continue; } runs2.push({ d, r }); if (i < list.length) r = [list[i]]; } }
          runs2.sort((p, q) => q.d - p.d || q.r.length - p.r.length);
          let ok = false; for (const { r } of runs2) { const d = r.length >= 2 ? B.safeDoor(r, degA) : null; if (d) { doors.push(...d); ok = true; break; } }
          if (!ok || graph().depth.size < before) { doors.length = 0; doors.push(...saved); }
        }
      }
      const g = graph(); for (const v of g.depth.values()) maxDepth = Math.max(maxDepth, v);
      if (boss && boss.label) { for (let i = 0; i < n4; i++) if (B.q[i] === boss.label) { bossDepth = g.depth.get(g.find(i)) ?? -1; break; } }
      // the way down: any room deep in the dungeon (75% of the deepest or more), a dead end when there is one
      const seenL = new Set(), cand = [];
      for (let i = 0; i < n4; i += 4) { const l = B.q[i]; if (!l || seenL.has(l) || B.kinds[l] !== 'room' || (boss && l === boss.label)) continue; seenL.add(l);
        const sp = g.find(i), d = g.depth.get(sp); if (d === undefined || d < 0.75 * maxDepth || B.area(l) < 24) continue; cand.push([l, d, (g.adj.get(sp) || new Set()).size]); }
      const dead = cand.filter(c => c[2] <= 1), pool = dead.length ? dead : cand;
      if (pool.length) { const c = pick(pool); forcedGoal = c[0]; goalDepth = c[1]; }
    }
    // ---- the way: start, the deepest room (goal), the central form, and the route between them ----
    const marks = {}; let routeLen = 0, goalLabel = 0;
    { const allW = new Set([...segsF.map(g => g.k), ...gates, ...halfWalls]), allD = new Set([...doors, ...gates]);
      const blocks = k => allW.has(k) && !allD.has(k), C4 = W - 1, R4 = H - 1, Qn = C4 * R4 * 4, Qi = (x, y, k) => (y * C4 + x) * 4 + k;
      const nbrs = i => { const c = i >> 2, k = i & 3, x = c % C4, y = (c / C4) | 0, out = [];
        const d1 = blocks(wk([x, y], [x + 1, y + 1])), d2 = blocks(wk([x + 1, y], [x, y + 1]));
        if (k === 0) { if (!d2) out.push(Qi(x, y, 1)); if (!d1) out.push(Qi(x, y, 3)); if (y > 0 && !blocks(wk([x, y], [x + 1, y]))) out.push(Qi(x, y - 1, 2)); }
        if (k === 1) { if (!d2) out.push(Qi(x, y, 0)); if (!d1) out.push(Qi(x, y, 2)); if (x < C4 - 1 && !blocks(wk([x + 1, y], [x + 1, y + 1]))) out.push(Qi(x + 1, y, 3)); }
        if (k === 2) { if (!d2) out.push(Qi(x, y, 3)); if (!d1) out.push(Qi(x, y, 1)); if (y < R4 - 1 && !blocks(wk([x, y + 1], [x + 1, y + 1]))) out.push(Qi(x, y + 1, 0)); }
        if (k === 3) { if (!d2) out.push(Qi(x, y, 2)); if (!d1) out.push(Qi(x, y, 0)); if (x > 0 && !blocks(wk([x, y], [x, y + 1]))) out.push(Qi(x - 1, y, 1)); }
        return out; };
      const [sx, sy] = N(si, sj); let s0 = -1;
      for (let r2 = 0; r2 < 4 && s0 < 0; r2++) for (let y = Math.max(0, sy - 1 - r2); y <= Math.min(R4 - 1, sy + r2) && s0 < 0; y++) for (let x = Math.max(0, sx - 1 - r2); x <= Math.min(C4 - 1, sx + r2); x++) if (B.q[Qi(x, y, 0)] === corr) { s0 = Qi(x, y, 0); break; }
      if (s0 < 0) for (let i = 0; i < Qn; i++) if (B.q[i] === corr) { s0 = i; break; }
      const dist = new Int32Array(Qn).fill(-1), prev = new Int32Array(Qn).fill(-1), qq = [s0]; dist[s0] = 0;
      for (let h = 0; h < qq.length; h++) for (const j of nbrs(qq[h])) if (dist[j] < 0 && B.q[j]) { dist[j] = dist[qq[h]] + 1; prev[j] = qq[h]; qq.push(j); }
      // the start room: the first room reached; the goal: the room whose nearest point is farthest
      const near = new Map(); for (let i = 0; i < Qn; i++) if (dist[i] >= 0 && B.kinds[B.q[i]] === 'room') { const l = B.q[i]; if (!near.has(l) || dist[i] < dist[near.get(l)]) near.set(l, i); }
      let startRoom = 0, sd = 1e9, gd = -1, gq = -1, maxD = 0;
      const central = rooms.find(r => r.special === 'central');
      for (const [l, i] of near) { if (dist[i] < sd) { sd = dist[i]; startRoom = l; } maxD = Math.max(maxD, dist[i]); }
      // the way down to the next floor: a room drawn by luck among those at least 40% of the deepest distance
      // away (it may be halfway or at the very bottom: nothing tells where it is)
      const far = [...near].filter(([l, i]) => l !== startRoom && (!central || l !== central.label) && B.area(l) >= 30 && dist[i] >= 0.4 * maxD);
      if (forcedGoal && near.has(forcedGoal)) { goalLabel = forcedGoal; gq = near.get(forcedGoal); gd = dist[gq]; }
      else if (far.length) { const [l, i] = pick(far); goalLabel = l; gq = i; gd = dist[i]; }
      for (let i = 0; i < Qn; i += 4) { const l = B.q[i], k = vk((i >> 2) % C4, ((i >> 2) / C4) | 0);
        if (central && l === central.label) marks[k] = 4; else if (l === goalLabel) marks[k] = 1; else if (l === startRoom) marks[k] = 2; }
      for (let i = gq; i >= 0; i = prev[i]) { const k = vk((i >> 2) % C4, ((i >> 2) / C4) | 0); if (marks[k] === undefined) marks[k] = 5; }
      routeLen = gd; }
    // no way in from outside (rare): draw the dungeon again
    if (!entranceOK && (opts._try || 0) < 5) return halls(n, m, cave, { ...opts, _try: (opts._try || 0) + 1 });
    let floor = 0; for (const v of B.q) if (v) floor++;
    const nDiag = [...edges.values()].filter(e => e.diag).length;
    return {
      size: W, rows: H, walls: [...segsF.map(s => s.k), ...gates, ...halfWalls], doors: [...new Set([...doors, ...gates])], columns: [], marks,
      title: cave ? 'Masmorra construida sobre tu cueva' : `Masmorra de salas y pasillos ${n}×${m}`,
      desc: `Escala: 1 cuadrado = 2 personas; pasillos de 2, salas de ${rmin} a ${rmax} cuadrados (lo más grande se parte en minicuartos con puerta). ${rooms.length} salas (cuadradas con bisel 1 o 2 y rombos con puntas de 2). Sala del jefe en el centro${nPillars ? ` con ${nPillars} columnas` : ''}. ` +
        `Pasillos de 2 que serpentean entre ellas: crecen como un laberinto que prefiere girar (vueltas y espirales), se ramifican y a veces cortan en diagonal (${nDiag} tramos diagonales). ${avenueRombos.length} salas rombo (cuadrados girados en medio de las avenidas, vacías y grandes, sin triángulos alrededor). ${diagCubes.length} cuartitos en fila a los lados de los pasillos diagonales (galerías en diagonal)${rooms.some(r => r.kind === 'dgal') ? `, y ${rooms.filter(r => r.kind === 'dgal').length} salón diagonal en bloque` : ''}. ` +
        `Cada sala abre a un pasillo vecino; los pasillos que no llevan a ninguna sala se cortan. ${loops} atajos. ` +
        `${splitPairs.length} particiones nuevas (paredes dentro de salas, partes entre ${pmin} y ${pmax < 1e9 ? pmax : '∞'}). Sin huecos de 1, sin esquinas de 90° (biselado automático) y sin puertas pegadas a otra pared. ${nPart} puertas entre salas vecinas (salas en fila). ${rooms.filter(r => r.kind === 'gal').length} galerías (pasadizo con cuartitos a los lados, hasta 5 salidas). ${(gates.length - halfWalls.length) / 2} compuertas y ${halfWalls.length} pasos estrechos (media pared y puerta de 1) que parten los pasillos: junto a las puertas de las salas, a lo largo de los tramos (también en diagonal), en las bocas de los cruces y justo pasada cada vuelta en L (desde antes de la vuelta parece la puerta de un cuarto). Ningún tramo de pasillo pasa de ${maxPiece} cuadrados. ${nThrough} salas de paso disfrazadas (parecen un cuarto más, pero unen dos tramos de pasillo).${round ? ' Contorno circular irregular.' : ''}\n• Piso usado: ${Math.round(100 * floor / B.q.length)}%. Ruta de la entrada a la meta: ${Math.round(routeLen / 2)} pasos.\n• Entrada desde afuera por ${entDir[1] > 0 ? 'abajo' : entDir[1] < 0 ? 'arriba' : entDir[0] > 0 ? 'la derecha' : 'la izquierda'}. El jefe y la bajada al piso siguiente están donde tocó (suerte), pero escondidos: la sala del jefe tiene una sola puerta, hacia su vecino más hondo (a ${bossDepth} puertas de la entrada); la bajada está entre lo más hondo del mapa (a ${goalDepth} de ${maxDepth} puertas), en un callejón sin salida cuando lo hay. ${nWalled} puertas sobrantes tapiadas (una cuarta parte de las vueltas) para que el camino sea algo más largo sin perder decisiones.\n• Colores: verde = sala inicial, dorado = bajada al piso siguiente, morado = sala del jefe (opcional), azul = ruta a la bajada.\n\nMarca con 🖍 los errores y explica abajo.`,
    };
  };
})();
