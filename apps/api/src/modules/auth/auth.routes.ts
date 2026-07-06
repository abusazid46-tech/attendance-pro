import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ApiError, asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { hashToken, signAccessToken, signRefreshToken, userPayload, verifyPassword, verifyTokenHash } from "../../lib/security.js";
import { validate } from "../../middleware/validate.js";

export const authRouter = Router();

const loginSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    mobileNumber: z.string().min(7).optional(),
    password: z.string().min(8)
  })
});

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, mobileNumber, password } = req.body;
    if (!email && !mobileNumber) throw new ApiError(422, "Email or mobile number is required");

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: email ?? undefined }, { mobileNumber: mobileNumber ?? undefined }], isActive: true },
      include: { role: true }
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new ApiError(401, "Invalid credentials");

    const payload = userPayload(user);
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: await hashToken(refreshToken) } });

    res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role.name } });
  })
);

authRouter.post(
  "/refresh",
  validate(z.object({ body: z.object({ refreshToken: z.string().min(20) }) })),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const users = await prisma.user.findMany({ where: { refreshTokenHash: { not: null } }, include: { role: true } });
    const user = await Promise.all(users.map(async (item) => ((await verifyTokenHash(refreshToken, item.refreshTokenHash!)) ? item : null))).then((items) =>
      items.find(Boolean)
    );
    if (!user) throw new ApiError(401, "Invalid refresh token");
    res.json({ accessToken: signAccessToken(userPayload(user)) });
  })
);

authRouter.post(
  "/forgot-password",
  validate(z.object({ body: z.object({ email: z.string().email() }) })),
  asyncHandler(async (req, res) => {
    const token = nanoid(48);
    const expires = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await prisma.user.updateMany({ where: { email: req.body.email }, data: { passwordResetToken: token, resetTokenExpiry: expires } });
    res.json({
      message: "Password reset token generated. Wire this to email/SMS in production.",
      ...(env.NODE_ENV === "development" ? { resetTokenPreview: token } : {})
    });
  })
);

authRouter.post(
  "/reset-password",
  validate(z.object({ body: z.object({ token: z.string().min(20), password: z.string().min(8) }) })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({ where: { passwordResetToken: req.body.token, resetTokenExpiry: { gt: new Date() } } });
    if (!user) throw new ApiError(400, "Invalid or expired reset token");
    const { hashPassword } = await import("../../lib/security.js");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(req.body.password), passwordResetToken: null, resetTokenExpiry: null } });
    res.json({ message: "Password reset successful" });
  })
);
