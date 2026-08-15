import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './models/prisma';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`CircleStore API listening on http://localhost:${env.port}`);
  console.log(`Allowed origins: ${env.corsOrigins.join(', ')}`);
});

/** Drain in-flight requests and release the connection pool before exiting. */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down.`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
