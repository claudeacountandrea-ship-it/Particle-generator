// Motor de ciudad: un derivado del generador de mazmorras (mazmorra_base.js) que usa su plantilla y la transforma:
// 1) simetría: una mitad del mapa se refleja sobre la otra (centro ordenado y simétrico);
// 2) escala ×2 por cuartos de celda (las diagonales siguen limpias): pasillos → pistas de 4, salas → casas grandes, jefe → plaza;
// 3) ensanche: las pistas crecen 1 celda hacia las casas (pistas de 6, doble vía con mediana en las rectas);
// 4) casas nuevas: cada casa se parte en cuartos según su orientación (recta o diagonal), con puerta a la calle, puertas
//    interiores y ventanas; los huecos grandes son parques, los chicos se vuelven calle;
// 5) plaza libre con reja y portones, entrada A en la muralla, ruta A → plaza y refugios en el camino.
// El modelo que devuelve lo exportan y dibujan CiudadDiagonal.toParts / CiudadDiagonal.draw.
(function (root) {
  'use strict';
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const CEN = [[0.5, 1 / 6], [5 / 6, 0.5], [0.5, 5 / 6], [1 / 6, 0.5]]; // centro de cada cuarto: N, E, S, O
  const quarterOf = (u, v) => { const dx = u - 0.5, dy = v - 0.5; return Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 0 : 2) : (dx > 0 ? 1 : 3); };
  const ROAD = 1, PLAZA = 2, VEREDA = 3, PASAJE = 4, RING = 5;
  const isSt = l => l === ROAD || l === VEREDA || l === PASAJE; // calzada, vereda o pasaje peatonal
  const BLOCK = new Set(['exterior', 'interior', 'medianera', 'muralla', 'reja', 'ventana', 'ruina']);

  function generate(o = {}) {
    const seed = (o.seed ?? 7) >>> 0, n = o.n ?? 16, F = o.escala ?? 3, ens = o.ensanche ?? 0;
    const old = Math.random; Math.random = rng(seed);
    let m; try { m = root.MazmorraBase.Halls(n, undefined, null, { central: true, rmin: 4, rmax: 8, round: true }); } finally { Math.random = old; }
    const R = rng(seed ^ 0x3c6ef372), chance = p => R() < p, rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
    const C0 = m.size - 1, R0 = m.rows - 1, q0 = m._q;
    const k0 = l => { const k = l ? m._kinds[l] : 'rock'; return k === 'gal' ? 'corr' : k === 'rock' || !k ? 'out' : k; };
    const markLab = v => { const c = new Map(); for (const [k, val] of Object.entries(m.marks)) if (val === v) { const [x, y] = k.split(',').map(Number); for (let i = 0; i < 4; i++) { const l = q0[(y * C0 + x) * 4 + i]; if (l) c.set(l, (c.get(l) || 0) + 1); } } let b = 0, bn = 0; for (const [l, k] of c) if (k > bn) { bn = k; b = l; } return b; };
    const bossL = markLab(4), startL = markLab(2);

    // 1) simetría: se queda la mitad con la entrada y se refleja (x → C0-1-x, E ↔ O)
    let src = q0;
    if (o.simetria === true) {
      let bl = 0, br = 0; for (let i = 0; i < q0.length; i++) if (q0[i] === bossL) ((i >> 2) % C0 < C0 / 2 ? bl++ : br++);
      const keepLeft = bl >= br, MIR = [0, 3, 2, 1]; // se conserva la mitad con más plaza
      src = new Int32Array(q0);
      for (let y = 0; y < R0; y++) for (let x = 0; x < C0; x++) {
        const xs = C0 - 1 - x; if (keepLeft ? x <= xs : x >= xs) continue;
        for (let k = 0; k < 4; k++) src[(y * C0 + x) * 4 + k] = q0[(y * C0 + xs) * 4 + MIR[k]];
      }
    }
    // 2) escala ×F por cuartos
    const C = C0 * F, Rr = R0 * F, W = C + 1, H = Rr + 1, NQ = C * Rr * 4;
    const orig = new Int32Array(NQ);
    for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) {
      const px = (x + CEN[k][0]) / F, py = (y + CEN[k][1]) / F, cx = Math.floor(px), cy = Math.floor(py);
      orig[(y * C + x) * 4 + k] = src[(cy * C0 + cx) * 4 + quarterOf(px - cx, py - cy)];
    }
    // tipo base de cada cuarto: 0 fuera, 1 calle, 2 plaza, 3 sala, 4 hueco
    let t = new Uint8Array(NQ);
    for (let i = 0; i < NQ; i++) { const l = orig[i], k = k0(l); t[i] = !l || k === 'out' ? 0 : l === bossL ? 2 : k === 'corr' || l === startL ? 1 : k === 'pillar' ? 4 : 3; }
    // contorno simétrico: solo la silueta de la ciudad se refleja; el interior queda libre
    if (o.contorno !== false) { const MIR = [0, 3, 2, 1], nt = new Uint8Array(t); for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) if (t[(y * C + C - 1 - x) * 4 + MIR[k]] === 0) nt[(y * C + x) * 4 + k] = 0; t = nt; }
    const typeAt = (tt, px, py) => { const cx = Math.floor(px), cy = Math.floor(py); if (cx < 0 || cy < 0 || cx >= C || cy >= Rr) return 0; return tt[(cy * C + cx) * 4 + quarterOf(px - cx, py - cy)]; };
    // 3) ensanche: la calle avanza `ens` celdas sobre casas y huecos
    const OFF = [-1, -0.5, 0, 0.5, 1];
    const dilate = zone => {
      const nt = new Uint8Array(t);
      for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) {
        const i = (y * C + x) * 4 + k; if ((t[i] !== 3 && t[i] !== 4) || (zone && !zone[y * C + x])) continue;
        // la forma se corre celdas enteras (el mismo cuarto en las 8 celdas vecinas): una diagonal limpia sigue limpia
        grow: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < C && ny < Rr && t[(ny * C + nx) * 4 + k] === 1) { nt[i] = 1; break grow; } }
      }
      t = nt;
    };
    for (let pass = 0; pass < ens; pass++) dilate(null);
    // componentes conexas por tipo (cuartos vecinos del mismo tipo)
    const nb = (i, f) => { const c = i >> 2, k = i & 3, x = c % C, y = (c / C) | 0;
      if (k === 0) { f(i + 1); f(i + 3); if (y > 0) f(((y - 1) * C + x) * 4 + 2); }
      else if (k === 1) { f(i - 1); f(i + 1); if (x < C - 1) f((y * C + x + 1) * 4 + 3); }
      else if (k === 2) { f(i - 1); f(i + 1); if (y < Rr - 1) f(((y + 1) * C + x) * 4); }
      else { f(i - 3); f(i - 1); if (x > 0) f((y * C + x - 1) * 4 + 1); } };
    const comps = (same) => { const id = new Int32Array(NQ).fill(-1), list = []; for (let s = 0; s < NQ; s++) { if (id[s] >= 0 || !same(s, s)) continue; const cid = list.length, st = [s], mem = []; id[s] = cid;
      while (st.length) { const i = st.pop(); mem.push(i); nb(i, j => { if (id[j] < 0 && same(i, j)) { id[j] = cid; st.push(j); } }); } list.push(mem); } return { id, list }; };
    // casas chicas y huecos chicos se vuelven calle; huecos grandes, parques
    { const { list } = comps((i, j) => (t[i] === 3 || t[i] === 4) && t[j] === t[i] && orig[j] === orig[i]);
      for (const mem of list) { const a = mem.length / 4, tp = t[mem[0]]; if ((tp === 3 && a < 60) || (tp === 4 && a < 80)) for (const i of mem) t[i] = 1; } }
    // calles sueltas: se unen a la red principal abriendo un paso de 2 celdas (nada queda encerrado)
    for (let it = 0; it < 40; it++) {
      const isR = i => t[i] === 1 || t[i] === 2, { id, list } = comps((i, j) => isR(i) && isR(j));
      if (list.length <= 1) break;
      let main = 0; list.forEach((l, k) => { if (l.length > list[main].length) main = k; });
      const cellComp = new Int32Array(C * Rr).fill(-1); for (let i = 0; i < NQ; i++) if (id[i] >= 0 && (cellComp[i >> 2] < 0 || id[i] === main)) cellComp[i >> 2] = id[i];
      const prev = new Int32Array(C * Rr).fill(-2), qq = []; for (let c = 0; c < C * Rr; c++) if (cellComp[c] === main) { prev[c] = -1; qq.push(c); }
      let hit = -1;
      for (let h2 = 0; h2 < qq.length && hit < 0; h2++) { const c = qq[h2], x = c % C, y = (c / C) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (prev[j] !== -2) continue;
          if ([0, 1, 2, 3].some(k => t[j * 4 + k] === 0)) continue; prev[j] = c; if (cellComp[j] >= 0 && cellComp[j] !== main) { hit = j; break; } qq.push(j); } }
      if (hit < 0) { list.forEach((l, k) => { if (k !== main) for (const i of l) if (t[i] === 1) t[i] = 4; }); break; }
      for (let c = hit; c >= 0; c = prev[c]) { const x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const nx = x + dx, ny = y + dy; if (nx < C && ny < Rr) for (let k = 0; k < 4; k++) { const i = (ny * C + nx) * 4 + k; if (t[i] === 3 || t[i] === 4) t[i] = 1; } } }
    }
    // jerarquía de calles (como una ciudad que creció sola pero funciona): avenidas desde la muralla hasta la plaza,
    // más anchas y con mediana; el resto son calles de 4
    let nAv = 0;
    { const isRd = c => [0, 1, 2, 3].every(k => t[c * 4 + k] === 1 || t[c * 4 + k] === 2), hasT = (c, v) => [0, 1, 2, 3].some(k => t[c * 4 + k] === v);
      const dist = new Int32Array(C * Rr).fill(-1), prev = new Int32Array(C * Rr).fill(-1), qq = [];
      for (let c = 0; c < C * Rr; c++) if (hasT(c, 2)) { dist[c] = 0; qq.push(c); }
      for (let h2 = 0; h2 < qq.length; h2++) { const c = qq[h2], x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (dist[j] < 0 && isRd(j)) { dist[j] = dist[c] + 1; prev[j] = c; qq.push(j); } } }
      const border = []; for (let c = 0; c < C * Rr; c++) if (dist[c] > 0) { const x = c % C, y = (c / C) | 0; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx >= C || ny >= Rr || hasT(ny * C + nx, 0); })) border.push(c); }
      const chosen = [], want = n >= 14 ? 4 : 3;
      while (chosen.length < want && border.length) {
        let best = -1, bs = -1; for (const c of border) { const sep = chosen.length ? Math.min(...chosen.map(o2 => Math.hypot(c % C - o2 % C, ((c / C) | 0) - ((o2 / C) | 0)))) : 1e9; const sc2 = Math.min(sep, 1e6) * 2 + dist[c]; if (sep > Math.min(C, Rr) / 4 && sc2 > bs) { bs = sc2; best = c; } }
        if (best < 0) break; chosen.push(best);
      }
      const zone = new Uint8Array(C * Rr);
      for (const c0 of chosen) { nAv++; for (let c = c0; c >= 0 && dist[c] > 0; c = prev[c]) { const x = c % C, y = (c / C) | 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < C && ny < Rr) zone[ny * C + nx] = 1; } } }
      dilate(zone); dilate(zone);
    }
    // chaflán: las esquinas de 90° de las manzanas se biselan (ninguna esquina en ángulo recto, como en la mazmorra)
    for (let pass = 0; pass < 2; pass++) {
      const full = (c, v) => [0, 1, 2, 3].every(k => (t[c * 4 + k] === 3 || t[c * 4 + k] === 4) === v);
      const cellAt = (x, y) => x < 0 || y < 0 || x >= C || y >= Rr ? -1 : y * C + x, nt = new Uint8Array(t);
      for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) {
        const c = y * C + x;
        for (const [dx, dy, ks] of [[-1, -1, [0, 3]], [1, -1, [0, 1]], [-1, 1, [2, 3]], [1, 1, [1, 2]]]) {
          const a2 = cellAt(x + dx, y), b2 = cellAt(x, y + dy), d2 = cellAt(x + dx, y + dy); if (a2 < 0 || b2 < 0 || d2 < 0) continue;
          const roadish = cc => [0, 1, 2, 3].every(k => t[cc * 4 + k] === 1 || t[cc * 4 + k] === 2);
          if (full(c, true) && roadish(a2) && roadish(b2) && roadish(d2)) for (const k of ks) nt[c * 4 + k] = 1; // esquina saliente de la manzana
          else if (roadish(c) && full(a2, true) && full(b2, true) && full(d2, true) && orig[a2 * 4] === orig[b2 * 4]) for (const k of ks) { nt[c * 4 + k] = t[a2 * 4]; orig[c * 4 + k] = orig[a2 * 4]; } // esquina entrante
        }
      }
      t = nt;
    }
    // crecer una máscara celdas enteras (el mismo cuarto en las 8 vecinas): las diagonales siguen limpias
    const grow = (mask, steps) => { let cur = mask; for (let s2 = 0; s2 < steps; s2++) { const nx = new Uint8Array(cur); for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) { const i = (y * C + x) * 4 + k; if (cur[i]) continue; g: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < C && yy < Rr && cur[(yy * C + xx) * 4 + k]) { nx[i] = 1; break g; } } } cur = nx; } return cur; };
    // la plaza siempre rodeada de césped (2) y después de pista (6)
    { const P = t.map(v => v === 2 ? 1 : 0), g2 = grow(P, 2), r8 = grow(g2, 6);
      for (let i = 0; i < NQ; i++) { if (t[i] === 0 || P[i]) continue; if (g2[i]) t[i] = 5; else if (r8[i]) t[i] = 1; }
      const { list } = comps((i, j) => (t[i] === 3 || t[i] === 4) && t[j] === t[i] && orig[j] === orig[i]);
      for (const mem of list) if (mem.length / 4 < 60) for (const i of mem) t[i] = 1; }
    // las calles de menos de 3 de ancho no son pista: son pasajes peatonales (personas y bicis)
    { const full = c => [0, 1, 2, 3].every(k => t[c * 4 + k] === 1 || t[c * 4 + k] === 0), core = new Uint8Array(NQ); // el campo cuenta como abierto
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) { let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!full((y + dy) * C + x + dx)) { ok = false; break; } if (ok) for (let k = 0; k < 4; k++) core[(y * C + x) * 4 + k] = 1; }
      const wide = grow(core, 1); for (let i = 0; i < NQ; i++) if (t[i] === 1 && !wide[i]) t[i] = 6; }
    // veredas: la franja de calle pegada a manzanas, parques y césped
    { const B = t.map(v => v === 3 || v === 4 || v === 5 ? 1 : 0), V = grow(B, 1); for (let i = 0; i < NQ; i++) if (t[i] === 1 && V[i]) t[i] = 7; }
    // etiquetas finales: calzada, plaza, vereda, pasaje, césped de la plaza; parques; manzanas en lotes con casa y patio
    const q = new Int32Array(NQ), kinds = ['out', 'corr', 'plaza', 'vereda', 'pasaje', 'parque'], houseOfL = [0, 0, 0, 0, 0, 0], houses = new Map();
    for (let i = 0; i < NQ; i++) q[i] = t[i] === 1 ? ROAD : t[i] === 2 ? PLAZA : t[i] === 7 ? VEREDA : t[i] === 6 ? PASAJE : t[i] === 5 ? RING : 0;
    const { list: blocks } = comps((i, j) => (t[i] === 3 || t[i] === 4) && t[j] === t[i] && orig[j] === orig[i]);
    const centerOf = mem => { let sx = 0, sy = 0; for (const i of mem) { const c = i >> 2; sx += c % C + CEN[i & 3][0]; sy += ((c / C) | 0) + CEN[i & 3][1]; } return [sx / mem.length, sy / mem.length]; };
    // zonas como en una ciudad: comercio y oficinas junto a la plaza, condominios en el anillo medio, suburbio afuera
    let pcx = C / 2, pcy = Rr / 2; { let sx = 0, sy = 0, sn = 0; for (let i = 0; i < NQ; i++) if (t[i] === 2) { const c = i >> 2; sx += c % C; sy += (c / C) | 0; sn++; } if (sn) { pcx = sx / sn; pcy = sy / sn; } }
    const rMax = Math.hypot(C, Rr) / 2;
    const zoneOf = (cx, cy) => { const r = Math.hypot(cx - pcx, cy - pcy) / rMax; return r < 0.33 ? 'centro' : r < 0.58 ? 'medio' : 'suburbio'; };
    const frameOf = mem => { let d = 0, a = 0; for (const i of mem) nb(i, j => { if (!(t[j] === t[i] && orig[j] === orig[i])) (i >> 2) === (j >> 2) ? d++ : a++; }); return d * 1.41 > a; };
    // un corte recto (o diagonal) cerca del medio del lado más largo. Regla de vértices de la mazmorra: el corte termina en "T"
    // contra una pared recta perpendicular en sus dos puntas (nunca a 45°: sin filos), y dos diagonales nunca se cruzan en una celda
    const mk = new Int32Array(NQ); let stamp = 0;
    const inQ = (x, y, k) => x >= 0 && y >= 0 && x < C && y < Rr && mk[(y * C + x) * 4 + k] === stamp;
    const all4 = (x, y, ks, v) => ks.every(k => inQ(x, y, k) === v);
    const endsOK = (diag, ax, c, xs0, xs1, ys0, ys1) => {
      if (!diag && ax === 0) { const ys = []; for (let y = ys0; y <= ys1; y++) if (inQ(c - 1, y, 1) && inQ(c, y, 3)) ys.push(y); if (!ys.length) return false; const yt = ys[0], yb = ys[ys.length - 1];
        return [c - 1, c].every(x => all4(x, yt, [0, 1, 2, 3], true) && all4(x, yt - 1, [0, 1, 2, 3], false) && all4(x, yb, [0, 1, 2, 3], true) && all4(x, yb + 1, [0, 1, 2, 3], false)); }
      if (!diag) { const xs = []; for (let x = xs0; x <= xs1; x++) if (inQ(x, c - 1, 2) && inQ(x, c, 0)) xs.push(x); if (!xs.length) return false; const xl = xs[0], xr = xs[xs.length - 1];
        return [c - 1, c].every(y => all4(xl, y, [0, 1, 2, 3], true) && all4(xl - 1, y, [0, 1, 2, 3], false) && all4(xr, y, [0, 1, 2, 3], true) && all4(xr + 1, y, [0, 1, 2, 3], false)); }
      const cells = []; for (let x = xs0; x <= xs1; x++) { const y = ax === 0 ? c - 1 - x : x - c; if (inQ(x, y, 0) && inQ(x, y, 2)) cells.push([x, y]); } if (!cells.length) return false;
      const [xs, ysA] = cells[0], [xe, ye] = cells[cells.length - 1];
      if (ax === 0) return all4(xe, ye - 1, [2, 3], true) && all4(xe, ye - 1, [0, 1], false) && all4(xe + 1, ye, [2, 3], true) && all4(xe + 1, ye, [0, 1], false)
        && all4(xs - 1, ysA, [0, 1], true) && all4(xs - 1, ysA, [2, 3], false) && all4(xs, ysA + 1, [0, 1], true) && all4(xs, ysA + 1, [2, 3], false);
      return all4(xe + 1, ye, [0, 3], true) && all4(xe + 1, ye, [1, 2], false) && all4(xe, ye + 1, [0, 3], true) && all4(xe, ye + 1, [1, 2], false)
        && all4(xs - 1, ysA, [1, 2], true) && all4(xs - 1, ysA, [0, 3], false) && all4(xs, ysA - 1, [1, 2], true) && all4(xs, ysA - 1, [0, 3], false);
    };
    const cut = (set, minA, diag, minT) => {
      stamp++; let xs0 = 1e9, xs1 = -1, ys0 = 1e9, ys1 = -1;
      for (const i of set) { mk[i] = stamp; const c = i >> 2, x = c % C, y = (c / C) | 0; if (x < xs0) xs0 = x; if (x > xs1) xs1 = x; if (y < ys0) ys0 = y; if (y > ys1) ys1 = y; }
      const fr = set.map(i => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return diag ? [px + py, px - py] : [px, py]; });
      const sc = diag ? Math.SQRT1_2 : 1, ext = [0, 1].map(ax => { let lo = 1e9, hi = -1e9; for (const f of fr) { if (f[ax] < lo) lo = f[ax]; if (f[ax] > hi) hi = f[ax]; } return [Math.floor(lo), Math.ceil(hi)]; }); // bordes de la forma, no centros
      for (const ax of [0, 1].sort((p, r2) => (ext[r2][1] - ext[r2][0]) - (ext[p][1] - ext[p][0]))) {
        const [lo, hi] = ext[ax]; if ((hi - lo) * sc < 2 * minT) continue;
        const mid = (lo + hi) / 2, cs = [];
        for (let c = Math.ceil(lo); c <= hi; c++) if ((c - lo) * sc >= minT && (hi - c) * sc >= minT) cs.push(c);
        cs.sort((p, r2) => Math.abs(p - mid) - Math.abs(r2 - mid) + (R() - 0.5) * 3);
        for (const c of cs) {
          if (!endsOK(diag, ax, c, xs0 - 1, xs1 + 1, ys0 - 1, ys1 + 1)) continue;
          const A2 = [], B2 = []; set.forEach((i, k) => (fr[k][ax] < c ? A2 : B2).push(i));
          if (A2.length / 4 >= minA && B2.length / 4 >= minA) return [A2, B2];
        }
      }
      return null;
    };
    // corte paralelo a la calle para separar casa y patio: busca una posición válida cerca de la profundidad pedida
    const cutAtDepth = (set, diag, ax, want, fromLo) => {
      stamp++; let xs0 = 1e9, xs1 = -1, ys0 = 1e9, ys1 = -1;
      for (const i of set) { mk[i] = stamp; const c = i >> 2, x = c % C, y = (c / C) | 0; if (x < xs0) xs0 = x; if (x > xs1) xs1 = x; if (y < ys0) ys0 = y; if (y > ys1) ys1 = y; }
      for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5]) { const c = want + d; if (endsOK(diag, ax, c, xs0 - 1, xs1 + 1, ys0 - 1, ys1 + 1)) return c; }
      return null;
    };
    const bspLeaves = (set, minA, diag, minT) => { const out = []; const rec = (s, d) => { const r = s.length / 4 >= 2 * minA && d < 10 ? cut(s, minA, diag, minT) || cut(s, minA, !diag, minT) : null; if (!r) out.push(s); else { rec(r[0], d + 1); rec(r[1], d + 1); } }; rec(set, 0); return out; };
    const splitN = (set, nR, minA, diag) => { const lv = [set], stuck = new Set(); while (lv.length < nR) { let bi = -1; lv.forEach((s, k) => { if (!stuck.has(s) && (bi < 0 || s.length > lv[bi].length)) bi = k; }); if (bi < 0) break; const r = cut(lv[bi], minA, diag, 4) || cut(lv[bi], minA, !diag, 4); if (!r) stuck.add(lv[bi]); else lv.splice(bi, 1, r[0], r[1]); } return lv; };
    // centro comercial en "pesa" (dumbbell): un ancla en cada punta, pasillo central con locales enfrentados a los dos lados
    // y un pasaje en el medio que lleva a la calle por ambos lados; simétrico respecto al pasillo
    const mallLayout = (mem, diag) => {
      const fr = mem.map(i => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return diag ? [px + py, px - py] : [px, py]; });
      const sc = diag ? Math.SQRT1_2 : 1, ext = [0, 1].map(ax => { let lo = 1e9, hi = -1e9; for (const f of fr) { if (f[ax] < lo) lo = f[ax]; if (f[ax] > hi) hi = f[ax]; } return [lo, hi]; });
      const L = (ext[0][1] - ext[0][0]) >= (ext[1][1] - ext[1][0]) ? 0 : 1, P = 1 - L, [l0, l1] = ext[L], [p0, p1] = ext[P];
      if ((l1 - l0) * sc < 30 || (p1 - p0) * sc < 18) return null; // nunca un centro comercial delgado
      const pm = Math.round((p0 + p1) / 2), half = 2 / sc, anc = Math.max(6, (l1 - l0) * sc * 0.2) / sc, aL = l0 + anc, aR = l1 - anc;
      const shopW = rnd(5, 6) / sc, nS = Math.max(1, Math.floor((aR - aL) / shopW)), mid = nS >> 1, g = new Map();
      mem.forEach((i, k) => { const f = fr[k]; let key;
        if (f[L] < aL) key = 'ancla0'; else if (f[L] > aR) key = 'ancla1'; else if (Math.abs(f[P] - pm) < half) key = 'pasillo';
        else { const si = Math.min(nS - 1, Math.floor((f[L] - aL) / shopW)); key = si === mid ? 'pasillo' : (f[P] < pm ? 'a' : 'b') + si; }
        if (!g.has(key)) g.set(key, []); g.get(key).push(i); });
      return { rooms: [...g.values()], hub: [...g.keys()].indexOf('pasillo') };
    };
    const newLabel = (kind, hid) => { kinds.push(kind); houseOfL.push(hid); return kinds.length - 1; };
    const roadNb = i => { let r = false; nb(i, j => { if (t[j] === 1 || t[j] === 6 || t[j] === 7) r = true; }); return r; };
    const erode = (set, steps) => { let cur = set; for (let s2 = 0; s2 < steps; s2++) { stamp++; for (const i of cur) mk[i] = stamp; cur = cur.filter(i => { const c = i >> 2, k = i & 3, x = c % C, y = (c / C) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inQ(x + dx, y + dy, k)) return false; return true; }); } return cur; };
    let nextH = 1, nMalls = 0;
    const addHouse = (type, zone, rooms, patio, hub = -1) => {
      const hid = nextH++, all = rooms.flat(), [hx, hy] = centerOf(all), h = { id: hid, type, zone, cx: hx, cy: hy, area: all.length / 4, rooms: new Set(), patio: 0, refuge: false };
      houses.set(hid, h);
      for (const r of rooms) { const l = newLabel('room', hid); h.rooms.add(l); for (const i of r) q[i] = l; }
      if (patio && patio.length) { const l = newLabel('patio', hid); h.patio = l; for (const i of patio) q[i] = l; }
      if (hub >= 0) h.hub = [...h.rooms][hub];
      return h;
    };
    const bz = blocks.filter(b => t[b[0]] === 3).map(b => ({ b, zone: zoneOf(...centerOf(b)) }));
    const forcedMall = bz.filter(x => x.zone !== 'suburbio').sort((p, r2) => r2.b.length - p.b.length)[0]?.b;
    for (const mem of blocks) {
      if (t[mem[0]] === 4) { const l = newLabel('parque', 0); for (const i of mem) q[i] = l; continue; }
      const area = mem.length / 4, zone = zoneOf(...centerOf(mem)), diag = frameOf(mem);
      if (mem === forcedMall || (zone === 'centro' && area > 700 && nMalls < 3 && chance(0.5))) { const ml = mallLayout(mem, diag); if (ml) { addHouse('comercial', zone, ml.rooms, null, ml.hub); nMalls++; continue; } }
      if (zone === 'suburbio' && area > 420 && chance(0.2)) { addHouse('almacen', zone, splitN(mem, rnd(2, 3), area / 4, diag), null); continue; }
      const lotMin = zone === 'centro' ? 70 : zone === 'medio' ? 130 : 105;
      const front = [], orphan = [];
      for (const lot of bspLeaves(mem, lotMin, diag, 5)) (lot.some(roadNb) ? front : orphan).push(lot);
      if (!front.length) front.push(...orphan.splice(0));
      // lotes sin calle: se suman como patio al lote vecino (o quedan como jardín interior)
      const lotIdx = new Map(); front.forEach((lot, k) => lot.forEach(i => lotIdx.set(i, k)));
      const extra = front.map(() => []);
      for (const lot of orphan) { const cnt = new Map(); for (const i of lot) nb(i, j => { const k = lotIdx.get(j); if (k !== undefined) cnt.set(k, (cnt.get(k) || 0) + 1); }); let bk = -1, bn = 0; for (const [k, c2] of cnt) if (c2 > bn) { bn = c2; bk = k; }
        if (bk >= 0) extra[bk].push(...lot); else { const l = newLabel('parque', 0); for (const i of lot) q[i] = l; } }
      front.forEach((lot, k) => {
        const type = zone === 'centro' ? (chance(0.75) ? 'tienda' : 'oficinas') : zone === 'medio' ? (chance(0.6) ? 'condominio' : 'casa') : 'casa';
        let nR = type === 'casa' ? rnd(3, 7) : type === 'condominio' ? rnd(5, 7) : type === 'tienda' ? rnd(2, 4) : rnd(4, 6);
        const per = type === 'casa' ? rnd(14, 20) : rnd(16, 22); // área de cada cuarto (celdas), pareja dentro de la casa
        // casa suelta (rodeada de su jardín) o adosada (comparte pared con las vecinas)
        const style = (type === 'casa' || type === 'condominio') && chance(zone === 'suburbio' ? 0.55 : zone === 'medio' ? 0.3 : 0) ? 'suelta' : 'adosada';
        let house = [], yard = [];
        if (style === 'suelta') for (const e of [2, 1]) { const core = erode(lot, e); if (core.length / 4 < 3 * 14) continue; const n2 = Math.max(3, Math.min(nR, Math.floor(core.length / 4 / 14))); if (splitN(core, n2, 12, diag).length < 3) continue; const inC = new Set(core); house = core; yard = lot.filter(i => !inC.has(i)); nR = n2; break; }
        if (!house.length) {
        // la casa al frente y el patio de césped atrás, separados por un corte paralelo a la calle
        const fr = lot.map(i => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return diag ? [px + py, px - py] : [px, py]; });
        const sc = diag ? Math.SQRT1_2 : 1, rd = lot.map(roadNb), ax = (() => { let best = 0, bv = -1; for (const a2 of [0, 1]) { let lo = 1e9, hi = -1e9, sr = 0, nr = 0; fr.forEach((f, k) => { lo = Math.min(lo, f[a2]); hi = Math.max(hi, f[a2]); if (rd[k]) { sr += f[a2]; nr++; } }); const m2 = nr ? sr / nr : (lo + hi) / 2, v = Math.max(m2 - lo, hi - m2) / (hi - lo + 1e-9); if (v > bv) { bv = v; best = a2; } } return best; })();
        let lo = 1e9, hi = -1e9, sr = 0, nr = 0; fr.forEach((f, k) => { lo = Math.min(lo, f[ax]); hi = Math.max(hi, f[ax]); if (rd[k]) { sr += f[ax]; nr++; } });
        const fromLo = (nr ? sr / nr : lo) - lo < hi - (nr ? sr / nr : hi), depthWant = Math.max(8, nR * per / Math.max(4, lot.length / 4 / ((hi - lo) * sc + 1)));
        const cutAt = cutAtDepth(lot, diag, ax, Math.round(fromLo ? lo + depthWant / sc : hi - depthWant / sc), fromLo);
        if (cutAt == null) house = lot; else lot.forEach((i, k) => ((fromLo ? fr[k][ax] < cutAt : fr[k][ax] > cutAt) ? house : yard).push(i));
        if (cutAt != null && Math.min(fromLo ? hi - cutAt : cutAt - lo, fromLo ? cutAt - lo : hi - cutAt) * sc < 4) { house = lot; yard = []; }
        if (type === 'tienda' || type === 'oficinas' || yard.length / 4 < 16 || house.length / 4 < 16) { house = lot; yard = []; }
        }
        yard.push(...extra[k]);
        const lvs = splitN(house, nR, type === 'condominio' ? 16 : 12, diag);
        // cuartos parejos: el que pase del máximo se vuelve a partir
        for (let guard = 0; guard < 6; guard++) { const bi = lvs.findIndex(s2 => s2.length / 4 > per * 1.6); if (bi < 0) break; const r = cut(lvs[bi], 12, diag, 4) || cut(lvs[bi], 12, !diag, 4); if (!r) break; lvs.splice(bi, 1, r[0], r[1]); }
        addHouse(type, zone, lvs, yard).style = style;
      });
    }
    // pedazos sueltos de un cuarto (casas en L): si son chicos se suman al cuarto vecino de la misma casa
    { const { list } = comps((i, j) => q[i] > PLAZA && kinds[q[i]] === 'room' && q[j] === q[i]); const seen = new Map();
      for (const mem of list.sort((a, b) => b.length - a.length)) { const l = q[mem[0]]; if (!seen.has(l)) { seen.set(l, 1); continue; }
        const cnt = new Map(); for (const i of mem) nb(i, j => { const lj = q[j]; if (lj !== l && kinds[lj] === 'room' && houseOfL[lj] === houseOfL[l]) cnt.set(lj, (cnt.get(lj) || 0) + 1); });
        let best = 0, bn = 0; for (const [lj, c] of cnt) if (c > bn) { bn = c; best = lj; }
        if (best) for (const i of mem) q[i] = best; else { const nl = kinds.length; kinds.push('room'); houseOfL.push(houseOfL[l]); houses.get(houseOfL[l]).rooms.add(nl); for (const i of mem) q[i] = nl; } } }
    { const present = new Set(q); for (const h of houses.values()) for (const l of [...h.rooms]) if (!present.has(l)) h.rooms.delete(l); }
    // una casa de un solo cuarto (forma rara) se suma como anexo a la casa vecina con la que comparte la pared más larga
    { const qOf = new Map(); for (let i = 0; i < NQ; i++) { const l = q[i]; if (kinds[l] === 'room') { if (!qOf.has(l)) qOf.set(l, []); qOf.get(l).push(i); } }
      for (const h of [...houses.values()]) {
        if (h.rooms.size !== 1 || h.type === 'tienda' || h.type === 'comercial' || h.type === 'almacen') continue;
        const l = [...h.rooms][0], cnt = new Map();
        for (const i of qOf.get(l) || []) nb(i, j => { const lj = q[j]; if (kinds[lj] === 'room' && houseOfL[lj] !== h.id) { const hh = houseOfL[lj]; cnt.set(hh, (cnt.get(hh) || 0) + 1); } });
        let bh = 0, bn = 0; for (const [hh, c2] of cnt) if (c2 > bn && houses.get(hh) && houses.get(hh).type !== 'comercial') { bn = c2; bh = hh; }
        if (!bh) continue;
        houseOfL[l] = bh; houses.get(bh).rooms.add(l);
        if (h.patio) { houseOfL[h.patio] = bh; if (!houses.get(bh).patio) houses.get(bh).patio = h.patio; else for (const i of qOf.get(h.patio) || []) q[i] = houses.get(bh).patio; }
        houses.delete(h.id);
      } }
    // ingeniería vial: se derriban casas que obligan a dar un rodeo largo; su lugar pasa a ser calle nueva
    let nDemol = 0;
    { const roadCell = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) for (let k = 0; k < 4; k++) if (isSt(q[c * 4 + k])) roadCell[c] = 1;
      const maxD = o.derribos ?? Math.max(2, Math.round(n / 4));
      for (const h of [...houses.values()].sort(() => R() - 0.5)) {
        if (nDemol >= maxD || h.area > 170 || h.type === 'comercial') continue;
        const mine = new Set(); for (let i = 0; i < NQ; i++) if (h.rooms.has(q[i]) || (h.patio && q[i] === h.patio)) mine.add(i >> 2);
        const edge = []; for (const c of mine) { const x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < C && ny < Rr && roadCell[ny * C + nx] && !mine.has(ny * C + nx)) edge.push(ny * C + nx); } }
        if (edge.length < 4) continue;
        let a = edge[0], b = edge[0], e = 0; for (const p of edge) for (const r2 of edge) { const d = Math.hypot(p % C - r2 % C, ((p / C) | 0) - ((r2 / C) | 0)); if (d > e) { e = d; a = p; b = r2; } }
        const dist = new Int32Array(C * Rr).fill(-1), qq = [a]; dist[a] = 0;
        for (let hd = 0; hd < qq.length && dist[b] < 0; hd++) { const c = qq[hd], x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (dist[j] < 0 && roadCell[j]) { dist[j] = dist[c] + 1; qq.push(j); } } }
        if (dist[b] >= 0 && dist[b] < 3.5 * e) continue;
        for (let i = 0; i < NQ; i++) if (h.rooms.has(q[i]) || (h.patio && q[i] === h.patio)) { q[i] = ROAD; roadCell[i >> 2] = 1; }
        houses.delete(h.id); nDemol++;
      }
    }

    // 5) bordes desde las etiquetas: rectos y diagonales
    const kindOf = l => kinds[l] || 'out', houseOf = l => houseOfL[l] || 0;
    const Q = (x, y, k) => (x < 0 || y < 0 || x >= C || y >= Rr) ? 0 : q[(y * C + x) * 4 + k];
    let segs = [], segMap = new Map();
    const classOf = (a, b) => {
      const ka = kindOf(a), kb = kindOf(b), ks = [ka, kb].sort().join('|');
      const ST = k => k === 'corr' || k === 'vereda' || k === 'pasaje';
      if (ka === 'out' || kb === 'out') { const ko = ka === 'out' ? kb : ka; return ko === 'room' ? 'exterior' : ko === 'patio' || ko === 'parque' || ko === 'plaza' ? 'reja' : null; } // sin muralla: la ciudad se abre al campo
      if (ST(ka) && ST(kb)) return (ka === 'corr' || kb === 'corr') && (ka === 'vereda' || kb === 'vereda') ? 'bordillo' : null;
      if ((ka === 'plaza' && kb === 'parque') || (kb === 'plaza' && ka === 'parque')) return null; // el césped se abre a la plaza
      if (ka === 'patio' || kb === 'patio') { const [p, ot, ko] = ka === 'patio' ? [a, b, kb] : [b, a, ka]; return ko === 'room' ? (houseOf(ot) === houseOf(p) ? 'exterior' : 'medianera') : 'reja'; }
      if (ks === 'room|room') return houseOf(a) === houseOf(b) ? 'interior' : 'medianera';
      if (ka === 'room' || kb === 'room') return 'exterior';
      return 'reja'; // calle con plaza o parque
    };
    const addSeg = (key, a, b, dir, line, pos, L1, L2) => { const cls = classOf(L1, L2); if (!cls) return; const s = { a, b, dir, line, pos, L1, L2, cls }; segs.push(s); segMap.set(key, s); };
    const build = () => {
      segs = []; segMap = new Map();
      for (let y = 0; y <= Rr; y++) for (let x = 0; x < C; x++) { const a = Q(x, y - 1, 2), b = Q(x, y, 0); if (a !== b) addSeg('h' + x + ',' + y, [x, y], [x + 1, y], 'h', y, x, a, b); }
      for (let y = 0; y < Rr; y++) for (let x = 0; x <= C; x++) { const a = Q(x - 1, y, 1), b = Q(x, y, 3); if (a !== b) addSeg('v' + x + ',' + y, [x, y], [x, y + 1], 'v', x, y, a, b); }
      for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) {
        const N = Q(x, y, 0), E = Q(x, y, 1), S = Q(x, y, 2), O = Q(x, y, 3);
        if (N !== O || E !== S) addSeg('d1' + x + ',' + y, [x, y], [x + 1, y + 1], 'd1', x - y, x, N !== O ? N : E, N !== O ? O : S);
        if (N !== E || O !== S) addSeg('d2' + x + ',' + y, [x + 1, y], [x, y + 1], 'd2', x + y, x, N !== E ? N : O, N !== E ? E : S);
      }
    };
    // reparación con las reglas de la mazmorra: si un filo (45°), una esquina de 90° o un cruce de diagonales lo causa una
    // pared entre dos cuartos, esos cuartos se juntan (sin pared no hay falla)
    let nMerge = 0, nFixX = 0, nFixW = 0;
    // regla de la rejilla de vértices: una celda es entera, o partida por UNA diagonal completa (nunca media, nunca en X)
    const normalize = () => {
      let changed = 0;
      for (let c = 0; c < C * Rr; c++) {
        const i = c * 4, N = q[i], E = q[i + 1], S = q[i + 2], O = q[i + 3];
        if ((N === E && E === S && S === O) || (N === E && S === O && N !== S) || (N === O && S === E && N !== S)) continue;
        let best = null, bc = 9;
        const tryP = (p, cost) => { if (cost < bc) { bc = cost; best = p; } };
        for (const a of [N, E]) for (const b of [S, O]) tryP([a, a, b, b], (N !== a) + (E !== a) + (S !== b) + (O !== b) - 0.1); // d1: N,E | S,O
        for (const a of [N, O]) for (const b of [S, E]) tryP([a, b, b, a], (N !== a) + (O !== a) + (S !== b) + (E !== b) - 0.1); // d2: N,O | S,E
        for (const a of [N, E, S, O]) tryP([a, a, a, a], (N !== a) + (E !== a) + (S !== a) + (O !== a));
        for (let k = 0; k < 4; k++) q[i + k] = best[k]; changed++;
      }
      return changed;
    };
    normalize();
    for (let round = 0; round < (o.reparar ?? 8); round++) {
      build();
      const at = new Map();
      for (const s2 of segs) if (s2.cls !== 'bordillo') for (const [p, r2] of [[s2.a, s2.b], [s2.b, s2.a]]) { const k = p[0] + ',' + p[1]; if (!at.has(k)) at.set(k, []); at.get(k).push([r2[0] - p[0], r2[1] - p[1], s2]); }
      const bad = [], wedge = [], rr = s2 => kindOf(s2.L1) === 'room' && kindOf(s2.L2) === 'room';
      for (const d of at.values()) {
        if (d.length < 2) continue;
        const ang = d.map(([dx, dy]) => Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7), srt = ang.slice().sort((p, r2) => p - r2), through = ang.some(p => ang.includes((p + 4) & 7));
        let problem = d.length === 2 && Math.abs(ang[0] - ang[1]) % 4 === 2, wp = -1, wg = 0;
        if (problem) { const a0 = Math.min(ang[0], ang[1]), a1 = Math.max(ang[0], ang[1]); if (a1 - a0 === 2) { wp = a0; wg = 2; } else { wp = a1; wg = 2; } }
        for (let ii = 0; ii < srt.length; ii++) { const p = srt[ii], r2 = ii + 1 < srt.length ? srt[ii + 1] : srt[0] + 8, gap = r2 - p; if (gap === 1 || (gap === 2 && p % 2 === 1 && !through)) { problem = true; wp = p; wg = gap; } }
        if (!problem) continue;
        let any = false; for (const [, , s2] of d) if (rr(s2) && houseOf(s2.L1) === houseOf(s2.L2)) { bad.push([s2.L1, s2.L2]); any = true; }
        if (!any) wedge.push([d[0][2], d, wp, wg]);
      }
      const xcells = []; for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) { const a = segMap.get('d1' + x + ',' + y), b = segMap.get('d2' + x + ',' + y); if (a && b) xcells.push([x, y]); }
      if (!bad.length && !wedge.length && !xcells.length) break;
      // cruce en X: la celda se queda con una sola diagonal (la que separa los dos espacios más grandes)
      nFixX += xcells.length;
      // esquina fea que no es entre cuartos de una casa: el pedacito en punta (45°) o la esquina de 90° pasa al espacio vecino
      const labelAt = (px, py) => { const cx = Math.floor(px), cy = Math.floor(py); return cx < 0 || cy < 0 || cx >= C || cy >= Rr ? -1 : (cy * C + cx) * 4 + quarterOf(px - cx, py - cy); };
      for (const [, d, wp, wg] of wedge) {
        const s3 = d[0][2], vtx = (s3.a[0] + d[0][0] === s3.b[0] && s3.a[1] + d[0][1] === s3.b[1]) ? s3.a : s3.b;
        const ins = []; for (let h2 = 0; h2 < wg; h2++) { const an = (wp + h2 + 0.5) * Math.PI / 4, qi = labelAt(vtx[0] + 0.3 * Math.cos(an), vtx[1] + 0.3 * Math.sin(an)); if (qi >= 0) ins.push(qi); }
        const o1 = labelAt(vtx[0] + 0.3 * Math.cos((wp - 0.5) * Math.PI / 4), vtx[1] + 0.3 * Math.sin((wp - 0.5) * Math.PI / 4)), o2 = labelAt(vtx[0] + 0.3 * Math.cos((wp + wg + 0.5) * Math.PI / 4), vtx[1] + 0.3 * Math.sin((wp + wg + 0.5) * Math.PI / 4));
        const cand = [o1, o2].filter(j => j >= 0 && kindOf(q[j]) !== 'out').map(j => q[j]); if (!cand.length || !ins.length) continue;
        const to = cand.find(l => kindOf(l) === kindOf(q[ins[0]])) ?? cand[0];
        if (wg === 1) for (const i of ins) { const from = q[i], base = (i >> 2) * 4; for (let k = 0; k < 4; k++) if (q[base + k] === from) q[base + k] = to; } // punta a 45°: toda esa parte de la celda
        else for (const i of ins) q[i] = to; // esquina de 90°: dos cuartos, queda un bisel
        nFixW++;
      }
      normalize();
      if (!bad.length) continue;
      const cnt = new Map(); for (let i = 0; i < NQ; i++) cnt.set(q[i], (cnt.get(q[i]) || 0) + 1);
      const done = new Set(), remap = new Map();
      for (const [a, b] of bad) {
        if (done.has(a) || done.has(b) || a === b) continue;
        const [small, big] = (cnt.get(a) || 0) < (cnt.get(b) || 0) ? [a, b] : [b, a];
        if (houseOf(small) !== houseOf(big) && (cnt.get(small) || 0) / 4 > 40) continue;
        remap.set(small, big); done.add(a); done.add(b); nMerge++;
        houses.get(houseOf(small))?.rooms.delete(small); houses.get(houseOf(big))?.rooms.add(big);
      }
      for (let i = 0; i < NQ; i++) { const m2 = remap.get(q[i]); if (m2) q[i] = m2; }
    }
    normalize();
    // consistencia: cada cuarto que quedó en el mapa pertenece a una casa existente
    { const present = new Map(); for (let i = 0; i < NQ; i++) { const l = q[i]; if (kinds[l] === 'room') { if (!present.has(l)) present.set(l, []); present.get(l).push(i); } }
      for (const h of houses.values()) h.rooms = new Set([...h.rooms].filter(l => present.has(l)));
      for (const [l, mem] of present) { let h = houses.get(houseOfL[l]); if (!h) { const [hx, hy] = centerOf(mem); h = { id: houseOfL[l] || nextH++, type: 'casa', zone: zoneOf(hx, hy), cx: hx, cy: hy, area: 0, rooms: new Set(), patio: 0, refuge: false }; houseOfL[l] = h.id; houses.set(h.id, h); } h.rooms.add(l); } }
    for (const [id, h] of [...houses]) if (!h.rooms.size) houses.delete(id);
    build();
    // tramos: bordes seguidos en la misma línea que separan los mismos dos espacios
    const runs = (() => { const lines = new Map(); for (const s of segs) { const k = s.dir + ':' + s.line; if (!lines.has(k)) lines.set(k, []); lines.get(k).push(s); }
      const out = []; for (const ls of lines.values()) { ls.sort((p, r) => p.pos - r.pos); let cur = null;
        for (const s of ls) { const pk = Math.min(s.L1, s.L2) + ',' + Math.max(s.L1, s.L2); if (cur && cur.pk === pk && cur.segs[cur.segs.length - 1].pos === s.pos - 1) cur.segs.push(s); else { cur = { pk, segs: [s], a: Math.min(s.L1, s.L2), b: Math.max(s.L1, s.L2) }; out.push(cur); } } }
      return out; })();
    const openMid = (run, cls, w = 1, force = false) => { const n2 = run.segs.length; if (n2 < 3 && !force) return false; w = Math.max(1, Math.min(w, n2 - 2)); /* la puerta nunca toca la punta del tramo */ const s0 = Math.floor((n2 - w) / 2); for (let k = 0; k < w; k++) run.segs[s0 + k].cls = cls; };
    // puertas de las casas: la principal en el tramo más largo hacia la calle; interiores en árbol
    const byHouse = new Map();
    for (const r of runs) { const ka = kindOf(r.a), kb = kindOf(r.b); for (const l of [r.a, r.b]) if (kindOf(l) === 'room' || kindOf(l) === 'patio') { const h = houseOf(l); if (!byHouse.has(h)) byHouse.set(h, []); byHouse.get(h).push(r); } }
    for (const h of houses.values()) {
      const rs = byHouse.get(h.id) || [];
      const toRoad = rs.filter(r => (isSt(r.a) || isSt(r.b)) && kindOf(isSt(r.a) ? r.b : r.a) === 'room').sort((p, r2) => r2.segs.length - p.segs.length);
      const street = toRoad.filter(r => r.segs.length >= 3).length ? toRoad.filter(r => r.segs.length >= 3) : toRoad;
      const fr = street[0];
      if (h.hub) { toRoad.filter(r => r.a === h.hub || r.b === h.hub).slice(0, 2).forEach(r => openMid(r, 'puerta', Math.min(3, r.segs.length))); }
      if (fr) { openMid(fr, 'puerta', h.type === 'almacen' || h.type === 'comercial' ? 3 : 2, true); h.front = isSt(fr.a) ? fr.b : fr.a; } // puerta de 2 de ancho
      if (street[1] && (h.type !== 'casa' || chance(0.35))) openMid(street[1], 'puerta', h.type === 'comercial' ? 3 : 2);
      if (h.type === 'comercial' && street[2]) openMid(street[2], 'puerta', 2);
      // árbol de puertas interiores desde el cuarto de la entrada
      // puerta trasera al patio, portón del patio a la calle y algún hueco en la reja con el patio vecino
      if (h.patio) {
        const back = rs.filter(r => (r.a === h.patio || r.b === h.patio) && kindOf(r.a === h.patio ? r.b : r.a) === 'room' && houseOf(r.a === h.patio ? r.b : r.a) === h.id).sort((p, r2) => r2.segs.length - p.segs.length)[0];
        if (back) openMid(back, 'puerta', 2, true);
        // el jardín tiene reja y al menos 2 entradas (adelante y atrás, o al patio vecino)
        const gates = rs.filter(r => (r.a === h.patio || r.b === h.patio) && (isSt(r.a) || isSt(r.b)) && r.segs.length >= 3).sort((p, r2) => r2.segs.length - p.segs.length);
        gates.slice(0, 2).forEach(r => openMid(r, 'porton', 2, true));
        if (gates.length < 2) { const nbp = rs.filter(r => (r.a === h.patio || r.b === h.patio) && kindOf(r.a === h.patio ? r.b : r.a) === 'patio' && r.segs.length >= 3).sort((p, r2) => r2.segs.length - p.segs.length); nbp.slice(0, 2 - gates.length).forEach(r => openMid(r, 'porton', 2, true)); }
      }
      const inner = rs.filter(r => kindOf(r.a) === 'room' && kindOf(r.b) === 'room' && houseOf(r.a) === h.id && houseOf(r.b) === h.id);
      const best = new Map(); for (const r of inner) { const k = r.pk, p = best.get(k); if (!p || r.segs.length > p.segs.length) best.set(k, r); }
      const pairs = [...best.values()].sort(() => R() - 0.5), seen = new Set([h.hub || h.front || [...h.rooms][0]]), used = new Set();
      let grew = true; while (grew) { grew = false; for (const r of pairs.sort((p, r2) => r2.segs.length - p.segs.length)) if (seen.has(r.a) !== seen.has(r.b)) { openMid(r, 'puerta', r.segs.length >= 4 ? 2 : 1, true); seen.add(r.a); seen.add(r.b); used.add(r); grew = true; } }
      for (const r of pairs) if (!used.has(r) && r.segs.length >= 5 && chance(0.15)) openMid(r, 'puerta');
      // ventanas: en las paredes que dan a calle, plaza o parque, nunca en la punta ni junto a una puerta
      const pOpen = { casa: 0.18, tienda: 0.3, oficinas: 0.12, condominio: 0.14, comercial: 0.2, almacen: 0.08 }[h.type];
      for (const r of rs) {
        if (kindOf(r.a) === 'patio' && kindOf(r.b) === 'patio') continue;
        if (!r.segs.every(s => s.cls === 'exterior' || s.cls === 'puerta') || r.segs.length < 3) continue;
        const step = h.type === 'tienda' || h.type === 'comercial' ? 2 : h.type === 'almacen' ? 4 : 3;
        for (let k = 1 + rnd(0, 1); k <= r.segs.length - 2; k += step) {
          const s = r.segs[k]; if (s.cls !== 'exterior' || r.segs[k - 1].cls === 'puerta' || r.segs[k + 1].cls === 'puerta') continue;
          s.cls = chance(pOpen) ? 'ventanaRota' : 'ventana';
        }
      }
    }
    // plaza y parques: portones centrados en sus tramos más largos de reja
    const rejaRuns = l => runs.filter(r => (r.a === l || r.b === l) && r.segs[0].cls === 'reja').sort((p, r2) => r2.segs.length - p.segs.length);
    rejaRuns(RING).slice(0, 6).forEach(r => openMid(r, 'porton', 3, true)); // el césped de la plaza: varias entradas desde la pista
    for (let l = 6; l < kinds.length; l++) if (kinds[l] === 'parque') rejaRuns(l).slice(0, 2).forEach(r => openMid(r, 'porton', 2, true)); // todo pasto: al menos 2 entradas
    // caminos por cuartos de celda (ventana rota cuesta más, la mediana se salta)
    const segAt = new Map(segs.map(s2 => [s2.dir + (s2.dir[0] === 'd' ? Math.min(s2.a[0], s2.b[0]) + ',' + Math.min(s2.a[1], s2.b[1]) : s2.a[0] + ',' + s2.a[1]), s2]));
    const cost = s2 => !s2 ? 1 : BLOCK.has(s2.cls) ? 0 : s2.cls === 'ventanaRota' ? 5 : s2.cls === 'mediana' ? 3 : 1;
    const walk = (start, goal) => {
      const dist = new Int32Array(NQ).fill(1e9), prev = new Int32Array(NQ).fill(-1), bk = [[start]]; dist[start] = 0;
      const step = (i, j, s2, d) => { const c2 = cost(s2); if (!c2 || kindOf(q[j]) === 'out') return; const nd = d + c2; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; (bk[nd] = bk[nd] || []).push(j); } };
      for (let d = 0; d < bk.length; d++) for (const i of bk[d] || []) {
        if (dist[i] !== d) continue;
        if (goal && goal(i)) return { i, dist, prev };
        const c = i >> 2, k = i & 3, x = c % C, y = (c / C) | 0, d1 = segAt.get('d1' + x + ',' + y), d2 = segAt.get('d2' + x + ',' + y);
        if (k === 0) { step(i, i + 1, d2, d); step(i, i + 3, d1, d); if (y > 0) step(i, ((y - 1) * C + x) * 4 + 2, segAt.get('h' + x + ',' + y), d); }
        else if (k === 1) { step(i, i - 1, d2, d); step(i, i + 1, d1, d); if (x < C - 1) step(i, (y * C + x + 1) * 4 + 3, segAt.get('v' + (x + 1) + ',' + y), d); }
        else if (k === 2) { step(i, i - 1, d1, d); step(i, i + 1, d2, d); if (y < Rr - 1) step(i, ((y + 1) * C + x) * 4, segAt.get('h' + x + ',' + (y + 1)), d); }
        else { step(i, i - 3, d1, d); step(i, i - 1, d2, d); if (x > 0) step(i, (y * C + x - 1) * 4 + 1, segAt.get('v' + x + ',' + y), d); }
      }
      return { i: -1, dist, prev };
    };
    const Qi = (x, y, k) => (x < 0 || y < 0 || x >= C || y >= Rr) ? -1 : (y * C + x) * 4 + k;
    const innerQ = s2 => { const [x, y] = s2.a, cs = s2.dir === 'h' ? [Qi(x, y - 1, 2), Qi(x, y, 0)] : s2.dir === 'v' ? [Qi(x - 1, y, 1), Qi(x, y, 3)] : [0, 1, 2, 3].map(k => Qi(Math.min(s2.a[0], s2.b[0]), Math.min(s2.a[1], s2.b[1]), k)); return cs.find(i => i >= 0 && q[i] === ROAD) ?? -1; };
    // entrada A: la calle del borde de la ciudad más lejana a la plaza (A y B lo más lejos posible)
    let A = null, s0 = -1;
    { let p0 = -1; for (let i = 0; i < NQ; i++) if (q[i] === PLAZA) { p0 = i; break; }
      const dist = p0 >= 0 ? walk(p0, null).dist : null; let bd = -1;
      for (let i = 0; i < NQ; i++) { if (!isSt(q[i])) continue; let edge = false; nb(i, j => { if (kindOf(q[j]) === 'out') edge = true; }); const c = i >> 2, x = c % C, y = (c / C) | 0; if (x === 0 || y === 0 || x === C - 1 || y === Rr - 1) edge = true;
        if (!edge) continue; const d = dist ? dist[i] : 0; if (d < 1e9 && d > bd) { bd = d; s0 = i; } }
      if (s0 >= 0) { const c = s0 >> 2; A = [c % C + 0.5, ((c / C) | 0) + 0.5]; } }
    // nada encerrado: todo espacio al que no se llega desde A recibe una puerta (o portón) hacia uno al que sí se llega
    let nFix = 0;
    if (s0 >= 0) for (let round = 0; round < 10; round++) {
      const { dist } = walk(s0, null), reached = new Set(), un = new Set();
      for (let i = 0; i < NQ; i++) { if (kindOf(q[i]) === 'out') continue; (dist[i] < 1e9 ? reached : un).add(q[i]); }
      for (const l of reached) un.delete(l);
      if (!un.size) break;
      let prog = false;
      for (const l of un) {
        const r = runs.filter(r2 => ((r2.a === l && reached.has(r2.b)) || (r2.b === l && reached.has(r2.a))) && r2.segs.every(x => BLOCK.has(x.cls))).sort((p, r2) => r2.segs.length - p.segs.length)[0];
        if (!r) continue; const ot = r.a === l ? r.b : r.a;
        openMid(r, kindOf(l) === 'room' || kindOf(ot) === 'room' ? 'puerta' : 'porton', kindOf(l) === 'room' || kindOf(ot) === 'room' ? 1 : 2, true); prog = true; nFix++;
      }
      if (!prog) break;
    }
    // doble vía: mediana al medio de las pistas rectas de 6, con cortes para cruzar
    let nMed = 0;
    { const full = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) full[c] = q[c * 4] === ROAD && q[c * 4 + 1] === ROAD && q[c * 4 + 2] === ROAD && q[c * 4 + 3] === ROAD ? 1 : 0;
      const dist = new Int32Array(C * Rr), queue = [];
      for (let c = 0; c < C * Rr; c++) if (!full[c]) { dist[c] = 0; queue.push(c); } else dist[c] = 1e9;
      for (let h2 = 0; h2 < queue.length; h2++) { const c = queue[h2], x = c % C, y = (c / C) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (dist[j] > dist[c] + 1) { dist[j] = dist[c] + 1; queue.push(j); } } }
      const D = (x, y) => x < 0 || y < 0 || x >= C || y >= Rr ? 0 : dist[y * C + x];
      const cand = new Map();
      for (let y = 0; y < Rr; y++) for (let x = 1; x < C; x++) if (D(x - 1, y) === D(x, y) && D(x, y) >= 3 && D(x, y) <= 5 && D(x - 2, y) === D(x, y) - 1 && D(x + 1, y) === D(x, y) - 1) cand.set('v' + x + ',' + y, 1);
      for (let y = 1; y < Rr; y++) for (let x = 0; x < C; x++) if (D(x, y - 1) === D(x, y) && D(x, y) >= 3 && D(x, y) <= 5 && D(x, y - 2) === D(x, y) - 1 && D(x, y + 1) === D(x, y) - 1) cand.set('h' + x + ',' + y, 1);
      const take = (keyOf, line, len) => { let run = []; const flush = () => { if (run.length >= 10) run.forEach((k, i) => { if (i % 16 < 14) { const [x, y] = k.slice(1).split(',').map(Number); const s = { a: k[0] === 'v' ? [x, y] : [x, y], b: k[0] === 'v' ? [x, y + 1] : [x + 1, y], dir: k[0], line: k[0] === 'v' ? x : y, pos: k[0] === 'v' ? y : x, L1: ROAD, L2: ROAD, cls: 'mediana' }; segs.push(s); nMed++; } }); run = []; };
        for (let p = 0; p <= len; p++) { const k = keyOf(p); if (p < len && cand.has(k)) run.push(k); else flush(); } };
      for (let x = 1; x < C; x++) take(p => 'v' + x + ',' + p, x, Rr);
      for (let y = 1; y < Rr; y++) take(p => 'h' + p + ',' + y, y, C);
    }
    const route = s0 >= 0 ? (() => { const r = walk(s0, i => q[i] === PLAZA); if (r.i < 0) return null; const p = []; for (let j = r.i; j >= 0; j = r.prev[j]) p.push(j); return { quarters: p.reverse(), cost: r.dist[r.i] }; })() : null;
    const routeCells = route ? [...new Set(route.quarters.map(i => i >> 2))].map(c => [c % C, (c / C) | 0]) : [];
    // refugios: casas junto a la ruta a 1/3 y 2/3; una sola entrada y ventanas cerradas
    const refuges = [];
    if (routeCells.length) for (const f of [1 / 3, 2 / 3]) {
      const [tx, ty] = routeCells[Math.floor(routeCells.length * f)];
      const h = [...houses.values()].filter(h => h.front && !h.refuge).sort((a, b) => Math.hypot(a.cx - tx, a.cy - ty) - Math.hypot(b.cx - tx, b.cy - ty))[0];
      if (h) { h.refuge = true; refuges.push(h); }
    }
    for (const h of refuges) {
      let mainDone = false;
      for (const r of byHouse.get(h.id) || []) {
        const outer = !(kindOf(r.a) === 'room' && kindOf(r.b) === 'room' && houseOf(r.a) === houseOf(r.b));
        if (!outer) continue;
        for (const s of r.segs) { if (s.cls === 'ventanaRota') s.cls = 'ventana'; }
        const hasDoor = r.segs.some(s => s.cls === 'puerta');
        if (hasDoor && mainDone) r.segs.forEach(s => { if (s.cls === 'puerta') s.cls = 'exterior'; }); else if (hasDoor) mainDone = true;
      }
    }
    // plaza = destino (B)
    const plazaParts = comps((i, j) => q[i] === PLAZA && q[j] === PLAZA).list.sort((p, r2) => r2.length - p.length);
    const plaza = plazaParts.length ? (() => { const [cx, cy] = centerOf(plazaParts[0]); let pn = 0; for (const p of plazaParts) pn += p.length; return { cx, cy, area: pn / 4, partes: plazaParts.length }; })() : null;
    const count = c => segs.filter(s => s.cls === c).length, hs = [...houses.values()];
    const stats = {
      casas: hs.filter(h => h.type === 'casa').length, tiendas: hs.filter(h => h.type === 'tienda').length, oficinas: hs.filter(h => h.type === 'oficinas').length, condominios: hs.filter(h => h.type === 'condominio').length,
      centroComercial: hs.filter(h => h.type === 'comercial').length, patios: hs.filter(h => h.patio).length, almacenes: hs.filter(h => h.type === 'almacen').length, derribos: nDemol, crucesArreglados: nFixX, esquinasArregladas: nFixW, sueltas: hs.filter(h => h.style === 'suelta').length, cuartosUnidos: nMerge, avenidas: nAv, accesosArreglados: nFix,
      cuartos: hs.reduce((a, h) => a + h.rooms.size, 0), refugios: refuges.length, parques: kinds.filter(k => k === 'parque').length, plazaCeldas: plaza ? Math.round(plaza.area) : 0,
      puertas: count('puerta'), ventanasCerradas: count('ventana'), ventanasRotas: count('ventanaRota'), rejas: count('reja'), portones: count('porton'), mediana: nMed,
      tramosDiagonales: segs.filter(s => s.dir[0] === 'd').length, ruta: route ? route.cost : null,
    };
    return { motor: true, seed, n, W, H, C4: C, q, kinds, kindOf, houseOf, segs, houses, bossL: PLAZA, plaza, A, routeCells, stats };
  }

  root.MotorCiudad = { generate };
})(typeof window !== 'undefined' ? window : globalThis);
