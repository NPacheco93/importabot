// Interfaz de ImportaBot: envía la conversación al backend y muestra las respuestas.
// La API key NO está aquí: el navegador solo habla con /api/chat.

const chat = document.getElementById('chat');
const formulario = document.getElementById('formulario');
const caja = document.getElementById('texto');
const botonEnviar = document.getElementById('enviar');
const inicioHTML = chat.innerHTML;
const WHATSAPP = (window.IMPORTABOT_CONFIG && window.IMPORTABOT_CONFIG.whatsapp) || '';

let historial = [];
let eventos = []; // lo que se ve en pantalla, para reconstruirlo si se recarga la página
let ocupado = false;
const CLAVE = 'importabot-conversacion';

function guardar() {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ historial, eventos })); } catch { /* navegación privada */ }
}

const L = (n) => 'L ' + Math.round(n).toLocaleString('en-US');
const rango = (r) => (r.min === r.max ? L(r.min) : `${L(r.min)} – ${L(r.max)}`);
const html = (md) => DOMPurify.sanitize(marked.parse(md || ''));
const bajar = () => chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });

function agregar(clase, contenido, comoTexto = false) {
  const div = document.createElement('div');
  div.className = 'burbuja ' + clase;
  if (comoTexto) div.textContent = contenido; else div.innerHTML = contenido;
  chat.appendChild(div);
  bajar();
  return div;
}

function enlaceWhatsApp(resumen) {
  const base = WHATSAPP ? `https://wa.me/${WHATSAPP}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(resumen)}`;
}

// Botón fijo "Hablar con un asesor": lleva el último estimado o, si no hay, la última consulta del cliente.
document.getElementById('asesor').addEventListener('click', (e) => {
  const ultimaTarjeta = [...eventos].reverse().find((ev) => ev.tipo === 'tarjeta');
  const ultimaConsulta = [...eventos].reverse().find((ev) => ev.tipo === 'usuario');
  const texto = ultimaTarjeta
    ? ultimaTarjeta.calculo.resumen_asesor
    : 'Hola, vengo de ImportaBot y quiero una cotización.' +
      (ultimaConsulta ? `\nMi consulta: ${ultimaConsulta.texto.slice(0, 300)}` : '');
  e.currentTarget.href = enlaceWhatsApp(texto);
});

const TEXTO_ESTADO = {
  cubre: (p) => `Tu presupuesto de ${L(p.presupuesto_lps)} alcanza. Precio máximo sugerido en subasta: $${p.precio_maximo_subasta_usd.toLocaleString('en-US')}.`,
  parcial: (p) => `Tu presupuesto de ${L(p.presupuesto_lps)} alcanza solo en parte del rango: el vehículo debería costar $${p.precio_maximo_subasta_usd.toLocaleString('en-US')} o menos en subasta.`,
  insuficiente: (p) => `Con ${L(p.presupuesto_lps)} no es realista. Presupuesto mínimo aproximado: ${L(p.presupuesto_minimo_aprox_lps)}.`,
};

