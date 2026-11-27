import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { errorHandler, HttpError } from './middleware/errorHandler.ts';
import { healthRouter } from './routes/health.ts';

export function createApp(configureApi?: (router: Router) => void, allowedOrigins: readonly string[] = []) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('X-Request-Id', randomUUID());
    next();
  });
  app.use('/api', (req, res, next) => {
    res.vary('Origin');
    const origin = req.get('Origin');
    if (req.method === 'OPTIONS') {
      res.vary('Access-Control-Request-Method');
      res.vary('Access-Control-Request-Headers');
    }
    if (!origin) { next(); return; }
    if (!allowedOrigins.includes(origin)) {
      if (req.method === 'OPTIONS') next(new HttpError('FORBIDDEN'));
      else next();
      return;
    }
    res.set('Access-Control-Allow-Origin', origin);
    if (req.method !== 'OPTIONS') { next(); return; }
    const method = req.get('Access-Control-Request-Method');
    const headers = req.get('Access-Control-Request-Headers')?.toLowerCase().split(',').map((header) => header.trim()) ?? [];
    if ((method !== 'GET' && method !== 'POST') || headers.some((header) => header !== 'authorization' && header !== 'content-type')) {
      next(new HttpError('FORBIDDEN'));
      return;
    }
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.sendStatus(204);
  });
  app.use(express.json({ limit: '16kb' }));

  const api = Router();
  api.use(healthRouter);
  configureApi?.(api);
  app.use('/api', api);
  app.use(() => { throw new HttpError('NOT_FOUND'); });
  app.use(errorHandler);
  return app;
}
