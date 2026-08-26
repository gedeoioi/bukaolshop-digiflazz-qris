import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = randomUUID();

  if (err instanceof AppError) {
    logger.warn({
      err,
      requestId,
      path: req.path,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      requestId,
    });
  }

  logger.error({
    err,
    requestId,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    requestId,
  });
}
