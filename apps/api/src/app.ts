import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { errorHandler } from "./lib/http.js";
import { registerRoutes } from "./routes.js";

export const createApp = () => {
  const app = express();
  const origins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

  app.use(helmet());
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("combined"));
  app.use(rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000), max: Number(process.env.RATE_LIMIT_MAX ?? 300) }));

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "attendance-api", time: new Date().toISOString() }));

  const spec = swaggerJsdoc({
    definition: {
      openapi: "3.1.0",
      info: { title: "Attendance Management API", version: "1.0.0" },
      servers: [{ url: "http://localhost:4000" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
        }
      },
      security: [{ bearerAuth: [] }],
      paths: {
        "/health": { get: { security: [], summary: "Health check", responses: { "200": { description: "Service is healthy" } } } },
        "/api/v1/auth/login": {
          post: {
            security: [],
            summary: "Login using email/mobile and password",
            responses: { "200": { description: "JWT session created" }, "401": { description: "Invalid credentials" } }
          }
        },
        "/api/v1/auth/refresh": {
          post: { security: [], summary: "Refresh access token", responses: { "200": { description: "Access token refreshed" } } }
        },
        "/api/v1/academics/hierarchy": {
          get: { summary: "Read department/course/semester/section/subject hierarchy", responses: { "200": { description: "Academic hierarchy" } } }
        },
        "/api/v1/attendance/students": {
          get: { summary: "Search students by name, roll, registration and filters", responses: { "200": { description: "Student list" } } }
        },
        "/api/v1/attendance": {
          post: { summary: "Submit attendance batch with geofence validation", responses: { "201": { description: "Attendance submitted" } } }
        },
        "/api/v1/attendance/{attendanceId}": {
          patch: {
            summary: "Edit attendance within configured time window and write audit log",
            parameters: [{ name: "attendanceId", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Attendance updated" }, "403": { description: "Edit window expired" } }
          }
        },
        "/api/v1/analytics/faculty-dashboard": {
          get: { summary: "Faculty dashboard cards and charts", responses: { "200": { description: "Faculty analytics" } } }
        },
        "/api/v1/analytics/students/{studentId}": {
          get: {
            summary: "Student attendance analytics",
            parameters: [{ name: "studentId", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Student analytics" } }
          }
        },
        "/api/v1/qr-attendance/sessions": {
          post: { summary: "Create 5 minute QR attendance token", responses: { "201": { description: "QR session created" } } }
        },
        "/api/v1/qr-attendance/scan": {
          post: { summary: "Scan QR token and prevent duplicate attendance", responses: { "201": { description: "QR attendance saved" } } }
        },
        "/api/v1/leave-requests": {
          post: { summary: "Create student leave request", responses: { "201": { description: "Leave request created" } } }
        },
        "/api/v1/reports/daily": {
          get: { summary: "Daily attendance report in JSON or CSV", responses: { "200": { description: "Report generated" } } }
        }
      }
    },
    apis: ["./src/**/*.ts"]
  });

  app.get("/docs.json", (_req, res) => res.json(spec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
  registerRoutes(app);
  app.use(errorHandler);

  return app;
};
