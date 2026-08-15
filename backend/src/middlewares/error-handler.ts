import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, SchemaConfigError, ValidationError } from '../core/errors';
import { isProduction } from '../config/env';

/**
 * The single place that translates errors into HTTP.
 *
 * Domain code throws domain errors; only this module knows about status codes.
 * Every response uses the same envelope so the client can map `fieldErrors`
 * straight onto form inputs without per-endpoint glue:
 *
 *   { "error": { "code": "...", "message": "...", "fieldErrors": { ... } } }
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const payload = toPayload(error);

  if (payload.status >= 500 && !isProduction) {
    console.error('[error]', error);
  }

  res.status(payload.status).json({ error: payload.body });
}

interface ErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  issues?: string[];
}

function toPayload(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof ValidationError) {
    return {
      status: error.status,
      body: { code: error.code, message: error.message, fieldErrors: error.fieldErrors },
    };
  }

  if (error instanceof SchemaConfigError) {
    return {
      status: error.status,
      body: { code: error.code, message: error.message, issues: error.issues },
    };
  }

  if (error instanceof AppError) {
    return { status: error.status, body: { code: error.code, message: error.message } };
  }

  // Request body failed its Zod schema — surface per-field messages.
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_';
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      status: 422,
      body: { code: 'VALIDATION_FAILED', message: 'Please check the highlighted fields.', fieldErrors },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return translatePrismaError(error);
  }

  return {
    status: 500,
    body: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Something went wrong.' : String((error as Error)?.message ?? error),
    },
  };
}

function translatePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): { status: number; body: ErrorBody } {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      return {
        status: 409,
        body: { code: 'CONFLICT', message: `That ${target} is already taken.` },
      };
    }
    case 'P2025':
      return { status: 404, body: { code: 'NOT_FOUND', message: 'The requested record does not exist.' } };
    case 'P2003':
      return {
        status: 400,
        body: { code: 'BAD_REQUEST', message: 'Referenced record does not exist.' },
      };
    default:
      return {
        status: 500,
        body: {
          code: 'DATABASE_ERROR',
          message: isProduction ? 'Something went wrong.' : `${error.code}: ${error.message}`,
        },
      };
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}
