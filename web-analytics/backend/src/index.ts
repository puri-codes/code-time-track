import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { closeDatabase, getDatabase } from './lib/database.js';
import { analyticsRoutes } from './routes/analyticsRoutes.js';
import { extensionRoutes } from './routes/extensionRoutes.js';
import { githubRoutes } from './routes/githubRoutes.js';

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    now: new Date().toISOString()
  });
});

app.use('/api/github', githubRoutes);
app.use('/api/extension', extensionRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.listen(env.port, () => {
  getDatabase();
  console.log(`[web-analytics] API running on http://localhost:${env.port}`);
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

