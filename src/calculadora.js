// Calculadora de ImportaBot.
// Aquí viven las reglas del negocio: el modelo de IA NO calcula montos,
// solo extrae los datos y llama a calcularPresupuesto().

import tarifas from '../data/tarifas.json' with { type: 'json' };
import impuestos from '../data/impuestos.json' with { type: 'json' };
import reparaciones from '../data/reparaciones.json' with { type: 'json' };
import referencias from '../data/precios_referencia.json' with { type: 'json' };

const TC = tarifas.tipo_cambio.lps_por_usd;
const R = impuestos.regimen_normal;

const porTramo = (tramos, valor, campo) =>
  tramos.find((t) => t.hasta === null || valor <= t.hasta)[campo];

const redondear = (n) => Math.round(n / 100) * 100;

// Comisiones de compra de la subasta (USD) según el precio de subasta.
export function comisionSubasta(precioUsd) {
  return porTramo(tarifas.comision_subasta_usd.tramos, precioUsd, 'monto');
}

// Origen según el primer carácter del VIN o el país que diga el cliente.
export function origenDesdeVin(vin) {
  if (!vin) return 'desconocido';
  const c = String(vin).trim().charAt(0).toUpperCase();
  return R.vin_estados_unidos.includes(c) ? 'estados_unidos' : 'otro';
}

// Introducción (impuestos + trámites en Honduras), en lempiras.
// compraLps = precio de subasta + comisiones, ya en lempiras.
export function calcularIntroduccion({ anio, compraLps, fleteLps, origen = 'desconocido' }) {
  const tram = tarifas.tramites_honduras_lps;
  const parqueo = tram.parqueo_fiscal;

  if (anio <= impuestos.amnistia.anio_maximo) {
    const tasa = impuestos.amnistia.tasa_unica_lps;
    return {
      regimen: 'amnistia',
      min: tasa + parqueo + tram.tramitador.min,
      max: tasa + parqueo + tram.tramitador.max,
      detalle: { tasa_unica: tasa, parqueo_fiscal: parqueo, tramitador: tram.tramitador },
    };
  }

  // Régimen normal: CIF -> DAI -> ISC -> ISV -> ecotasa
  const cif = compraLps + fleteLps;
  const cifUsd = cif / TC;
  const dai = R.dai_porcentaje[origen] ?? R.dai_porcentaje.desconocido;
  const isc = porTramo(R.isc_tramos_usd, cifUsd, 'porcentaje');
  const eco = porTramo(R.ecotasa_tramos_usd, cifUsd, 'monto_lps');

  const impuesto = (daiPct) => {
    const vDai = cif * daiPct / 100;
    const vIsc = cif * isc / 100;
    const vIsv = (cif + vDai + vIsc) * R.isv_porcentaje / 100;
    return { dai: vDai, isc: vIsc, isv: vIsv, total: vDai + vIsc + vIsv + eco };
  };
  const bajo = impuesto(dai.min);
  const alto = impuesto(dai.max);

  return {
    regimen: 'normal',
    min: bajo.total + parqueo + tram.tramitador.min,
    max: alto.total + parqueo + tram.tramitador.max,
    detalle: {
      cif_lps: cif, dai_porcentaje: dai, isc_porcentaje: isc,
      isv_porcentaje: R.isv_porcentaje, ecotasa: eco,
      parqueo_fiscal: parqueo, tramitador: tram.tramitador,
    },
  };
}

// Busca el rango de precio de referencia del modelo.
export function buscarReferencia({ marca, modelo, anio }) {
  const m = (s) => String(s || '').toLowerCase().trim();
  return referencias.modelos.find((r) =>
    m(marca).includes(r.marca) && m(modelo).includes(r.modelo) &&
    anio >= r.anio_desde && anio <= r.anio_hasta) || null;
}

// Comisión del negocio: monto fijo por vehículo o porcentaje sobre el costo.
export function comisionNegocio(subtotalLps) {
  const c = tarifas.comision_negocio;
  return c.tipo === 'porcentaje' ? subtotalLps * c.porcentaje / 100 : c.monto_lps;
}

