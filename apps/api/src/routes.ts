import type { Express } from "express";
import { academicsRouter } from "./modules/academics/academics.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { attendanceRouter } from "./modules/attendance/attendance.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { backupsRouter } from "./modules/backups/backups.routes.js";
import { leaveRouter } from "./modules/leave/leave.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { qrRouter } from "./modules/qr/qr.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const registerRoutes = (app: Express) => {
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/academics", academicsRouter);
  app.use("/api/v1/attendance", attendanceRouter);
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/backups", backupsRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/leave-requests", leaveRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  app.use("/api/v1/qr-attendance", qrRouter);
  app.use("/api/v1/reports", reportsRouter);
};
