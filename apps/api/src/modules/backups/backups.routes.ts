import { BackupTarget } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const backupsRouter = Router();
backupsRouter.use(authenticate, allowRoles("SUPER_ADMIN", "ADMIN", "FACULTY"));

backupsRouter.get(
  "/",
  validate(z.object({ query: z.object({ teacherId: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const snapshots = await prisma.backupSnapshot.findMany({
      where: { teacherId: req.query.teacherId as string | undefined },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    res.json({ snapshots });
  })
);

backupsRouter.post(
  "/",
  validate(
    z.object({
      body: z.object({
        teacherId: z.string(),
        target: z.nativeEnum(BackupTarget),
        fileUrl: z.string().url().optional(),
        metadata: z.record(z.unknown()).optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const snapshot = await prisma.backupSnapshot.create({
      data: {
        teacherId: req.body.teacherId,
        target: req.body.target,
        fileUrl: req.body.fileUrl,
        metadata: req.body.metadata
      }
    });

    res.status(201).json({ snapshot, message: "Backup snapshot recorded" });
  })
);