// Costo total para un precio de subasta dado, en el escenario 'min' o 'max'.
function costoTotal(precioUsd, p, escenario) {
  const flete = tarifas.flete_lps[p.tipo_vehiculo] || tarifas.flete_lps.sedan;
  const fleteLps = flete[escenario];
  const comision = comisionSubasta(precioUsd);
  const compraLps = (precioUsd + comision) * TC;
  const intro = calcularIntroduccion({ anio: p.anio, compraLps, fleteLps, origen: p.origen });
  const rep = p.modalidad === 'reparado' ? reparaciones.niveles[p.nivel_danio][escenario] : 0;
  const subtotal = precioUsd * TC + comision * TC + fleteLps + intro[escenario] + rep;
  const negocio = comisionNegocio(subtotal);
  return {
    precio_subasta_lps: precioUsd * TC,
    comisiones_subasta_lps: comision * TC,
    flete_lps: fleteLps,
    introduccion_lps: intro[escenario],
    reparacion_lps: rep,
    comision_negocio_lps: negocio,
    total: subtotal + negocio,
    regimen: intro.regimen,
  };
}

// Precio máximo de subasta que cabe en el presupuesto (escenario conservador).
function precioMaximoParaPresupuesto(presupuesto, p) {
  let lo = 0, hi = 200000;
  if (costoTotal(lo, p, 'max').total > presupuesto) return 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (costoTotal(mid, p, 'max').total <= presupuesto) lo = mid; else hi = mid;
  }
  return Math.floor(lo / 50) * 50;
}

/**
 * Función principal que el modelo de IA llama con function calling.
 * Recibe los datos que el modelo extrajo de la conversación.
 */
