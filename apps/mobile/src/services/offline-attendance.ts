import * as SQLite from "expo-sqlite";
import { apiBackend } from "./api-backend";

const db = SQLite.openDatabaseSync("attendance-offline.db");

db.execSync(`
CREATE TABLE IF NOT EXISTS offline_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
`);

export const enqueueOfflineAttendance = async (payload: unknown) => {
  await db.runAsync("INSERT INTO offline_attendance (payload, createdAt) VALUES (?, ?)", JSON.stringify(payload), new Date().toISOString());
};

export const syncOfflineAttendance = async () => {
  const rows = await db.getAllAsync<{ id: number; payload: string }>("SELECT id, payload FROM offline_attendance ORDER BY id ASC");
  for (const row of rows) {
    await apiBackend.submitAttendance(JSON.parse(row.payload));
    await db.runAsync("DELETE FROM offline_attendance WHERE id = ?", row.id);
  }
};
