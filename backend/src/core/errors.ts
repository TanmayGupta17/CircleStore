/**
 * Domain errors.
 *
 * The core throws these; the HTTP layer is the only place that knows how to
 * turn them into status codes (see middlewares/error-handler.ts). That keeps
 * the domain free of transport concerns.
 */

export type FieldErrors = Record<string, string>;

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND';

  constructor(resource: string, identifier?: string) {
    super(identifier ? `${resource} '${identifier}' not found` : `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  readonly status = 422;
  readonly code = 'VALIDATION_FAILED';
  readonly fieldErrors: FieldErrors;

  constructor(fieldErrors: FieldErrors, message = 'Validation failed') {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

/**
 * A request that is well-formed but violates a business rule, e.g. changing the
 * type of a field that already holds data.
 */
export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = 'CONFLICT';
}

export class BadRequestError extends AppError {
  readonly status = 400;
  readonly code = 'BAD_REQUEST';
}

/**
 * A capability the deployment has not been configured for, e.g. image uploads
 * without storage credentials. Distinct from a 500: nothing is broken, the
 * feature simply is not switched on.
 */
export class NotConfiguredError extends AppError {
  readonly status = 503;
  readonly code = 'NOT_CONFIGURED';
}

/**
 * The admin has produced an unusable category configuration — a circular
 * conditional rule, a forward reference, a dangling dependency. Rejected at
 * write time so a broken form can never reach a seller.
 */
export class SchemaConfigError extends AppError {
  readonly status = 422;
  readonly code = 'INVALID_SCHEMA_CONFIG';
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid category configuration: ${issues.join('; ')}`);
    this.issues = issues;
  }
}
