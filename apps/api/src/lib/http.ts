import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(422).json({ message: "Validation failed", errors: error.flatten() });
  }
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message, details: error.details });
  }
  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
};