function tarjeta(c, registrar = true) {
  if (registrar) eventos.push({ tipo: 'tarjeta', calculo: c });
  const d = c.desglose_lps;
  const filas = [
    ['Precio en subasta', d.precio_subasta],
    ['Comisiones de subasta', d.comisiones_subasta],
    ['Flete hasta Puerto Cortés', d.flete],
    ['Introducción (impuestos y trámites)', d.introduccion],
  ];
  if (c.modalidad === 'reparado') filas.push([`Reparación (daño ${c.nivel_danio})`, d.reparacion]);
  if (d.servicio.max > 0) filas.push(['Servicio', d.servicio]);

  const div = document.createElement('div');
  div.className = 'tarjeta';
  div.innerHTML = `
    <div class="tarjeta-cab">
      <h2></h2>
      <div class="etiquetas">
        <span class="etiqueta">${c.modalidad === 'reparado' ? 'Reparado' : 'Sin reparar'}</span>
        <span class="etiqueta"></span>
      </div>
    </div>
    <table><tbody>${filas.map(([n, r]) => `<tr><td>${n}</td><td>${rango(r)}</td></tr>`).join('')}</tbody></table>
    <div class="total"><span>Total estimado</span><strong>${rango(c.total_lps)}</strong></div>
    ${c.presupuesto ? `<div class="estado ${c.presupuesto.estado}">${TEXTO_ESTADO[c.presupuesto.estado](c.presupuesto)}</div>` : ''}
    ${c.advertencias.length ? `<ul class="advertencias">${c.advertencias.map(() => '<li></li>').join('')}</ul>` : ''}
    <p class="pie">Estimado válido hasta el ${c.valido_hasta} · Tipo de cambio L ${c.tipo_cambio} por dólar. No es una cotización formal.</p>
    ${!c.presupuesto || c.presupuesto.derivar_al_asesor
      ? `<a class="whatsapp" target="_blank" rel="noopener" href="${enlaceWhatsApp(c.resumen_asesor)}">Enviar al asesor por WhatsApp</a>` : ''}`;
  // Textos que vienen de la conversación se insertan como texto, no como HTML.
  div.querySelector('h2').textContent = c.vehiculo;
  div.querySelectorAll('.etiqueta')[1].textContent = c.regimen;
  div.querySelectorAll('.advertencias li').forEach((li, i) => { li.textContent = c.advertencias[i]; });
  chat.appendChild(div);
  bajar();
}

async function enviar(texto) {
  texto = texto.trim();
  if (!texto || ocupado) return;
  ocupado = true; botonEnviar.disabled = true;
  document.getElementById('sugerencias')?.remove();

  agregar('usuario', texto, true);
  historial.push({ role: 'user', content: texto });
  eventos.push({ tipo: 'usuario', texto });
  caja.value = ''; ajustarAltura();

  const espera = agregar('bot escribiendo', '<span></span><span></span><span></span>');
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensajes: historial }),
    });
    const datos = await r.json();
    espera.remove();
    if (!r.ok) throw new Error(datos.error || 'Error del servidor');
    agregar('bot', html(datos.texto));
    eventos.push({ tipo: 'bot', texto: datos.texto });
    if (datos.calculo) tarjeta(datos.calculo);
    historial.push({ role: 'assistant', content: datos.texto });
    guardar();
  } catch (e) {
    espera.remove();
    historial.pop();
    eventos.pop();
    agregar('error', e.message || 'No hay conexión. Intentá de nuevo.', true);
  } finally {
    ocupado = false; botonEnviar.disabled = false; caja.focus();
  }
}

function ajustarAltura() {
  caja.style.height = 'auto';
  caja.style.height = Math.min(caja.scrollHeight, 140) + 'px';
}

function conectarSugerencias() {
  document.querySelectorAll('#sugerencias button').forEach((b) =>
    b.addEventListener('click', () => enviar(b.dataset.texto)));
}

formulario.addEventListener('submit', (e) => { e.preventDefault(); enviar(caja.value); });
caja.addEventListener('input', ajustarAltura);
caja.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(caja.value); }
});
document.getElementById('nueva').addEventListener('click', () => {
  historial = [];
  eventos = [];
  guardar();
  chat.innerHTML = inicioHTML;
  conectarSugerencias();
  caja.focus();
});
conectarSugerencias();

// Reconstruye la conversación si el cliente recargó la página (solo en esta pestaña).
try {
  const previo = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
  if (previo && previo.historial.length) {
    historial = previo.historial;
    eventos = previo.eventos;
    document.getElementById('sugerencias')?.remove();
    for (const e of eventos) {
      if (e.tipo === 'usuario') agregar('usuario', e.texto, true);
      else if (e.tipo === 'bot') agregar('bot', html(e.texto));
      else if (e.tipo === 'tarjeta') tarjeta(e.calculo, false);
    }
  }
} catch { /* sin almacenamiento disponible: se empieza de cero */ }
