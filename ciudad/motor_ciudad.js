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
  const ROAD = 1, PLAZA = 2;
  const BLOCK = new Set(['exterior', 'interior', 'medianera', 'muralla', 'reja', 'ventana', 'ruina']);

  function generate(o = {}) {
    const seed = (o.seed ?? 7) >>> 0, n = o.n ?? 16, F = 2, ens = o.ensanche ?? 1;
    const old = Math.random; Math.random = rng(seed);
    let m; try { m = root.MazmorraBase.Halls(n, undefined, null, { central: true, rmin: 4, rmax: 8, round: true }); } finally { Math.random = old; }
    const R = rng(seed ^ 0x3c6ef372), chance = p => R() < p, rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
    const C0 = m.size - 1, R0 = m.rows - 1, q0 = m._q;
    const k0 = l => { const k = l ? m._kinds[l] : 'rock'; return k === 'gal' ? 'corr' : k === 'rock' || !k ? 'out' : k; };
    const markLab = v => { const c = new Map(); for (const [k, val] of Object.entries(m.marks)) if (val === v) { const [x, y] = k.split(',').map(Number); for (let i = 0; i < 4; i++) { const l = q0[(y * C0 + x) * 4 + i]; if (l) c.set(l, (c.get(l) || 0) + 1); } } let b = 0, bn = 0; for (const [l, k] of c) if (k > bn) { bn = k; b = l; } return b; };
    const bossL = markLab(4), startL = markLab(2);

    // 1) simetría: se queda la mitad con la entrada y se refleja (x → C0-1-x, E ↔ O)
    let src = q0;
    if (o.simetria !== false) {
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
    const typeAt = (tt, px, py) => { const cx = Math.floor(px), cy = Math.floor(py); if (cx < 0 || cy < 0 || cx >= C || cy >= Rr) return 0; return tt[(cy * C + cx) * 4 + quarterOf(px - cx, py - cy)]; };
    // 3) ensanche: la calle avanza `ens` celdas sobre casas y huecos
    const OFF = [-1, -0.5, 0, 0.5, 1];
    for (let pass = 0; pass < ens; pass++) {
      const nt = new Uint8Array(t);
      for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) {
        const i = (y * C + x) * 4 + k; if (t[i] !== 3 && t[i] !== 4) continue;
        const px = x + CEN[k][0], py = y + CEN[k][1];
        grow: for (const dx of OFF) for (const dy of OFF) if (typeAt(t, px + dx, py + dy) === 1) { nt[i] = 1; break grow; }
      }
      t = nt;
    }
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
      for (const mem of list) { const a = mem.length / 4, tp = t[mem[0]]; if ((tp === 3 && a < 30) || (tp === 4 && a < 40)) for (const i of mem) t[i] = 1; } }
    // etiquetas finales: 1 calle, 2 plaza, parques y casas (una por componente de la sala original)
    const q = new Int32Array(NQ), kinds = ['out', 'corr', 'plaza'], houseOfL = [0, 0, 0], houses = new Map();
    for (let i = 0; i < NQ; i++) q[i] = t[i] === 1 ? ROAD : t[i] === 2 ? PLAZA : 0;
    const { list: blocks } = comps((i, j) => (t[i] === 3 || t[i] === 4) && t[j] === t[i] && orig[j] === orig[i]);
    const centerOf = mem => { let sx = 0, sy = 0; for (const i of mem) { const c = i >> 2; sx += c % C + CEN[i & 3][0]; sy += ((c / C) | 0) + CEN[i & 3][1]; } return [sx / mem.length, sy / mem.length]; };
    // zonas como en una ciudad: centro comercial y oficinas junto a la plaza, condominios en el anillo medio, suburbio afuera
    let pcx = C / 2, pcy = Rr / 2; { let sx = 0, sy = 0, sn = 0; for (let i = 0; i < NQ; i++) if (t[i] === 2) { const c = i >> 2; sx += c % C; sy += (c / C) | 0; sn++; } if (sn) { pcx = sx / sn; pcy = sy / sn; } }
    const rMax = Math.hypot(C, Rr) / 2;
    const zoneOf = (cx, cy) => { const r = Math.hypot(cx - pcx, cy - pcy) / rMax; return r < 0.33 ? 'centro' : r < 0.58 ? 'medio' : 'suburbio'; };
    const typeFor = (zone, area) => zone === 'centro' ? (area > 260 ? 'oficinas' : chance(0.7) ? 'tienda' : 'oficinas')
      : zone === 'medio' ? (area > 160 ? 'condominio' : chance(0.5) ? 'condominio' : 'casa')
      : (area > 380 && chance(0.6) ? 'almacen' : 'casa');
    for (const mem of blocks) {
      if (t[mem[0]] === 4) { const l = kinds.length; kinds.push('parque'); houseOfL.push(0); for (const i of mem) q[i] = l; continue; }
      const hid = kinds.length, area = mem.length / 4, [cx, cy] = centerOf(mem);
      const zone = zoneOf(cx, cy), type = typeFor(zone, area);
      houses.set(hid, { id: hid, type, zone, cx, cy, area, rooms: new Set(), refuge: false });
      // 4) cuartos: cortes rectos o diagonales según la orientación de la casa
      const diagEdges = (() => { let d = 0, a = 0; for (const i of mem) nb(i, j => { if (!(t[j] === 3 && orig[j] === orig[i])) { const sameCell = (i >> 2) === (j >> 2); sameCell ? d++ : a++; } }); return d * 1.41 > a; })();
      const minA = type === 'comercial' ? 60 : type === 'almacen' ? area / 2.6 : type === 'oficinas' ? 24 : type === 'condominio' ? 30 : type === 'tienda' ? 22 : 18;
      const leaves = [];
      const split = (set, depth) => {
        const a = set.length / 4;
        if (a < 2 * minA || depth > 7 || (a < 3.2 * minA && chance(0.35))) { leaves.push(set); return; }
        const fr = set.map(i => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return diagEdges ? [px + py, px - py] : [px, py]; });
        const sc = diagEdges ? Math.SQRT1_2 : 1, ext = [0, 1].map(ax => { let lo = 1e9, hi = -1e9; for (const f of fr) { lo = Math.min(lo, f[ax]); hi = Math.max(hi, f[ax]); } return [lo, hi]; });
        const axes = [0, 1].sort((p, r) => (ext[r][1] - ext[r][0]) - (ext[p][1] - ext[p][0]));
        for (const ax of axes) {
          const [lo, hi] = ext[ax]; if ((hi - lo) * sc < 8) continue;
          for (let tries = 0; tries < 4; tries++) {
            let c = Math.round(lo + (hi - lo) * (0.5 + (R() - 0.5) * 0.3)); if (diagEdges && (c % 1)) c = Math.round(c);
            const A2 = [], B2 = []; set.forEach((i, k) => (fr[k][ax] < c ? A2 : B2).push(i));
            if (A2.length / 4 < minA || B2.length / 4 < minA || (c - lo) * sc < 3.5 || (hi - c) * sc < 3.5) continue;
            split(A2, depth + 1); split(B2, depth + 1); return;
          }
        }
        leaves.push(set);
      };
      split(mem, 0);
      for (const lf of leaves) { const l = kinds.length; kinds.push('room'); houseOfL.push(hid); houses.get(hid).rooms.add(l); for (const i of lf) q[i] = l; }
    }
    // pedazos sueltos de un cuarto (casas en L): si son chicos se suman al cuarto vecino de la misma casa
    { const { list } = comps((i, j) => q[i] > PLAZA && kinds[q[i]] === 'room' && q[j] === q[i]); const seen = new Map();
      for (const mem of list.sort((a, b) => b.length - a.length)) { const l = q[mem[0]]; if (!seen.has(l)) { seen.set(l, 1); continue; }
        const cnt = new Map(); for (const i of mem) nb(i, j => { const lj = q[j]; if (lj !== l && kinds[lj] === 'room' && houseOfL[lj] === houseOfL[l]) cnt.set(lj, (cnt.get(lj) || 0) + 1); });
        let best = 0, bn = 0; for (const [lj, c] of cnt) if (c > bn) { bn = c; best = lj; }
        if (best) for (const i of mem) q[i] = best; else { const nl = kinds.length; kinds.push('room'); houseOfL.push(houseOfL[l]); houses.get(houseOfL[l]).rooms.add(nl); for (const i of mem) q[i] = nl; } } }
    { const present = new Set(q); for (const h of houses.values()) for (const l of [...h.rooms]) if (!present.has(l)) h.rooms.delete(l); }
    // centro comercial: el edificio más grande cerca de la plaza, con pocos cortes (locales grandes)
    { const mall = [...houses.values()].filter(h => h.zone !== 'suburbio').sort((a, b) => b.area - a.area)[0]; if (mall) mall.type = 'comercial'; }
    // ingeniería vial: se derriban casas que obligan a dar un rodeo largo; su lugar pasa a ser calle nueva
    let nDemol = 0;
    { const roadCell = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) for (let k = 0; k < 4; k++) if (q[c * 4 + k] === ROAD) roadCell[c] = 1;
      const maxD = o.derribos ?? Math.max(2, Math.round(n / 4));
      for (const h of [...houses.values()].sort(() => R() - 0.5)) {
        if (nDemol >= maxD || h.area > 170 || h.type === 'comercial') continue;
        const mine = new Set(); for (let i = 0; i < NQ; i++) if (h.rooms.has(q[i])) mine.add(i >> 2);
        const edge = []; for (const c of mine) { const x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < C && ny < Rr && roadCell[ny * C + nx] && !mine.has(ny * C + nx)) edge.push(ny * C + nx); } }
        if (edge.length < 4) continue;
        let a = edge[0], b = edge[0], e = 0; for (const p of edge) for (const r2 of edge) { const d = Math.hypot(p % C - r2 % C, ((p / C) | 0) - ((r2 / C) | 0)); if (d > e) { e = d; a = p; b = r2; } }
        const dist = new Int32Array(C * Rr).fill(-1), qq = [a]; dist[a] = 0;
        for (let hd = 0; hd < qq.length && dist[b] < 0; hd++) { const c = qq[hd], x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (dist[j] < 0 && roadCell[j]) { dist[j] = dist[c] + 1; qq.push(j); } } }
        if (dist[b] >= 0 && dist[b] < 3.5 * e) continue;
        for (let i = 0; i < NQ; i++) if (h.rooms.has(q[i])) { q[i] = ROAD; roadCell[i >> 2] = 1; }
        houses.delete(h.id); nDemol++;
      }
    }

    // 5) bordes desde las etiquetas: rectos y diagonales
    const kindOf = l => kinds[l] || 'out', houseOf = l => houseOfL[l] || 0;
    const Q = (x, y, k) => (x < 0 || y < 0 || x >= C || y >= Rr) ? 0 : q[(y * C + x) * 4 + k];
    const segs = [], segMap = new Map();
    const classOf = (a, b) => {
      const ka = kindOf(a), kb = kindOf(b), ks = [ka, kb].sort().join('|');
      if (ka === 'out' || kb === 'out') return 'muralla';
      if (ks === 'room|room') return houseOf(a) === houseOf(b) ? 'interior' : 'medianera';
      if (ka === 'room' || kb === 'room') return 'exterior';
      return 'reja'; // calle con plaza o parque
    };
    const addSeg = (key, a, b, dir, line, pos, L1, L2) => { const s = { a, b, dir, line, pos, L1, L2, cls: classOf(L1, L2) }; segs.push(s); segMap.set(key, s); };
    for (let y = 0; y <= Rr; y++) for (let x = 0; x < C; x++) { const a = Q(x, y - 1, 2), b = Q(x, y, 0); if (a !== b) addSeg('h' + x + ',' + y, [x, y], [x + 1, y], 'h', y, x, a, b); }
    for (let y = 0; y < Rr; y++) for (let x = 0; x <= C; x++) { const a = Q(x - 1, y, 1), b = Q(x, y, 3); if (a !== b) addSeg('v' + x + ',' + y, [x, y], [x, y + 1], 'v', x, y, a, b); }
    for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) {
      const N = Q(x, y, 0), E = Q(x, y, 1), S = Q(x, y, 2), O = Q(x, y, 3);
      if (N !== O || E !== S) addSeg('d1' + x + ',' + y, [x, y], [x + 1, y + 1], 'd1', x - y, x, N !== O ? N : E, N !== O ? O : S);
      if (N !== E || O !== S) addSeg('d2' + x + ',' + y, [x + 1, y], [x, y + 1], 'd2', x + y, x, N !== E ? N : O, N !== E ? E : S);
    }
    // tramos: bordes seguidos en la misma línea que separan los mismos dos espacios
    const runs = (() => { const lines = new Map(); for (const s of segs) { const k = s.dir + ':' + s.line; if (!lines.has(k)) lines.set(k, []); lines.get(k).push(s); }
      const out = []; for (const ls of lines.values()) { ls.sort((p, r) => p.pos - r.pos); let cur = null;
        for (const s of ls) { const pk = Math.min(s.L1, s.L2) + ',' + Math.max(s.L1, s.L2); if (cur && cur.pk === pk && cur.segs[cur.segs.length - 1].pos === s.pos - 1) cur.segs.push(s); else { cur = { pk, segs: [s], a: Math.min(s.L1, s.L2), b: Math.max(s.L1, s.L2) }; out.push(cur); } } }
      return out; })();
    const openMid = (run, cls, w = 1) => { const n2 = run.segs.length; w = Math.min(w, n2); const s0 = Math.floor((n2 - w) / 2); for (let k = 0; k < w; k++) run.segs[s0 + k].cls = cls; };
    // puertas de las casas: la principal en el tramo más largo hacia la calle; interiores en árbol
    const byHouse = new Map();
    for (const r of runs) { const ka = kindOf(r.a), kb = kindOf(r.b); for (const l of [r.a, r.b]) if (kindOf(l) === 'room') { const h = houseOf(l); if (!byHouse.has(h)) byHouse.set(h, []); byHouse.get(h).push(r); } }
    for (const h of houses.values()) {
      const rs = byHouse.get(h.id) || [];
      const street = rs.filter(r => (r.a === ROAD || r.b === ROAD) && r.segs.length >= 3).sort((p, r2) => r2.segs.length - p.segs.length);
      const fr = street[0];
      if (fr) { openMid(fr, 'puerta', h.type === 'almacen' || h.type === 'comercial' ? 3 : h.type === 'tienda' ? 2 : 1); h.front = fr.a === ROAD ? fr.b : fr.a; }
      if (street[1] && (h.type !== 'casa' || chance(0.35))) openMid(street[1], 'puerta', h.type === 'comercial' ? 3 : 1);
      if (h.type === 'comercial' && street[2]) openMid(street[2], 'puerta', 2);
      // árbol de puertas interiores desde el cuarto de la entrada
      const inner = rs.filter(r => kindOf(r.a) === 'room' && kindOf(r.b) === 'room' && houseOf(r.a) === h.id && houseOf(r.b) === h.id);
      const best = new Map(); for (const r of inner) { const k = r.pk, p = best.get(k); if (!p || r.segs.length > p.segs.length) best.set(k, r); }
      const pairs = [...best.values()].sort(() => R() - 0.5), seen = new Set([h.front ?? [...h.rooms][0]]), used = new Set();
      let grew = true; while (grew) { grew = false; for (const r of pairs) if (seen.has(r.a) !== seen.has(r.b)) { openMid(r, 'puerta'); seen.add(r.a); seen.add(r.b); used.add(r); grew = true; } }
      for (const r of pairs) if (!used.has(r) && r.segs.length >= 5 && chance(0.15)) openMid(r, 'puerta');
      // ventanas: en las paredes que dan a calle, plaza o parque, nunca en la punta ni junto a una puerta
      const pOpen = { casa: 0.18, tienda: 0.3, oficinas: 0.12, condominio: 0.14, comercial: 0.2, almacen: 0.08 }[h.type];
      for (const r of rs) {
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
    rejaRuns(PLAZA).slice(0, 4).forEach(r => openMid(r, 'porton', Math.min(4, r.segs.length)));
    for (let l = 3; l < kinds.length; l++) if (kinds[l] === 'parque') rejaRuns(l).slice(0, 2).forEach(r => openMid(r, 'porton', 2));
    // entrada A: en la muralla, junto a lo que era el patio de entrada de la mazmorra
    let A = null;
    { const cand = segs.filter(s => s.cls === 'muralla' && (s.L1 === ROAD || s.L2 === ROAD));
      const isStart = s => { const mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2; for (const [dx, dy] of [[0.3, 0.3], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3]]) { const px = mx + dx, py = my + dy, cx = Math.floor(px), cy = Math.floor(py); if (cx >= 0 && cy >= 0 && cx < C && cy < Rr && orig[(cy * C + cx) * 4 + quarterOf(px - cx, py - cy)] === startL) return true; } return false; };
      const pickS = cand.filter(isStart)[0] || cand.sort((p, r2) => Math.abs(p.a[1] - Rr / 2) + p.a[0] - Math.abs(r2.a[1] - Rr / 2) - r2.a[0])[0];
      if (pickS) { const run = runs.find(r => r.segs.includes(pickS)); openMid(run, 'entrada', Math.min(4, run.segs.length)); const s = run.segs[Math.floor(run.segs.length / 2)]; A = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2]; } }
    // doble vía: mediana al medio de las pistas rectas de 6, con cortes para cruzar
    let nMed = 0;
    { const full = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) full[c] = q[c * 4] === ROAD && q[c * 4 + 1] === ROAD && q[c * 4 + 2] === ROAD && q[c * 4 + 3] === ROAD ? 1 : 0;
      const dist = new Int32Array(C * Rr), queue = [];
      for (let c = 0; c < C * Rr; c++) if (!full[c]) { dist[c] = 0; queue.push(c); } else dist[c] = 1e9;
      for (let h2 = 0; h2 < queue.length; h2++) { const c = queue[h2], x = c % C, y = (c / C) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (dist[j] > dist[c] + 1) { dist[j] = dist[c] + 1; queue.push(j); } } }
      const D = (x, y) => x < 0 || y < 0 || x >= C || y >= Rr ? 0 : dist[y * C + x];
      const cand = new Map();
      for (let y = 0; y < Rr; y++) for (let x = 1; x < C; x++) if (D(x - 1, y) === 3 && D(x, y) === 3 && D(x - 2, y) === 2 && D(x + 1, y) === 2) cand.set('v' + x + ',' + y, 1);
      for (let y = 1; y < Rr; y++) for (let x = 0; x < C; x++) if (D(x, y - 1) === 3 && D(x, y) === 3 && D(x, y - 2) === 2 && D(x, y + 1) === 2) cand.set('h' + x + ',' + y, 1);
      const take = (keyOf, line, len) => { let run = []; const flush = () => { if (run.length >= 10) run.forEach((k, i) => { if (i % 16 < 14) { const [x, y] = k.slice(1).split(',').map(Number); const s = { a: k[0] === 'v' ? [x, y] : [x, y], b: k[0] === 'v' ? [x, y + 1] : [x + 1, y], dir: k[0], line: k[0] === 'v' ? x : y, pos: k[0] === 'v' ? y : x, L1: ROAD, L2: ROAD, cls: 'mediana' }; segs.push(s); nMed++; } }); run = []; };
        for (let p = 0; p <= len; p++) { const k = keyOf(p); if (p < len && cand.has(k)) run.push(k); else flush(); } };
      for (let x = 1; x < C; x++) take(p => 'v' + x + ',' + p, x, Rr);
      for (let y = 1; y < Rr; y++) take(p => 'h' + p + ',' + y, y, C);
    }
    // ruta A → plaza por cuartos de celda (ventana rota cuesta más, la mediana se salta)
    const segAt = new Map(segs.map(s => [s.dir + (s.dir[0] === 'd' ? Math.min(s.a[0], s.b[0]) + ',' + Math.min(s.a[1], s.b[1]) : s.a[0] + ',' + s.a[1]), s]));
    const cost = s => !s ? 1 : BLOCK.has(s.cls) ? 0 : s.cls === 'ventanaRota' ? 5 : s.cls === 'mediana' ? 3 : 1;
    const route = (() => {
      if (!A) return null;
      const ax = Math.min(C - 1, Math.max(0, Math.floor(A[0]))), ay = Math.min(Rr - 1, Math.max(0, Math.floor(A[1])));
      let s0 = -1; for (let k = 0; k < 4; k++) if (q[(ay * C + ax) * 4 + k] === ROAD) s0 = (ay * C + ax) * 4 + k;
      if (s0 < 0) for (let d = 1; d < 4 && s0 < 0; d++) for (let k = 0; k < 4; k++) { const xx = Math.min(C - 1, ax + d); if (q[(ay * C + xx) * 4 + k] === ROAD) { s0 = (ay * C + xx) * 4 + k; break; } }
      if (s0 < 0) return null;
      const dist = new Int32Array(NQ).fill(1e9), prev = new Int32Array(NQ).fill(-1), bk = [[s0]]; dist[s0] = 0;
      const step = (i, j, s, d) => { const c2 = cost(s); if (!c2 || kindOf(q[j]) === 'out') return; const nd = d + c2; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; (bk[nd] = bk[nd] || []).push(j); } };
      for (let d = 0; d < bk.length; d++) for (const i of bk[d] || []) {
        if (dist[i] !== d) continue;
        if (q[i] === PLAZA) { const p = []; for (let j = i; j >= 0; j = prev[j]) p.push(j); return { quarters: p.reverse(), cost: d }; }
        const c = i >> 2, k = i & 3, x = c % C, y = (c / C) | 0, d1 = segAt.get('d1' + x + ',' + y), d2 = segAt.get('d2' + x + ',' + y);
        if (k === 0) { step(i, i + 1, d2, d); step(i, i + 3, d1, d); if (y > 0) step(i, ((y - 1) * C + x) * 4 + 2, segAt.get('h' + x + ',' + y), d); }
        else if (k === 1) { step(i, i - 1, d2, d); step(i, i + 1, d1, d); if (x < C - 1) step(i, (y * C + x + 1) * 4 + 3, segAt.get('v' + (x + 1) + ',' + y), d); }
        else if (k === 2) { step(i, i - 1, d1, d); step(i, i + 1, d2, d); if (y < Rr - 1) step(i, ((y + 1) * C + x) * 4, segAt.get('h' + x + ',' + (y + 1)), d); }
        else { step(i, i - 3, d1, d); step(i, i - 1, d2, d); if (x > 0) step(i, (y * C + x - 1) * 4 + 1, segAt.get('v' + x + ',' + y), d); }
      }
      return null;
    })();
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
      centroComercial: hs.filter(h => h.type === 'comercial').length, almacenes: hs.filter(h => h.type === 'almacen').length, derribos: nDemol,
      cuartos: hs.reduce((a, h) => a + h.rooms.size, 0), refugios: refuges.length, parques: kinds.filter(k => k === 'parque').length, plazaCeldas: plaza ? Math.round(plaza.area) : 0,
      puertas: count('puerta'), ventanasCerradas: count('ventana'), ventanasRotas: count('ventanaRota'), rejas: count('reja'), portones: count('porton'), mediana: nMed,
      tramosDiagonales: segs.filter(s => s.dir[0] === 'd').length, ruta: route ? route.cost : null,
    };
    return { motor: true, seed, n, W, H, C4: C, q, kinds, kindOf, houseOf, segs, houses, bossL: PLAZA, plaza, A, routeCells, stats };
  }

  root.MotorCiudad = { generate };
})(typeof window !== 'undefined' ? window : globalThis);
