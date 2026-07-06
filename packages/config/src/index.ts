export const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const roles = ["SUPER_ADMIN", "ADMIN", "FACULTY", "STUDENT", "PARENT"] as const;
export type Role = (typeof roles)[number];

export const attendanceColor = (percentage: number) => {
  if (percentage >= 75) return "green";
  if (percentage >= 60) return "orange";
  return "red";
};

export const apiPaths = {
  health: "/health",
  auth: "/api/v1/auth",
  attendance: "/api/v1/attendance",
  analytics: "/api/v1/analytics",
  academics: "/api/v1/academics",
  users: "/api/v1/users",
  leave: "/api/v1/leave-requests",
  reports: "/api/v1/reports",
  qr: "/api/v1/qr-attendance"
} as const;
