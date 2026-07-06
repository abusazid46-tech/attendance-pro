import "dotenv/config";
import { z } from "zod";

const defaultApiPort = Number(process.env.PORT ?? 4000);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  ATTENDANCE_EDIT_WINDOW_HOURS: z.coerce.number().default(24),
  LOW_ATTENDANCE_THRESHOLD: z.coerce.number().default(75),
  GEOFENCE_LATITUDE: z.coerce.number().default(26.1445),
  GEOFENCE_LONGITUDE: z.coerce.number().default(91.7362),
  GEOFENCE_RADIUS_METERS: z.coerce.number().default(150),
  API_PORT: z.coerce.number().default(defaultApiPort),
  CORS_ORIGINS: z.string().default("http://localhost:3000")
});

export const env = schema.parse(process.env);
