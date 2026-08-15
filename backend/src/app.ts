import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env';
import { buildContainer } from './container';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { buildRouter } from './routes';

/**
 * Express application factory.
 *
 * Separated from `server.ts` so tests can build an app without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      credentials: true,
    }),
  );

  // Listings carry base64-free JSON only; images are sent as URLs.
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'circlestore-api' });
  });

  app.use('/api', buildRouter(buildContainer()));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
