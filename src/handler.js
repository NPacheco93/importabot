// Lógica compartida del endpoint /api/chat (servidor local y función de Netlify).
// Incluye las protecciones contra uso indebido definidas en el Parcial 1.

import { responder } from './bot.js';

const MAX_MENSAJES = 30;      // por conversación
const MAX_CARACTERES = 800;   // por mensaje
const LIMITE_VENTANA_MS = 10 * 60 * 1000;
const LIMITE_SOLICITUDES = 30; // por IP cada 10 minutos

const visitas = new Map();

function excedeLimite(ip) {
  const ahora = Date.now();
  const lista = (visitas.get(ip) || []).filter((t) => ahora - t < LIMITE_VENTANA_MS);
  lista.push(ahora);
  visitas.set(ip, lista);
  return lista.length > LIMITE_SOLICITUDES;
}

// Oculta datos personales antes de enviarlos a la API (riesgo de privacidad, Parcial 1).
export function ocultarDatosPersonales(texto) {
  return texto
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{5}\b/g, '[identidad oculta]')          // DNI hondureño
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[número oculto]')                     // tarjetas
    .replace(/\b(?=[A-HJ-NPR-Z0-9]*\d)[A-HJ-NPR-Z0-9]{17}\b/gi, (vin) => `[VIN que inicia con ${vin[0].toUpperCase()}]`) // VIN completo
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo oculto]')
    .replace(/(?:\+?504[ -]?)?\b[2389]\d{3}[ -]?\d{4}\b/g, '[teléfono oculto]');
}

export async function manejarChat(cuerpo, ip = 'local') {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 500, data: { error: 'Falta configurar la API key de OpenAI en el servidor.' } };
  }
  if (excedeLimite(ip)) {
    return { status: 429, data: { error: 'Demasiadas consultas seguidas. Intentá de nuevo en unos minutos.' } };
  }

  const mensajes = Array.isArray(cuerpo?.mensajes) ? cuerpo.mensajes : null;
  if (!mensajes || mensajes.length === 0) {
    return { status: 400, data: { error: 'No llegó ningún mensaje.' } };
  }
  if (mensajes.length > MAX_MENSAJES) {
    return { status: 400, data: { error: 'La conversación es muy larga. Tocá "Nueva conversación" para empezar otra.' } };
  }

  const historial = [];
  for (const m of mensajes) {
    if (!['user', 'assistant'].includes(m?.role) || typeof m.content !== 'string') {
      return { status: 400, data: { error: 'Formato de mensaje no válido.' } };
    }
    if (m.content.length > MAX_CARACTERES) {
      return { status: 400, data: { error: `Cada mensaje puede tener hasta ${MAX_CARACTERES} caracteres.` } };
    }
    historial.push({ role: m.role, content: m.role === 'user' ? ocultarDatosPersonales(m.content) : m.content });
  }

  try {
    const r = await responder(historial);
    return { status: 200, data: { texto: r.texto, calculo: r.calculo, llamadas: r.llamadas } };
  } catch (e) {
    console.error('Error con la API de OpenAI:', e.status, e.message);
    const msg = e.status === 401 ? 'La API key no es válida.'
      : e.status === 429 ? 'Se agotó el saldo o el límite de la API de OpenAI.'
      : 'No pude conectarme con el asistente. Intentá de nuevo.';
    return { status: 502, data: { error: msg } };
  }
}
