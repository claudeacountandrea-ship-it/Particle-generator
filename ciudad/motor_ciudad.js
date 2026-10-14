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
  const mezcla = (a, R) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }; // determinista en cualquier navegador
  const isSt = l => l === ROAD || l === VEREDA || l === PASAJE; // calzada, vereda o pasaje peatonal
  const BLOCK = new Set(['exterior', 'interior', 'medianera', 'muralla', 'reja', 'ventana', 'ruina', 'muro']);

  function generate(o = {}) {
    const seed = (o.seed ?? 7) >>> 0, n = o.n ?? 12, F = o.escala ?? 4, ens = o.ensanche ?? 0; // calles: 2 de pasillo ×4 = 8 (6 de calzada: un carril de 3 por sentido + veredas). Un auto mide 2, un carril 3
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
    // margen alrededor de la ciudad para el anillo de asfalto y las autopistas de salida
    const M = o.margen ?? 50, C = C0 * F + 2 * M, Rr = R0 * F + 2 * M, W = C + 1, H = Rr + 1, NQ = C * Rr * 4;
    const orig = new Int32Array(NQ);
    for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) {
      const px = (x - M + CEN[k][0]) / F, py = (y - M + CEN[k][1]) / F, cx = Math.floor(px), cy = Math.floor(py);
      orig[(y * C + x) * 4 + k] = cx < 0 || cy < 0 || cx >= C0 || cy >= R0 ? 0 : src[(cy * C0 + cx) * 4 + quarterOf(px - cx, py - cy)];
    }
    // tipo base de cada cuarto: 0 fuera, 1 calle, 2 plaza, 3 sala, 4 hueco
    let t = new Uint8Array(NQ);
    for (let i = 0; i < NQ; i++) { const l = orig[i], k = k0(l); t[i] = !l || k === 'out' ? 0 : l === bossL ? 2 : k === 'corr' || l === startL ? 1 : k === 'pillar' ? 4 : 3; }
    // contorno simétrico: solo la silueta de la ciudad se refleja; el interior queda libre
    if (o.contorno !== false) { const MIR = [0, 3, 2, 1], nt = new Uint8Array(t); for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) if (t[(y * C + C - 1 - x) * 4 + MIR[k]] === 0) nt[(y * C + x) * 4 + k] = 0; t = nt; }
    // crecer una máscara celdas enteras (el mismo cuarto en las 8 vecinas): las diagonales siguen limpias
    const grow = (mask, steps) => { let cur = mask; for (let s2 = 0; s2 < steps; s2++) { const nx = new Uint8Array(cur); for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) for (let k = 0; k < 4; k++) { const i = (y * C + x) * 4 + k; if (cur[i]) continue; g: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < C && yy < Rr && cur[(yy * C + xx) * 4 + k]) { nx[i] = 1; break g; } } } cur = nx; } return cur; };
    const cityQ = t.map(v => v ? 1 : 0); // silueta de la ciudad (antes del anillo)
    // la ciudad termina en un anillo de asfalto (6) y de ahí salen autopistas (8, con mediana) hasta el borde: hacia otra ciudad
    let nHwy = 0; const major = new Uint8Array(C * Rr), ringM = new Uint8Array(C * Rr), hwyM = new Uint8Array(C * Rr), artM = new Uint8Array(C * Rr), avM = new Uint8Array(C * Rr); // vías principales: separan barrios
    { const city = t.map(v => v ? 1 : 0), ring = grow(city, 8); // anillo de 8: 6 de calzada y veredas
      for (let i = 0; i < NQ; i++) if (!t[i] && ring[i]) { t[i] = 1; major[i >> 2] = 1; ringM[i >> 2] = 1; }
      let sx = 0, sy = 0, sn = 0; for (let i = 0; i < NQ; i++) if (city[i]) { const c = i >> 2; sx += c % C; sy += (c / C) | 0; sn++; }
      const cx = Math.round(sx / sn), cy = Math.round(sy / sn), dirs = mezcla([[1, 0], [-1, 0], [0, 1], [0, -1]], R).slice(0, rnd(2, 3));
      for (const [dx, dy] of dirs) { nHwy++; const off = rnd(-8, 8);
        for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) {
          const along = dx ? (x - cx) * dx : (y - cy) * dy, across = dx ? y - (cy + off) : x - (cx + off);
          if (along > 0 && across >= -8 && across < 8) /* autopista: 2 carriles de 3 por sentido + mediana + veredas = 16 */ for (let k = 0; k < 4; k++) { const i = (y * C + x) * 4 + k; if (!t[i]) { t[i] = 1; major[y * C + x] = 1; hwyM[y * C + x] = 1; } } } } }
    // caminos rurales: 1 o 2 caminos angostos (8) salen del anillo al campo y terminan en una granja (caserío y su campo)
    let nGranja = 0; const camposCultivo = [];
    if (o.granjas !== false) { let sx = 0, sy = 0, sn = 0; for (let i = 0; i < NQ; i++) if (cityQ[i]) { const c = i >> 2; sx += c % C; sy += (c / C) | 0; sn++; } const gx = Math.round(sx / sn), gy = Math.round(sy / sn);
      const free = (x, y) => x >= 2 && y >= 2 && x < C - 2 && y < Rr - 2 && [0, 1, 2, 3].every(k => t[(y * C + x) * 4 + k] === 0);
      const quiero = rnd(1, 2); for (const [dx, dy, off0] of mezcla([[1, 0], [-1, 0], [0, 1], [0, -1]], R).flatMap(d => [[...d, rnd(-60, -25)], [...d, rnd(25, 60)]])) { if (nGranja >= quiero) break; const off = off0, P2 = (d, a) => dx ? [gx + dx * d, gy + off + a] : [gx + off + a, gy + dy * d];
        let d0 = -1, seenCity = false; for (let d = 0; d < Math.max(C, Rr); d++) { const [x, y] = P2(d, 0); if (x < 0 || y < 0 || x >= C || y >= Rr) break; if (!free(x, y)) seenCity = true; else if (seenCity && [-6, 0, 6].every(a => free(...P2(d, a)))) { d0 = d; break; } }
        if (d0 < 0) continue; const dEnd = d0 + rnd(4, 8); if (![-12, 0, 12].every(a => free(...P2(dEnd + 19, a)))) continue; // tiene que entrar la granja
        if ([...Array(dEnd - d0 + 30).keys()].some(k2 => [-18, 18].some(a => { const [x, y] = P2(d0 + k2, a); return x >= 0 && y >= 0 && x < C && y < Rr && hwyM[y * C + x]; }))) continue; // lejos de la autopista
        nGranja++;
        const setT = (d, a, v) => { const [x, y] = P2(d, a); if (x < 0 || y < 0 || x >= C || y >= Rr) return; for (let k = 0; k < 4; k++) { const i = (y * C + x) * 4 + k; if (t[i] === 0) t[i] = v; } };
        for (let d = d0 - 3; d <= dEnd; d++) for (let a = -4; a < 4; a++) setT(d, a, 1); // el camino
        for (let d = dEnd + 1; d <= dEnd + 18; d++) for (let a = -11; a < 11; a++) setT(d, a, 1 + (Math.abs(a) < 9 && d > dEnd + 1 && d < dEnd + 17 ? 2 : 0)); // caserío: manzana con su calle alrededor
        const side = chance(0.5) ? 1 : -1, field = []; for (let d = dEnd - 4; d <= dEnd + 18; d++) for (let a = 13; a < 30; a++) { const [x, y] = P2(d, side * a); if (free(x, y)) field.push([x, y]); }
        camposCultivo.push(field); for (const [x, y] of field) for (let k = 0; k < 4; k++) t[(y * C + x) * 4 + k] = 4; } } // campo de cultivo (pasto)
    // TRAZADO POR ETAPAS (o.trazado !== 'mazmorra'): 1) la silueta es la de la mazmorra; 2) la silueta se parte en barrios con
    // cortes rectos o a 45° y cada corte es una avenida (16 de ancho los primeros, 12 los siguientes); 3) el barrio del centro
    // conserva las calles orgánicas de la mazmorra (casco antiguo, con la plaza); 4) cada otro barrio tiene su cuadrícula de
    // calles de 8 (recta o diagonal), con manzanas del tamaño de su tipo. Después siguen las etapas de siempre (veredas, lotes...)
    const porBarrios = o.trazado !== 'mazmorra'; let nBarriosT = 0; const crossPts = []; // cruces entre avenidas de barrios (para óvalos)
    if (porBarrios) {
      const fv = (i, dg) => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return dg ? [px + py, px - py] : [px, py]; }, scF = dg => dg ? Math.SQRT1_2 : 1;
      const city = []; for (let i = 0; i < NQ; i++) if (cityQ[i]) city.push(i);
      let pxs = 0, pys = 0, pn = 0; for (let i = 0; i < NQ; i++) if (t[i] === 2) { const c = i >> 2; pxs += c % C; pys += (c / C) | 0; pn++; }
      const pc = pn ? [pxs / pn, pys / pn] : [C / 2, Rr / 2], target = o.barrioArea ?? 9000, art = new Uint8Array(NQ), artId = new Int32Array(NQ), leaves = []; let nCut = 0;
      const split = (set, depth) => {
        if (set.length / 4 < target * 1.7 || depth > 7) { if (set.length) leaves.push(set); return; }
        let best = null; for (const dg of [false, true]) for (const ax of [0, 1]) { let lo = 1e9, hi = -1e9; for (const i of set) { const f = fv(i, dg)[ax]; if (f < lo) lo = f; if (f > hi) hi = f; }
          const sc2 = (hi - lo) * scF(dg) * (dg ? 0.8 : 1) * (0.85 + R() * 0.3); if (!best || sc2 > best.s) best = { s: sc2, dg, ax, lo, hi }; }
        const { dg, ax, lo, hi } = best, pos = Math.round(lo + (hi - lo) * (0.38 + R() * 0.24)), hw = Math.round((depth < 2 ? 8 : 6) / scF(dg)), A = [], B = [], id = ++nCut;
        // la avenida no es una regla: a veces se desvía (un tramo a 45° y sigue corrida) para rodear algo
        let glo = 1e9, ghi = -1e9; for (const i of set) { const g = fv(i, dg)[1 - ax]; if (g < glo) glo = g; if (g > ghi) ghi = g; }
        const jog = chance(0.6) ? { g1: Math.round(glo + (ghi - glo) * (0.25 + R() * 0.5)), d: (chance(0.5) ? 1 : -1) * rnd(6, 16) } : null;
        const posAt = g => { if (!jog || g <= jog.g1) return [pos, hw]; const k2 = Math.min(Math.abs(jog.d), Math.floor(g - jog.g1)); return [pos + Math.sign(jog.d) * k2, k2 < Math.abs(jog.d) ? Math.round(hw * 1.42) : hw]; };
        for (const i of set) { const f = fv(i, dg), [p2, h2] = posAt(f[1 - ax]), a = f[ax]; if (a > p2 - h2 && a < p2 + h2) { art[i] = 1; artId[i] = id; } else (a < p2 ? A : B).push(i); }
        split(A, depth + 1); split(B, depth + 1); };
      split(city, 0);
      // el barrio del centro: el que tiene la plaza (o el más cercano al centro)
      const cen = leaves.map(s => { let sx = 0, sy = 0; for (const i of s) { const c = i >> 2; sx += c % C; sy += (c / C) | 0; } return [sx / s.length, sy / s.length]; });
      let ci = 0, cd = 1e9; leaves.forEach((s, k) => { let hasP = false; for (const i of s) if (t[i] === 2) { hasP = true; break; } const d = hasP ? -1 : Math.hypot(cen[k][0] - pc[0], cen[k][1] - pc[1]); if (d < cd) { cd = d; ci = k; } });
      const rMax2 = Math.max(...cen.map(p => Math.hypot(p[0] - pc[0], p[1] - pc[1])), 1);
      // distancia (en celdas) a la avenida más cercana: una calle de barrio paralela y pegada a la avenida sobra
      const dA = new Int32Array(C * Rr).fill(99), qa = []; for (let i = 0; i < NQ; i++) if (art[i] && dA[i >> 2]) { dA[i >> 2] = 0; qa.push(i >> 2); }
      for (let h2 = 0; h2 < qa.length; h2++) { const c = qa[h2], x = c % C, y = (c / C) | 0; if (dA[c] >= 14) continue; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (dA[j] > dA[c] + 1) { dA[j] = dA[c] + 1; qa.push(j); } } }
      leaves.forEach((s, k) => { nBarriosT++;
        if (k === ci || o.trazado !== 'cuadricula') return; // calles de la mazmorra tal cual (la esencia); la cuadrícula es opcional
        const r = Math.hypot(cen[k][0] - pc[0], cen[k][1] - pc[1]) / rMax2, dg = chance(0.35);
        // manzanas: cerca del centro chicas (2 lotes de fondo), afuera alargadas; en el borde algunas grandes (industria, parque)
        const P0 = r < 0.45 ? rnd(34, 38) : rnd(36, 42), P1 = r < 0.45 ? rnd(44, 54) : rnd(56, 76), w = Math.round(8 / scF(dg)), p0 = Math.round(P0 / scF(dg)), p1 = Math.round(P1 / scF(dg)), o0 = rnd(0, p0 - 1), o1 = rnd(0, p1 - 1), sw = chance(0.5);
        // calles con separación irregular, algunas con un quiebre, y tramos que no siguen (cruces en T): nada de orden perfecto
        let al = 1e9, ah = -1e9, bl = 1e9, bh = -1e9; for (const i of s) { const f = fv(i, dg), a = sw ? f[0] : f[1], b = sw ? f[1] : f[0]; if (a < al) al = a; if (a > ah) ah = a; if (b < bl) bl = b; if (b > bh) bh = b; }
        const mkLines = (lo2, hi2, P, glo2, ghi2) => { const ls = []; let p2 = Math.floor(lo2) + rnd(Math.round(P * 0.3), P - 2); while (p2 < hi2) { ls.push({ p: p2, jog: chance(0.3) ? { g1: Math.round(glo2 + (ghi2 - glo2) * (0.2 + R() * 0.6)), d: (chance(0.5) ? 1 : -1) * rnd(3, 7) } : null }); p2 += P + rnd(-Math.round(P * 0.18), Math.round(P * 0.18)); } return ls; };
        const LA = mkLines(al, ah, p0, bl, bh), LB = mkLines(bl, bh, p1, al, ah), cut = new Set(); LB.forEach((_, kb) => LA.forEach((__, ka) => { if (chance(0.2)) cut.add(kb + ':' + ka); }));
        const inLine = (L, v, g) => { const k2 = L.jog && g > L.jog.g1 ? Math.min(Math.abs(L.jog.d), Math.floor(g - L.jog.g1)) : 0, p2 = L.p + (L.jog ? Math.sign(L.jog.d) * k2 : 0), ww = L.jog && k2 > 0 && k2 < Math.abs(L.jog.d) ? Math.round(w * 1.42) : w; return v >= p2 && v < p2 + ww; };
        const lineOf = i => { const f = fv(i, dg), a = sw ? f[0] : f[1], b = sw ? f[1] : f[0]; const ka = LA.findIndex(L => inLine(L, a, b)), kb = LB.findIndex(L => inLine(L, b, a));
          let seg = 0; while (seg < LA.length && LA[seg].p + w <= a) seg++; // entre qué calles 'a' cae este tramo de la calle 'b'
          return [ka >= 0 ? 'a' + ka : null, kb >= 0 && !cut.has(kb + ':' + seg) ? 'b' + kb : null]; };
        const st = new Map(); for (const i of s) for (const ln of lineOf(i)) if (ln) { let e = st.get(ln); if (!e) st.set(ln, e = [0, 0]); e[0]++; if (dA[i >> 2] < 10) e[1]++; }
        const drop = new Set([...st].filter(([, e]) => e[1] / e[0] > 0.4).map(([ln]) => ln)); // la calle va pegada a la avenida casi todo su largo
        for (const i of s) { const ls = lineOf(i).filter(ln => ln && !drop.has(ln)); t[i] = ls.length ? 1 : 3; orig[i] = 100000 + k; } });
      for (let i = 0; i < NQ; i++) if (art[i]) { t[i] = 1; major[i >> 2] = 1; artM[i >> 2] = 1; }
      // cruces de avenidas: donde se juntan bandas de dos cortes distintos
      { const acc = new Map(); for (let y = 2; y < Rr - 2; y++) for (let x = 2; x < C - 2; x++) { const c0 = artId[(y * C + x) * 4]; if (!c0) continue; const ids = new Set();
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const v = artId[((y + dy) * C + x + dx) * 4]; if (v) ids.add(v); }
          if (ids.size >= 2) { const key = [...ids].sort((a2, b2) => a2 - b2).slice(0, 2).join(','); let a2 = acc.get(key); if (!a2) acc.set(key, a2 = [0, 0, 0]); a2[0] += x; a2[1] += y; a2[2]++; } }
        for (const [, a2] of acc) if (a2[2] >= 6) crossPts.push([Math.round(a2[0] / a2[2]), Math.round(a2[1] / a2[2])]); }
    }
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
      for (const mem of list) { const a = mem.length / 4, tp = t[mem[0]]; if ((tp === 3 && a < 60) || (tp === 4 && a < 80)) for (const i of mem) t[i] = porBarrios && a >= 16 ? 4 : 1; } } // en barrios, un pedazo chico es una placita, no asfalto
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
    if (!porBarrios) { const isRd = c => [0, 1, 2, 3].every(k => t[c * 4 + k] === 1 || t[c * 4 + k] === 2), hasT = (c, v) => [0, 1, 2, 3].some(k => t[c * 4 + k] === v);
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
      for (let c = 0; c < C * Rr; c++) if (zone[c] && [0, 1, 2, 3].some(k => t[c * 4 + k] === 1)) { major[c] = 1; artM[c] = 1; }
    }
    // avenida-autopista que cruza la ciudad pasando junto a la plaza: 12 de ancho (veredas + calzada con mediana)
    let nBlvd = 0;
    { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, cx0 = 1e9, cx1 = -1, cy0 = 1e9, cy1 = -1;
      for (let i = 0; i < NQ; i++) { const c = i >> 2, x = c % C, y = (c / C) | 0; if (t[i] === 2) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } if (t[i]) { cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); cy0 = Math.min(cy0, y); cy1 = Math.max(cy1, y); } }
      if (x1 >= 0 && o.avenidaCentral !== false && !porBarrios) { const horiz = cx1 - cx0 >= cy1 - cy0, side = chance(0.5), W2 = 16;
        const p0 = horiz ? (side ? y1 + 12 : y0 - 12 - W2) : (side ? x1 + 12 : x0 - 12 - W2);
        if (p0 > (horiz ? cy0 : cx0) + 10 && p0 + W2 < (horiz ? cy1 : cx1) - 10) { nBlvd = 1;
          for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) { const v = horiz ? y : x; if (v < p0 || v >= p0 + W2) continue; for (let k = 0; k < 4; k++) { const i = (y * C + x) * 4 + k; if (t[i] === 3 || t[i] === 4) t[i] = 1; } major[y * C + x] = 1; avM[y * C + x] = 1; } } } }
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
    // puntas de manzana a 45° (cuadrícula diagonal contra avenida recta): la punta se corta y queda una cara plana
    if (porBarrios) for (let pass = 0; pass < 4; pass++) { const nt = new Uint8Array(t), B3 = v => v === 3 || v === 4, F2 = (x, y, k) => x < 0 || y < 0 || x >= C || y >= Rr ? 0 : t[(y * C + x) * 4 + k];
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) { const i = (y * C + x) * 4, N = t[i], E = t[i + 1], S = t[i + 2], O = t[i + 3];
        const outer = [[x, y - 1, 2], [x + 1, y, 3], [x, y + 1, 0], [x - 1, y, 1]]; // N, E, S, O: el cuarto vecino que mira hacia acá
        if (N === E && E === S && S === O) { if (B3(N) && outer.filter(([xx, yy, k]) => B3(F2(xx, yy, k))).length <= 1) for (let k = 0; k < 4; k++) nt[i + k] = 1; continue; } // celda suelta en punta
        let half = null; if (N === E && S === O && N !== S) half = B3(N) && S === 1 ? [0, 1] : B3(S) && N === 1 ? [2, 3] : null; else if (N === O && S === E && N !== S) half = B3(N) && S === 1 ? [0, 3] : B3(S) && N === 1 ? [1, 2] : null;
        if (!half) continue; if (half.filter(k => B3(F2(...outer[k]))).length <= 1) for (let k = 0; k < 4; k++) nt[i + k] = 1; } // media celda en punta (toca manzana por un solo lado)
      t = nt; }
    // la plaza siempre rodeada de césped (2) y después de pista (6)
    { const P = t.map(v => v === 2 ? 1 : 0), g2 = grow(P, 2), r8 = grow(g2, 8);
      for (let i = 0; i < NQ; i++) { if (t[i] === 0 || P[i]) continue; if (g2[i]) t[i] = 5; else if (r8[i]) { t[i] = 1; major[i >> 2] = 1; } }
      const { list } = comps((i, j) => (t[i] === 3 || t[i] === 4) && t[j] === t[i] && orig[j] === orig[i]);
      for (const mem of list) if (mem.length / 4 < 60) for (const i of mem) t[i] = 1; }
    // las calles de menos de 3 de ancho no son pista: son pasajes peatonales (personas y bicis)
    { const full = c => [0, 1, 2, 3].every(k => t[c * 4 + k] === 1 || t[c * 4 + k] === 0), core = new Uint8Array(NQ); // el campo cuenta como abierto
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) { let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!full((y + dy) * C + x + dx)) { ok = false; break; } if (ok) for (let k = 0; k < 4; k++) core[(y * C + x) * 4 + k] = 1; }
      const wide = grow(core, 2); for (let i = 0; i < NQ; i++) if (t[i] === 1 && !wide[i]) t[i] = 6; // margen de 2: los medios cuartos de un borde diagonal no cuentan como angostos
      const { list } = comps((i, j) => t[i] === 6 && t[j] === 6); for (const mem of list) if (mem.length / 4 < 12) for (const i of mem) t[i] = 1; } // pedacitos sueltos no son pasaje
    // pasajes: callejones peatonales sin salida (2 de ancho) que entran desde la calle hasta el medio de algunas manzanas rectas
    let nPas = 0;
    { const { list } = comps((i, j) => t[i] === 3 && t[j] === 3 && orig[j] === orig[i]);
      for (const mem of list) {
        if (mem.length / 4 < 350 || !chance(0.5)) continue;
        let d = 0, a2 = 0; for (const i of mem) nb(i, j => { if (!(t[j] === 3 && orig[j] === orig[i])) (i >> 2) === (j >> 2) ? d++ : a2++; }); if (d * 1.41 > a2 * 0.3) continue; // solo manzanas rectas
        let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (const i of mem) { const c = i >> 2, x = c % C, y = (c / C) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const vert = x1 - x0 >= y1 - y0, mid = vert ? Math.round((x0 + x1) / 2) : Math.round((y0 + y1) / 2), fromLow = chance(0.5);
        const end = vert ? Math.round((y0 + y1) / 2) : Math.round((x0 + x1) / 2), full3 = c => [0, 1, 2, 3].every(k => t[c * 4 + k] === 3);
        const cells = []; let ok = true;
        for (let v = fromLow ? (vert ? y0 : x0) : (vert ? y1 : x1); fromLow ? v <= end : v >= end; v += fromLow ? 1 : -1) for (const w of [mid - 1, mid]) { const c = vert ? v * C + w : w * C + v; if (!full3(c)) { ok = false; break; } cells.push(c); }
        if (!ok || cells.length < 16) continue;
        for (const c of cells) for (let k = 0; k < 4; k++) t[c * 4 + k] = 6; nPas++;
      } }
    // rotondas (óvalos) donde se cruzan las vías principales: el cruce se abre en un octógono con una isla de pasto al medio
    let nRot = 0, nIsla = 0; const rotPts = [], decoPts = []; // decoPts: islas donde va una estatua, un letrero o un árbol
    { const pts = []; const overlap = (A, B) => { const seen = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) { if (!A[c] || !B[c] || seen[c]) continue; let sx = 0, sy = 0, k2 = 0; const st = [c]; seen[c] = 1;
          while (st.length) { const d = st.pop(), x = d % C, y = (d / C) | 0; sx += x; sy += y; k2++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * C + nx; if (nx >= 0 && ny >= 0 && nx < C && ny < Rr && A[j] && B[j] && !seen[j]) { seen[j] = 1; st.push(j); } } }
          if (k2 >= 20) pts.push([Math.round(sx / k2), Math.round(sy / k2)]); } };
      overlap(avM, artM); overlap(hwyM, ringM); overlap(artM, ringM); pts.push(...crossPts);
      const chosen = []; for (const p of mezcla(pts, R)) if (chosen.length < (n >= 14 ? 5 : 4) && chosen.every(q2 => Math.hypot(q2[0] - p[0], q2[1] - p[1]) > 40)) chosen.push(p);
      // óvalo de verdad: isla de pasto de radio 5 y un anillo de 2 carriles (9 de ancho) alrededor; nunca pegado al campo
      for (const [cx, cy] of chosen) { let near = false; for (let y = cy - 16; y <= cy + 16 && !near; y++) for (let x = cx - 16; x <= cx + 16; x++) { if (x < 0 || y < 0 || x >= C || y >= Rr) { near = true; break; } const tt = [0, 1, 2, 3].map(k => t[(y * C + x) * 4 + k]); if (tt.some(v => v === 2 || v === 5) || (Math.abs(x - cx) < 12 && Math.abs(y - cy) < 12 && Math.abs(x - cx) + Math.abs(y - cy) < 16 && tt.includes(0))) { near = true; break; } }
        if (near) continue; nRot++; rotPts.push([cx, cy]); // nunca junto a la plaza ni a su césped, ni con el campo dentro
        for (let y = cy - 15; y <= cy + 15; y++) for (let x = cx - 15; x <= cx + 15; x++) { if (x < 0 || y < 0 || x >= C || y >= Rr) continue; for (let k = 0; k < 4; k++) {
          const i = (y * C + x) * 4 + k, dx = Math.abs(x + CEN[k][0] - cx), dy = Math.abs(y + CEN[k][1] - cy);
          if (dx < 5 && dy < 5 && dx + dy < 7) t[i] = 9; // isla de la rotonda
          else if (dx < 14 && dy < 14 && dx + dy < 20 && t[i] !== 0 && t[i] !== 2) t[i] = 1; } } } }
    // plazuelas: donde el asfalto sobra (a más de 7 celdas de cualquier borde, fuera de avenidas y óvalos), el centro de ese
    // espacio pasa a ser una plazuela verde con su vereda; alrededor queda una calzada normal de ~6
    let nPlazuela = 0;
    { const NR = t.map(v => v === 1 ? 0 : 1), G = grow(NR, 7), I0 = new Uint8Array(NQ); // por cuartos: las diagonales del borde quedan limpias
      const nearRot = c => rotPts.some(([rx, ry]) => Math.max(Math.abs(c % C - rx), Math.abs(((c / C) | 0) - ry)) < 18);
      for (let i = 0; i < NQ; i++) if (t[i] === 1 && !G[i] && !major[i >> 2] && !nearRot(i >> 2)) I0[i] = 1;
      const I1 = grow(I0, 1); for (let i = 0; i < NQ; i++) if (I1[i] && t[i] !== 1) I1[i] = 0;
      const seen = new Uint8Array(NQ); for (let s0 = 0; s0 < NQ; s0++) { if (!I1[s0] || seen[s0]) continue; const st = [s0], mem = []; seen[s0] = 1;
        while (st.length) { const i = st.pop(); mem.push(i); nb(i, j => { if (I1[j] && !seen[j]) { seen[j] = 1; st.push(j); } }); }
        if (mem.length / 4 < 9) continue; nPlazuela++; for (const i of mem) t[i] = 4; // hueco → plazuela o juegos
        let sx = 0, sy = 0; for (const i of mem) { const c = i >> 2; sx += c % C; sy += (c / C) | 0; } decoPts.push([Math.round(sx / mem.length) + 0.5, Math.round(sy / mem.length) + 0.5]); } }
    // asfalto que sobra: donde la calzada es muy ancha en todas direcciones, una isla verde al medio (la vía no queda tan vacía)
    { const R1 = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) R1[c] = [0, 1, 2, 3].every(k => t[c * 4 + k] === 1) ? 1 : 0;
      const rad = 12, cand = []; for (let y = rad; y < Rr - rad; y += 2) for (let x = rad; x < C - rad; x += 2) { if (!R1[y * C + x]) continue; let ok = true; for (let dy = -rad; dy <= rad && ok; dy++) for (let dx = -rad; dx <= rad; dx++) if (Math.abs(dx) + Math.abs(dy) <= rad + 4 && !R1[(y + dy) * C + x + dx]) { ok = false; break; } if (ok) cand.push([x, y]); }
      const pick = []; for (const p of mezcla(cand, R)) if ([...pick, ...rotPts].every(q2 => Math.hypot(q2[0] - p[0], q2[1] - p[1]) > 28)) pick.push(p);
      for (const [cx, cy] of pick) for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) for (let k = 0; k < 4; k++) { const i = (y * C + x) * 4 + k, dx = Math.abs(x + CEN[k][0] - cx), dy = Math.abs(y + CEN[k][1] - cy); if (dx < 4 && dy < 4 && dx + dy < 6 && t[i] === 1) t[i] = 9; } // isla octogonal
      nIsla = pick.length; decoPts.push(...pick); }
    // veredas: la franja de calle pegada a manzanas, parques y césped
    { const B = t.map(v => v === 3 || v === 4 || v === 5 ? 1 : 0), V = grow(B, 1); for (let i = 0; i < NQ; i++) if (t[i] === 1 && V[i]) t[i] = 7; }
    // el anillo y las autopistas también tienen vereda del lado del campo: veredas a ambos lados
    { const O = t.map(v => v === 0 ? 1 : 0), V = grow(O, 1); for (let i = 0; i < NQ; i++) if (t[i] === 1 && V[i]) t[i] = 7; }
    // la calzada es para vehículos: un tramo de menos de 3 de ancho no lleva autos y pasa a ser vereda
    { const full = c => [0, 1, 2, 3].every(k => t[c * 4 + k] === 1), core = new Uint8Array(NQ);
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) { let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!full((y + dy) * C + x + dx)) { ok = false; break; } if (ok) for (let k = 0; k < 4; k++) core[(y * C + x) * 4 + k] = 1; }
      const wide = grow(core, 2); for (let i = 0; i < NQ; i++) if (t[i] === 1 && !wide[i]) t[i] = 7; } // sin escalones en las diagonales
    // veredas suaves: sin dientes de sierra entre vereda y calzada (cada celda sigue a la mayoría de sus vecinas)
    for (let pass = 0; pass < 3; pass++) { const nt = new Uint8Array(t);
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) { const c = y * C + x, qs = [0, 1, 2, 3].map(k => t[c * 4 + k]); if (!qs.every(v => v === 1 || v === 7)) continue;
        let nV = 0, nR2 = 0, nearB = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const j = ((y + dy) * C + x + dx) * 4, vs = [t[j], t[j + 1], t[j + 2], t[j + 3]]; if (vs.every(v => v === 7)) nV++; else if (vs.every(v => v === 1)) nR2++; if (vs.some(v => v === 3 || v === 4 || v === 5)) nearB = true; }
        if (nR2 >= 5 && nV <= 2 && !nearB && qs.some(v => v === 7)) for (let k = 0; k < 4; k++) nt[c * 4 + k] = 1; // diente de vereda suelto en la calzada
        else if (nV >= 5 && nR2 <= 2 && qs.some(v => v === 1)) for (let k = 0; k < 4; k++) nt[c * 4 + k] = 7; } // muesca de calzada en la vereda
      t = nt; }
    // etiquetas finales: calzada, plaza, vereda, pasaje, césped de la plaza; parques; manzanas en lotes con casa y patio
    const q = new Int32Array(NQ), kinds = ['out', 'corr', 'plaza', 'vereda', 'pasaje', 'parque'], houseOfL = [0, 0, 0, 0, 0, 0], houses = new Map();
    for (let i = 0; i < NQ; i++) q[i] = t[i] === 1 ? ROAD : t[i] === 2 ? PLAZA : t[i] === 7 ? VEREDA : t[i] === 6 ? PASAJE : t[i] === 5 ? RING : 0;
    // la plaza con diseño: fuente octogonal al centro, anillo para caminar, senderos en cruz, canteros con esquinas biseladas
    const plazaObj = [];
    { const pq = []; for (let i = 0; i < NQ; i++) if (t[i] === 2) pq.push(i);
      if (pq.length) { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const inP = new Set(pq);
        // el rectángulo más grande alrededor del centro de la plaza
        let sx = 0, sy = 0; for (const i of pq) { const c = i >> 2; sx += c % C; sy += (c / C) | 0; } const cx = Math.round(sx / pq.length), cy = Math.round(sy / pq.length);
        const fullIn = (a0, a1, b0, b1) => { for (let y = b0; y < b1; y++) for (let x = a0; x < a1; x++) for (let k = 0; k < 4; k++) if (!inP.has((y * C + x) * 4 + k)) return false; return true; };
        let a0 = cx - 2, a1 = cx + 2, b0 = cy - 2, b1 = cy + 2, grew = true; if (fullIn(a0, a1, b0, b1)) { while (grew) { grew = false; for (const sd of [0, 1, 2, 3]) { const tt = [a0, a1, b0, b1]; tt[sd] += sd % 2 ? 1 : -1; if (fullIn(...tt)) { [a0, a1, b0, b1] = tt; grew = true; } } } }
        const hw = Math.min(cx - a0, a1 - cx), hh = Math.min(cy - b0, b1 - cy);
        if (hw >= 10 && hh >= 10) { const r = Math.max(3, Math.round(Math.min(hw, hh) * 0.16)), rr = Math.round(r * 1.5), fl = kinds.length, cl = fl + 1; kinds.push('agua', 'cantero'); houseOfL.push(0, 0);
          const out2 = hw + hh - 6; // bisel de las esquinas exteriores de los canteros
          for (let y = cy - hh; y < cy + hh; y++) for (let x = cx - hw; x < cx + hw; x++) for (let k = 0; k < 4; k++) {
            const i = (y * C + x) * 4 + k, dx = Math.abs(x + CEN[k][0] - cx), dy = Math.abs(y + CEN[k][1] - cy);
            if (dx < r && dy < r && dx + dy < rr) q[i] = fl; // fuente
            else if (dx >= 2 && dy >= 2 && dx < hw - 3 && dy < hh - 3 && !(dx < r + 3 && dy < r + 3 && dx + dy < rr + 4) && dx + dy < out2) q[i] = cl; } // canteros
          for (const [sx2, sy2] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { plazaObj.push({ tipo: 'arbol', x: cx + sx2 * (hw * 0.55), y: cy + sy2 * (hh * 0.55) }); plazaObj.push({ tipo: 'banca', x: cx + sx2 * (r + 1.5), y: cy + sy2 * (r + 1.5) }); }
          plazaObj.push({ tipo: 'fuente', x: cx, y: cy, r }); } } }
    { let rl = 0; for (let i = 0; i < NQ; i++) if (t[i] === 9) { if (!rl) { kinds.push('rotonda'); houseOfL.push(0); rl = kinds.length - 1; } q[i] = rl; } }
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
        { const key = new Map(cs.map(c => [c, Math.abs(c - mid) + (R() - 0.5) * 3])); cs.sort((p, r2) => key.get(p) - key.get(r2)); }
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
    const splitN = (set, nR, minA, diag, minT = 4) => { const lv = [set], stuck = new Set(); while (lv.length < nR) { let bi = -1; lv.forEach((s, k) => { if (!stuck.has(s) && (bi < 0 || s.length > lv[bi].length)) bi = k; }); if (bi < 0) break; const r = cut(lv[bi], minA, diag, minT) || cut(lv[bi], minA, !diag, minT); if (!r) stuck.add(lv[bi]); else lv.splice(bi, 1, r[0], r[1]); } return lv; };
    // el rectángulo más grande (en la orientación pedida) que entra en un terreno; en diagonal sus bordes caen en vértices
    const rectIn = (set, dg) => {
      if (!set.length) return null;
      // semilla: el punto más hondo del terreno (lo último que queda al ir comiendo los bordes)
      let deep = set; for (let g2 = 0; g2 < 40; g2++) { const nx = erode(deep, 1); if (!nx.length) break; deep = nx; }
      const inS = new Set(set), st = dg ? 2 : 1, c0 = deep[0] >> 2, sx = c0 % C + 0.5, sy = ((c0 / C) | 0) + 0.5;
      let u0, u1, v0, v1; if (dg) { const u = Math.round(sx + sy), v = Math.round(sx - sy); u0 = u - (u & 1) - 2; u1 = u0 + 4; v0 = v - ((v - u0) & 1) - 2; v1 = v0 + 4; } else { u0 = Math.floor(sx) - 1; u1 = u0 + 3; v0 = Math.floor(sy) - 1; v1 = v0 + 3; }
      const quartersIn = (a0, a1, b0, b1) => { const out = []; // cuartos cuyo centro cae en el rectángulo (en coordenadas del marco)
        const xs = dg ? [Math.floor((a0 + b0) / 2) - 1, Math.ceil((a1 + b1) / 2) + 1] : [a0 - 1, a1 + 1], ys = dg ? [Math.floor((a0 - b1) / 2) - 1, Math.ceil((a1 - b0) / 2) + 1] : [b0 - 1, b1 + 1];
        for (let y = Math.max(0, ys[0]); y <= Math.min(Rr - 1, ys[1]); y++) for (let x = Math.max(0, xs[0]); x <= Math.min(C - 1, xs[1]); x++) for (let k = 0; k < 4; k++) { const px = x + CEN[k][0], py = y + CEN[k][1], f0 = dg ? px + py : px, f1 = dg ? px - py : py; if (f0 > a0 && f0 < a1 && f1 > b0 && f1 < b1) out.push((y * C + x) * 4 + k); }
        return out; };
      const fits = (a0, a1, b0, b1) => quartersIn(a0, a1, b0, b1).every(i => inS.has(i));
      if (!fits(u0, u1, v0, v1)) return null;
      let grew = true; while (grew) { grew = false;
        for (const side of [0, 1, 2, 3]) { const t2 = [u0, u1, v0, v1]; t2[side] += side % 2 ? st : -st; if (fits(...t2)) { [u0, u1, v0, v1] = t2; grew = true; } } }
      return quartersIn(u0, u1, v0, v1);
    };
    // centro comercial en "pesa" (dumbbell): un ancla en cada punta, pasillo central con locales enfrentados a los dos lados
    // y un pasaje en el medio que lleva a la calle por ambos lados; simétrico respecto al pasillo
    // corte en una posición pedida (o la válida más cercana), siempre en "T" contra paredes
    const cutAt = (set, diag, ax, want, range = 4) => {
      stamp++; let xs0 = 1e9, xs1 = -1, ys0 = 1e9, ys1 = -1;
      for (const i of set) { mk[i] = stamp; const c = i >> 2, x = c % C, y = (c / C) | 0; if (x < xs0) xs0 = x; if (x > xs1) xs1 = x; if (y < ys0) ys0 = y; if (y > ys1) ys1 = y; }
      const fr = set.map(i => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return diag ? [px + py, px - py] : [px, py]; });
      for (let d = 0; d <= range; d++) for (const sg of d ? [1, -1] : [1]) { const c = want + d * sg; if (!endsOK(diag, ax, c, xs0 - 1, xs1 + 1, ys0 - 1, ys1 + 1)) continue; const A2 = [], B2 = []; set.forEach((i, k) => (fr[k][ax] < c ? A2 : B2).push(i)); if (A2.length && B2.length) return [A2, B2]; }
      return null;
    };
    const extOf = (set, diag) => { const e = [[1e9, -1e9], [1e9, -1e9]]; for (const i of set) { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1], f = diag ? [px + py, px - py] : [px, py]; for (const ax of [0, 1]) { e[ax][0] = Math.min(e[ax][0], f[ax]); e[ax][1] = Math.max(e[ax][1], f[ax]); } } return e.map(([lo, hi]) => [Math.floor(lo), Math.ceil(hi)]); };
    // centro comercial en "pesa" (dumbbell): un ancla en cada punta, pasillo central de 4 con locales enfrentados a los dos
    // lados y un pasaje al medio que lleva a la calle; todo con cortes válidos de la rejilla (simétrico respecto al pasillo)
    const mallLayout = (mem, diag) => {
      const sc = diag ? Math.SQRT1_2 : 1, ext = extOf(mem, diag), L = (ext[0][1] - ext[0][0]) >= (ext[1][1] - ext[1][0]) ? 0 : 1, P = 1 - L;
      if ((ext[L][1] - ext[L][0]) * sc < 30 || (ext[P][1] - ext[P][0]) * sc < 18) return null; // nunca un centro comercial delgado
      const anc = Math.round(Math.max(6, (ext[L][1] - ext[L][0]) * sc * 0.2) / sc);
      const s1 = cutAt(mem, diag, L, ext[L][0] + anc, 10); if (!s1) return null;
      const s2 = cutAt(s1[1], diag, L, ext[L][1] - anc, 10); if (!s2) return null;
      const mid = s2[0], pe = extOf(mid, diag)[P], pm = Math.round((pe[0] + pe[1]) / 2), half = Math.round(2 / sc);
      const s3 = cutAt(mid, diag, P, pm - half, 2); if (!s3) return null;
      const s4 = cutAt(s3[1], diag, P, pm + half, 2); if (!s4) return null;
      const shopW = Math.round(rnd(4, 5) / sc); // muchos locales chicos
      const shops = side => { const out = []; let cur = side; for (let g2 = 0; g2 < 40; g2++) { const lo = extOf(cur, diag)[L][0], r = cutAt(cur, diag, L, lo + shopW, 1); if (!r || r[1].length / 4 < 16 || r[0].length / 4 < 12) { out.push(cur); break; } out.push(r[0]); cur = r[1]; } return out; };
      const A = shops(s3[0]), B = shops(s4[1]), ma = A.length >> 1, mb = B.length >> 1;
      const corridor = s4[0].concat(A.length > 2 ? A[ma] : [], B.length > 2 ? B[mb] : []);
      const locals = [...A.filter((_, k) => A.length <= 2 || k !== ma), ...B.filter((_, k) => B.length <= 2 || k !== mb)];
      const sideA = A.filter((_, k) => A.length <= 2 || k !== ma).length;
      return { rooms: [s1[0], s2[1], corridor, ...locals], hub: 2, roles: ['ancla', 'ancla', 'pasillo', ...locals.map((_, k) => k < sideA ? 'local' : 'localB')] };
    };
    // plantillas de edificios por franjas: frente (a la calle), pasillo, fondo; cada franja en piezas a lo largo
    const bandsOf = (set, diag, depths) => {
      const sc = diag ? Math.SQRT1_2 : 1, e = extOf(set, diag), L = (e[0][1] - e[0][0]) >= (e[1][1] - e[1][0]) ? 0 : 1, P = 1 - L, out = []; let cur = set;
      for (const d of depths) { const lo = extOf(cur, diag)[P][0], r = cutAt(cur, diag, P, lo + Math.round(d / sc), 2); if (!r || !r[1].length) return null; out.push(r[0]); cur = r[1]; }
      out.push(cur); return { out, L, P, sc };
    };
    const strips = (set, diag, L, w, minLast) => { const sc = diag ? Math.SQRT1_2 : 1, out = []; let cur = set;
      for (let g2 = 0; g2 < 60; g2++) { const lo = extOf(cur, diag)[L][0], r = cutAt(cur, diag, L, lo + Math.round(w / sc), 1); if (!r || r[1].length / 4 < minLast || r[0].length / 4 < 9) { out.push(cur); break; } out.push(r[0]); cur = r[1]; } return out; };
    // frente en 3: una punta, el medio (grande) y la otra punta
    const front3 = (set, diag, L, w) => { const p = strips(set, diag, L, w, w * 3); if (p.length < 3) return p.length === 2 ? [p[0], [], p[1]] : [[], p[0], []]; return [p[0], p.slice(1, -1).flat(), p[p.length - 1]]; };
    const template = (kind, set, diag) => {
      const rooms = [], roles = [], put = (r, role) => { if (r && r.length) { rooms.push(r); roles.push(role); } };
      { const e0 = extOf(set, diag), L0 = (e0[0][1] - e0[0][0]) >= (e0[1][1] - e0[1][0]) ? 0 : 1, D = (e0[1 - L0][1] - e0[1 - L0][0]) * (diag ? Math.SQRT1_2 : 1); if (D < 12) return null;
        var FR = Math.max(5, Math.min(10, Math.round(D * 0.38))), CO = D >= 16 ? 4 : 3; } // frente y pasillo según el fondo
      if (kind === 'policia') { const b = bandsOf(set, diag, [Math.min(FR, 7), CO]); if (!b) return null; const [g, rec, of] = front3(b.out[0], diag, b.L, 9);
        put(g, 'garaje policial'); put(rec, 'recepción'); put(of, 'oficina'); put(b.out[1], 'pasillo');
        const back = b.out[2], deep = (extOf(back, diag)[b.P][1] - extOf(back, diag)[b.P][0]) * b.sc, rowB = deep > 11 ? bandsOf(back, diag, [5]) : null;
        const cellsRow = rowB ? rowB.out[0] : back; const cells = strips(cellsRow, diag, b.L, 4, 9);
        cells.forEach((c2, k2) => put(c2, k2 === cells.length - 1 ? 'interrogatorio' : k2 === 0 && cells.length >= 3 ? 'baños' : 'celda')); if (rowB) put(rowB.out[1], 'patio de presos');
        return { rooms, roles, hub: roles.indexOf('pasillo') }; }
      if (kind === 'hospital') { const b = bandsOf(set, diag, [FR, CO]); if (!b) return null; const [u, rec, fa] = front3(b.out[0], diag, b.L, 10);
        if (rec.length) { put(u, 'urgencias'); put(rec, 'recepción'); put(fa, 'farmacia'); } else { put(u, 'recepción'); put(fa, 'urgencias'); } // la recepción nunca falta put(b.out[1], 'pasillo');
        const back = b.out[2], deep = (extOf(back, diag)[b.P][1] - extOf(back, diag)[b.P][0]) * b.sc, rowB = deep > 13 ? bandsOf(back, diag, [6]) : null;
        const hab = strips(rowB ? rowB.out[0] : back, diag, b.L, 6, 12); hab.forEach((c2, k2) => put(c2, k2 === hab.length - 1 ? 'quirófano' : k2 === 0 && hab.length >= 3 ? 'baños' : 'habitación')); if (rowB) put(rowB.out[1], 'sala de espera');
        return { rooms, roles, hub: roles.indexOf('pasillo') }; }
      if (kind === 'bomberos') { const b = bandsOf(set, diag, [FR, 3]); if (!b) return null;
        strips(b.out[0], diag, b.L, 9, 30).forEach(c2 => put(c2, 'cochera')); put(b.out[1], 'pasillo');
        strips(b.out[2], diag, b.L, 6, 12).forEach((c2, k2) => put(c2, ['dormitorio', 'cocina', 'baños', 'gimnasio', 'sala de guardia', 'oficina'][k2 % 6]));
        return { rooms, roles, hub: roles.indexOf('pasillo') }; }
      if (kind === 'carcel') { const b = bandsOf(set, diag, [Math.min(FR, 5)]); if (!b) return null; put(b.out[0], 'guardia');
        const rest = b.out[1], pe = extOf(rest, diag)[b.P], pm = Math.round((pe[0] + pe[1]) / 2), h2 = Math.round(2 / b.sc);
        const a1 = cutAt(rest, diag, b.P, pm - h2, 2), a2 = a1 && cutAt(a1[1], diag, b.P, pm + h2, 2); if (!a2) return null;
        strips(a1[0], diag, b.L, 4, 9).forEach(c2 => put(c2, 'celda')); put(a2[0], 'pasillo'); strips(a2[1], diag, b.L, 4, 9).forEach(c2 => put(c2, 'celda'));
        return { rooms, roles, hub: roles.indexOf('pasillo') }; }
      if (kind === 'militar') { const b = bandsOf(set, diag, [Math.min(FR, 6), 3]); if (!b) return null; const [m1, m2, m3] = front3(b.out[0], diag, b.L, 8);
        put(m1, 'mando'); put(m2, 'armería'); put(m3, 'enfermería'); put(b.out[1], 'pasillo');
        const bar = strips(b.out[2], diag, b.L, 7, 14); bar.forEach((c2, k2) => put(c2, k2 === bar.length - 1 ? 'comedor' : 'barraca'));
        return { rooms, roles, hub: roles.indexOf('pasillo') }; }
      if (kind === 'comercial') { const e = extOf(set, diag), L = (e[0][1] - e[0][0]) >= (e[1][1] - e[1][0]) ? 0 : 1, P = 1 - L, sc = diag ? Math.SQRT1_2 : 1;
        if ((e[L][1] - e[L][0]) * sc < 22 || (e[P][1] - e[P][0]) * sc < 14) return null;
        const anc = Math.round(Math.max(6, (e[L][1] - e[L][0]) * sc * 0.18) / sc), s1 = cutAt(set, diag, L, e[L][0] + anc, 3), s2 = s1 && cutAt(s1[1], diag, L, e[L][1] - anc, 3); if (!s2) return null;
        const mid = s2[0], pe = extOf(mid, diag)[P], pm = Math.round((pe[0] + pe[1]) / 2), h2 = Math.round(2 / sc);
        const a1 = cutAt(mid, diag, P, pm - h2, 2), a2 = a1 && cutAt(a1[1], diag, P, pm + h2, 2); if (!a2) return null;
        const A = strips(a1[0], diag, L, 7, 16), Bs = strips(a2[1], diag, L, 7, 16), ma = A.length >> 1, mb = Bs.length >> 1;
        put(s1[0], 'tienda ancla'); put(s2[1], 'tienda ancla'); put(a2[0].concat(A.length > 2 ? A[ma] : []), 'pasillo'); // la entrada al medio es parte del pasillo
        A.forEach((c2, k2) => { if (A.length <= 2 || k2 !== ma) put(c2, 'local'); });
        Bs.forEach((c2, k2) => { if (Bs.length > 2 && (k2 === mb || k2 === mb - 1)) return; put(c2, 'local'); }); if (Bs.length > 2) put(Bs[mb - 1].concat(Bs[mb]), 'patio de comidas');
        return { rooms, roles, hub: 2 }; }
      if (kind === 'mercado') { const e1 = extOf(set, diag), D1 = Math.min(e1[0][1] - e1[0][0], e1[1][1] - e1[1][0]) * (diag ? Math.SQRT1_2 : 1), b = bandsOf(set, diag, [Math.max(10, Math.round(D1 * 0.62))]); if (!b) return null; // nave grande de puestos y servicios al fondo
        put(b.out[0], 'nave de puestos'); strips(b.out[1], diag, b.L, 6, 12).forEach((c2, k2) => put(c2, ['depósito', 'frigorífico', 'baños', 'carga'][k2 % 4]));
        return { rooms, roles, hub: 0 }; }
      // condominio: pasillo desde la calle hacia adentro y departamentos a los dos lados (sala y dormitorio cada uno)
      if (kind === 'condominio') { const e = extOf(set, diag), sc = diag ? Math.SQRT1_2 : 1, ax = set.ax ?? ((e[0][1] - e[0][0]) >= (e[1][1] - e[1][0]) ? 0 : 1), A = 1 - ax, wA = (e[A][1] - e[A][0]) * sc; if (wA < 9) return null;
        let sides = null; if (wA >= 13) { const mid = (e[A][0] + e[A][1]) / 2, c1 = cutAt(set, diag, A, Math.round(mid - 1.5 / sc), 3), c2 = c1 && cutAt(c1[1], diag, A, Math.round(mid + 1.5 / sc), 1); if (c2 && c1[0].length / 4 >= 20 && c2[1].length / 4 >= 20) { put(c2[0], 'pasillo'); sides = [c1[0], c2[1]]; } }
        if (!sides) for (const [w0, sg] of [[e[A][0] + Math.round(3 / sc), 1], [e[A][1] - Math.round(3 / sc), -1]]) { const c1 = cutAt(set, diag, A, w0, 2); if (!c1) continue; const [pa, rest] = sg > 0 ? c1 : [c1[1], c1[0]]; if (pa.length / 4 > 3 * 40 || rest.length / 4 < 30) continue; put(pa, 'pasillo'); sides = [rest]; break; } // angosto: pasillo a un lado
        if (!sides) return null;
        let nd = 0;
        for (const side of sides) for (const dep of strips(side, diag, ax, 8, 20)) { nd++; // cada departamento: sala con cocina, dormitorio y baño (o un solo ambiente si es chico)
          const pr3 = dep.length / 4 >= 80 ? splitW(dep, ['sala', 'dormitorio', 'baño'], diag, 3) : null;
          if (pr3 && pr3.length === 3) pr3.forEach(([r4, ro]) => put(r4, ro)); else { const r = dep.length / 4 >= 64 ? (cut(dep, 24, diag, 4) || cut(dep, 24, !diag, 4)) : null; if (r) { put(r[0], 'sala'); put(r[1], 'dormitorio'); } else put(dep, 'departamento'); } }
        return nd >= 2 ? { rooms, roles, hub: 0 } : null; }
      if (kind === 'mansion') { // simétrica: hall y salón al medio, dos alas iguales a los lados
        const e = extOf(set, diag), L = (e[0][1] - e[0][0]) >= (e[1][1] - e[1][0]) ? 0 : 1, P = 1 - L, sc = diag ? Math.SQRT1_2 : 1, wL = (e[L][1] - e[L][0]) * sc, dP = (e[P][1] - e[P][0]) * sc;
        if (wL < 16 || dP < 10) return null; const ww = Math.max(Math.round(5 / sc), Math.round(wL * 0.3 / sc));
        const c1 = cutAt(set, diag, L, e[L][0] + ww, 2), c2 = c1 && cutAt(c1[1], diag, L, e[L][1] - ww, 2); if (!c2) return null;
        const c3 = cutAt(c2[0], diag, P, e[P][0] + Math.round(dP * 0.45 / sc), 1); if (!c3) return null;
        put(c3[0], 'hall'); put(c3[1], 'salón');
        const n3 = dP >= 20 ? 3 : 2, wing = (w, names) => { let cur = w; const ps = []; for (let k2 = 1; k2 < n3; k2++) { const r = cutAt(cur, diag, P, e[P][0] + Math.round(dP * k2 / n3 / sc), 1); if (!r) break; ps.push(r[0]); cur = r[1]; } ps.push(cur); ps.forEach((r2, k2) => put(r2, names[k2])); };
        wing(c1[0], n3 === 3 ? ['comedor', 'cocina', 'baño'] : ['comedor', 'cocina']); wing(c2[1], n3 === 3 ? ['biblioteca', 'sala de juegos', 'baño'] : ['biblioteca', 'baño']);
        return { rooms, roles, hub: 0 }; }
      if (kind === 'escuela') { const b = bandsOf(set, diag, [Math.min(FR, 6), CO]); if (!b) return null; const [d1, rc, en] = front3(b.out[0], diag, b.L, 7);
        // patio de recreo al medio con las aulas alrededor (a los dos lados y al fondo); la dirección adelante da al recreo
        { const b2 = bandsOf(set, diag, [Math.min(FR, 6)]), back = b2 && b2.out[1], eb = back && extOf(back, diag), wL = back ? (eb[b.L][1] - eb[b.L][0]) * b.sc : 0, dP = back ? (eb[b.P][1] - eb[b.P][0]) * b.sc : 0, aw = 6;
          if (back && b2.L === b.L && wL >= 2 * aw + 10 && dP >= aw + 7) { const [f1, f2, f3] = front3(b2.out[0], diag, b.L, 7); rooms.length = 0; roles.length = 0; put(f1, 'dirección'); put(f2, 'recepción'); put(f3, 'enfermería');
            const c1 = cutAt(back, diag, b.L, eb[b.L][0] + Math.round(aw / b.sc), 2), c2 = c1 && cutAt(c1[1], diag, b.L, eb[b.L][1] - Math.round(aw / b.sc), 2);
            const mid = c2 && c2[0], em = mid && extOf(mid, diag), c3 = mid && cutAt(mid, diag, b.P, em[b.P][1] - Math.round(aw / b.sc), 2);
            if (c3) { const colA = strips(c1[0], diag, b.P, 7, 14), colB = strips(c2[1], diag, b.P, 7, 14), row = strips(c3[1], diag, b.L, 8, 16);
              put(c3[0], 'patio de recreo'); colA.forEach(r2 => put(r2, 'aula')); row.forEach((r2, k2) => put(r2, k2 === row.length - 1 && row.length > 2 ? 'gimnasio' : 'aula')); colB.forEach((r2, k2) => put(r2, k2 === colB.length - 1 ? 'baños' : 'aula'));
              return { rooms, roles, hub: roles.indexOf('patio de recreo') }; } } }
        put(d1, 'dirección'); put(rc, 'recepción'); put(en, 'enfermería'); put(b.out[1], 'pasillo');
        const au = strips(b.out[2], diag, b.L, 7, 14); au.forEach((c2, k2) => put(c2, k2 === au.length - 1 ? 'gimnasio' : 'aula'));
        return { rooms, roles, hub: roles.indexOf('pasillo') }; }
      return null;
    };
    const newLabel = (kind, hid) => { kinds.push(kind); houseOfL.push(hid); return kinds.length - 1; };
    const roadNb = i => { let r = false; nb(i, j => { if (t[j] === 1 || t[j] === 6 || t[j] === 7) r = true; }); return r; };
    // programa de una casa: cada cuarto con su peso de área (la sala es la más grande y da a la calle, el baño es la mitad
    // de un dormitorio, la cocina como un dormitorio y hacia el patio); el corte cae donde reparte el área según los pesos
    const PROG = { sala: [2, 36, 2], garaje: [1.4, 32, 1], cocina: [1.05, 26, -1], dormitorio: [1, 26, 0], baño: [0.4, 14, -0.5], estudio: [0.8, 20, 0],
      local: [2.4, 40, 2], lobby: [2.2, 40, 2], depósito: [1, 20, -1], recepción: [1.3, 26, 2], oficina: [1, 22, 0], 'sala de reuniones': [1.2, 26, 0], comedor: [2, 36, 2], 'sala de ventas': [3, 60, 2], carga: [0.8, 24, -1] };
    const negocioProg = (type, a) => type === 'tienda' ? (a >= 95 ? ['local', 'baño', 'depósito'] : ['local', 'baño']) : type === 'oficinas' ? ['recepción', 'baño', 'oficina', ...(a >= 160 ? ['sala de reuniones'] : []), 'oficina', ...(a >= 220 ? ['oficina'] : [])] : type === 'comida' ? ['comedor', 'baño', 'cocina'] : type === 'corporativo' ? ['lobby', 'baño', 'oficina', 'recepción', 'sala de reuniones', 'oficina'] : ['sala de ventas', 'baño', 'depósito', 'carga']; // programa mínimo de cada negocio (si un corte no entra se pierde el último: lo menos importante va al final) // [peso, área mínima, cuánto quiere la calle]
    const casaProg = (nR, dpto = false) => { const p = dpto ? ['sala', 'dormitorio', 'baño', 'cocina'] : ['sala', 'cocina', 'baño']; if (nR >= 5) p.push('garaje'); while (p.length < nR) p.push(p.length === 6 ? 'baño' : 'dormitorio'); return p; };
    const cutFrac = (set, f, minA, minB, diag, minT, tA = minT, tB = minT) => {
      stamp++; let xs0 = 1e9, xs1 = -1, ys0 = 1e9, ys1 = -1;
      for (const i of set) { mk[i] = stamp; const c = i >> 2, x = c % C, y = (c / C) | 0; if (x < xs0) xs0 = x; if (x > xs1) xs1 = x; if (y < ys0) ys0 = y; if (y > ys1) ys1 = y; }
      const fr = set.map(i => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return diag ? [px + py, px - py] : [px, py]; });
      const sc = diag ? Math.SQRT1_2 : 1, n4 = set.length / 4, cands = [];
      for (const ax of [0, 1]) {
        const vs = fr.map(f2 => f2[ax]).sort((p, r2) => p - r2), lo = Math.floor(vs[0]), hi = Math.ceil(vs[vs.length - 1]);
        if ((hi - lo) * sc < tA + tB) continue;
        for (let c = lo; c <= hi; c++) { const wl = (c - lo) * sc, wh = (hi - c) * sc; let a = 0, b = vs.length; while (a < b) { const m2 = (a + b) >> 1; if (vs[m2] < c) a = m2 + 1; else b = m2; }
          for (const flip of [false, true]) { if ((flip ? wh : wl) < tA || (flip ? wl : wh) < tB) continue; const nA = (flip ? vs.length - a : a) / 4; if (nA >= minA && n4 - nA >= minB) cands.push([Math.abs(nA / n4 - f) + R() * 0.02 - (hi - lo) * sc * 0.001, ax, c, flip]); } }
      }
      cands.sort((p, r2) => p[0] - r2[0]);
      for (const [, ax, c, flip] of cands) { if (!endsOK(diag, ax, c, xs0 - 1, xs1 + 1, ys0 - 1, ys1 + 1)) continue; const A2 = [], B2 = []; set.forEach((i, k) => ((fr[k][ax] < c) !== flip ? A2 : B2).push(i)); return [A2, B2]; }
      return null;
    };
    const splitW = (set, roles, diag, minT = 4, fp = null) => {
      if (roles.length < 2) return [[set, roles[0]]];
      const W2 = roles.map(r => PROG[r][0]), tot = W2.reduce((a, b) => a + b, 0); let best = null, bs = 1e9;
      for (let m2 = 1; m2 < (1 << roles.length) - 1; m2++) { if (!(m2 & 1)) continue; // el grupo A lleva siempre el primer cuarto (la sala)
        let sa = 0; roles.forEach((r, k) => { if (m2 >> k & 1) sa += W2[k]; }); const g = roles.map((r, k) => m2 >> k & 1), gar = roles.indexOf('garaje');
        const s2 = Math.abs(sa / tot - 0.5) + (gar > 0 && !g[gar] ? 0.08 : 0) + R() * 0.03; if (s2 < bs) { bs = s2; best = g; } }
      const gA = roles.filter((r, k) => best[k]), gB = roles.filter((r, k) => !best[k]), mins = g => g.reduce((a, r) => a + PROG[r][1], 0), pull = g => g.reduce((a, r) => a + PROG[r][2], 0) / g.length;
      const fA = gA.reduce((a, r) => a + PROG[r][0], 0) / tot; const tw = g => g.length === 1 && g[0] === 'baño' ? 3 : minT; // el baño puede ser angosto (3)
      let r2 = cutFrac(set, fA, mins(gA), mins(gB), diag, minT, tw(gA), tw(gB)) || cutFrac(set, fA, mins(gA), mins(gB), !diag, minT, tw(gA), tw(gB));
      if (!r2) { const r4 = cut(set, 16, diag, minT) || cut(set, 16, !diag, minT); if (r4) r2 = Math.abs(r4[0].length / set.length - fA) < Math.abs(r4[1].length / set.length - fA) ? r4 : [r4[1], r4[0]]; } // cualquier corte válido antes que perder cuartos
      if (!r2) { if (roles.length > 2) return splitW(set, roles.slice(0, -1), diag, minT); return [[set, roles[0]]]; } // no entra: un cuarto menos
      let [A2, B2] = r2; const road = s => { if (!fp) return 0; let d = 0; for (const i of s) { const c = i >> 2; d += Math.hypot(c % C - fp[0], ((c / C) | 0) - fp[1]); } return -d / s.length; }; // cerca del frente del lote
      if ((road(A2) - road(B2)) * (pull(gA) - pull(gB)) < 0) { const sa2 = A2.length / 4, fB = sa2 / (sa2 + B2.length / 4); // el lado de la calle para el grupo que la quiere
        const r3 = cutFrac(set, 1 - fA, mins(gB), mins(gA), diag, minT, tw(gB), tw(gA)); if (r3 && (road(r3[1]) - road(r3[0])) * (pull(gA) - pull(gB)) >= 0) [B2, A2] = r3; else if (Math.abs(fB - fA) < 0.15 && mins(gA) <= B2.length / 4 && mins(gB) <= sa2) [A2, B2] = [B2, A2]; }
      return [...splitW(A2, gA, diag, minT, fp), ...splitW(B2, gB, diag, minT, fp)];
    };
    const erode = (set, steps) => { let cur = set; for (let s2 = 0; s2 < steps; s2++) { stamp++; for (const i of cur) mk[i] = stamp; cur = cur.filter(i => { const c = i >> 2, k = i & 3, x = c % C, y = (c / C) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inQ(x + dx, y + dy, k)) return false; return true; }); } return cur; };
    let nextH = 1, nMalls = 0, nPark = 0, nMans = 0, nSolo = 0, nAnexo = 0, nProg = 0, nVerde = 0, nEntP = 0, nJardin = 0, nVerAseg = 0;
    const roleOf = new Map(); // uso de cada cuarto: sala, cocina, garaje, dormitorio, baño, local...
    const addHouse = (type, zone, rooms, patio, hub = -1, roles = null) => {
      const hid = nextH++, all = rooms.flat(), [hx, hy] = centerOf(all), h = { id: hid, type, zone, cx: hx, cy: hy, area: all.length / 4, rooms: new Set(), patio: 0, refuge: false };
      houses.set(hid, h);
      for (const r of rooms) { const l = newLabel('room', hid); h.rooms.add(l); for (const i of r) q[i] = l; }
      if (patio && patio.length) { const l = newLabel('patio', hid); h.patio = l; for (const i of patio) q[i] = l; }
      if (hub >= 0) h.hub = [...h.rooms][hub];
      if (roles) [...h.rooms].forEach((l, k2) => roleOf.set(l, roles[k2]));
      return h;
    };
    const bz = blocks.filter(b => t[b[0]] === 3).map(b => ({ b, zone: zoneOf(...centerOf(b)) }));
    // edificios especiales con plantilla (se repiten según el tamaño de la ciudad): hospital, comisaría con celdas, bomberos,
    // base militar y cárcel en las afueras, parque con lago; el centro comercial va en la manzana más grande del centro
    const special = new Map(), used = new Set(), big = (z, min, max = 1e9) => bz.filter(x => !used.has(x.b) && z.includes(x.zone) && x.b.length / 4 >= min && x.b.length / 4 <= max).sort((p, r2) => r2.b.length - p.b.length);
    const forcedMall = bz.filter(x => x.zone !== 'suburbio').sort((p, r2) => r2.b.length - p.b.length)[0]?.b; if (forcedMall) used.add(forcedMall);
    const take = (kind, list, far = false) => { const x = far ? list.sort((p, r2) => Math.hypot(...centerOf(r2.b).map((v, k2) => v - [pcx, pcy][k2])) - Math.hypot(...centerOf(p.b).map((v, k2) => v - [pcx, pcy][k2])))[0] : list[0]; if (x) { special.set(x.b, kind); used.add(x.b); } };
    const pref = (z, a, b) => big(z, a).length ? big(z, a) : big(z, b); // terreno grande si hay: la instalación es una mini ciudad
    for (let k2 = 0; k2 < (n >= 16 ? 2 : 1); k2++) take('hospital', pref(['medio', 'centro'], 750, 420));
    if (forcedMall) special.set(forcedMall, 'comercial'); for (const x of big(['centro'], 900).slice(0, n >= 14 ? 1 : 0)) { special.set(x.b, 'comercial'); used.add(x.b); }
    take('policia', big(['medio', 'centro'], 260, 900)); take('bomberos', big(['medio', 'suburbio'], 180, 600));
    for (let k2 = 0; k2 < (n >= 16 ? 2 : 1); k2++) take('escuela', pref(['medio', 'suburbio'], 650, 380));
    for (let k2 = 0; k2 < (n >= 14 ? 2 : 1); k2++) take('mercado', big(['medio', 'centro'], 300)); // mercado de abastos (para las compras de la casa)
    { const bigOr = (min, min2) => big(['suburbio', 'medio'], min).filter(x => x.zone === 'suburbio').length ? big(['suburbio'], min) : big(['suburbio'], min2); // terreno grande: la base es una mini ciudad
      take('militar', bigOr(1100, 380), true); if (n >= 14) take('carcel', bigOr(800, 300), true); }
    { const parks = blocks.filter(b => t[b[0]] === 4).sort((p, r2) => r2.length - p.length); let lakes = n >= 16 ? 2 : 1;
      for (const p of parks) if (lakes > 0 && p.length / 4 >= 180) { special.set(p, 'lago'); lakes--; }
      while (lakes-- > 0) take('lago', big(['medio', 'suburbio'], 300)); }
    const nSpecial = {}; for (const v of special.values()) nSpecial[v] = (nSpecial[v] || 0) + 1;
    // barrios: la ciudad se reparte en barrios (regiones vecinas) y cada uno tiene su estilo: casas sueltas o adosadas,
    // tamaño de casa y de cuartos, y un tono de fachada y de techo; las casas de un barrio se parecen entre sí
    const NOMBRES = ['Los Álamos', 'San Telmo', 'La Loma', 'El Puerto', 'Villa Nueva', 'Las Flores', 'El Molino', 'Santa Rita', 'Los Pinos', 'La Estación', 'Las Acacias', 'El Mirador', 'San Roque', 'La Cantera'];
    const TINTS = [['#d9b48c', '#8c4a3a'], ['#c9a27e', '#6f4a3a'], ['#e3c9a0', '#9a5a3a'], ['#bfa892', '#5a5048'], ['#d7b9a6', '#7a3f3a'], ['#c8b38f', '#4f5a3a'], ['#e0bf9a', '#8a6a3a'], ['#b9a38a', '#5a4a6a']];
    // cada barrio es una región entre vías principales (anillo, autopistas, avenidas radiales y central, anillo de la plaza)
    const bComp = new Int32Array(C * Rr).fill(-1); let nComp = 0;
    { const city = c => [0, 1, 2, 3].some(k => t[c * 4 + k] !== 0); for (let c0 = 0; c0 < C * Rr; c0++) { if (bComp[c0] >= 0 || major[c0] || !city(c0)) continue; const st = [c0]; bComp[c0] = nComp;
        while (st.length) { const c = st.pop(), x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * C + nx; if (nx >= 0 && ny >= 0 && nx < C && ny < Rr && bComp[j] < 0 && !major[j] && city(j)) { bComp[j] = nComp; st.push(j); } } } nComp++; } }
    const barrios = [], byComp = new Map();
    { const cnt = new Map(); for (const x of bz) { const cp = bComp[x.b[0] >> 2]; cnt.set(cp, (cnt.get(cp) || 0) + 1); }
      for (const [cp, k2] of [...cnt.entries()].sort((p, r2) => r2[1] - p[1])) { if (cp < 0) continue; const id = barrios.length, tn = TINTS[id % TINTS.length];
        const b = { id, nombre: NOMBRES[id % NOMBRES.length], cx: 0, cy: 0, suelta: [0.15, 0.4, 0.7, 0.9][rnd(0, 3)], ante: chance(0.5), nR: [[3, 4], [3, 5], [4, 5], [4, 6]][rnd(0, 3)], per: [[34, 40], [38, 46], [42, 50]][rnd(0, 2)], tint: tn[0], roof: tn[1], n: 0, sx: 0, sy: 0 };
        if (k2 >= 2 || !barrios.length) { barrios.push(b); byComp.set(cp, b); } } }
    const barrioOf = set => { const [x, y] = centerOf(set); let b2 = byComp.get(bComp[set[0] >> 2]); if (!b2) { let bd = 1e9; for (const b of barrios) { const d = b.n ? Math.hypot(b.sx / b.n - x, b.sy / b.n - y) : 1e9; if (d < bd) { bd = d; b2 = b; } } b2 = b2 || barrios[0]; } b2.n++; b2.sx += x; b2.sy += y; return b2; };
    const roleMap = (roles, m2) => roles.map(r => m2[r] || r);
    for (const mem of blocks) {
      const sp = special.get(mem), area = mem.length / 4;
      // parque con lago (estilo inglés): agua al medio, pasto alrededor
      if (sp === 'lago') { const water = erode(mem, 4), inW = new Set(water); const lp = newLabel('parque', 0), lw = newLabel('agua', 0); for (const i of mem) q[i] = inW.has(i) ? lw : lp; continue; }
      // parques: los chicos son juegos para niños
      if (t[mem[0]] === 4) { const l = newLabel(area < 160 ? 'juegos' : 'parque', 0); for (const i of mem) q[i] = l; continue; }
      const zone = zoneOf(...centerOf(mem)), diag = frameOf(mem);
      // edificios especiales = recintos propios y separados: terreno cercado con su patio, estacionamiento al frente y un
      // edificio de planta limpia (rectángulo en la orientación de la manzana) con su diseño único
      if (['hospital', 'policia', 'bomberos', 'militar', 'carcel', 'escuela', 'comercial', 'mercado'].includes(sp)) {
        let done = false;
        for (const dg of [diag, !diag]) {
          const memHQ = sp !== 'comercial' && mem.length / 4 >= (sp === 'militar' || sp === 'carcel' ? 500 : 700) ? (() => { const e4 = extOf(mem, dg), L4 = (e4[0][1] - e4[0][0]) >= (e4[1][1] - e4[1][0]) ? 0 : 1, r4 = cutAt(mem, dg, L4, Math.round(e4[L4][0] + (e4[L4][1] - e4[L4][0]) * 0.55), 4); return r4 && r4[0].length / 4 >= 280 ? r4[0] : mem; })() : mem; // el cuartel en un extremo: el resto es patio para la mini ciudad
          let rect = rectIn(erode(memHQ, 2), dg); if (!rect || rect.length / 4 < 120) continue;
          if ((sp === 'militar' || sp === 'carcel') && rect.length > mem.length * 0.4) { const e3 = extOf(rect, dg), L3 = (e3[0][1] - e3[0][0]) >= (e3[1][1] - e3[1][0]) ? 0 : 1, f3 = mem.length * 0.38 / rect.length; // cuartel chico: el resto del terreno es para los otros edificios
            const r3 = cutAt(rect, dg, L3, Math.round(e3[L3][0] + (e3[L3][1] - e3[L3][0]) * Math.max(0.35, f3)), 3); if (r3 && r3[0].length / 4 >= 150) rect = r3[0]; }
          const e = extOf(rect, dg), L = (e[0][1] - e[0][0]) >= (e[1][1] - e[1][0]) ? 0 : 1, P = 1 - L, sc = dg ? Math.SQRT1_2 : 1;
          const depthP = (e[P][1] - e[P][0]) * sc, parkD = sp === 'carcel' || sp === 'militar' ? 0 : sp === 'comercial' ? Math.min(14, Math.round(depthP * 0.35)) : Math.min(9, Math.round(depthP * 0.3));
          let park = null, bld = rect;
          if (parkD >= 5 && depthP - parkD >= 12) { const r = cutAt(rect, dg, P, e[P][0] + Math.round(parkD / sc), 2); if (r) { bld = r[1]; // el estacionamiento llega hasta la calle: todo el frente del terreno delante del edificio
            const eb = extOf(bld, dg), inB = new Set(bld); park = mem.filter(i => { if (inB.has(i)) return false; const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1], f = dg ? [px + py, px - py] : [px, py]; return f[P] < eb[P][0] && f[L] > eb[L][0] && f[L] < eb[L][1]; }); } }
          let tp = template(sp, bld, dg) || template(sp, bld, !dg);
          for (const fr2 of [0.5, 0]) { if (tp || !park) break; // si el edificio no entra, estacionamiento más chico (o ninguno)
            const pd = Math.round(parkD * fr2); park = null; bld = rect;
            if (pd >= 5) { const r = cutAt(rect, dg, P, e[P][0] + Math.round(pd / sc), 2); if (r) { bld = r[1]; const eb = extOf(bld, dg), inB = new Set(bld); park = mem.filter(i => { if (inB.has(i)) return false; const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1], f = dg ? [px + py, px - py] : [px, py]; return f[P] < eb[P][0] && f[L] > eb[L][0] && f[L] < eb[L][1]; }); } }
            tp = template(sp, bld, dg) || template(sp, bld, !dg); }
          if (!tp) continue;
          const inR = new Set(bld), inP = new Set(park || []), yard = mem.filter(i => !inR.has(i) && !inP.has(i));
          const h = addHouse(sp, zone, tp.rooms, yard, tp.hub, tp.roles); h.campus = true; h.recinto = sp === 'militar' || sp === 'carcel'; if (sp === 'comercial') nMalls++;
          // instalaciones como mini ciudades según su importancia: en el terreno, además del edificio principal, otros edificios
          // separados con su espacio (base militar y cárcel dentro del muro; hospital, escuela, comisaría, bomberos y mercado)
          const ANEXOS = { militar: [['barraca', 'barraca', 'baños'], ['comedor', 'cocina'], ['hangar'], ['taller', 'depósito'], ['barraca', 'baños']], carcel: [['pabellón', 'pabellón', 'baños'], ['comedor', 'cocina'], ['taller'], ['pabellón', 'baños']],
            hospital: [['urgencias', 'sala de espera'], ['laboratorio', 'farmacia'], ['mantenimiento'], ['capilla']], escuela: [['aula', 'aula', 'baños'], ['comedor', 'cocina'], ['biblioteca']],
            policia: [['garaje policial'], ['celda', 'celda', 'baños'], ['armería', 'vestuario']], bomberos: [['torre de práctica'], ['vestuario', 'sala de guardia'], ['taller']], mercado: [['puesto', 'puesto'], ['puesto', 'depósito']] };
          if (ANEXOS[sp] && h.patio) { let free = yard.slice(); const progs = ANEXOS[sp];
            for (const pr of progs) { let rect = rectIn(erode(free, 2), dg) || rectIn(erode(free, 2), !dg); if (!rect || rect.length / 4 < 48) break;
              for (let g4 = 0; g4 < 3 && rect.length / 4 > 130; g4++) { const e2 = extOf(rect, dg), L2 = (e2[0][1] - e2[0][0]) >= (e2[1][1] - e2[1][0]) ? 0 : 1, r2 = cutAt(rect, dg, L2, Math.round(e2[L2][0] + (e2[L2][1] - e2[L2][0]) * Math.max(0.3, 110 / (rect.length / 4))), 2); if (!r2 || r2[0].length / 4 < 48) break; rect = r2[0]; } // edificios de ~110 celdas
              const rooms2 = pr.length > 1 && rect.length / 4 >= 90 ? splitN(rect, pr.length, 16, dg, 4) : [rect]; const hx = addHouse(sp, zone, rooms2, null, -1, rooms2.map((_, k2) => pr[k2] || pr[pr.length - 1]));
              hx.campus = true; hx.recinto = h.recinto; hx.patio = h.patio; hx.anexo = true; nAnexo++;
              const cs = new Set(rect.map(i => i >> 2)), near = new Set(); for (const c of cs) { const x = c % C, y = (c / C) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) near.add((y + dy) * C + x + dx); }
              free = free.filter(i => !near.has(i >> 2)); }
            // en lo que queda del terreno: cancha deportiva (escuela, base) o helipuerto (hospital)
            const extra = sp === 'hospital' ? 'helipuerto' : sp === 'escuela' || sp === 'militar' ? 'cancha' : null;
            if (extra) { let r5 = rectIn(erode(free, 1), dg) || rectIn(erode(free, 1), !dg); if (r5 && r5.length / 4 >= 40) { if (extra === 'helipuerto' && r5.length / 4 > 100) { const e5 = extOf(r5, dg), L5 = (e5[0][1] - e5[0][0]) >= (e5[1][1] - e5[1][0]) ? 0 : 1, c5 = cutAt(r5, dg, L5, Math.round((e5[L5][0] + e5[L5][1]) / 2), 3); if (c5) r5 = c5[0]; }
              const l5 = newLabel(extra, 0); for (const i of r5) q[i] = l5; } } }
          if (park) { const l = newLabel('parking', 0); for (const i of park) q[i] = l; nPark++; }
          done = true; break;
        }
        if (done) continue;
        // sin plantilla posible: edificio simple en el medio del terreno, igual separado y con su patio
        const core = erode(mem, 3), inC = new Set(core), rooms = splitN(core.length ? core : mem, 6, 20, diag);
        const h = addHouse(sp, zone, rooms, core.length ? mem.filter(i => !inC.has(i)) : null, -1, rooms.map((_, k2) => k2 === 0 ? 'recepción' : 'sala')); h.campus = !!core.length; h.recinto = sp === 'militar' || sp === 'carcel'; continue;
      }
      if (!sp && zone === 'centro' && area > 700 && nMalls < 2 && chance(0.3)) { const ml = mallLayout(mem, diag) || mallLayout(mem, !diag); if (ml) { addHouse('comercial', zone, ml.rooms, null, ml.hub, roleMap(ml.roles, { localB: 'local' })); nMalls++; continue; } }
      if (zone === 'suburbio' && area >= 480 && area <= 1800 && nMans < (n >= 14 ? 3 : 2) && chance(0.4)) { // mansión en medio de su jardín
        let ok2 = false; for (const dg of [diag, !diag]) { const rect = rectIn(erode(mem, 2), dg); if (!rect || rect.length / 4 < 200) continue; const tp = template('mansion', rect, dg); if (!tp) continue;
          const inR = new Set(rect), h = addHouse('mansion', zone, tp.rooms, mem.filter(i => !inR.has(i)), tp.hub, tp.roles); h.style = 'suelta'; nMans++; ok2 = true; break; }
        if (ok2) continue; }
      if (zone === 'suburbio' && area > 420 && chance(0.2)) { { const lv2 = splitN(mem, rnd(3, 4), 30, diag), ord = lv2.map((_, k2) => k2).sort((p, r2) => lv2[r2].length - lv2[p].length), rl = []; ord.forEach((k2, j) => { rl[k2] = j === 0 ? 'almacén' : j === ord.length - 1 ? 'baño' : j === 1 ? 'oficina' : 'bodega'; }); addHouse('almacen', zone, lv2, null, -1, rl); } continue; }
      // manzana mediana del centro o del anillo medio: a veces es un solo lote con un supermercado o una comida rápida y su estacionamiento
      const solo = zone !== 'suburbio' && area >= 170 && area <= 700 && nSolo < (n >= 14 ? 6 : 4) && chance(0.22) ? (area >= 320 ? 'super' : 'comida') : null; if (solo) nSolo++;
      const lotMin = solo ? 1e9 : zone === 'centro' ? 100 : zone === 'medio' ? 170 : 140; // lotes más grandes: cuartos donde entra un auto
      const front = [], orphan = [];
      for (const lot of bspLeaves(mem, lotMin, diag, 5)) (lot.some(roadNb) ? front : orphan).push(lot);
      if (!front.length) front.push(...orphan.splice(0));
      // lotes sin calle: se suman como patio al lote vecino (o quedan como jardín interior)
      const lotIdx = new Map(); front.forEach((lot, k) => lot.forEach(i => lotIdx.set(i, k)));
      const extra = front.map(() => []);
      for (const lot of orphan) { const cnt = new Map(); for (const i of lot) nb(i, j => { const k = lotIdx.get(j); if (k !== undefined) cnt.set(k, (cnt.get(k) || 0) + 1); }); let bk = -1, bn = 0; for (const [k, c2] of cnt) if (c2 > bn) { bn = c2; bk = k; }
        if (bk >= 0) extra[bk].push(...lot); else { const l = newLabel('parque', 0); for (const i of lot) q[i] = l; } }
      front.forEach((lot, k) => {
        // estacionamiento: se sacrifica algún lote del centro y del anillo medio
        if (!solo && zone !== 'suburbio' && chance(zone === 'centro' ? 0.1 : 0.05)) { const l = newLabel('parking', 0); for (const i of [...lot, ...extra[k]]) q[i] = l; nPark++; return; }
        // lote angosto (menos de 6 de ancho): no sirve para oficina ni casa; queda de área verde (letreros, decoración)
        { let th = 0, cur = lot; while (cur.length && th < 4) { cur = erode(cur, 1); th++; } if (th < 3) { const l = newLabel('parque', 0); for (const i of [...lot, ...extra[k]]) q[i] = l; nVerde++; return; } }
        const u = R(), type0 = zone === 'centro' ? (u < 0.48 ? 'tienda' : u < 0.62 ? 'comida' : u < 0.82 || lot.length / 4 < 150 ? 'oficinas' : 'corporativo') : zone === 'medio' ? (u < 0.5 ? 'condominio' : u < 0.58 ? 'comida' : 'casa') : 'casa', type = solo || (type0 === 'comida' && lot.length / 4 < 130 ? 'tienda' : type0); // la comida rápida necesita lote para su estacionamiento
        let nR = type === 'casa' ? rnd(3, 7) : type === 'condominio' ? rnd(5, 7) : type === 'tienda' ? rnd(2, 4) : type === 'comida' ? 3 : type === 'super' ? 3 : rnd(4, 6);
        const B2 = barrioOf(lot); nR = type === 'casa' ? rnd(B2.nR[0], B2.nR[1]) : nR; // el barrio decide el tamaño de sus casas
        const per = type === 'casa' ? rnd(B2.per[0], B2.per[1]) : rnd(34, 46); // área de cada cuarto: entra al menos un auto (5×6 o más)
        // casa suelta (rodeada de su jardín) o adosada (comparte pared con las vecinas)
        const style = (type === 'casa' || type === 'condominio') && chance(zone === 'centro' ? 0 : B2.suelta) ? 'suelta' : 'adosada'; // estilo del barrio
        let house = [], yard = [];
        if (style === 'suelta') for (const e of [2, 1]) { const core = erode(lot, e); if (core.length / 4 < 3 * 28) continue; const n2 = Math.max(3, Math.min(nR, Math.floor(core.length / 4 / 28))); if (splitN(core, n2, 25, diag, 5).length < 3) continue; const inC = new Set(core); house = core; yard = lot.filter(i => !inC.has(i)); nR = n2; break; }
        if (!house.length) {
        // la casa al frente y el patio de césped atrás, separados por un corte paralelo a la calle
        const fr = lot.map(i => { const c = i >> 2, px = c % C + CEN[i & 3][0], py = ((c / C) | 0) + CEN[i & 3][1]; return diag ? [px + py, px - py] : [px, py]; });
        const sc = diag ? Math.SQRT1_2 : 1, rd = lot.map(roadNb), ax = (() => { let best = 0, bv = -1; for (const a2 of [0, 1]) { let lo = 1e9, hi = -1e9, sr = 0, nr = 0; fr.forEach((f, k) => { lo = Math.min(lo, f[a2]); hi = Math.max(hi, f[a2]); if (rd[k]) { sr += f[a2]; nr++; } }); const m2 = nr ? sr / nr : (lo + hi) / 2, v = Math.max(m2 - lo, hi - m2) / (hi - lo + 1e-9); if (v > bv) { bv = v; best = a2; } } return best; })();
        let lo = 1e9, hi = -1e9, sr = 0, nr = 0; fr.forEach((f, k) => { lo = Math.min(lo, f[ax]); hi = Math.max(hi, f[ax]); if (rd[k]) { sr += f[ax]; nr++; } });
        const fromLo = (nr ? sr / nr : lo) - lo < hi - (nr ? sr / nr : hi), depthWant = Math.max(8, (type === 'casa' || type === 'condominio' ? casaProg(nR).reduce((a, r) => a + PROG[r][0], 0) : nR) * per / Math.max(4, lot.length / 4 / ((hi - lo) * sc + 1)));
        const cutAt = cutAtDepth(lot, diag, ax, Math.round(fromLo ? lo + depthWant / sc : hi - depthWant / sc), fromLo);
        if (cutAt == null) house = lot; else lot.forEach((i, k) => ((fromLo ? fr[k][ax] < cutAt : fr[k][ax] > cutAt) ? house : yard).push(i));
        if (cutAt != null && Math.min(fromLo ? hi - cutAt : cutAt - lo, fromLo ? cutAt - lo : hi - cutAt) * sc < 4) { house = lot; yard = []; }
        if (type === 'tienda' || type === 'oficinas' || type === 'comida' || type === 'super' || type === 'corporativo' || yard.length / 4 < 16 || house.length / 4 < 16) { house = lot; yard = []; }
        // sin jardín: la casa deja un patio atrás (y la tienda u oficina, un patio de servicio) si el lote alcanza
        if (!yard.length && house.length / 4 >= ((type === 'casa' || type === 'condominio') ? 150 : 190) && ['casa', 'condominio', 'tienda', 'oficinas'].includes(type)) { const dBack = Math.max(4, Math.round(((hi - lo) * sc) * 0.25)), cB = cutAtDepth(lot, diag, ax, Math.round(fromLo ? hi - dBack / sc : lo + dBack / sc), !fromLo);
          if (cB != null) { const back = house.filter(i => { const k2 = lot.indexOf(i); return fromLo ? fr[k2][ax] > cB : fr[k2][ax] < cB; }); const rest2 = house.filter(i => !back.includes(i)); if (back.length / 4 >= 16 && rest2.length / 4 >= 90 && erode(back, 1).length) { house = rest2; yard = back; } } }
        // comida rápida y supermercado: el local se retira y deja su estacionamiento al frente (cada construcción con su espacio)
        if ((type === 'comida' && lot.length / 4 >= 130) || type === 'super') { const dep = type === 'super' ? 12 : 9, c0 = cutAtDepth(lot, diag, ax, Math.round(fromLo ? lo + dep / sc : hi - dep / sc), fromLo);
          if (c0 != null) { const pk = lot.filter((i, k2) => fromLo ? fr[k2][ax] < c0 : fr[k2][ax] > c0); const inP = new Set(pk), rest = house.filter(i => !inP.has(i)); if (pk.length / 4 >= 45 && rest.length / 4 >= 70 && erode(rest, 4).length) { house = rest; /* el local necesita fondo (al menos 8) */ const l = newLabel('parking', 0); for (const i of pk) q[i] = l; nPark++; } } }
        // antejardín: en algunos barrios la casa se retira de la vereda y la entrada pasa por un jardín al frente
        if (B2.ante && (type === 'casa' || type === 'condominio') && house.length) { const c0 = cutAtDepth(lot, diag, ax, Math.round(fromLo ? lo + 3 / sc : hi - 3 / sc), fromLo), inH = new Set(house);
          if (c0 != null) { const fg = lot.filter((i, k2) => inH.has(i) && (fromLo ? fr[k2][ax] < c0 : fr[k2][ax] > c0)); if (fg.length && (house.length - fg.length) / 4 >= 60) { const inF = new Set(fg); house = house.filter(i => !inF.has(i)); yard.push(...fg); } } }
        house.ax = ax;
        }
        yard.push(...extra[k]);
        let lvs, roles = null; const cdo = type === 'condominio' ? template('condominio', house, diag) : null;
        if (cdo) { lvs = cdo.rooms; roles = cdo.roles; }
        else if (type === 'comida' || type === 'super' || type === 'tienda' || type === 'oficinas' || type === 'corporativo') { const rq = lot.filter(roadNb), fp = rq.length ? centerOf(rq) : null, pr = splitW(house, negocioProg(type, house.length / 4), diag, 4, fp); lvs = pr.map(x => x[0]); roles = pr.map(x => x[1]); } // el frente (local, recepción, comedor) da a la calle
        else if (type === 'casa' || type === 'condominio') { const wsum = k2 => casaProg(k2).reduce((a2, r) => a2 + PROG[r][0], 0); while (nR > (type === 'condominio' ? 4 : 3) && house.length / 4 / wsum(nR) < per * 0.8) nR--; // cuartos grandes: menos cuartos si no entran (el resto va arriba)
          const rq = lot.filter(roadNb), fp = rq.length ? centerOf(rq) : null, pr = splitW(house, casaProg(nR, type === 'condominio'), diag, 4, fp); lvs = pr.map(x => x[0]); roles = pr.map(x => x[1]);
          if (lvs.length < 3 && house.length / 4 >= 80) { // forma rara: la casa es el rectángulo más grande que entra y el resto es jardín
            const rect = erode(house, 2); if (rect && rect.length / 4 >= 60) { const pr2 = splitW(rect, casaProg(Math.max(3, Math.min(nR, Math.floor(rect.length / 4 / per) + 1))), diag, 4, fp);
              if (pr2.length >= 3 || pr2.length > lvs.length) { const inR = new Set(rect); yard.push(...house.filter(i => !inR.has(i))); house = rect; lvs = pr2.map(x => x[0]); roles = pr2.map(x => x[1]); } } }
          if (lvs.length < 3) { const alt = splitN(house, Math.max(3, nR), 16, diag, 4); if (alt.length > lvs.length) { // forma rara: partición común y usos por tamaño
            const ord = alt.map((x, k2) => k2).sort((p, r2) => alt[r2].length - alt[p].length), pg = casaProg(alt.length).filter(r => r !== 'baño' && r !== 'sala'); lvs = alt; roles = [];
            ord.forEach((k2, j) => { roles[k2] = j === 0 ? 'sala' : j === ord.length - 1 ? 'baño' : pg[j - 1] || 'dormitorio'; }); } } } // programa: sala grande, baño chico
        else { lvs = splitN(house, nR, 25, diag, 5);
          // cuartos parejos: el que pase del máximo se vuelve a partir
          for (let guard = 0; guard < 6; guard++) { const bi = lvs.findIndex(s2 => s2.length / 4 > per * 1.7); if (bi < 0) break; const r = cut(lvs[bi], 25, diag, 5) || cut(lvs[bi], 25, !diag, 5); if (!r) break; lvs.splice(bi, 1, r[0], r[1]); } }
        // cuarto muy largo para su ancho (más de 2,6 veces): se parte en dos (sala y comedor, cocina y lavandería, dos dormitorios...)
        for (let k2 = 0; k2 < lvs.length && lvs.length < 10; k2++) { const lv = lvs[k2], ro = roles ? roles[k2] : null; if (ro === 'baño' || ro === 'pasillo' || ro === 'garaje') continue;
          let asp = 1e9; for (const dg of [diag, !diag]) { const e = extOf(lv, dg), a2 = e[0][1] - e[0][0], b2 = e[1][1] - e[1][0]; asp = Math.min(asp, Math.max(a2, b2) / Math.max(1, Math.min(a2, b2))); }
          if (asp <= 2.6 || lv.length / 4 < 40) continue; const r = cutFrac(lv, 0.5, 16, 16, diag, 4); if (!r) continue;
          lvs.splice(k2, 1, r[0], r[1]); if (roles) roles.splice(k2, 1, ro, { sala: 'comedor', cocina: 'lavandería', comedor: 'cocina', departamento: 'departamento', oficina: 'oficina' }[ro] || (ro === 'dormitorio' ? 'dormitorio' : ro)); k2--; }
        // cuarto demasiado grande para su uso: se parte (la sala hasta 2,6 cuartos normales, el resto hasta 2)
        for (let k2 = 0; k2 < lvs.length && lvs.length < 10; k2++) { const lv = lvs[k2], ro = roles ? roles[k2] : null, cap2 = (ro === 'sala' || ro === 'nave de puestos' ? 2.6 : 2) * per;
          if (lv.length / 4 <= cap2 || ro === 'pasillo') continue; const r = cutFrac(lv, 0.5, 20, 20, diag, 4) || (lv.length / 4 > 3 * cap2 ? cutFrac(lv, 0.5, 20, 20, !diag, 4) : null); if (!r) continue; // en el marco de la casa (el otro marco solo si es enorme)
          lvs.splice(k2, 1, r[0], r[1]); if (roles) roles.splice(k2, 1, ro, { sala: 'comedor', cocina: 'comedor', comedor: 'estudio', garaje: 'depósito' }[ro] || ro); k2--; }
        const hh = addHouse(type, zone, lvs, yard, cdo ? cdo.hub : -1, roles); hh.style = style; hh.barrio = B2.id; if (type === 'casa' || type === 'condominio') { hh.tint = B2.tint; hh.roofTint = B2.roof; }
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
        if ((!bh || (qOf.get(l) || []).length / 4 > 90)) { // un cuarto suelto grande no es anexo: pasa a ser jardín (de la vecina o público)
          if ((qOf.get(l) || []).length / 4 <= 90 && !bh) continue;
          const hb = houses.get(bh); if (hb && hb.patio) { for (const i of qOf.get(l) || []) q[i] = hb.patio; } else { kinds[l] = bh ? 'patio' : 'parque'; houseOfL[l] = bh || 0; if (hb) hb.patio = l; }
          if (h.patio) { if (hb && hb.patio && hb.patio !== h.patio) { for (const i of qOf.get(h.patio) || []) q[i] = hb.patio; } else { kinds[h.patio] = 'parque'; houseOfL[h.patio] = 0; } }
          roleOf.delete(l); houses.delete(h.id); nJardin++; continue; }
        houseOfL[l] = bh; houses.get(bh).rooms.add(l); roleOf.set(l, 'estudio'); // anexo chico
        if (h.patio) { houseOfL[h.patio] = bh; if (!houses.get(bh).patio) houses.get(bh).patio = h.patio; else for (const i of qOf.get(h.patio) || []) q[i] = houses.get(bh).patio; }
        houses.delete(h.id);
      } }
    // ingeniería vial: se derriban casas que obligan a dar un rodeo largo; su lugar pasa a ser calle nueva
    let nDemol = 0;
    { const roadCell = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) for (let k = 0; k < 4; k++) if (isSt(q[c * 4 + k])) roadCell[c] = 1;
      const maxD = o.derribos ?? Math.max(2, Math.round(n / 4));
      for (const h of mezcla([...houses.values()], R)) {
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
      if (ka === 'out' || kb === 'out') { const ko = ka === 'out' ? kb : ka; return ko === 'room' ? 'exterior' : ko === 'patio' || ko === 'parque' || ko === 'plaza' || ko === 'juegos' ? 'reja' : null; }
      if (ka === 'agua' || kb === 'agua') { const ko = ka === 'agua' ? kb : ka; return ko === 'parque' ? null : ko === 'plaza' ? 'bordillo' : 'reja'; } // orilla del lago abierta al pasto; borde de la fuente
      if (ka === 'rotonda' || kb === 'rotonda' || ka === 'cantero' || kb === 'cantero') return 'bordillo'; // isla de la rotonda y canteros de la plaza: solo cordón // sin muralla: la ciudad se abre al campo
      if (ka === 'parking' || kb === 'parking') { const ko = ka === 'parking' ? kb : ka; const ot = ka === 'parking' ? b : a; return ST(ko) ? 'bordillo' : ko === 'room' ? 'exterior' : ko === 'out' || ko === 'parking' ? null : 'reja'; } // el estacionamiento se abre a la calle y al terreno de su recinto
      if (ST(ka) && ST(kb)) return (ka === 'corr' || kb === 'corr') && (ka === 'vereda' || kb === 'vereda') ? 'bordillo' : null;
      if ((ka === 'plaza' && kb === 'parque') || (kb === 'plaza' && ka === 'parque')) return null; // el césped se abre a la plaza
      if ((ka === 'parque' || ka === 'juegos') && (kb === 'parque' || kb === 'juegos')) return null; // dos áreas verdes vecinas: sin reja entre ellas
      if (ka === 'cancha' || kb === 'cancha' || ka === 'helipuerto' || kb === 'helipuerto') return ka === 'patio' || kb === 'patio' ? 'bordillo' : 'reja'; // cancha y helipuerto: pintados en el terreno
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
    // sierra de medias celdas: al crecer una forma con diagonales, sus lados rectos quedan como una pila de medias celdas iguales
    // (vertical u horizontal); esas celdas pasan a ser enteras (vereda si una mitad es vereda)
    const sierra = (final = false) => { const SOFT0 = new Set(['vereda', 'corr', 'out', 'pasaje', 'parque', 'parking']), sig = c => { const i = c * 4, N = q[i], E = q[i + 1], S = q[i + 2], O = q[i + 3]; if (N === E && S === O && N !== S) return 'a' + N + ',' + S; if (N === O && S === E && N !== S) return 'b' + N + ',' + S; return null; };
      const fix = []; for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) { const c = y * C + x, g = sig(c); if (!g) continue; const i = c * 4; if (![q[i], q[i + 2]].every(l => SOFT0.has(kindOf(l))) && !(final && (q[i] === VEREDA || q[i + 2] === VEREDA))) continue; // al final también contra casas y jardines
        if (sig(c - C) === g || sig(c + C) === g || sig(c - 1) === g || sig(c + 1) === g) fix.push(c); }
      for (const c of fix) { const i = c * 4, A2 = q[i], B2 = q[i + 2], to = kindOf(A2) === 'vereda' ? A2 : kindOf(B2) === 'vereda' ? B2 : A2; for (let k = 0; k < 4; k++) q[i + k] = to; } };
    sierra();
    // veredas sin esquinas de 90°: la esquina de una celda de vereda (o de calle/campo pegado a la vereda) se bisela a 45°;
    // dos pasadas: primero las puntas y después los rincones que quedan
    const bisel = () => { for (let pass = 0; pass < 3; pass++) { const SOFT = new Set(['vereda', 'corr', 'out', 'pasaje', 'parque', 'rotonda', 'parking']), snap = q.slice();
      const U = (x, y) => { if (x < 0 || y < 0 || x >= C || y >= Rr) return -1; const i = (y * C + x) * 4, l = snap[i]; return snap[i + 1] === l && snap[i + 2] === l && snap[i + 3] === l ? l : -1; };
      const F = (x, y, k) => x < 0 || y < 0 || x >= C || y >= Rr ? -1 : snap[(y * C + x) * 4 + k]; // el cuarto de la vecina que mira hacia esta celda
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) {
        const X0 = U(x, y); if (X0 < 0 || !SOFT.has(kindOf(X0))) continue;
        // [lado1 (dx,dy,cuarto que mira), lado2, diagonal, opuesto1, opuesto2, cuartos que cambian]: N=0 E=1 S=2 O=3
        for (const [a, b, d, oa, ob, ks] of [[[0, -1, 2], [1, 0, 3], [1, -1], [0, 1, 0], [-1, 0, 1], [0, 1]], [[1, 0, 3], [0, 1, 0], [1, 1], [-1, 0, 1], [0, -1, 2], [1, 2]], [[0, 1, 0], [-1, 0, 1], [-1, 1], [0, -1, 2], [1, 0, 3], [2, 3]], [[-1, 0, 1], [0, -1, 2], [-1, -1], [1, 0, 3], [0, 1, 0], [3, 0]]]) {
          const Y0 = U(x + a[0], y + a[1]); if (Y0 < 0 || Y0 === X0 || !SOFT.has(kindOf(Y0)) || U(x + b[0], y + b[1]) !== Y0) continue; // lados enteros: sin cascada de medias celdas (sierra)
          // (la diagonal puede ser otra cosa: así también se cierra la vereda que solo se toca por una punta)
          if (F(x + oa[0], y + oa[1], oa[2]) === Y0 || F(x + ob[0], y + ob[1], ob[2]) === Y0) continue;
          if (kindOf(X0) === 'vereda' && [F(x, y - 1, 2), F(x + 1, y, 3), F(x, y + 1, 0), F(x - 1, y, 1)].filter(l => l !== X0).length >= 3) continue; // la punta de una vereda no se afila
          // final de una franja de 2 de ancho: si la vecina de al lado también es esquina hacia el mismo lado, el final queda recto
          // (biselar las dos hace la sierra «≶»)
          { let strip = false; for (const [sA, sB] of [[a, b], [b, a]]) { const px = x - sA[0], py = y - sA[1]; if (U(px, py) !== X0 && F(px, py, [0, 1, 2, 3].find(k => true)) !== X0) continue;
              const fB = F(px + sB[0], py + sB[1], sB[2]), fA = F(px - sA[0], py - sA[1], (sA[2] + 2) % 4); if (fB === Y0 && fA === Y0) strip = true; }
            if (strip) continue; }
          if (kindOf(X0) === kindOf(Y0)) continue;
          const i = (y * C + x) * 4; if (q[i] !== X0 || q[i + 1] !== X0 || q[i + 2] !== X0 || q[i + 3] !== X0) continue;
          for (const k of ks) q[i + k] = Y0; break; } } } };
    bisel();
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
        if (houses.get(houseOf(small))?.type === 'comercial' || houses.get(houseOf(small))?.campus) continue; // el plano del centro comercial y de los edificios especiales se respeta
        remap.set(small, big); done.add(a); done.add(b); nMerge++;
        houses.get(houseOf(small))?.rooms.delete(small); houses.get(houseOf(big))?.rooms.add(big);
      }
      for (let i = 0; i < NQ; i++) { const m2 = remap.get(q[i]); if (m2) q[i] = m2; }
    }
    // vereda asegurada: los lotes, la reparación de esquinas y los óvalos mueven bordes después de trazar las veredas; al final,
    // todo edificio, jardín o parque que quede pegado a la calzada recupera su vereda (1 celda), y se vuelve a limpiar y biselar
    const asegurarVereda = () => { const B = new Uint8Array(NQ); for (let i = 0; i < NQ; i++) { const k = kindOf(q[i]); if (k === 'room' || k === 'patio' || k === 'parque' || k === 'juegos' || k === 'parking') B[i] = 1; }
      const V = grow(B, 1); let n2 = 0; for (let i = 0; i < NQ; i++) if (V[i] && q[i] === ROAD) { q[i] = VEREDA; n2++; } return n2; };
    // entrada de autos: la vereda rodea también los estacionamientos y cada uno abre una sola entrada de ~7 celdas, en el medio
    // de su frente a la calzada (la vereda es más importante: el estacionamiento no se la come entera)
    const entradasAutos = () => { const cellHas = (c, pred) => [0, 1, 2, 3].some(k => pred(q[c * 4 + k])); const byP = new Map();
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) { const c = y * C + x; if (!cellHas(c, l => l === VEREDA)) continue; let pk = 0, rd = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c2 = c + dy * C + dx; for (let k = 0; k < 4; k++) { const l = q[c2 * 4 + k]; if (kindOf(l) === 'parking') pk = l; if (l === ROAD) rd = true; } }
        if (pk && rd) { if (!byP.has(pk)) byP.set(pk, []); byP.get(pk).push([x, y]); } }
      for (const cs of byP.values()) { if (cs.length < 3) continue; const mx = cs.reduce((a, p) => a + p[0], 0) / cs.length, my = cs.reduce((a, p) => a + p[1], 0) / cs.length;
        const [cx, cy] = cs.slice().sort((p, r2) => Math.hypot(p[0] - mx, p[1] - my) - Math.hypot(r2[0] - mx, r2[1] - my))[0];
        const nearHouse = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (let k = 0; k < 4; k++) { const kd = kindOf(q[((y + dy) * C + x + dx) * 4 + k]); if (kd === 'room' || kd === 'patio' || kd === 'parque' || kd === 'juegos') return true; } return false; };
        for (const [x, y] of cs) { if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) > 3 || nearHouse(x, y)) continue; for (let k = 0; k < 4; k++) if (q[(y * C + x) * 4 + k] === VEREDA) q[(y * C + x) * 4 + k] = ROAD; } // solo la franja entre el estacionamiento y la calle
        nEntP++; } };
    nVerAseg = asegurarVereda(); normalize(); entradasAutos(); normalize(); sierra(); bisel(); sierra(true); normalize(); // la reparación de esquinas también puede dejar sierra en las veredas
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
    const openAt = (run, frac, cls, w) => { const n2 = run.segs.length; w = Math.max(1, Math.min(w, n2 - 2)); const s0 = Math.max(1, Math.min(n2 - 1 - w, Math.round(n2 * frac - w / 2))); for (let k = 0; k < w; k++) run.segs[s0 + k].cls = cls; };
    let nEmerg = 0, nGar = 0, nHueco = 0;
    const openMid = (run, cls, w = 1, force = false) => { const n2 = run.segs.length; if (n2 < 3 && !force) return false; w = Math.max(1, Math.min(w, n2 - 2)); /* la puerta nunca toca la punta del tramo */ const s0 = Math.floor((n2 - w) / 2); for (let k = 0; k < w; k++) run.segs[s0 + k].cls = cls; };
    // baño en un rincón y pasillo al medio: entre los cuartos privados chicos, el baño es el que menos vecinos tiene (en una
    // esquina, con pared afuera); en casas de 5 cuartos o más, el cuarto privado que toca a 3 o más es el pasillo (distribuidor)
    { const areaR = new Map(); for (let i = 0; i < NQ; i++) if (kinds[q[i]] === 'room') areaR.set(q[i], (areaR.get(q[i]) || 0) + 1);
      const nbs = new Map(); for (const r of runs) if (kindOf(r.a) === 'room' && kindOf(r.b) === 'room' && houseOf(r.a) === houseOf(r.b) && r.segs.length >= 2) for (const [x, y] of [[r.a, r.b], [r.b, r.a]]) { if (!nbs.has(x)) nbs.set(x, new Set()); nbs.get(x).add(y); }
      const deg = l => (nbs.get(l) || new Set()).size;
      for (const h of houses.values()) { if (h.type !== 'casa' && h.type !== 'condominio' && h.type !== 'mansion') continue;
        const pv = [...h.rooms].filter(l => ['baño', 'dormitorio', 'estudio'].includes(roleOf.get(l))); const nb2 = pv.filter(l => roleOf.get(l) === 'baño').length; if (!pv.length) continue;
        if (h.rooms.size >= 5 && ![...h.rooms].some(l => roleOf.get(l) === 'pasillo')) { const hub = pv.filter(l => deg(l) >= 3).sort((p, r2) => deg(r2) - deg(p) || areaR.get(p) - areaR.get(r2))[0]; if (hub) { roleOf.set(hub, 'pasillo'); pv.splice(pv.indexOf(hub), 1); } }
        const minA = Math.min(...pv.map(l => areaR.get(l))), cand = pv.filter(l => areaR.get(l) <= minA * 1.4).sort((p, r2) => deg(p) - deg(r2) || areaR.get(p) - areaR.get(r2));
        const banos = new Set(cand.slice(0, nb2)); for (const l of pv) roleOf.set(l, banos.has(l) ? 'baño' : roleOf.get(l) === 'estudio' ? 'estudio' : 'dormitorio'); } }
    // programa mínimo de cada construcción: si falta un uso obligatorio, lo toma un cuarto repetido o genérico (el más chico para
    // los baños), nunca el último de su uso ni el cuarto de entrada
    const PROG_MIN = { corporativo: ['lobby', 'oficina', 'baño'], casa: ['sala', 'cocina', 'baño'], condominio: ['sala', 'cocina', 'baño', 'dormitorio'], mansion: ['hall', 'cocina', 'baño'], tienda: ['local', 'baño'], oficinas: ['recepción', 'oficina', 'baño'], comida: ['comedor', 'cocina', 'baño'],
      super: ['sala de ventas', 'depósito', 'baño'], almacen: ['almacén', 'oficina', 'baño'], hospital: ['recepción', 'urgencias', 'habitación', 'quirófano', 'farmacia', 'baños'], escuela: ['dirección', 'aula', 'baños', 'gimnasio'],
      policia: ['recepción', 'oficina', 'celda', 'baños'], bomberos: ['cochera', 'dormitorio', 'cocina', 'baños'], mercado: ['nave de puestos', 'depósito', 'baños'], comercial: ['pasillo', 'local', 'baños'], militar: ['mando', 'barraca', 'comedor', 'baños'], carcel: ['guardia', 'celda', 'comedor', 'baños'] };
    { const GEN = new Set(['sala', 'oficina', 'habitación', 'aula', 'barraca', 'local', 'localB', 'depósito', 'dormitorio', 'celda', 'pabellón', 'departamento', 'bodega', 'estudio', 'garaje', 'comedor', 'cochera', 'gimnasio', 'enfermería', 'sala de espera', 'taller', 'armería', 'sala de reuniones']), areaR2 = new Map(); for (let i = 0; i < NQ; i++) if (kinds[q[i]] === 'room') areaR2.set(q[i], (areaR2.get(q[i]) || 0) + 1);
      for (const h of houses.values()) { const need0 = PROG_MIN[h.type]; if (!need0 || h.anexo) continue; const rooms = [...h.rooms];
        if (h.type === 'casa' && rooms.length === 1) { h.type = 'taller'; roleOf.set(rooms[0], 'taller'); continue; } // un solo ambiente: taller
        if ((h.type === 'oficinas' || h.type === 'corporativo') && rooms.length <= 2) { h.mono = true; const o2 = rooms.slice().sort((p, r2) => areaR2.get(r2) - areaR2.get(p)); roleOf.set(o2[0], h.type === 'corporativo' ? 'lobby' : 'oficina'); if (o2[1]) roleOf.set(o2[1], 'baño'); continue; } // oficina mínima
        if (h.type === 'tienda' && rooms.length === 1) { h.type = 'kiosco'; roleOf.set(rooms[0], 'local'); continue; } // una tienda de un solo ambiente es un kiosco
        if (h.type === 'casa' && rooms.length <= 2) { h.mono = true; const o2 = rooms.slice().sort((p, r2) => areaR2.get(r2) - areaR2.get(p)); roleOf.set(o2[0], 'sala'); if (o2[1]) roleOf.set(o2[1], 'baño'); continue; } // monoambiente: sala con cocina y baño (el dormitorio, arriba)
        const need = need0;
        for (const R2 of need) { const cnt = new Map(); rooms.forEach(l => cnt.set(roleOf.get(l), (cnt.get(roleOf.get(l)) || 0) + 1)); if (cnt.get(R2)) continue;
          const cand = rooms.filter(l => l !== h.hub && (cnt.get(roleOf.get(l)) > 1 || (GEN.has(roleOf.get(l)) && !need.includes(roleOf.get(l)))) && !(need.includes(roleOf.get(l)) && cnt.get(roleOf.get(l)) <= 1));
          if (!cand.length && R2 === 'baño' && (h.type === 'condominio' || h.type === 'casa') && cnt.get('cocina') === 1 && cnt.get('sala')) cand.push(rooms.find(l => roleOf.get(l) === 'cocina')); // la cocina pasa a la sala (cocina abierta) y ese cuarto es baño
          if (!cand.length) continue; cand.sort((p, r2) => (R2.startsWith('baño') ? 1 : -1) * (areaR2.get(p) - areaR2.get(r2))); roleOf.set(cand[0], R2); nProg++; } } }
    // puertas de las casas: la principal en el tramo más largo hacia la calle; interiores en árbol
    const byHouse = new Map();
    for (const r of runs) { const ka = kindOf(r.a), kb = kindOf(r.b); for (const l of [r.a, r.b]) if (kindOf(l) === 'room' || kindOf(l) === 'patio') { const h = houseOf(l); if (!byHouse.has(h)) byHouse.set(h, []); byHouse.get(h).push(r); } }
    for (const h of houses.values()) {
      const rs = byHouse.get(h.id) || [];
      const outL = l => isSt(l) || ((h.campus || h.type === 'comida' || h.type === 'super') && (l === h.patio || kindOf(l) === 'parking')); // un recinto sale a su propio terreno
      const toRoad = rs.filter(r => (outL(r.a) || outL(r.b)) && kindOf(outL(r.a) ? r.b : r.a) === 'room').sort((p, r2) => r2.segs.length - p.segs.length);
      const street = toRoad.filter(r => r.segs.length >= 3).length ? toRoad.filter(r => r.segs.length >= 3) : toRoad;
      const recRun = street.find(r => (h.type === 'condominio' && roleOf.get(h.hub) === 'pasillo' ? ['pasillo'] : ['recepción', 'guardia', 'mando', 'dirección', 'sala', 'comedor', 'nave de puestos', 'sala de ventas', 'local', 'lobby']).includes(roleOf.get(outL(r.a) ? r.b : r.a)));
      const fr = recRun || street[0];
      if (h.hub) { toRoad.filter(r => r.a === h.hub || r.b === h.hub).slice(0, 2).forEach(r => openMid(r, 'puerta', Math.min(3, r.segs.length))); }
      // puerta principal de 2 de ancho; una tienda tiene 2 puertas principales (salvo una minitienda)
      if (fr) {
        if (h.type === 'bomberos' && !roleOf.has(h.front ?? -1) && !recRun) { openMid(fr, 'garaje', 4, true); if (street[1]) openMid(street[1], 'garaje', 4); } // salida de los camiones
        else if ((h.type === 'tienda' || h.type === 'comida' || h.type === 'mercado' || h.type === 'super') && fr.segs.length >= 9) { openAt(fr, 1 / 3, 'puerta', 2); openAt(fr, 2 / 3, 'puerta', 2); }
        else { openMid(fr, 'puerta', h.type === 'almacen' || h.type === 'comercial' ? 3 : 2, true); if (h.type === 'tienda' && street[1]) openMid(street[1], 'puerta', 2); }
        h.front = outL(fr.a) ? fr.b : fr.a;
      } else if (h.patio) { // casa suelta: la puerta principal sale de la sala al jardín
        const sr = rs.filter(r => (r.a === h.patio || r.b === h.patio) && houseOf(r.a === h.patio ? r.b : r.a) === h.id && kindOf(r.a === h.patio ? r.b : r.a) === 'room' && r.segs.length >= 3).sort((p, r2) => (['sala', 'hall'].includes(roleOf.get(r2.a === h.patio ? r2.b : r2.a))) - (['sala', 'hall'].includes(roleOf.get(p.a === h.patio ? p.b : p.a))) || r2.segs.length - p.segs.length)[0];
        if (sr) { openMid(sr, 'puerta', 2, true); h.front = sr.a === h.patio ? sr.b : sr.a; }
      }
      // portones de vehículos de los edificios: garaje policial, urgencias (ambulancias), cocheras de bomberos
      for (const r of street) { const role = roleOf.get(outL(r.a) ? r.b : r.a); if (r !== fr && ['garaje policial', 'urgencias', 'cochera'].includes(role)) openMid(r, 'garaje', 4, true); }
      // garaje: en casas y condominios de 4 cuartos o más, otro cuarto que da a la calle, con portón de 3
      if ((h.type === 'casa' || h.type === 'condominio') && h.rooms.size >= 4) { const g2 = street.find(r => r !== fr && roleOf.get(isSt(r.a) ? r.b : r.a) === 'garaje' && r.segs.length >= 4) || street.find(r => r !== fr && (isSt(r.a) ? r.b : r.a) !== h.front && !['baño', 'cocina'].includes(roleOf.get(isSt(r.a) ? r.b : r.a)) && r.segs.length >= 5); if (g2) { openMid(g2, 'garaje', 3); h.garage = isSt(g2.a) ? g2.b : g2.a; nGar++; } }
      if (street[1] && (h.type !== 'casa' || chance(0.35))) openMid(street[1], 'puerta', h.type === 'comercial' ? 3 : 2);
      if (h.type === 'comercial' && street[2]) openMid(street[2], 'puerta', 2);
      // árbol de puertas interiores desde el cuarto de la entrada
      // puerta trasera al patio, portón del patio a la calle y algún hueco en la reja con el patio vecino
      if (h.patio) {
        const back = rs.filter(r => (r.a === h.patio || r.b === h.patio) && kindOf(r.a === h.patio ? r.b : r.a) === 'room' && houseOf(r.a === h.patio ? r.b : r.a) === h.id && (r.a === h.patio ? r.b : r.a) !== h.front).sort((p, r2) => (roleOf.get(r2.a === h.patio ? r2.b : r2.a) === 'cocina') - (roleOf.get(p.a === h.patio ? p.b : p.a) === 'cocina') || r2.segs.length - p.segs.length)[0]; // la puerta de atrás, de la cocina
        if (back) openMid(back, 'puerta', 2, true);
        // el jardín tiene reja y al menos 2 entradas (adelante y atrás, o al patio vecino)
        const gates = rs.filter(r => (r.a === h.patio || r.b === h.patio) && (isSt(r.a) || isSt(r.b)) && r.segs.length >= 3).sort((p, r2) => r2.segs.length - p.segs.length);
        gates.slice(0, h.recinto ? 1 : 2).forEach((r, k2) => { const roto = !h.campus && chance(0.25); openMid(r, roto ? 'hueco' : 'porton', h.campus && k2 === 0 ? 4 : 2, true); if (roto) nHueco++; }); // un recinto: portón de 4 para vehículos // entrada propia: portón o un hueco roto en la reja
        if (h.campus) { const pg = rs.filter(r => (r.a === h.patio || r.b === h.patio) && kindOf(r.a === h.patio ? r.b : r.a) === 'parking' && r.segs.length >= 6).sort((p, r2) => r2.segs.length - p.segs.length)[0]; if (pg) openMid(pg, 'porton', 4, true); } // del estacionamiento al terreno
        if (h.recinto) for (const r of rs) if ((r.a === h.patio || r.b === h.patio) && !(kindOf(r.a) === 'room' && kindOf(r.b) === 'patio' && houseOf(r.a) === h.id) && !(kindOf(r.b) === 'room' && houseOf(r.b) === h.id)) r.segs.forEach(x => { if (x.cls === 'reja') x.cls = 'muro'; }); // recinto: muro alto
        if (gates.length < 2 && !h.recinto) { const nbp = rs.filter(r => (r.a === h.patio || r.b === h.patio) && kindOf(r.a === h.patio ? r.b : r.a) === 'patio' && r.segs.length >= 3).sort((p, r2) => r2.segs.length - p.segs.length); nbp.slice(0, 2 - gates.length).forEach(r => openMid(r, 'porton', 2, true)); }
      }
      // salida de emergencia en las casas grandes, condominios y oficinas: otra pared exterior, lejos de la principal
      if (h.rooms.size >= 6 || h.type === 'condominio' || h.type === 'oficinas') {
        const em = rs.filter(r => r !== fr && r.segs.length >= 4 && r.segs.every(x => x.cls === 'exterior') && [r.a, r.b].some(l => kindOf(l) === 'room' && houseOf(l) === h.id) && [r.a, r.b].some(l => isSt(l) || l === h.patio || kindOf(l) === 'parking')).sort((p, r2) => r2.segs.length - p.segs.length)[0];
        if (em) { openMid(em, 'puerta', 2); h.emergency = true; nEmerg++; }
      }
      const inner = rs.filter(r => kindOf(r.a) === 'room' && kindOf(r.b) === 'room' && houseOf(r.a) === h.id && houseOf(r.b) === h.id);
      const best = new Map(); for (const r of inner) { const k = r.pk, p = best.get(k); if (!p || r.segs.length > p.segs.length) best.set(k, r); }
      const pairs = mezcla([...best.values()], R), seen = new Set([h.hub || h.front || [...h.rooms][0]]), used = new Set();
      // el baño es una hoja: una sola puerta, nunca se pasa por él a otro cuarto (si no queda otra, se permite)
      const leaf = l => roleOf.get(l) === 'baño' || roleOf.get(l) === 'baños';
      for (const [strict, minL] of [[true, 3], [true, 1], [false, 1]]) { let grew = true; while (grew) { grew = false; for (const r of pairs.sort((p, r2) => r2.segs.length - p.segs.length)) if (seen.has(r.a) !== seen.has(r.b) && r.segs.length >= minL) { const from = seen.has(r.a) ? r.a : r.b; if (strict && leaf(from) && from !== (h.hub || h.front)) continue; openMid(r, 'puerta', r.segs.length >= 4 ? 2 : 1, true); seen.add(r.a); seen.add(r.b); used.add(r); grew = true; } } }
      for (const r of pairs) if (!used.has(r) && r.segs.length >= 5 && !leaf(r.a) && !leaf(r.b) && chance(0.15)) openMid(r, 'puerta');
      // centro comercial: los locales se abren enteros al pasillo (vidriera abierta, sin pared); escuela: el recreo abierto al pasillo
      if (h.type === 'comercial' || h.type === 'escuela') for (const r of inner) { const ra = roleOf.get(r.a), rb = roleOf.get(r.b), other = ra === 'pasillo' ? rb : rb === 'pasillo' ? ra : null;
        if (other && (h.type === 'comercial' ? ['local', 'patio de comidas', 'tienda ancla'].includes(other) : other === 'patio de recreo') && r.segs.length >= 4) openMid(r, 'puerta', r.segs.length - 2, true); }
      // ventanas: en las paredes que dan a calle, plaza o parque, nunca en la punta ni junto a una puerta
      const pOpen = { corporativo: 0.05, super: 0.2, mansion: 0.1, comida: 0.3, mercado: 0.15, casa: 0.18, tienda: 0.3, oficinas: 0.12, condominio: 0.14, comercial: 0.2, almacen: 0.08 }[h.type];
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
    // usos de los cuartos según la casa
    { const area = new Map(); for (let i = 0; i < NQ; i++) if (kinds[q[i]] === 'room') area.set(q[i], (area.get(q[i]) || 0) + 1);
      for (const h of houses.values()) {
        const rs2 = [...h.rooms].filter(l => !roleOf.has(l)); if (!rs2.length) continue;
        if (h.type === 'tienda') { rs2.forEach(l => roleOf.set(l, l === h.front ? 'local' : 'depósito')); continue; }
        if (h.type === 'oficinas') { rs2.forEach(l => roleOf.set(l, l === h.front ? 'recepción' : 'oficina')); continue; }
        if (h.type === 'bomberos') { rs2.forEach((l, k2) => roleOf.set(l, l === h.front ? 'cochera' : ['dormitorio', 'cocina', 'oficina', 'gimnasio'][k2 % 4])); continue; }
        if (h.type === 'hospital') { rs2.forEach((l, k2) => roleOf.set(l, l === h.front ? 'recepción' : k2 === 1 ? 'urgencias' : 'habitación')); continue; }
        if (h.type === 'policia') { rs2.forEach((l, k2) => roleOf.set(l, l === h.front ? 'recepción' : k2 % 2 ? 'celda' : 'oficina')); continue; }
        if (h.type === 'almacen') { rs2.forEach(l => roleOf.set(l, l === h.front ? 'almacén' : 'bodega')); continue; }
        if (h.front && !roleOf.has(h.front)) roleOf.set(h.front, h.type === 'condominio' ? 'hall' : 'sala');
        if (h.garage && !roleOf.has(h.garage)) roleOf.set(h.garage, 'garaje');
        const backR = h.patio ? rs2.filter(l => !roleOf.has(l) && runs.some(r => (r.a === l && r.b === h.patio) || (r.b === l && r.a === h.patio))).sort((p, r2) => area.get(r2) - area.get(p))[0] : null;
        const rest = rs2.filter(l => !roleOf.has(l)).sort((p, r2) => area.get(p) - area.get(r2));
        const kitchen = backR || rest[rest.length - 1]; if (kitchen && !roleOf.has(kitchen)) roleOf.set(kitchen, 'cocina');
        const rest2 = rest.filter(l => !roleOf.has(l)); if (rest2.length >= 2) roleOf.set(rest2[0], 'baño');
        rest2.forEach(l => { if (!roleOf.has(l)) roleOf.set(l, h.type === 'condominio' ? 'depto' : 'dormitorio'); });
      } }
    // plaza y parques: portones centrados en sus tramos más largos de reja
    const rejaRuns = l => runs.filter(r => (r.a === l || r.b === l) && r.segs[0].cls === 'reja').sort((p, r2) => r2.segs.length - p.segs.length);
    rejaRuns(RING).slice(0, 6).forEach(r => openMid(r, 'porton', 3, true));
    for (let l = 6; l < kinds.length; l++) if (kinds[l] === 'parque' || kinds[l] === 'juegos') rejaRuns(l).slice(0, 2).forEach(r => openMid(r, 'porton', 2, true)); // todo pasto: al menos 2 entradas
    // caminos por cuartos de celda (ventana rota cuesta más, la mediana se salta)
    const segAt = new Map(segs.map(s2 => [s2.dir + (s2.dir[0] === 'd' ? Math.min(s2.a[0], s2.b[0]) + ',' + Math.min(s2.a[1], s2.b[1]) : s2.a[0] + ',' + s2.a[1]), s2]));
    const cost = s2 => !s2 ? 1 : BLOCK.has(s2.cls) ? 0 : s2.cls === 'ventanaRota' ? 5 : s2.cls === 'mediana' ? 3 : 1;
    const walk = (start, goal) => {
      const dist = new Int32Array(NQ).fill(1e9), prev = new Int32Array(NQ).fill(-1), bk = [[start]]; dist[start] = 0;
      const step = (i, j, s2, d) => { const c2 = cost(s2); if (!c2 || kindOf(q[j]) === 'out' || kindOf(q[j]) === 'agua') return; const nd = d + c2; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; (bk[nd] = bk[nd] || []).push(j); } };
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
      for (let i = 0; i < NQ; i++) { if (kindOf(q[i]) === 'out' || kindOf(q[i]) === 'agua') continue; (dist[i] < 1e9 ? reached : un).add(q[i]); }
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
    // rejas en las calles: cruzan la calle de vereda a vereda; casi siempre dejan un paso de 2, a veces la cierran (solo si
    // igual se llega a todo por otro lado: hay que rodear)
    let nBarr = 0, nBarrFull = 0;
    if (s0 >= 0) { const stc = c => c >= 0 && [0, 1, 2, 3].every(k => isSt(q[c * 4 + k])), want = Math.round(n * 2.5);
      const reachN = () => { const d = walk(s0, null).dist; let k2 = 0; for (let i = 0; i < NQ; i++) if (d[i] < 1e9) k2++; return k2; };
      let base = -1;
      for (let tr = 0; tr < want * 40 && nBarr < want; tr++) {
        const x = rnd(1, C - 2), y = rnd(1, Rr - 2); if (!stc(y * C + x)) continue;
        const horiz = chance(0.5), cellAt = v => horiz ? y * C + v : v * C + x, lim = horiz ? C : Rr;
        let a = horiz ? x : y, b = a; while (a - 1 >= 0 && stc(cellAt(a - 1))) a--; while (b + 1 < lim && stc(cellAt(b + 1))) b++;
        if (b - a + 1 < 4 || b - a + 1 > 12) continue;
        let straight = true; for (let v = a; v <= b && straight; v++) for (const dd of [-1, 1]) { const c2 = horiz ? (y + dd) * C + v : v * C + x + dd; if (!stc(c2)) { straight = false; break; } }
        if (!straight) continue;
        const full = chance(0.25), g0 = rnd(a, b - 1), added = [];
        for (let v = a; v <= b; v++) { if (!full && (v === g0 || v === g0 + 1)) continue; added.push(horiz ? { a: [v, y], b: [v + 1, y], dir: 'h', line: y, pos: v, L1: ROAD, L2: ROAD, cls: 'reja' } : { a: [x, v], b: [x, v + 1], dir: 'v', line: x, pos: v, L1: ROAD, L2: ROAD, cls: 'reja' }); }
        const keyOf = s2 => s2.dir + s2.a[0] + ',' + s2.a[1]; if (added.some(s2 => segAt.has(keyOf(s2)))) continue;
        // la punta de la reja no cae junto a una puerta, portón o ventana de la pared donde termina
        const OPEN = new Set(['puerta', 'porton', 'garaje', 'hueco', 'ventana', 'ventanaRota', 'entrada']);
        const ends = horiz ? [[a, y], [b + 1, y]] : [[x, a], [x, b + 1]], near = ([ex, ey]) => (horiz ? ['v' + ex + ',' + (ey - 1), 'v' + ex + ',' + ey] : ['h' + (ex - 1) + ',' + ey, 'h' + ex + ',' + ey]).some(k2 => OPEN.has(segAt.get(k2)?.cls));
        if (ends.some(near)) continue;
        added.forEach(s2 => segAt.set(keyOf(s2), s2));
        if (full) { if (base < 0) base = reachN(); if (reachN() < base) { added.forEach(s2 => segAt.delete(keyOf(s2))); continue; } nBarrFull++; }
        segs.push(...added); nBarr++;
      } }
    const medRuns = []; // tramos de mediana (para los carriles y el sentido del tráfico)
    // doble vía: mediana al medio de las pistas rectas de 6, con cortes para cruzar
    let nMed = 0;
    { const full = new Uint8Array(C * Rr); for (let c = 0; c < C * Rr; c++) full[c] = q[c * 4] === ROAD && q[c * 4 + 1] === ROAD && q[c * 4 + 2] === ROAD && q[c * 4 + 3] === ROAD ? 1 : 0;
      const dist = new Int32Array(C * Rr), queue = [];
      for (let c = 0; c < C * Rr; c++) if (!full[c]) { dist[c] = 0; queue.push(c); } else dist[c] = 1e9;
      for (let h2 = 0; h2 < queue.length; h2++) { const c = queue[h2], x = c % C, y = (c / C) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= Rr) continue; const j = ny * C + nx; if (dist[j] > dist[c] + 1) { dist[j] = dist[c] + 1; queue.push(j); } } }
      const D = (x, y) => x < 0 || y < 0 || x >= C || y >= Rr ? 0 : dist[y * C + x];
      const cand = new Map();
      for (let y = 0; y < Rr; y++) for (let x = 1; x < C; x++) if (D(x - 1, y) === D(x, y) && D(x, y) >= 3 && D(x, y) <= 10 && D(x - 2, y) === D(x, y) - 1 && D(x + 1, y) === D(x, y) - 1) cand.set('v' + x + ',' + y, 1);
      for (let y = 1; y < Rr; y++) for (let x = 0; x < C; x++) if (D(x, y - 1) === D(x, y) && D(x, y) >= 3 && D(x, y) <= 10 && D(x, y - 2) === D(x, y) - 1 && D(x, y + 1) === D(x, y) - 1) cand.set('h' + x + ',' + y, 1);
      const take = (keyOf, line, len) => { let run = []; const flush = () => { if (run.length >= 10) { const [x0r, y0r] = run[0].slice(1).split(',').map(Number), [x1r, y1r] = run[run.length - 1].slice(1).split(',').map(Number); medRuns.push({ dir: run[0][0], line, p0: run[0][0] === 'v' ? y0r : x0r, p1: run[0][0] === 'v' ? y1r : x1r, d: D(x0r, y0r) }); } if (run.length >= 10) run.forEach((k, i) => { if (i % 16 < 14) { const [x, y] = k.slice(1).split(',').map(Number); const s = { a: k[0] === 'v' ? [x, y] : [x, y], b: k[0] === 'v' ? [x, y + 1] : [x + 1, y], dir: k[0], line: k[0] === 'v' ? x : y, pos: k[0] === 'v' ? y : x, L1: ROAD, L2: ROAD, cls: 'mediana' }; segs.push(s); nMed++; } }); run = []; };
        for (let p = 0; p <= len; p++) { const k = keyOf(p); if (p < len && cand.has(k)) run.push(k); else flush(); } };
      for (let x = 1; x < C; x++) take(p => 'v' + x + ',' + p, x, Rr);
      for (let y = 1; y < Rr; y++) take(p => 'h' + p + ',' + y, y, C);
    }
    // sentido del tráfico (por la derecha): a cada lado de la mediana sus carriles de 3, con flechas cada 10 celdas y líneas
    // blancas entre carriles; en los óvalos se gira en sentido antihorario
    const trafico = { flechas: [], lineas: [] };
    for (const r of medRuns) { const nL = Math.max(1, Math.round(r.d / 3)), lw = r.d / nL;
      for (const side of [1, -1]) { // h: abajo va al este, arriba al oeste; v: a la izquierda va al sur, a la derecha al norte
        const dirA = r.dir === 'h' ? [side, 0] : [0, -side];
        for (let j = 0; j < nL; j++) { const off = side * (j + 0.5) * lw;
          for (let p = r.p0 + 4; p <= r.p1 - 3; p += 10) trafico.flechas.push(r.dir === 'h' ? { x: p + 0.5, y: r.line + off, dx: dirA[0], dy: dirA[1] } : { x: r.line + off, y: p + 0.5, dx: dirA[0], dy: dirA[1] }); }
        for (let j = 1; j < nL; j++) { const off = side * j * lw; trafico.lineas.push(r.dir === 'h' ? { x1: r.p0, y1: r.line + off, x2: r.p1 + 1, y2: r.line + off } : { x1: r.line + off, y1: r.p0, x2: r.line + off, y2: r.p1 + 1 }); } } }
    for (const [cx, cy] of rotPts) for (let a = 0; a < 8; a++) { const th = (a + 0.5) * Math.PI / 4; trafico.flechas.push({ x: cx + Math.cos(th) * 8.5, y: cy + Math.sin(th) * 8.5, dx: +Math.sin(th).toFixed(3), dy: +(-Math.cos(th)).toFixed(3), ovalo: true }); }
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
    // ---------- pisos: cada edificio sube con la misma planta (mismas paredes, así las reglas de la rejilla se cumplen arriba
    // también); un condominio son departamentos apilados; arriba las puertas a la calle pasan a ventanas (balcón)
    const cellH = new Int32Array(C * Rr), cellL = new Int32Array(C * Rr);
    for (let c = 0; c < C * Rr; c++) { const l = q[c * 4]; if (kinds[l] === 'room' && q[c * 4 + 1] === l && q[c * 4 + 2] === l && q[c * 4 + 3] === l) { cellL[c] = l; cellH[c] = houseOf(l); } }
    const anyRoom = c => [0, 1, 2, 3].some(k => kinds[q[c * 4 + k]] === 'room');
    for (const h of houses.values()) {
      const big = h.rooms.size;
      if (h.type === 'corporativo') { h.pisos = 2; h.altura = rnd(6, 12); continue; } // torre: solo los pisos 1 y 2 se usan, el resto es fachada
      h.pisos = h.type === 'casa' ? (big < 4 || chance({ centro: 0.7, medio: 0.5 }[h.zone] ?? 0.3) ? 2 : 1) // casa chica: el resto de cuartos arriba
        : h.type === 'condominio' ? rnd(3, 5) : h.type === 'mansion' ? 2 : h.type === 'oficinas' ? rnd(2, 3) : h.type === 'tienda' ? (chance(0.4) ? 2 : 1) : h.type === 'comercial' ? rnd(2, 3)
        : ['hospital', 'escuela', 'policia', 'bomberos'].includes(h.type) ? 2 : 1;
    }
    // puentes y tablas entre techos de edificios cercanos (más caminos cuando las calles están cerradas)
    const puentes = []; { const cand = new Map(), NOB = new Set(['militar', 'carcel', 'corporativo']);
      for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) { const h1 = cellH[y * C + x]; if (!h1 || NOB.has(houses.get(h1)?.type)) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]]) { let g = 0, x2 = x + dx, y2 = y + dy;
          while (x2 < C && y2 < Rr && g <= 8 && !anyRoom(y2 * C + x2)) { g++; x2 += dx; y2 += dy; }
          if (g < 1 || g > 8 || x2 >= C || y2 >= Rr) continue; const h2 = cellH[y2 * C + x2]; if (!h2 || h2 === h1 || NOB.has(houses.get(h2)?.type)) continue;
          const side = [x - dy, y - dx], side2 = [x2 - dy, y2 - dx]; if (cellH[side[1] * C + side[0]] !== h1 || cellH[side2[1] * C + side2[0]] !== h2) continue; // ancho: dos celdas de techo a cada lado
          const pk = Math.min(h1, h2) + ',' + Math.max(h1, h2); if (!cand.has(pk)) cand.set(pk, []); cand.get(pk).push({ x, y, dx, dy, g, h1, h2 }); } }
      const deg = new Map(), cap = h => houses.get(h)?.campus || houses.get(h)?.type === 'comercial' ? 3 : 2;
      for (const list of [...cand.values()].sort((p, r2) => Math.min(...p.map(c2 => c2.g)) - Math.min(...r2.map(c2 => c2.g)))) {
        const gmin = Math.min(...list.map(c2 => c2.g)), best = list.filter(c2 => c2.g === gmin), b = best[best.length >> 1];
        if ((deg.get(b.h1) || 0) >= cap(b.h1) || (deg.get(b.h2) || 0) >= cap(b.h2)) continue;
        deg.set(b.h1, (deg.get(b.h1) || 0) + 1); deg.set(b.h2, (deg.get(b.h2) || 0) + 1);
        const x1 = b.x + b.dx, y1 = b.y + b.dy; // eje del puente: el borde entre la fila (o columna) de la celda y la de al lado
        puentes.push({ tipo: b.g <= 3 ? 'tabla' : 'puente', x1, y1, x2: x1 + b.dx * b.g, y2: y1 + b.dy * b.g, ancho: 2, largo: b.g, casaA: b.h1, casaB: b.h2, pisosA: houses.get(b.h1).pisos, pisosB: houses.get(b.h2).pisos });
        houses.get(b.h1).techo = houses.get(b.h2).techo = true;
      } }
    // escaleras: un área (caracol 2×2 o recta 2×3) en el mismo lugar de todos los pisos, pegada a una pared, sin tapar puertas,
    // con su entrada desde el mismo cuarto (sala, hall, pasillo o recepción)
    const escaleras = []; {
      const DOORISH = new Set(['puerta', 'garaje', 'porton', 'hueco', 'entrada', 'ventanaRota']);
      const PREF = ['pasillo', 'hall', 'sala', 'recepción', 'guardia', 'dirección', 'local', 'oficina', 'estar'];
      for (const h of houses.values()) {
        if (h.pisos < 2 && !h.techo) continue;
        const big = h.campus || h.type === 'comercial' || h.type === 'oficinas' || h.type === 'mansion';
        // en U (dos tramos con descanso, 4×4), recta larga (2×4, 2×5 en edificios) y, si no entra nada, caracol 2×2
        const dims = big ? [['U', 4, 4], ['recta', 2, 5], ['recta', 5, 2], ['recta', 2, 4], ['recta', 4, 2], ['caracol', 2, 2]]
          : chance(0.5) ? [['U', 4, 4], ['recta', 2, 4], ['recta', 4, 2], ['caracol', 2, 2]] : [['recta', 2, 4], ['recta', 4, 2], ['U', 4, 4], ['caracol', 2, 2]];
        const rooms = [...h.rooms].sort((p, r2) => { const a = PREF.indexOf(roleOf.get(p)), b = PREF.indexOf(roleOf.get(r2)); return (a < 0 ? 99 : a) - (b < 0 ? 99 : b); });
        let got = null;
        // casa en diagonal: la escalera gira con la casa (un rectángulo en el marco a 45°, con bordes en vértices de la rejilla)
        const nd = segs.filter(s3 => s3.dir[0] === 'd' && [s3.L1, s3.L2].some(l2 => kindOf(l2) === 'room' && houseOf(l2) === h.id)).length, na = segs.filter(s3 => s3.dir[0] !== 'd' && [s3.L1, s3.L2].some(l2 => kindOf(l2) === 'room' && houseOf(l2) === h.id)).length;
        if (nd > na) { const dimsD = dims.map(([f2, w2, h2]) => [f2, f2 === 'caracol' ? 4 : w2 === 2 ? 4 : 6, f2 === 'caracol' ? 4 : h2 === 2 ? 4 : 6]);
          const fq = i => { const c2 = i >> 2, px = c2 % C + CEN[i & 3][0], py = ((c2 / C) | 0) + CEN[i & 3][1]; return [px + py, px - py]; };
          for (const l of rooms) { const mem = []; for (let i = 0; i < NQ; i++) if (q[i] === l) mem.push(i); if (!mem.length) continue; const F2 = mem.map(fq);
            const inRect = (a0, a1, b0, b1) => { let n2 = 0, bad = 0; for (let k2 = 0; k2 < mem.length; k2++) { const [u, v] = F2[k2]; if (u > a0 && u < a1 && v > b0 && v < b1) n2++; } // cuartos del cuarto dentro
              const want = (a1 - a0) * (b1 - b0) * 2; return n2 >= want * 0.98 ? n2 : 0; }; // un rectángulo a 45° de du×dv tiene du·dv·2 cuartos
            let u0m = 1e9, u1m = -1e9, v0m = 1e9, v1m = -1e9; for (const [u, v] of F2) { u0m = Math.min(u0m, u); u1m = Math.max(u1m, u); v0m = Math.min(v0m, v); v1m = Math.max(v1m, v); }
            for (const [forma, du, dv] of dimsD) { let bs = -1;
              for (let u0 = Math.floor(u0m); u0 + du <= Math.ceil(u1m); u0++) for (let v0 = Math.floor(v0m); v0 + dv <= Math.ceil(v1m); v0++) { if ((u0 + v0) & 1) continue; if (!inRect(u0, u0 + du, v0, v0 + dv)) continue;
                const band = [[u0 - 2, u0, v0, v0 + dv], [u0 + du, u0 + du + 2, v0, v0 + dv], [u0, u0 + du, v0 - 2, v0], [u0, u0 + du, v0 + dv, v0 + dv + 2]].map(([a0, a1, b0, b1]) => { const n2 = inRect(a0, a1, b0, b1); return { free: n2 > 0, wall: n2 === 0 }; });
                const sides = band.map((b2, si) => ({ si, ...b2 })), okS = s3 => forma !== 'recta' || (du < dv ? s3.si >= 2 : s3.si < 2);
                const ent = sides.find(s3 => okS(s3) && s3.free && sides[s3.si ^ 1].wall) || sides.find(s3 => okS(s3) && s3.free); if (!ent) continue;
                const sc = sides.filter(s3 => s3.wall).length * 2 + (sides[ent.si ^ 1].wall ? 1 : 0); if (sc > bs) { bs = sc; got = { diag: true, u0, v0, du, dv, l, forma, entrada: ['u-', 'u+', 'v-', 'v+'][ent.si] }; } }
              if (got) break; } if (got) break; } }
        if (!got) for (const l of rooms) { for (const [forma, w, hh] of dims) {
          let bs = -1;
          for (let y = 1; y + hh < Rr; y++) for (let x = 1; x + w < C; x++) {
            let ok = true; for (let b = 0; b < hh && ok; b++) for (let a = 0; a < w; a++) if (cellL[(y + b) * C + x + a] !== l) { ok = false; break; } if (!ok) continue;
            // los cuatro lados: pared (fuera del cuarto) o piso libre; la entrada es un lado libre entero
            const sides = [[0, -1, w, 'h', y], [1, 0, hh, 'v', x + w], [0, 1, w, 'h', y + hh], [-1, 0, hh, 'v', x]].map(([dx, dy, n2, dir, line], si) => {
              let free = 0, door = false; for (let t2 = 0; t2 < n2; t2++) { const cx = dx ? (dx > 0 ? x + w : x - 1) : x + t2, cy = dy ? (dy > 0 ? y + hh : y - 1) : y + t2;
                if (cellL[cy * C + cx] === l) free++; else { const sg = segMap.get(dir === 'h' ? 'h' + (x + t2) + ',' + line : 'v' + line + ',' + (y + t2)); if (sg && DOORISH.has(sg.cls)) door = true; } }
              return { si, free: free === n2, wall: free === 0, door }; });
            if (sides.some(s3 => s3.door)) continue; const okS = s3 => forma !== 'recta' || (w < hh ? s3.si % 2 === 0 : s3.si % 2 === 1); // la recta entra por un lado corto
            const ent = sides.find(s3 => okS(s3) && s3.free && sides[(s3.si + 2) % 4].wall) || sides.find(s3 => okS(s3) && s3.free); if (!ent) continue;
            const sc = sides.filter(s3 => s3.wall).length * 2 + (sides[(ent.si + 2) % 4].wall ? 1 : 0); if (sc > bs) { bs = sc; got = { x, y, w, h: hh, l, forma, entrada: 'NESO'[ent.si] }; }
          }
          if (got) break; } if (got) break; }
        if (!got) continue;
        h.escalera = escaleras.length;
        if (got.diag) { const { u0, v0, du, dv } = got, P = (u, v) => [(u + v) / 2, (u - v) / 2], esq = [P(u0, v0), P(u0 + du, v0), P(u0 + du, v0 + dv), P(u0, v0 + dv)], [cx, cy] = P(u0 + du / 2, v0 + dv / 2);
          const dir = { 'u-': [-1, -1], 'u+': [1, 1], 'v-': [-1, 1], 'v+': [1, -1] }[got.entrada].map(v => v * Math.SQRT1_2), largo = (got.entrada[0] === 'u' ? du : dv) * Math.SQRT1_2, ancho = (got.entrada[0] === 'u' ? dv : du) * Math.SQRT1_2;
          const celdas = []; for (let y = Math.floor(Math.min(...esq.map(e => e[1]))); y <= Math.ceil(Math.max(...esq.map(e => e[1]))); y++) for (let x = Math.floor(Math.min(...esq.map(e => e[0]))); x <= Math.ceil(Math.max(...esq.map(e => e[0]))); x++) { const u = x + y + 1, v = x - y; if (u - 1 >= u0 && u + 1 <= u0 + du && v - 1 >= v0 && v + 1 <= v0 + dv) celdas.push([x, y]); }
          escaleras.push({ tipo: 'escalera', forma: got.forma, diag: true, esquinas: esq, cx, cy, dir, largo, ancho, celdas, entrada: got.entrada, casa: h.id, cuarto: got.l, pisos: h.pisos, techo: !!h.techo }); }
        else { const dir = { N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0] }[got.entrada], ns = got.entrada === 'N' || got.entrada === 'S', celdas = []; for (let b = 0; b < got.h; b++) for (let a = 0; a < got.w; a++) celdas.push([got.x + a, got.y + b]);
          escaleras.push({ tipo: 'escalera', forma: got.forma, x: got.x, y: got.y, w: got.w, h: got.h, cx: got.x + got.w / 2, cy: got.y + got.h / 2, dir, largo: ns ? got.h : got.w, ancho: ns ? got.w : got.h, celdas, esquinas: [[got.x, got.y], [got.x + got.w, got.y], [got.x + got.w, got.y + got.h], [got.x, got.y + got.h]], entrada: got.entrada, casa: h.id, cuarto: got.l, pisos: h.pisos, techo: !!h.techo }); }
      } }
    // plantas de arriba: mismas paredes; entre casas más bajas la medianera pasa a pared exterior con ventanas
    const maxPisos = Math.max(1, ...[...houses.values()].map(h => h.pisos)), pisos = [];
    const rolesUp = new Map(); // cuarto → usos de los pisos 2, 3, 4
    const areaQ = new Map(); for (let i = 0; i < NQ; i++) if (kinds[q[i]] === 'room') areaQ.set(q[i], (areaQ.get(q[i]) || 0) + 1);
    for (const h of houses.values()) { if (h.pisos < 2) continue; const st = escaleras[h.escalera]?.cuarto;
      const priv = [...h.rooms].filter(l => l !== st && roleOf.get(l) !== 'baño').sort((p, r2) => areaQ.get(r2) - areaQ.get(p)); // arriba en una casa: dormitorios
      if ((h.type === 'casa' || h.type === 'mansion') && ![...h.rooms].some(l => roleOf.get(l) === 'baño') && priv.length >= 2) roleOf.set(priv.pop(), 'baño'); // sin baño abajo: el cuarto chico de arriba (y de abajo) es baño
      const dormUp = l => { const k2 = priv.indexOf(l); return k2 === 0 ? 'dormitorio principal' : k2 >= 3 && k2 === priv.length - 1 ? 'estudio' : 'dormitorio'; };
      for (const l of h.rooms) { const r0 = roleOf.get(l) || '', up = [];
        for (let k = 2; k <= h.pisos; k++) up.push(l === st && h.type !== 'condominio' ? (h.campus || h.type === 'comercial' ? 'pasillo' : 'hall') // donde llega la escalera
          : h.type === 'casa' || h.type === 'mansion' ? (r0 === 'baño' || r0 === 'pasillo' ? r0 : dormUp(l))
          : h.type === 'condominio' ? r0 // departamento repetido piso por piso
          : h.type === 'oficinas' || h.type === 'tienda' || h.type === 'corporativo' ? (r0 === 'baño' ? 'baño' : r0 === 'lobby' ? 'hall' : 'oficina')
          : ['garaje', 'cochera', 'garaje policial', 'urgencias', 'patio de presos'].includes(r0) ? (h.type === 'hospital' ? 'habitación' : 'oficina') : r0);
        rolesUp.set(l, up); } }
    for (let k = 2; k <= maxPisos; k++) {
      const up = l => kindOf(l) === 'room' && (houses.get(houseOf(l))?.pisos || 1) >= k ? houseOf(l) : 0, list = [];
      for (const s of segs) { if (s.cls === 'mediana' || s.cls === 'bordillo') continue; const h1 = up(s.L1), h2 = up(s.L2); if (!h1 && !h2) continue;
        const cls = h1 && h2 ? (h1 === h2 ? (s.cls === 'puerta' ? 'puerta' : 'interior') : 'medianera')
          : s.cls === 'ventana' || s.cls === 'ventanaRota' ? s.cls : ['puerta', 'garaje', 'porton', 'hueco', 'entrada'].includes(s.cls) ? 'ventana' : 'exterior';
        list.push({ a: s.a, b: s.b, dir: s.dir, line: s.line, pos: s.pos, L1: s.L1, L2: s.L2, cls }); }
      // ventanas en los tramos exteriores largos que quedaron ciegos
      const byLine = new Map(); for (const s of list) { const kk = s.dir + ':' + s.line; if (!byLine.has(kk)) byLine.set(kk, []); byLine.get(kk).push(s); }
      for (const ls of byLine.values()) { ls.sort((p, r2) => p.pos - r2.pos); let run = [];
        const flush = () => { if (run.length >= 4 && run.every(s => s.cls === 'exterior')) for (let t2 = 1 + rnd(0, 1); t2 <= run.length - 2; t2 += 3) run[t2].cls = chance(0.12) ? 'ventanaRota' : 'ventana'; run = []; };
        for (const s of ls) { if (run.length && (run[run.length - 1].pos !== s.pos - 1 || run[run.length - 1].L1 !== s.L1 || run[run.length - 1].L2 !== s.L2)) flush(); run.push(s); } flush(); }
      pisos.push({ piso: k, segs: list });
    }
    const count = c => segs.filter(s => s.cls === c).length, hs = [...houses.values()];
    const stats = {
      casas: hs.filter(h => h.type === 'casa').length, tiendas: hs.filter(h => h.type === 'tienda').length, oficinas: hs.filter(h => h.type === 'oficinas').length, condominios: hs.filter(h => h.type === 'condominio').length,
      centroComercial: hs.filter(h => h.type === 'comercial').length, mansiones: nMans, patios: hs.filter(h => h.patio).length, almacenes: hs.filter(h => h.type === 'almacen').length, derribos: nDemol, rotondas: nRot, islasVerdes: nIsla, plazuelas: nPlazuela, granjas: nGranja, lotesVerdes: nVerde, comidaRapida: hs.filter(h => h.type === 'comida').length, torres: hs.filter(h => h.type === 'corporativo').length, edificiosRecinto: nAnexo, supermercados: hs.filter(h => h.type === 'super').length, mercados: hs.filter(h => h.type === 'mercado').length, barrios: barrios.length, pasajes: nPas, especiales: nSpecial, avenidaCentral: nBlvd, estacionamientos: nPark, rejasCalle: nBarr, rejasCierran: nBarrFull, garajes: nGar, salidasEmergencia: nEmerg, entradasRotas: nHueco, autopistas: nHwy, crucesArreglados: nFixX, esquinasArregladas: nFixW, sueltas: hs.filter(h => h.style === 'suelta').length, cuartosUnidos: nMerge, avenidas: nAv, accesosArreglados: nFix,
      cuartos: hs.reduce((a, h) => a + h.rooms.size, 0), refugios: refuges.length, parques: kinds.filter(k => k === 'parque').length, plazaCeldas: plaza ? Math.round(plaza.area) : 0,
      puertas: count('puerta'), ventanasCerradas: count('ventana'), ventanasRotas: count('ventanaRota'), rejas: count('reja'), portones: count('porton'), mediana: nMed,
      tramosDiagonales: segs.filter(s => s.dir[0] === 'd').length, ruta: route ? route.cost : null,
      edificiosDe2oMas: hs.filter(h => h.pisos >= 2).length, pisosMax: maxPisos, escaleras: escaleras.length, escalerasAlTecho: escaleras.filter(e => e.techo).length, puentes: puentes.filter(p => p.tipo === 'puente').length, tablas: puentes.filter(p => p.tipo === 'tabla').length,
    };
    // objetos: tachos de basura en los pasajes (callejones peatonales) y juegos en los parques infantiles
    const objetos = o.objetos ? [...plazaObj] : []; // solo construcciones: sin juegos, árboles, bancas ni tachos (o.objetos = true para tenerlos)
    { const cellK = (x, y) => x < 0 || y < 0 || x >= C || y >= Rr ? 'out' : kindOf(q[(y * C + x) * 4]);
      for (let y = 1; y < Rr - 1; y++) for (let x = 1; x < C - 1; x++) {
        const c = y * C + x; if (![0, 1, 2, 3].every(k => q[c * 4 + k] === PASAJE)) continue;
        if (o.objetos && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ['room', 'patio', 'parking'].includes(cellK(x + dx, y + dy))) && chance(0.09)) objetos.push({ tipo: 'tacho', x: x + 0.5, y: y + 0.5 });
      }
      const acc = new Map(); for (let i = 0; i < NQ; i++) if (kinds[q[i]] === 'juegos') { const c = i >> 2; let a = acc.get(q[i]); if (!a) acc.set(q[i], a = [0, 0, 0]); a[0] += c % C + 0.5; a[1] += ((c / C) | 0) + 0.5; a[2]++; }
      if (o.objetos) for (const [, a] of acc) { const cx = a[0] / a[2], cy = a[1] / a[2]; objetos.push({ tipo: 'tobogan', x: cx - 2, y: cy }, { tipo: 'columpio', x: cx + 2, y: cy }, { tipo: 'arenero', x: cx, y: cy + 2.5 }); } }
    const roomInfo = []; { const acc = new Map(); for (let i = 0; i < NQ; i++) { const l = q[i]; if (kinds[l] !== 'room') continue; const c = i >> 2; let a = acc.get(l); if (!a) acc.set(l, a = [0, 0, 0]); a[0] += c % C + 0.5; a[1] += ((c / C) | 0) + 0.5; a[2]++; }
      for (const [l, a] of acc) roomInfo.push({ l, cx: a[0] / a[2], cy: a[1] / a[2], area: a[2] / 4, role: roleOf.get(l) || '', arriba: rolesUp.get(l) || [] }); }
    for (const b of barrios) if (b.n) { b.cx = b.sx / b.n; b.cy = b.sy / b.n; }
    return { motor: true, roomInfo, objetos, barrios: barrios.filter(b => b.n).map(b => ({ nombre: b.nombre, cx: b.cx, cy: b.cy, estilo: b.suelta > 0.5 ? 'casas sueltas con jardín' : 'casas adosadas' })), seed, n, W, H, C4: C, q, kinds, kindOf, houseOf, segs, houses, bossL: PLAZA, plaza, A, routeCells, stats, pisos, maxPisos, escaleras, puentes, viaMayor: major, rotondas: rotPts, trafico, decoracion: [...rotPts, ...decoPts].map(([x, y]) => ({ x, y })) };
  }

  root.MotorCiudad = { generate };
})(typeof window !== 'undefined' ? window : globalThis);
