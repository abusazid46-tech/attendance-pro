import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { hashPassword } from "../../lib/security.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const usersRouter = Router();
usersRouter.use(authenticate, allowRoles("SUPER_ADMIN", "ADMIN"));

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ include: { role: true }, orderBy: { createdAt: "desc" } });
    res.json({ users: users.map(({ passwordHash, refreshTokenHash, ...safe }) => safe) });
  })
);

usersRouter.post(
  "/faculty",
  validate(z.object({ body: z.object({ fullName: z.string(), email: z.string().email(), mobileNumber: z.string().optional(), password: z.string().min(8), departmentId: z.string(), employeeCode: z.string() }) })),
  asyncHandler(async (req, res) => {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: "FACULTY" } });
    const teacher = await prisma.teacher.create({
      data: {
        employeeCode: req.body.employeeCode,
        department: { connect: { id: req.body.departmentId } },
        user: { create: { fullName: req.body.fullName, email: req.body.email, mobileNumber: req.body.mobileNumber, passwordHash: await hashPassword(req.body.password), roleId: role.id } }
      },
      include: { user: true }
    });
    res.status(201).json({ teacher });
  })
);
