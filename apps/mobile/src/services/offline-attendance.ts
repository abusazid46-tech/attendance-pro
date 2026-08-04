import { Platform } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { apiBackend } from "./api-backend";

const webQueueKey = "attendance.offlineQueue";
let nativeDb: SQLiteDatabase | undefined;
let syncInFlight = false;

type OfflineAttendanceBundle = {
  classPayload?: any;
  attendancePayload?: any;
};

const db = async () => {
  if (Platform.OS === "web") return undefined;
  if (!nativeDb) {
    const SQLite = await import("expo-sqlite");
    nativeDb = SQLite.openDatabaseSync("attendance-offline.db");
    const database = nativeDb;
    database.execSync(`
    CREATE TABLE IF NOT EXISTS offline_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    `);
  }
  return nativeDb;
};

export const enqueueOfflineAttendance = async (payload: unknown) => {
  if (Platform.OS === "web") {
    const rows = JSON.parse(localStorage.getItem(webQueueKey) ?? "[]");
    rows.push({ id: Date.now(), payload, createdAt: new Date().toISOString() });
    localStorage.setItem(webQueueKey, JSON.stringify(rows));
    return;
  }
  const database = await db();
  await database?.runAsync("INSERT INTO offline_attendance (payload, createdAt) VALUES (?, ?)", JSON.stringify(payload), new Date().toISOString());
};

export const syncOfflineAttendance = async () => {
  if (syncInFlight) return;
  syncInFlight = true;

  try {
  if (Platform.OS === "web") {
    const rows = JSON.parse(localStorage.getItem(webQueueKey) ?? "[]") as { id: number; payload: unknown }[];
    for (const row of rows) await syncPayload(row.payload);
    localStorage.removeItem(webQueueKey);
    return;
  }
  const database = await db();
  const rows = (await database?.getAllAsync<{ id: number; payload: string }>("SELECT id, payload FROM offline_attendance ORDER BY id ASC")) ?? [];
  for (const row of rows) {
    await syncPayload(JSON.parse(row.payload));
    await database?.runAsync("DELETE FROM offline_attendance WHERE id = ?", row.id);
  }
  } finally {
    syncInFlight = false;
  }
};

async function syncPayload(payload: unknown) {
  const bundle = payload as OfflineAttendanceBundle;
  if (bundle?.attendancePayload) {
    const attendancePayload = { ...bundle.attendancePayload };
    if (!attendancePayload.classSessionId && bundle.classPayload) {
      const classResponse = await apiBackend.createClassSession(bundle.classPayload);
      attendancePayload.classSessionId = classResponse.classSession?.id;
    }
    await apiBackend.submitAttendance(attendancePayload);
    return;
  }
  await apiBackend.submitAttendance(payload as never);
}
