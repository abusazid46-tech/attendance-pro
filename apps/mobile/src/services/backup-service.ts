import AsyncStorage from "@react-native-async-storage/async-storage";
import { Share } from "react-native";
import type { BackendDashboard } from "./app-data";

const backupIndexKey = "attendance.backupSnapshots";
const localKeyPrefixes = ["attendance.classDiary.", "attendance.profilePhoto.", "attendance.offlineQueue"];

export type LocalBackupSnapshot = {
  id: string;
  target: "GOOGLE_DRIVE" | "LOCAL_STORAGE";
  createdAt: string;
  size: number;
  summary: {
    students: number;
    papers: number;
    attendanceRecords: number;
    classes: number;
    localItems: number;
  };
  payload: {
    app: "Smart Attendance App";
    version: 1;
    dashboard: BackendDashboard;
    localItems: Record<string, string>;
  };
};

export async function createLocalBackup(target: LocalBackupSnapshot["target"], dashboard: BackendDashboard) {
  const localItems = await readBackupLocalItems();
  const snapshot: LocalBackupSnapshot = {
    id: `backup-${Date.now()}`,
    target,
    createdAt: new Date().toISOString(),
    size: 0,
    summary: {
      students: dashboard.students.length,
      papers: dashboard.papers.length,
      attendanceRecords: dashboard.attendanceRecords.length,
      classes: dashboard.classSessions.length,
      localItems: Object.keys(localItems).length
    },
    payload: {
      app: "Smart Attendance App",
      version: 1,
      dashboard,
      localItems
    }
  };
  snapshot.size = jsonSize(snapshot.payload);
  const snapshots = await listLocalBackups();
  const next = [snapshot, ...snapshots].slice(0, 12);
  await AsyncStorage.setItem(backupIndexKey, JSON.stringify(next));
  return snapshot;
}

export async function listLocalBackups(): Promise<LocalBackupSnapshot[]> {
  const raw = await AsyncStorage.getItem(backupIndexKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function restoreLocalBackup(id: string) {
  const snapshot = (await listLocalBackups()).find((item) => item.id === id);
  if (!snapshot) throw new Error("Backup snapshot not found on this phone.");
  await Promise.all(Object.entries(snapshot.payload.localItems).map(([key, value]) => AsyncStorage.setItem(key, value)));
  return snapshot;
}

export async function shareBackup(snapshot: LocalBackupSnapshot) {
  await Share.share({
    title: `Smart Attendance backup ${formatBackupDate(snapshot.createdAt)}`,
    message: JSON.stringify(snapshot.payload, null, 2)
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBackupDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function readBackupLocalItems() {
  const keys = await AsyncStorage.getAllKeys();
  const backupKeys = keys.filter((key) => localKeyPrefixes.some((prefix) => key.startsWith(prefix)));
  const pairs = await AsyncStorage.multiGet(backupKeys);
  return Object.fromEntries(pairs.filter((entry): entry is [string, string] => Boolean(entry[1])));
}

function jsonSize(value: unknown) {
  return encodeURIComponent(JSON.stringify(value)).replace(/%[0-9A-F]{2}/g, "x").length;
}
