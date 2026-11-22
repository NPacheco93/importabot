# ImportaBot

Asistente virtual con inteligencia artificial que da **presupuestos estimados para importar vehículos** desde subastas de Estados Unidos (Copart e IAAI) hasta Puerto Cortés, Honduras.

**Versión en vivo:** [URL-DE-NETLIFY]

Proyecto Integrador · Inteligencia Artificial Aplicada · Universidad Tecnológica de Honduras, campus San Pedro Sula · Nery David Pacheco Rivera · 2026

## Qué hace

- Conversa con el cliente en lenguaje natural, en español o en inglés.
- Da un presupuesto estimado en dos modalidades:
  - **Sin reparar:** el vehículo puesto fuera de puerto, tal como llega.
  - **Reparado:** incluye un rango de reparación según el nivel de daño.
- Aplica las reglas de importación de Honduras: la tasa única de la amnistía para modelos 2010 y anteriores, y el cálculo de DAI, ISC, ISV y ecotasa para modelos 2011 en adelante, con DAI 0 % si el VIN indica fabricación en EE. UU. (DR-CAFTA).
- Compara el estimado con el presupuesto del cliente (alcanza, alcanza en parte o no alcanza) y propone alternativas.
- Muestra una tarjeta con el desglose y un botón que abre WhatsApp con la solicitud ya resumida para el asesor.
- Se protege contra el uso indebido: no confirma precios inventados, rechaza temas ajenos, oculta datos personales antes de enviarlos a la IA y limita las consultas por usuario.

## Cómo se usa

1. Abrí la versión en vivo desde cualquier navegador, en computadora o celular.
2. Escribí el vehículo que te interesa, por ejemplo: *"Busco una Tacoma 2008 doble cabina 4x4, reparada con daño leve. Tengo 200 mil lempiras."*, o tocá una de las sugerencias.
3. Si falta algún dato (año, modalidad o nivel de daño), el asistente lo pregunta.
4. Revisá la tarjeta del estimado y, si querés una cotización formal, tocá **Enviar al asesor por WhatsApp**.

Los montos son estimados en rango, con fecha de validez, y no son una cotización formal.

## Cómo funciona

```
Navegador (public/)  →  /api/chat (servidor)  →  API de OpenAI (GPT-6 Luna)
                                  ↑                       │ function calling
                                  └── calculadora.js ←────┘ (tarifas e impuestos en data/)
```

El modelo de IA **no calcula montos**: entiende al cliente, extrae los datos del vehículo y llama a la función `calcular_presupuesto`. La calculadora hace las cuentas con las tablas de `data/` y el modelo explica el resultado.

## Tecnologías

| Parte | Tecnología |
|---|---|
| Interfaz | HTML, CSS y JavaScript sin frameworks; marked.js y DOMPurify para dar formato seguro a las respuestas |
| Servidor local | Node.js con Express |
| Servidor en producción | Netlify Functions |
| Inteligencia artificial | API de OpenAI (Responses API) con el modelo GPT-6 Luna y function calling |
| Datos del negocio | Archivos JSON en `data/` |
| Pruebas | Scripts de Node.js en `tests/` |

## Estructura

| Carpeta o archivo | Contenido |
|---|---|
| `public/` | Interfaz de chat |
| `src/calculadora.js` | Reglas del negocio: amnistía, régimen normal, DAI según VIN, modalidades y presupuesto |
| `src/bot.js` | Conexión con OpenAI e instrucciones del asistente |
| `src/handler.js` | Validaciones, límite de consultas y ocultamiento de datos personales |
| `netlify/functions/chat.mjs` | El endpoint `/api/chat` en Netlify |
| `server.js` | El endpoint `/api/chat` para correrlo en la computadora |
| `data/` | Tarifas, impuestos, reparaciones, precios de referencia y preguntas frecuentes |
| `tests/` | Pruebas de la calculadora y del asistente con la API |

## Cómo ejecutarlo localmente

Requisitos: Node.js 20 o más reciente y una API key de OpenAI con saldo.

```bash
git clone https://github.com/NPacheco93/importabot.git
cd importabot
npm install
cp .env.example .env     # pegá tu API key de OpenAI en el archivo .env
npm test                 # pruebas de la calculadora (no usan la API)
npm start                # abrí http://localhost:3000
npm run pruebas          # pruebas del asistente con la API real
```

La API key vive solo en `.env` en local o en las variables de entorno de Netlify en producción. El archivo `.env` está en `.gitignore` y nunca se sube al repositorio.

## Despliegue en Netlify

1. Conectá el repositorio en Netlify con **Add new project → Import an existing project**.
2. Netlify lee `netlify.toml`: publica la carpeta `public/` y las funciones de `netlify/functions/`. No hace falta comando de build.
3. En **Project configuration → Environment variables**, agregá `OPENAI_API_KEY` con tu clave y `OPENAI_MODEL` con `gpt-6-luna`.
4. Publicá de nuevo el sitio para que tome las variables.

## Limitaciones conocidas

- Los precios de subasta salen de una tabla de referencia que se actualiza a mano; hoy incluye un solo modelo (Toyota Tacoma 2005–2008).
- Las tasas de impuestos deben confirmarse con un agente aduanero antes de usar los estimados con clientes.
- Si la API de OpenAI no responde, el asistente no puede dar estimados.
