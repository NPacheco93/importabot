// Servidor local de ImportaBot (Parcial 2).
// Uso: npm start  ->  abrir http://localhost:3000

import 'dotenv/config';
import express from 'express';
import { appendFile, mkdir } from 'node:fs/promises';
import { manejarChat } from './src/handler.js';
import { MODELO } from './src/bot.js';

const app = express();
const PUERTO = process.env.PORT || 3000;

app.use(express.json({ limit: '50kb' }));
app.use(express.static('public'));

// Registro de cada estimado entregado, sin datos personales (estimados_log.csv del Parcial 1).
async function registrarEstimado(calculo) {
  await mkdir('registros', { recursive: true });
  const fila = [new Date().toISOString(), calculo.vehiculo, calculo.modalidad,
    calculo.presupuesto?.presupuesto_lps ?? '', calculo.total_lps.min, calculo.total_lps.max,
    calculo.presupuesto?.estado ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  await appendFile('registros/estimados_log.csv', fila + '\n');
}

app.post('/api/chat', async (req, res) => {
  const inicio = Date.now();
  const { status, data } = await manejarChat(req.body, req.ip);
  if (data.calculo) registrarEstimado(data.calculo).catch(() => {});
  console.log(`[${new Date().toLocaleTimeString()}] /api/chat ${status} en ${Date.now() - inicio} ms` +
    (data.llamadas?.length ? ` · función: ${data.llamadas.map((l) => l.estado).join(', ')}` : ''));
  res.status(status).json(data);
});

app.listen(PUERTO, () => {
  console.log(`ImportaBot funcionando en http://localhost:${PUERTO}`);
  console.log(`Modelo: ${MODELO} · API key ${process.env.OPENAI_API_KEY ? 'cargada desde .env' : 'NO configurada (revisá el archivo .env)'}`);
});
