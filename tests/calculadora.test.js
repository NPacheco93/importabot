// Pruebas de la calculadora (no necesitan API key).
// Uso: npm test
// Compara la introducción calculada con lo que realmente pagué en mis 3 importaciones,
// y verifica las reglas de presupuesto y de datos faltantes.

import { readFileSync } from 'node:fs';
import { calcularIntroduccion, calcularPresupuesto } from '../src/calculadora.js';

const HOY = new Date('2026-11-15T12:00:00');
const resultados = [];
const prueba = (nombre, esperado, real, paso) => resultados.push({ nombre, esperado, real, paso });
const L = (n) => 'L ' + Math.round(n).toLocaleString('en-US');

// 1. Validación con importaciones reales.
// Los montos reales son privados: viven en registros/casos_reales.json, que no se sube a GitHub.
// Formato: [{ "vehiculo": "...", "anio": 2019, "compraLps": 0, "fleteLps": 0, "origen": "estados_unidos", "real": 0 }]
let reales = [];
try {
  reales = JSON.parse(readFileSync(new URL('../registros/casos_reales.json', import.meta.url), 'utf8'));
} catch {
  console.log('(Sin registros/casos_reales.json: se omite la validación con costos reales.)');
}
let sumaError = 0;
for (const v of reales) {
  const r = calcularIntroduccion(v);
  const centro = (r.min + r.max) / 2;
  const error = Math.abs(centro - v.real) / v.real;
  sumaError += error;
  prueba(`Introducción ${v.vehiculo} (${r.regimen})`, 'error menor a 10 % frente al costo real',
    `error de ${(error * 100).toFixed(1)} %`, error < 0.10);
}
const errorPromedio = reales.length ? sumaError / reales.length : null;

// 2. Reglas de presupuesto (Tacoma 2008 reparada, daño leve, con rango de referencia)
const base = { marca: 'Toyota', modelo: 'Tacoma', anio: 2008, tipo_vehiculo: 'pickup',
  modalidad: 'reparado', nivel_danio: 'leve', precio_subasta_usd: null, origen: 'desconocido' };
for (const [presupuesto, esperado] of [[300000, 'cubre'], [200000, 'parcial'], [80000, 'insuficiente']]) {
  const r = calcularPresupuesto({ ...base, presupuesto_lps: presupuesto }, HOY);
  prueba(`Presupuesto ${L(presupuesto)} para Tacoma 2008 reparada`, esperado,
    `${r.presupuesto.estado} (rango ${L(r.total_lps.min)} – ${L(r.total_lps.max)})`,
    r.presupuesto.estado === esperado);
}

// 3. Precio fuera de lo normal
{
  const r = calcularPresupuesto({ ...base, presupuesto_lps: null, precio_subasta_usd: 500 }, HOY);
  prueba('Precio de subasta de $500 para Tacoma 2008', 'advertencia de precio fuera de lo normal',
    r.advertencias.length ? 'advertencia generada' : 'sin advertencia', r.advertencias.some((a) => a.includes('fuera de lo normal')));
}

// 4. Datos faltantes y modelo sin referencia
{
  const r = calcularPresupuesto({ ...base, nivel_danio: null, presupuesto_lps: null }, HOY);
  prueba('Reparado sin nivel de daño', 'pide el nivel de daño', r.estado + ': ' + (r.faltantes || []).join(', '),
    r.estado === 'faltan_datos');
  const s = calcularPresupuesto({ ...base, marca: 'Honda', modelo: 'Civic', anio: 2016, tipo_vehiculo: 'sedan', presupuesto_lps: null }, HOY);
  prueba('Modelo sin precio de referencia (Civic 2016)', 'no inventa precio', s.estado, s.estado === 'sin_referencia');
}

// 5. Régimen y DAI según el VIN (vehículo 2018 de $6,000)
{
  const v = { marca: 'Toyota', modelo: 'Tacoma', anio: 2018, tipo_vehiculo: 'pickup', modalidad: 'sin_reparar',
    nivel_danio: null, precio_subasta_usd: 6000, presupuesto_lps: null };
  const eeuu = calcularPresupuesto({ ...v, origen: 'estados_unidos' }, HOY);
  const mex = calcularPresupuesto({ ...v, origen: 'otro' }, HOY);
  prueba('VIN de EE. UU. vs. de México (2018, $6,000)', 'el de México paga más (DAI)',
    `${L(eeuu.desglose_lps.introduccion.max)} vs. ${L(mex.desglose_lps.introduccion.max)}`,
    mex.desglose_lps.introduccion.max > eeuu.desglose_lps.introduccion.max);
}

// Reporte
const ok = resultados.filter((r) => r.paso).length;
console.log('\nPRUEBAS DE LA CALCULADORA — ImportaBot\n');
for (const r of resultados) {
  console.log(`${r.paso ? '✔ PASÓ' : '✘ FALLÓ'}  ${r.nombre}`);
  console.log(`         Esperado: ${r.esperado}`);
  console.log(`         Real:     ${r.real}`);
}
console.log(`\nResultado: ${ok} de ${resultados.length} pruebas correctas (${Math.round(ok / resultados.length * 100)} %)`);
if (errorPromedio !== null) console.log(`Error promedio de la introducción vs. costos reales: ${(errorPromedio * 100).toFixed(1)} %\n`);
process.exitCode = ok === resultados.length ? 0 : 1;
