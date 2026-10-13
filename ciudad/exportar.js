// Exporta una ciudad a piezas TruWorlds (formato A: JSON por chunk).
// Uso: node ciudad/exportar.js --semilla=7 [--modo=ciudad --n=12 | --modo=diagonal --n=19 | --modo=cuadricula --tamano=150x110]
//      [--zona=x,y,ancho,alto] solo esa parte del mapa, en celdas (para probar a escala chica)
//      techos de diseño: cada ciudad/disenos/techos/<tipo>.json (casa, condominio, tienda... o todos) reemplaza el techo plano
//      [--ligera] sin pisos de arriba ni piso de color dentro de las casas (menos piezas); [--pisos=no] [--pisoInterior=no] [--techos=no]
// Sale en ciudad/export/<modo>_semilla_<n>/: index.json (resumen, spawns, lista de chunks) y chunk_XX.json (piezas).
const fs = require('fs'), path = require('path');
require('./ciudad.js'); require('./mazmorra_base.js'); require('./ciudad_diagonal.js'); require('./motor_ciudad.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const seed = +(args.semilla ?? 7), modo = args.modo ?? 'ciudad', diag = modo !== 'cuadricula', motor = modo === 'ciudad';
const [w, h] = diag ? [+(args.n ?? (motor ? 12 : 19)), 0] : (args.tamano ?? '150x110').split('x').map(Number);
const map = motor ? MotorCiudad.generate({ seed, n: w }) : diag ? CiudadDiagonal.generate({ seed, n: w }) : Ciudad.generate({ seed, w, h }), ligera = 'ligera' in args, zona = args.zona ? args.zona.split(',').map(Number) : null, tdir = path.join(__dirname, 'disenos', 'techos'), techos = fs.existsSync(tdir) ? Object.fromEntries(fs.readdirSync(tdir).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(tdir, f), 'utf8'))])) : {},
  opts = { pisos: !ligera && args.pisos !== 'no', pisoInterior: !ligera && args.pisoInterior !== 'no', roofs: args.techos !== 'no', zona, techos: Object.keys(techos).length ? techos : null }, out = diag ? CiudadDiagonal.toParts(map, opts) : Ciudad.toParts(map);
const dir = path.join(__dirname, 'export', `${motor ? 'ciudad' : diag ? 'diagonal' : 'cuadricula'}_semilla_${seed}${ligera ? '_ligera' : ''}${zona ? '_zona' : ''}`);
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const list = out.chunks.map((c, k) => {
  const file = `chunk_${String(k).padStart(2, '0')}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify({ name: c.name, center: c.center, parts: c.parts }));
  return { archivo: file, nombre: c.name, centro: c.center, piezas: c.parts.length };
});
const index = {
  formato: 'TruWorlds piezas v1: {name, shape, pos, size, rot (grados, orden Y,X,Z), color 0-1, material}; studs; Y arriba; el norte del mapa mira a -Z; el mapa está centrado en el origen',
  modo: motor ? 'ciudad (motor derivado de la mazmorra)' : diag ? 'diagonal (mazmorra pintada)' : 'cuadricula', semilla: seed, tamano: diag ? `${w}x${w} (lattice de la mazmorra)` : `${w}x${h} celdas`, medidas: out.medidas, escala: out.scale,
  totalPiezas: out.parts.length, chunks: list, spawns: out.spawns, estadisticas: map.stats,
};
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));
if (opts.techos) console.log('techos de diseño:', Object.keys(opts.techos).join(', '));
console.log(`${modo} semilla ${seed}: ${out.parts.length} piezas en ${list.length} chunks (máx ${Math.max(...list.map(c => c.piezas))}) → ${path.relative(process.cwd(), dir)}`);
