import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env';

/**
 * Prisma client singleton.
 *
 * This is the ONLY module in the application that instantiates a database
 * connection. Repositories receive it by injection, which keeps them testable
 * and keeps every other layer unaware that Prisma exists at all.
 */
export const prisma = new PrismaClient({
  log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
});

export type PrismaClientLike = PrismaClient;

/** Transaction handle — the subset of the client available inside `$transaction`. */
export type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
