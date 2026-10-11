// Arma ciudad/mazmorra_base.js con el generador de salas y pasillos de editor/index.html (sin tocar el editor).
// Correr de nuevo cada vez que mejore el generador de mazmorras: node ciudad/construir_base.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'editor', 'index.html'), 'utf8');
const sec = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error('no encuentro la sección ' + a); return html.slice(i, j); };
let src = sec('// ---------- grand dungeon', '// ---------- labyrinth of minirooms') + sec('// ---------- rooms and winding corridors', '// ---------- cave by steps') + sec('// ---------- floor view', 'async function savePadGen');
if (!src.includes('_share: diagShare,')) throw new Error('no encuentro la salida de Halls');
src = src.replace('_share: diagShare,', '_share: diagShare, _q: B.q, _kinds: B.kinds,');
// mezclar con sort(() => Math.random() - .5) da distinto en cada versión del motor de JavaScript (navegador ≠ Node):
// se cambia por una mezcla Fisher–Yates con el mismo Math.random, así la misma semilla da la misma ciudad en todos lados
src = src.replace(/\.sort\(\(\) => Math\.random\(\) - 0?\.5\)/g, '.__mezcla()'); // etiquetas por cuarto de celda: sala, pasillo o hueco
const out = `// Generado por ciudad/construir_base.js desde editor/index.html: no editar a mano.
(function (root) {
const vk = (x, y) => x + ',' + y;
function wk(a, b) { const [p, q] = (a[1] < b[1] || (a[1] === b[1] && a[0] <= b[0])) ? [a, b] : [b, a]; return vk(p[0], p[1]) + '|' + vk(q[0], q[1]); }
const parseW = k => k.split('|').map(s => s.split(',').map(Number));
if (!Array.prototype.__mezcla) Object.defineProperty(Array.prototype, '__mezcla', { configurable: true, value: function () { for (let i = this.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = this[i]; this[i] = this[j]; this[j] = t; } return this; } });
${src}
root.MazmorraBase = { Halls, floorView, checkRules, wk, parseW };
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(__dirname, 'mazmorra_base.js'), out);
console.log('mazmorra_base.js:', (out.length / 1024).toFixed(0), 'KB');
