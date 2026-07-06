import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { RoleName, User } from "@prisma/client";
import { env } from "../config/env.js";

export type JwtUser = {
  sub: string;
  role: RoleName;
  email: string;
};

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
export const hashToken = (token: string) => bcrypt.hash(token, 10);
export const verifyTokenHash = (token: string, hash: string) => bcrypt.compare(token, hash);

export const signAccessToken = (payload: JwtUser) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, { expiresIn: env.ACCESS_TOKEN_TTL } as SignOptions);

export const signRefreshToken = (payload: JwtUser) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, { expiresIn: env.REFRESH_TOKEN_TTL } as SignOptions);

export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as JwtUser;

export const userPayload = (user: User & { role: { name: RoleName } }): JwtUser => ({
  sub: user.id,
  email: user.email,
  role: user.role.name
});