export function calcularPresupuesto(entrada, hoy = new Date()) {
  const p = {
    marca: entrada.marca,
    modelo: entrada.modelo,
    anio: Number(entrada.anio),
    tipo_vehiculo: entrada.tipo_vehiculo || 'sedan',
    modalidad: entrada.modalidad,
    nivel_danio: entrada.nivel_danio,
    precio_subasta_usd: entrada.precio_subasta_usd,
    presupuesto_lps: entrada.presupuesto_lps,
    origen: entrada.origen || 'desconocido',
  };

  // 1. Datos que faltan: el asistente debe preguntarlos antes de calcular.
  const faltantes = [];
  if (!p.marca || !p.modelo) faltantes.push('marca y modelo');
  if (!p.anio || p.anio < 1980 || p.anio > hoy.getFullYear() + 1) faltantes.push('año del vehículo');
  if (!['sin_reparar', 'reparado'].includes(p.modalidad)) faltantes.push('modalidad (sin reparar o reparado)');
  if (p.modalidad === 'reparado' && !reparaciones.niveles[p.nivel_danio]) faltantes.push('nivel de daño (leve, moderado o fuerte)');
  if (faltantes.length) return { estado: 'faltan_datos', faltantes };

  // 2. Rango de precio de subasta: el que dio el cliente o el de referencia.
  const ref = buscarReferencia(p);
  let pmin, pmax, fuentePrecio;
  if (p.precio_subasta_usd > 0) {
    pmin = pmax = p.precio_subasta_usd;
    fuentePrecio = 'cliente';
  } else if (ref) {
    pmin = ref.precio_min_usd; pmax = ref.precio_max_usd;
    fuentePrecio = 'referencia';
  } else {
    return {
      estado: 'sin_referencia',
      mensaje: 'No hay precio de referencia para este modelo. No se debe inventar un precio: pedir al cliente el precio de subasta que vio, o pasarlo al asesor.',
      vehiculo: `${p.marca} ${p.modelo} ${p.anio}`,
    };
  }

  // 3. Cálculo del rango total.
  const bajo = costoTotal(pmin, p, 'min');
  const alto = costoTotal(pmax, p, 'max');
  const rango = (k) => ({ min: redondear(bajo[k]), max: redondear(alto[k]) });

  const advertencias = [];
  if (fuentePrecio === 'cliente' && ref &&
      (p.precio_subasta_usd < ref.precio_min_usd * 0.6 || p.precio_subasta_usd > ref.precio_max_usd * 1.6)) {
    advertencias.push(`El precio indicado ($${p.precio_subasta_usd}) está fuera de lo normal para este modelo (referencia: $${ref.precio_min_usd} a $${ref.precio_max_usd}). El estimado podría no ser realista.`);
  }
  if (bajo.regimen === 'normal' && p.origen === 'desconocido') {
    advertencias.push('No se sabe dónde se fabricó el vehículo: el rango incluye el caso con y sin arancel (DAI). Con el primer carácter del VIN se puede afinar.');
  }
  if (bajo.regimen === 'normal') {
    const edad = hoy.getFullYear() - p.anio;
    const lim = impuestos.regimen_normal.antiguedad_maxima_anios;
    const max = p.tipo_vehiculo === 'pickup' ? lim.trabajo : lim.turismo;
    if (edad > max) advertencias.push(`El vehículo tiene ${edad} años; la normativa general limita la antigüedad a ${max} años para este tipo. El asesor debe confirmar si se puede importar.`);
  }
  if (fuentePrecio === 'referencia' && ref.confianza === 'baja') {
    advertencias.push(`El rango de precio de subasta se basa en pocas muestras (${ref.muestras}); el asesor puede confirmarlo con subastas actuales.`);
  }

  // 4. Comparación con el presupuesto del cliente.
  let presupuesto = null;
  if (p.presupuesto_lps > 0) {
    const P = p.presupuesto_lps;
    const maxPrecio = precioMaximoParaPresupuesto(P, p);
    let estado;
    if (P >= alto.total) estado = 'cubre';
    else if (P >= bajo.total) estado = 'parcial';
    else estado = 'insuficiente';
    presupuesto = {
      presupuesto_lps: P,
      estado,
      precio_maximo_subasta_usd: maxPrecio,
      presupuesto_minimo_aprox_lps: redondear(bajo.total),
      derivar_al_asesor: estado !== 'insuficiente',
    };
  }

  const validez = new Date(hoy);
  validez.setDate(validez.getDate() + tarifas.validez_estimado_dias);

  const vehiculo = `${p.marca} ${p.modelo} ${p.anio}`.replace(/\b\w/g, (c) => c.toUpperCase());
  const total = rango('total');

  return {
    estado: 'ok',
    vehiculo,
    modalidad: p.modalidad,
    nivel_danio: p.modalidad === 'reparado' ? p.nivel_danio : null,
    regimen: bajo.regimen === 'amnistia' ? 'Amnistía vehicular (2010 y anteriores)' : 'Régimen normal (2011 en adelante)',
    precio_subasta_usd: { min: pmin, max: pmax, fuente: fuentePrecio },
    desglose_lps: {
      precio_subasta: rango('precio_subasta_lps'),
      comisiones_subasta: rango('comisiones_subasta_lps'),
      flete: rango('flete_lps'),
      introduccion: rango('introduccion_lps'),
      reparacion: rango('reparacion_lps'),
      servicio: rango('comision_negocio_lps'),
    },
    total_lps: total,
    presupuesto,
    advertencias,
    tipo_cambio: TC,
    valido_hasta: validez.toISOString().slice(0, 10),
    nota: 'Estimado, no es cotización formal. El precio final depende de la subasta y de la inspección.',
    resumen_asesor: [
      'Solicitud de cotización — ImportaBot',
      `Vehículo: ${vehiculo}`,
      `Modalidad: ${p.modalidad === 'reparado' ? `reparado (daño ${p.nivel_danio})` : 'sin reparar'}`,
      `Precio de subasta: $${pmin.toLocaleString('en-US')}${pmax !== pmin ? ` a $${pmax.toLocaleString('en-US')}` : ''}`,
      `Estimado total: L ${total.min.toLocaleString('en-US')}${total.max !== total.min ? ` a L ${total.max.toLocaleString('en-US')}` : ''}`,
      presupuesto ? `Presupuesto del cliente: L ${presupuesto.presupuesto_lps.toLocaleString('en-US')} (${presupuesto.estado})` : null,
    ].filter(Boolean).join('\n'),
  };
}
