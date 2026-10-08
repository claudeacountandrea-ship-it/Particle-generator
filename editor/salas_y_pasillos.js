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
    // every cell is a room (rooms that share a wall where no corridor passes), except a few kept
    // free so a corridor may cross them diagonally
    const freeCell = new Set();
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      if (cell[cid(i, j)] || !cellIn(i, j)) continue;
      if (Math.random() < 0.2) { freeCell.add(cid(i, j)); continue; }
      let w = 1, h = 1;
      const free = (a, b) => a < n && b < m && !cell[cid(a, b)] && !freeCell.has(cid(a, b)) && cellIn(a, b);
      const r = Math.random();
      // galleries: a long corridor with little rooms (partitions) on both sides
      if (r < 0.05 && free(i + 1, j) && free(i + 2, j)) {
        const big = free(i, j + 1) && free(i + 1, j + 1) && free(i + 2, j + 1) && Math.random() < 0.5;
        const g = { i, j, w: 3, h: big ? 2 : 1, kind: 'gal', axis: 'x', bevel: 1 }; rooms.push(g);
        for (let b = j; b < j + g.h; b++) for (let a = i; a < i + 3; a++) cell[cid(a, b)] = g;
        continue;
      }
      if (r < 0.09 && free(i, j + 1) && free(i, j + 2)) {
        const big = free(i + 1, j) && free(i + 1, j + 1) && free(i + 1, j + 2) && Math.random() < 0.5;
        const g = { i, j, w: big ? 2 : 1, h: 3, kind: 'gal', axis: 'y', bevel: 1 }; rooms.push(g);
        for (let b = j; b < j + 3; b++) for (let a = i; a < i + g.w; a++) cell[cid(a, b)] = g;
        continue;
      }
      if (r < 0.28 && free(i + 1, j) && free(i, j + 1) && free(i + 1, j + 1)) { w = 2; h = 2; }
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
      let w = opts.map(([a, b, d]) => { const dir = [a - i, b - j] + ''; return (d ? 1.4 : 1) * (last && dir === last ? 0.35 : 1); });
      let t = Math.random() * w.reduce((s, v) => s + v, 0), c = 0; for (; c < opts.length - 1; c++) { t -= w[c]; if (t <= 0) break; }
      const [a, b, d] = opts[c];
      if (d) usedDiagCell.add(cid(Math.min(i, a), Math.min(j, b)));
      edges.set(ekey(nid(i, j), nid(a, b)), { a: [i, j], b: [a, b], diag: d });
      seen.add(nid(a, b)); stack.push([a, b, [a - i, b - j] + '']);
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
      const nDoors = r.kind === 'gal' ? rnd(3, 5) : r.w * r.h > 1 && Math.random() < 0.5 ? 2 : 1;
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
          if (a < 0 || b < 0 || a > n || b > m || nodeBlocked(a, b) || (cave && !nodeIn(a, b))) continue;
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
    // gates: some straight corridor stretches are closed by a wall with a door across the corridor,
    // so a stretch becomes a small chamber to open on the way
    const gateSegs = [];
    for (const e of edges.values()) {
      if (e.diag || Math.random() > 0.18 || needed.has(ekey(nid(...e.a), nid(...e.b)))) continue; // never in front of a room door
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
      B.paint((x, y) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1, corr);
      const has = (a, b) => L.some(d => d[0] === a && d[1] === b);
      for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        if (has(sx, sy)) continue; // a diagonal corridor leaves the node this way
        const legs = 3 + (Math.random() < 0.5 ? 1 : 0); // bevel 1 or 2
        if (has(sx, 0) && has(0, sy)) B.paint((x, y) => sx * (x - cx) >= 1 && sy * (y - cy) >= 1 && sx * (x - cx) + sy * (y - cy) <= legs, corr, [0]);
        else if (!has(sx, 0) && !has(0, sy) && L.length >= 2) cuts.push((x, y) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1 && sx * (x - cx) + sy * (y - cy) > 0);
      }
    }
    for (const f of cuts) B.paint(f, 0, [corr]);
    // rooms fill their cells; on a side with no corridor they reach the middle of the band and share
    // the wall with the room next door (no rock left between rooms)
    const ext = (i, j, side) => { // side: 0 left, 1 right, 2 top, 3 bottom
      const [a, b] = side === 0 ? [i - 1, j] : side === 1 ? [i + 1, j] : side === 2 ? [i, j - 1] : [i, j + 1];
      if (a < 0 || b < 0 || a >= n || b >= m || !cellIn(a, b)) return false;
      const p = side === 0 ? [i, j] : side === 1 ? [i + 1, j] : side === 2 ? [i, j] : [i, j + 1];
      const q = side <= 1 ? [p[0], p[1] + 1] : [p[0] + 1, p[1]];
      return !isCorr(p, q);
    };
    const cellRect = (i, j) => { const [x0, y0] = N(i, j), x1 = x0 + G, y1 = y0 + G; return [x0 + (ext(i, j, 0) ? 0 : 1), y0 + (ext(i, j, 2) ? 0 : 1), x1 - (ext(i, j, 1) ? 0 : 1), y1 - (ext(i, j, 3) ? 0 : 1)]; };
    for (const r of rooms) {
      const l = B.label('room'); r.label = l; r.labels = [l];
      const rects = []; for (let b = r.j; b < r.j + r.h; b++) for (let a = r.i; a < r.i + r.w; a++) rects.push(cellRect(a, b));
      const inR = (x, y) => rects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
      const [x0, y0] = N(r.i, r.j), x1 = x0 + G * r.w, y1 = y0 + G * r.h;
      if (r.kind === 'gal') {
        // hall along the long axis; little rooms on both sides, each one opening onto the hall
        B.paint(inR, l, [0]);
        B.kinds[l] = 'gal';
        const along = r.axis === 'x', L0 = along ? x0 + 1 : y0 + 1, L1 = along ? x1 - 1 : y1 - 1;
        const T0 = along ? y0 + 1 : x0 + 1, T1 = along ? y1 - 1 : x1 - 1, depth = (T1 - T0) > 10 ? 5 : 3;
        r.cubicles = [];
        for (const side of [0, 1]) {
          let a = L0;
          while (L1 - a >= 4) {
            const b = L1 - a < 10 ? L1 : a + rnd(5, 7);
            const c = B.label('room'), lo = side ? T1 - depth : T0 - 1, hi = side ? T1 + 1 : T0 + depth, a0 = a;
            B.paint((x, y) => { const u = along ? x : y, v = along ? y : x; return u >= a0 && u <= b && v >= lo && v <= hi; }, c, [l]);
            r.cubicles.push(c); r.labels.push(c); a = b;
          }
        }
      } else if (r.kind === 'rb') {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = (x1 - x0) / 2 - 1;
        B.paint(inR, corr, [0]); // the corners around it are corridor, so its doors go on the diagonal sides
        B.paint((x, y) => Math.abs(x - cx) <= R && Math.abs(y - cy) <= R && Math.abs(x - cx) + Math.abs(y - cy) <= R + 1, l);
      } else B.paint(inR, l, [0]);
    }
    // a cell crossed by a diagonal corridor: its leftover triangles join a room beside them
    for (const c of usedDiagCell) {
      const i = c % n, j = (c / n) | 0, [x0, y0] = N(i, j);
      const owner = (a, b, side) => (a >= 0 && b >= 0 && a < n && b < m && cell[cid(a, b)] && cell[cid(a, b)].label && ext(a, b, side)) ? cell[cid(a, b)].label : 0;
      const L1 = owner(i, j - 1, 3) || owner(i + 1, j, 0), L2 = owner(i, j + 1, 2) || owner(i - 1, j, 1);
      const diagDown = edges.has(ekey(nid(i, j), nid(i + 1, j + 1))); // "\" crossing
      // upper-right / lower-left halves for "\", upper-left / lower-right for "/"
      B.paint((x, y) => x >= x0 && x <= x0 + G && y >= y0 && y <= y0 + G && (diagDown ? (x - x0) > (y - y0) : (x - x0) + (y - y0) < G), L1, [0]);
      B.paint((x, y) => x >= x0 && x <= x0 + G && y >= y0 && y <= y0 + G && (diagDown ? (x - x0) < (y - y0) : (x - x0) + (y - y0) > G), L2, [0]);
    }
    // the way in: a corridor from the start node to the map edge
    { const [sx, sy] = N(si, sj); if (!cave) B.paint((x, y) => Math.abs(x - sx) <= 1 && y >= sy && y <= H, corr); }
    // rock shut inside the dungeon (bits left at corners and by diagonals) joins the room beside it
    { const C4 = W - 1, R4 = H - 1, q = B.q, out = new Uint8Array(q.length), st = [];
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
      for (let i = 0; i < q.length; i++) if (!q[i] && !out[i]) { const l = B.label('room'), st2 = [i]; q[i] = l; while (st2.length) for (const j of nbr(st2.pop())) if (j >= 0 && !q[j] && !out[j]) { q[j] = l; st2.push(j); } } }
    B.snap(); B.pieces();
    // corridor scraps that touch nothing become rock
    for (let l = 1; l < B.next; l++) if (B.kinds[l] === 'corr' && l !== corr && B.area(l)) B.paint(() => true, 0, [l]); // closed scraps nobody can reach
    B.snap(); B.spikes();
    // ---- 6. doors ----
    const segs = B.segments(), runs = B.runs(segs), deg = new Map();
    for (const s of segs) for (const p of parseW(s.k)) { const v = vk(...p); deg.set(v, (deg.get(v) || 0) + 1); }
    const doors = [];
    const opened = new Set();
    for (const r of rooms) if (r.kind === 'rb') { // rombo: a door in the middle of a diagonal side
      const run = runs.get(Math.min(r.label, corr) + ',' + Math.max(r.label, corr)); const d = run && B.safeDoor(run, deg); if (d) { doors.push(...d); opened.add(r); }
    }
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
    for (const r of rooms) if (r.kind === 'gal') for (const c of r.cubicles) {
      const run = runs.get(Math.min(c, r.label) + ',' + Math.max(c, r.label)); const d = run && B.safeDoor(run, deg); if (d) doors.push(...d);
    }
    // partitions: some rooms open straight into the room next door (rooms in a row to cross)
    const roomLabels = new Set(rooms.flatMap(r => r.labels || []));
    let nPart = 0;
    for (const [key, run] of runs) {
      const [a, b] = key.split(',').map(Number);
      if (!roomLabels.has(a) || !roomLabels.has(b) || Math.random() > 0.3) continue;
      const d = B.safeDoor(run, deg); if (d) { doors.push(...d); nPart++; }
    }
    // gates only where the corridor really is (both sides corridor floor)
    const wallSet = new Set(segs.map(g => g.k));
    const gates = gateSegs.filter(k => !wallSet.has(k));
    if (!cave) { // the entrance: the bottom edge of the map
      const out = segs.filter(g => g.d === 'h' && g.line === H - 1 && (g.a === corr || g.b === corr)).sort((u, v) => u.pos - v.pos);
      if (out.length) doors.push(...out.map(g => g.k));
    }
    // any space nobody can reach yet gets a door to a reached neighbour (repeat until all are in)
    for (let pass = 0; pass < 6; pass++) {
      const allD = new Set([...doors, ...gates]), adjL = new Map();
      for (const g of segs) if (allD.has(g.k)) for (const [u, v] of [[g.a, g.b], [g.b, g.a]]) { if (!adjL.has(u)) adjL.set(u, []); adjL.get(u).push(v); }
      const reached = new Set([corr]), qq = [corr]; while (qq.length) for (const v of adjL.get(qq.pop()) || []) if (!reached.has(v)) { reached.add(v); qq.push(v); }
      let added = 0;
      for (let l = 1; l < B.next; l++) {
        if (reached.has(l) || !B.area(l)) continue;
        let best = null; for (const [key, run] of runs) { const [a, b] = key.split(',').map(Number); if ((a === l && reached.has(b)) || (b === l && reached.has(a))) if (!best || run.length > best.length) best = run; }
        const d = best && (B.safeDoor(best, deg) || B.door(best)); if (d) { doors.push(...d); added++; }
      }
      if (!added) break;
    }
    let floor = 0; for (const v of B.q) if (v) floor++;
    const nDiag = [...edges.values()].filter(e => e.diag).length;
    return {
      size: W, rows: H, walls: [...segs.map(s => s.k), ...gates], doors: [...new Set([...doors, ...gates])], columns: [],
      title: cave ? 'Masmorra construida sobre tu cueva' : `Masmorra de salas y pasillos ${n}×${m}`,
      desc: `${rooms.length} salas (cuadradas 8×8 con bisel 1, dobles o grandes con bisel 1 o 2, y rombos con puntas de 2). ` +
        `Pasillos de 2 que serpentean entre ellas: crecen como un laberinto que prefiere girar (vueltas y espirales), se ramifican y a veces cortan en diagonal (${nDiag} tramos diagonales). ` +
        `Cada sala abre a un pasillo vecino; los pasillos que no llevan a ninguna sala se cortan. ${loops} atajos. ` +
        `${nPart} puertas entre salas vecinas (salas en fila). ${rooms.filter(r => r.kind === 'gal').length} galerías (pasadizo con cuartitos a los lados, hasta 5 salidas) y ${gates.length / 2} compuertas que parten los pasillos en tramos.\n• Piso usado: ${Math.round(100 * floor / B.q.length)}%.\n\nMarca con 🖍 los errores y explica abajo.`,
    };
  };
})();
