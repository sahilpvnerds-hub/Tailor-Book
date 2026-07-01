import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

export interface ApiError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

export class CustomError extends Error implements ApiError {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code?: string;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorConverter = (err: Error): ApiError => {
  if (err instanceof CustomError) return err;

  const convertedErr = new CustomError(err.message, 500);
  convertedErr.stack = err.stack;
  return convertedErr;
};

export const errorHandler: ErrorRequestHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const { statusCode = 500, status = "error", message, code, details } = err;

  const errorResponse: any = {
    status,
    message,
    ...(code && { code }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    ...(process.env.NODE_ENV === "development" && { details }),
  };

  logger.error(
    {
      error: message,
      code,
      details,
      stack: err.stack,
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
      },
      response: {
        statusCode,
      },
    },
    "API Error occurred"
  );

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
