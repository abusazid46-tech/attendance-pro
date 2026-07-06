import type { NextFunction, Request, Response } from "express";
import type { RoleName } from "@prisma/client";
import { ApiError } from "../lib/http.js";
import { verifyAccessToken, type JwtUser } from "../lib/security.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Missing bearer token");
  req.user = verifyAccessToken(header.slice("Bearer ".length));
  next();
};

export const allowRoles =
  (...roles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, "Authentication required");
    if (!roles.includes(req.user.role)) throw new ApiError(403, "Insufficient permissions");
    next();
  };
