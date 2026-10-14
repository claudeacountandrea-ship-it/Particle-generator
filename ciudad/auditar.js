// Auditoría de planos: por tipo de construcción, cuántas hay, cuartos y área típicos, cuáles no tienen patio o entrada y qué usos
// de su programa mínimo les faltan (contando los pisos de arriba). Uso: node ciudad/auditar.js [semilla]
require('./mazmorra_base.js'); require('./ciudad.js'); require('./ciudad_diagonal.js'); require('./motor_ciudad.js');
const c = MotorCiudad.generate({ seed: +(process.argv[2] || 7), n: 12 }), RI = new Map(c.roomInfo.map(r => [r.l, r]));
// programa mínimo de cada tipo (usos que no pueden faltar, contando los pisos de arriba)
const MIN = { casa: ['sala', 'cocina', 'baño', 'dormitorio|dormitorio principal'], condominio: ['sala|departamento', 'cocina|departamento|sala', 'baño|departamento', 'dormitorio|departamento|dormitorio principal'], mansion: ['hall', 'salón', 'cocina', 'baño', 'dormitorio'],
  tienda: ['local', 'depósito', 'baño'], oficinas: ['recepción', 'oficina', 'baño'], comida: ['comedor', 'cocina', 'baño'], super: ['sala de ventas', 'depósito', 'baño'], almacen: ['almacén', 'oficina', 'baño'],
  hospital: ['recepción', 'urgencias', 'habitación', 'quirófano', 'farmacia', 'baños'], escuela: ['dirección', 'aula', 'baños', 'gimnasio'], policia: ['recepción', 'celda', 'oficina', 'baños'], bomberos: ['cochera', 'dormitorio', 'cocina', 'baños'],
  mercado: ['nave de puestos', 'depósito', 'baños'], comercial: ['local', 'pasillo', 'baños'], militar: ['mando', 'barraca', 'comedor', 'baños'], carcel: ['celda', 'guardia', 'comedor', 'baños'] };
const doorsOut = new Map(); const OUT = new Set(['corr', 'vereda', 'pasaje', 'patio', 'parking']);
for (const s of c.segs) { if (!['puerta', 'garaje', 'porton'].includes(s.cls)) continue; for (const [a, b] of [[s.L1, s.L2], [s.L2, s.L1]]) if (c.kindOf(a) === 'room' && OUT.has(c.kindOf(b))) { const h = c.houseOf(a); doorsOut.set(h, (doorsOut.get(h) || 0) + 1); } }
const rep = {};
for (const h of c.houses.values()) { if (h.anexo) continue; const t = h.type; const r = rep[t] = rep[t] || { n: 0, falta: {}, sinPatio: 0, sinEntrada: 0, unaEntrada: 0, cuartos: [], area: [] };
  r.n++; const roles = new Set(); for (const l of h.rooms) { const ri = RI.get(l); if (!ri) continue; roles.add(ri.role); (ri.arriba || []).forEach(x => roles.add(x)); }
  for (const need of MIN[t] || []) if (!need.split('|').some(x => roles.has(x))) r.falta[need] = (r.falta[need] || 0) + 1;
  if (!h.patio) r.sinPatio++; const d = doorsOut.get(h.id) || 0; if (!d) r.sinEntrada++; else if (d === 1) r.unaEntrada++; r.cuartos.push(h.rooms.size); r.area.push(Math.round(h.area)); }
for (const [t, r] of Object.entries(rep)) { const med = a => a.sort((x, y) => x - y)[a.length >> 1]; console.log(t.padEnd(11), 'n', String(r.n).padStart(3), 'cuartos~', med(r.cuartos), 'área~', med(r.area), 'sinPatio', r.sinPatio, 'sinEntrada', r.sinEntrada, 'unaEntrada', r.unaEntrada, 'falta', JSON.stringify(r.falta)); }
