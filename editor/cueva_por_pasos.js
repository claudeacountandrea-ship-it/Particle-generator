// ---------- cave by steps: the whole space is used ----------
// 1. A cave footprint (painted by the player, or dug by a few random "worms"), its outline cut in
//    straight and 45° stretches of 2. 2. Everything inside is divided into chambers with straight
//    and diagonal walls (octile Voronoi cells), every wall shared, no rock left inside; long cells
//    work as corridor stretches, big ones are split again. 3. The way: a long route from the
//    entrance to the deepest chamber, some steps with 2–3 alternatives, side chambers as dead ends
//    for rewards, and shortcuts between neighbours that were far apart along the way.
const Steps = (() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return function steps(size = 81, cave = null) {
    const W = cave ? cave.W : size, H = cave ? cave.H : size, B = Build(W, H);
    // ---- 1. footprint on blocks of 2×2 cells ----
    const bw = Math.floor((W - 1) / 2), bh = Math.floor((H - 1) / 2);
    const inBlk = new Uint8Array((bw + 1) * (bh + 1)); // corner flags on the block lattice
    let start = null;
    if (cave) {
      // a corner of the block lattice is inside when at least half of the 4×4 cells around it are painted
      for (let J = 0; J <= bh; J++) for (let I = 0; I <= bw; I++) {
        let c = 0; for (let y = 2 * J - 2; y < 2 * J + 2; y++) for (let x = 2 * I - 2; x < 2 * I + 2; x++) if (cave.cells.has(vk(x, y))) c++;
        inBlk[J * (bw + 1) + I] = c >= 8 ? 1 : 0;
      }
      if (cave.start) { const [x, y] = cave.start.split(',').map(Number); start = [x, y]; }
    } else {
      // worms dug from the bottom middle
      const dig = (cx, cy, r) => { for (let J = Math.max(1, Math.floor(cy - r)); J <= Math.min(bh - 1, cy + r); J++) for (let I = Math.max(1, Math.floor(cx - r)); I <= Math.min(bw - 1, cx + r); I++) if (Math.hypot(I - cx, J - cy) <= r) inBlk[J * (bw + 1) + I] = 1; };
      const sx = bw / 2, sy = bh - 3; start = [sx * 2, sy * 2 + 4];
      for (let w = 0; w < 5; w++) {
        let x = w ? rnd(4, bw - 4) : sx, y = w ? rnd(4, bh - 4) : sy, a = -Math.PI / 2 + (Math.random() - .5);
        for (let t = 0; t < bw * 1.6; t++) {
          dig(x, y, 2.2 + Math.random() * 2.2);
          a += (Math.random() - .5) * 0.9; x += Math.cos(a) * 1.2; y += Math.sin(a) * 1.2;
          if (x < 4 || x > bw - 4) { a = Math.PI - a; x = Math.max(4, Math.min(bw - 4, x)); }
          if (y < 4 || y > bh - 4) { a = -a; y = Math.max(4, Math.min(bh - 4, y)); }
        }
      }
    }
    // smooth the outline: a corner is inside when most of its neighbours are (twice)
    for (let pass = 0; pass < 2; pass++) {
      const nb = new Uint8Array(inBlk.length);
      for (let J = 0; J <= bh; J++) for (let I = 0; I <= bw; I++) {
        let c = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = I + a, y = J + b; if (x >= 0 && y >= 0 && x <= bw && y <= bh && inBlk[y * (bw + 1) + x]) c++; }
        nb[J * (bw + 1) + I] = c >= 5 ? 1 : 0;
      }
      inBlk.set(nb);
    }
    for (let J = 0; J <= bh; J++) for (let I = 0; I <= bw; I++) if (I < 2 || J < 2 || I > bw - 2 || J > bh - 2) inBlk[J * (bw + 1) + I] = 0; // keep off the map edge
    const C = (I, J) => I >= 0 && J >= 0 && I <= bw && J <= bh && inBlk[J * (bw + 1) + I];
    const inside = B.label('none');
    // block (I,J) has corners (I,J) (I+1,J) (I,J+1) (I+1,J+1); 4 or 2 in → whole, 3 in → half (cut by a diagonal)
    for (let J = 0; J < bh; J++) for (let I = 0; I < bw; I++) {
      const tl = C(I, J), tr = C(I + 1, J), bl = C(I, J + 1), br = C(I + 1, J + 1), n = tl + tr + bl + br;
      if (n < 2) continue;
      const x0 = 2 * I, y0 = 2 * J;
      let f;
      if (n === 4 || (n === 2 && !(tl && br) && !(tr && bl))) f = () => true;
      else if (n === 2) continue; // two opposite corners only: leave it out (no pinches)
      else if (!tl) f = (x, y) => (x - x0) + (y - y0) >= 2;
      else if (!tr) f = (x, y) => (x0 + 2 - x) + (y - y0) >= 2;
      else if (!bl) f = (x, y) => (x - x0) + (y0 + 2 - y) >= 2;
      else f = (x, y) => (x0 + 2 - x) + (y0 + 2 - y) >= 2;
      B.paint((x, y) => x >= x0 && x <= x0 + 2 && y >= y0 && y <= y0 + 2 && f(x, y), inside);
    }
    B.snap(); B.thin(); B.snap(); B.spikes();
    // keep the biggest connected piece of the cave
    B.pieces(); { let best = inside, ba = B.area(inside); for (let l = 1; l < B.next; l++) if (B.kinds[l] === 'none' && B.area(l) > ba) { ba = B.area(l); best = l; } for (let l = 1; l < B.next; l++) if (B.kinds[l] === 'none' && l !== best) B.paint(() => true, 0, [l]); B.paint(() => true, inside, [best]); }
    // ---- 2. chambers: octile Voronoi cells (walls straight or at 45°) ----
    const cells = []; for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) if (B.Q(x, y, 0) === inside) cells.push([x + .5, y + .5]);
    const area = cells.length, seeds = [];
    const want = Math.max(6, Math.round(area / 70));
    for (let t = 0; t < want * 30 && seeds.length < want; t++) {
      const [x, y] = cells[rnd(0, cells.length - 1)];
      const sx = 2 * Math.round(x / 2), sy = 2 * Math.round(y / 2); // even points: borders fall on grid lines and diagonals
      if (seeds.every(([a, b]) => Math.max(Math.abs(a - sx), Math.abs(b - sy)) >= 8)) seeds.push([sx, sy, B.label('room')]);
    }
    // chessboard distance: the border between two chambers is made of straight and 45° pieces only
    const oct = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy)) + 1e-3 * (Math.abs(dx) + Math.abs(dy));
    // a little stretch per seed: some chambers come out long (corridor stretches)
    for (const s of seeds) s[3] = [1, 1];
    B.paint(() => true, -1, [inside]); // mark the inside, then give every quarter to its nearest seed
    const C4 = W - 1, R4 = H - 1, QC = [[.5, 1 / 6], [5 / 6, .5], [.5, 5 / 6], [1 / 6, .5]];
    for (let y = 0; y < R4; y++) for (let x = 0; x < C4; x++) for (let k = 0; k < 4; k++) {
      const i = (y * C4 + x) * 4 + k; if (B.q[i] !== -1) continue;
      const px = x + QC[k][0], py = y + QC[k][1]; let best = 0, bd = 1e9;
      for (const s of seeds) { const d = oct((px - s[0]) * s[3][0], (py - s[1]) * s[3][1]); if (d < bd) { bd = d; best = s[2]; } }
      B.q[i] = best;
    }
    B.snap(); B.pieces();
    for (let l = 1; l < B.next; l++) { const a = B.area(l); if (a && a < 14 && B.kinds[l] === 'room') { /* tiny: join the neighbour */ const sh = new Map(); for (const s of B.segments()) { const o = s.a === l ? s.b : s.b === l ? s.a : -1; if (o > 0) sh.set(o, (sh.get(o) || 0) + 1); } const b = [...sh].sort((p, q) => q[1] - p[1])[0]; if (b) B.paint(() => true, b[0], [l]); } }
    B.snap(); B.thin(); B.snap(); B.spikes();
    // ---- 3. the way through ----
    let segs = B.segments();
    const deg = new Map(); for (const s of segs) for (const p of parseW(s.k)) { const v = vk(...p); deg.set(v, (deg.get(v) || 0) + 1); }
    const runs = B.runs(segs), doorOf = new Map(), adj = new Map();
    for (const [key, run] of runs) {
      const [a, b] = key.split(',').map(Number); if (!a || !b || run.length < 3) continue;
      const d = B.safeDoor(run, deg); if (!d) continue;
      doorOf.set(key, d);
      for (const [u, v] of [[a, b], [b, a]]) { if (!adj.has(u)) adj.set(u, []); adj.get(u).push(v); }
    }
    const rooms = [...adj.keys()];
    if (!rooms.length) return { size: W, rows: H, walls: segs.map(s => s.k), doors: [], columns: [], title: 'Cueva', desc: 'La cueva es muy chica.' };
    // entrance: the chamber nearest to the start point (bottom of the cave)
    const centre = new Map(); { const acc = new Map(); for (let y = 0; y < R4; y++) for (let x = 0; x < C4; x++) { const l = B.q[(y * C4 + x) * 4]; if (!l) continue; const a = acc.get(l) || [0, 0, 0]; a[0] += x; a[1] += y; a[2]++; acc.set(l, a); } for (const [l, a] of acc) centre.set(l, [a[0] / a[2], a[1] / a[2]]); }
    const sp = start || [W / 2, H];
    let ent = rooms[0]; for (const l of rooms) { const c = centre.get(l), e = centre.get(ent); if (c && Math.hypot(c[0] - sp[0], c[1] - sp[1]) < Math.hypot(e[0] - sp[0], e[1] - sp[1])) ent = l; }
    const key = (a, b) => Math.min(a, b) + ',' + Math.max(a, b);
    const open = new Set(), seen = new Set([ent]), stack = [ent], depth = new Map([[ent, 0]]);
    while (stack.length) { // depth-first: long, winding progress
      const u = stack[stack.length - 1];
      const opts = shuffle((adj.get(u) || []).filter(v => !seen.has(v)));
      if (!opts.length) { stack.pop(); continue; }
      const v = opts[0]; seen.add(v); open.add(key(u, v)); depth.set(v, depth.get(u) + 1); stack.push(v);
    }
    let goal = ent; for (const [l, d] of depth) if (d > depth.get(goal)) goal = l;
    // the main way: from the goal back to the entrance along the tree
    const parent = new Map(); { const q = [ent], pv = new Map([[ent, null]]); while (q.length) { const u = q.shift(); for (const v of adj.get(u) || []) if (!pv.has(v) && open.has(key(u, v))) { pv.set(v, u); q.push(v); } } for (const [k, v] of pv) parent.set(k, v); }
    const main = []; for (let l = goal; l !== null && l !== undefined; l = parent.get(l)) main.push(l); main.reverse();
    const onMain = new Set(main);
    // alternatives: some steps of the main way get a second door to a neighbour of the next step
    let alts = 0;
    const idx = new Map(main.map((l, i) => [l, i]));
    for (let i = 0; i < main.length - 2; i++) if (Math.random() < 0.45) {
      // from this step, a side door into a chamber that also opens 2–3 steps further on the way
      const u = main[i];
      // either straight into the step after next (two doors to choose from) …
      const skip = (adj.get(u) || []).find(x => idx.get(x) === i + 2 && !open.has(key(u, x)));
      if (skip !== undefined && Math.random() < 0.5) { open.add(key(u, skip)); alts++; i += 1; continue; }
      // … or through a side chamber that comes back 2–3 steps further on
      const opts = shuffle((adj.get(u) || []).filter(v => !onMain.has(v)));
      for (const v of opts) {
        const w = (adj.get(v) || []).find(x => idx.has(x) && idx.get(x) > i + 1 && idx.get(x) <= i + 3);
        if (w !== undefined) { open.add(key(u, v)); open.add(key(v, w)); alts++; i += 1; break; }
      }
    }
    // shortcuts: neighbours far apart along the way
    const bfs = s => { const d = new Map([[s, 0]]), q = [s]; while (q.length) { const u = q.shift(); for (const v of adj.get(u) || []) if (!d.has(v) && open.has(key(u, v))) { d.set(v, d.get(u) + 1); q.push(v); } } return d; };
    const cuts = [];
    for (let t = 0; t < 3; t++) {
      let best = null;
      for (const [k] of doorOf) if (!open.has(k)) { const [a, b] = k.split(',').map(Number); if (!seen.has(a) || !seen.has(b)) continue; const d = bfs(a).get(b) || 0; if (!best || d > best[1]) best = [k, d]; }
      if (!best || best[1] < 6) break; open.add(best[0]); cuts.push(best[1] - 1);
    }
    // chambers nobody reaches join a neighbour (no closed space)
    for (const l of rooms) if (!seen.has(l)) { const n2 = (adj.get(l) || []).find(o => seen.has(o)); if (n2) B.paint(() => true, n2, [l]); }
    B.snap(); segs = B.segments();
    const ws = new Set(segs.map(s => s.k)), doors = [];
    for (const k of open) { const d = doorOf.get(k); if (d && d.every(s => ws.has(s))) doors.push(...d); }
    // the way in: a door on the outer wall of the entrance chamber, the side nearest the start
    { const out = segs.filter(s => (s.a === ent || s.b === ent) && (!s.a || !s.b) && (s.d === 'h' || s.d === 'v'));
      const groups = new Map(); for (const s of out) { const g = s.d + s.line; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(s); }
      const best = [...groups.values()].sort((p, q) => q.length - p.length)[0];
      const deg2 = new Map(); for (const s of segs) for (const p of parseW(s.k)) { const v = vk(...p); deg2.set(v, (deg2.get(v) || 0) + 1); }
      if (best) { best.sort((p, q) => p.pos - q.pos); const d = B.safeDoor(best, deg2); if (d) doors.push(...d); } }
    const leaves = [...seen].filter(l => [...open].filter(k => k.split(',').map(Number).includes(l)).length === 1 && l !== ent && l !== goal).length;
    let floor = 0; for (const v of B.q) if (v) floor++;
    return {
      size: W, rows: H, walls: [...ws], doors: [...new Set(doors)], columns: [],
      title: cave ? 'Cueva por pasos (tu cueva)' : 'Cueva por pasos',
      desc: `Toda la cueva está partida en ${seen.size} cámaras con paredes rectas y diagonales (sin roca adentro: cada pared separa dos cámaras). ` +
        `Las cámaras largas funcionan como tramos de pasillo.\n• Camino principal: ${main.length} pasos desde la entrada (abajo) hasta la cámara más profunda (meta).\n` +
        `• ${alts} pasos con alternativa (dos puertas para seguir), ${leaves} cámaras sin salida (premios o enemigos), ${cuts.length} atajos (ahorran ${cuts.join(', ') || '0'} pasos).\n` +
        `• Piso usado: ${Math.round(100 * floor / B.q.length)}% del mapa; dentro de la cueva, todo.\n\nMarca con 🖍 los errores y explica abajo.`,
    };
  };
})();
