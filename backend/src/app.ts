import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { errorHandler, HttpError } from './middleware/errorHandler.ts';
import { healthRouter } from './routes/health.ts';

export function createApp(configureApi?: (router: Router) => void) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('X-Request-Id', randomUUID());
    next();
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
