import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards rejected promises to Express's error pipeline.
 *
 * Express 4 does not await handlers, so an un-wrapped `async` controller that
 * throws produces a hung request rather than a 500. Wrapping every controller
 * keeps the try/catch out of the controllers themselves.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
