import crypto from "node:crypto";
import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ApiError, asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const qrRouter = Router();
qrRouter.use(authenticate);

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

qrRouter.post(
  "/sessions",
  allowRoles("FACULTY"),
  validate(z.object({ body: z.object({ teacherId: z.string(), subjectId: z.string(), sectionId: z.string() }) })),
  asyncHandler(async (req, res) => {
    const token = nanoid(64);
    const session = await prisma.qrAttendanceSession.create({
      data: { ...req.body, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
    });
    res.status(201).json({ sessionId: session.id, token, expiresAt: session.expiresAt });
  })
);

qrRouter.post(
  "/scan",
  allowRoles("STUDENT"),
  validate(z.object({ body: z.object({ token: z.string(), studentId: z.string(), subjectId: z.string(), teacherId: z.string(), departmentId: z.string(), courseId: z.string(), semesterId: z.string(), sectionId: z.string() }) })),
  asyncHandler(async (req, res) => {
    const { token, ...attendanceInput } = req.body;
    const session = await prisma.qrAttendanceSession.findFirst({ where: { tokenHash: sha256(token), expiresAt: { gt: new Date() } } });
    if (!session) throw new ApiError(400, "Invalid or expired QR token");
    const attendance = await prisma.attendance.upsert({
      where: { studentId_subjectId_date: { studentId: attendanceInput.studentId, subjectId: attendanceInput.subjectId, date: new Date(new Date().toDateString()) } },
      update: {},
      create: { ...attendanceInput, date: new Date(new Date().toDateString()), status: "PRESENT", source: "QR" }
    });
    res.status(201).json({ attendance });
  })
);
