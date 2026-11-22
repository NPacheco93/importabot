// Función de Netlify para el Parcial 3: el mismo endpoint /api/chat en internet.
// La API key se configura como variable de entorno OPENAI_API_KEY en Netlify.
import { manejarChat } from '../../src/handler.js';

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  const cuerpo = await req.json().catch(() => null);
  const { status, data } = await manejarChat(cuerpo, context.ip);
  return Response.json(data, { status });
};

export const config = { path: '/api/chat' };
