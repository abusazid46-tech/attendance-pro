import { NotificationType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({ where: { userId: req.user!.sub }, orderBy: { createdAt: "desc" } });
    res.json({ notifications });
  })
);

notificationsRouter.post(
  "/broadcast",
  allowRoles("SUPER_ADMIN", "ADMIN"),
  validate(z.object({ body: z.object({ title: z.string(), body: z.string(), userIds: z.array(z.string()).optional() }) })),
  asyncHandler(async (req, res) => {
    const users = req.body.userIds ?? (await prisma.user.findMany({ select: { id: true } })).map((user) => user.id);
    await prisma.notification.createMany({
      data: users.map((userId: string) => ({ userId, type: NotificationType.ADMIN_BROADCAST, title: req.body.title, body: req.body.body }))
    });
    res.status(201).json({ message: "Broadcast queued", recipients: users.length });
  })
);
