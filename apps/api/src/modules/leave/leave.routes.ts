import { LeaveStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const leaveRouter = Router();
leaveRouter.use(authenticate);

leaveRouter.post(
  "/",
  allowRoles("STUDENT", "ADMIN", "SUPER_ADMIN"),
  validate(z.object({ body: z.object({ studentId: z.string(), startDate: z.coerce.date(), endDate: z.coerce.date(), reason: z.string().min(5), documentUrl: z.string().url().optional() }) })),
  asyncHandler(async (req, res) => {
    const leave = await prisma.leaveRequest.create({ data: req.body });
    res.status(201).json({ leave });
  })
);

leaveRouter.patch(
  "/:id/review",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(z.object({ params: z.object({ id: z.string() }), body: z.object({ status: z.nativeEnum(LeaveStatus), reviewerId: z.string().optional(), reviewerNote: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const leave = await prisma.leaveRequest.update({ where: { id: req.params.id as string }, data: { ...req.body, reviewedAt: new Date() } });
    res.json({ leave });
  })
);
