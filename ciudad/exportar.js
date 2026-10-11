// Exporta una ciudad a piezas TruWorlds (formato A: JSON por chunk).
// Uso: node ciudad/exportar.js --semilla=7 --tamano=150x110
// Sale en ciudad/export/semilla_<n>/: index.json (resumen, spawns, lista de chunks) y chunk_XX.json (piezas).
const fs = require('fs'), path = require('path');
require('./ciudad.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const seed = +(args.semilla ?? 7), [w, h] = (args.tamano ?? '150x110').split('x').map(Number);
const map = Ciudad.generate({ seed, w, h }), out = Ciudad.toParts(map);
const dir = path.join(__dirname, 'export', `semilla_${seed}`);
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const list = out.chunks.map((c, k) => {
  const file = `chunk_${String(k).padStart(2, '0')}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify({ name: c.name, center: c.center, parts: c.parts }));
  return { archivo: file, nombre: c.name, centro: c.center, piezas: c.parts.length };
});
const index = {
  formato: 'TruWorlds piezas v1: {name, shape, pos, size, rot (grados, orden Y,X,Z), color 0-1, material}; studs; Y arriba; el norte del mapa mira a -Z; el mapa está centrado en el origen',
  semilla: seed, tamanoCeldas: [w, h], medidas: out.medidas, escala: out.scale,
  totalPiezas: out.parts.length, chunks: list, spawns: out.spawns, estadisticas: map.stats,
};
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));
console.log(`semilla ${seed} ${w}x${h}: ${out.parts.length} piezas en ${list.length} chunks (máx ${Math.max(...list.map(c => c.piezas))}) → ${path.relative(process.cwd(), dir)}`);
