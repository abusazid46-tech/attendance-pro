import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "https://brown-butterfly-424334.hostingersite.com/api/v1";
export const adminTokenCookie = "attendance_admin_token";

type SessionResponse = {
  accessToken: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
};

export type AnalyticsResponse = {
  cards?: {
    todayClasses?: number;
    totalStudents?: number;
    attendancePercentage?: number;
    pendingAttendance?: number;
  };
  teacherAnalytics?: {
    totalClassesConducted?: number;
    attendanceAverage?: number;
    studentsBelowThreshold?: number;
    subjectPerformance?: { subject: string; percentage: number }[];
  };
  charts?: {
    presentVsAbsent?: { name: string; value: number }[];
    monthlyTrend?: { month: string; percentage?: number; attendance?: number }[];
    subjectWise?: { subject: string; percentage?: number; attendance?: number }[];
  };
};

export type HierarchyResponse = {
  departments?: { id: string; name: string; code?: string }[];
  courses?: { id: string; name: string; code?: string; department_id?: string }[];
  semesters?: { id: string; name: string; number?: number; course_id?: string }[];
  sections?: { id: string; name: string; semester_id?: string }[];
  subjects?: { id: string; code: string; name: string; semester_id?: string; department_id?: string; section_id?: string }[];
};

export type StudentsResponse = {
  students?: { id: string; roll_number?: string; full_name?: string; email?: string; section_name?: string }[];
};

export type AdminUsersResponse = {
  counts?: { teachers: number; students: number; total: number };
  teachers?: {
    id: string;
    user_id: string;
    employee_code?: string;
    designation?: string;
    institution_name?: string;
    full_name?: string;
    email?: string;
    mobile_number?: string;
    is_active?: boolean;
    department_name?: string;
  }[];
  students?: {
    id: string;
    user_id: string;
    roll_number?: string;
    registration_number?: string;
    full_name?: string;
    email?: string;
    is_active?: boolean;
    section_name?: string;
    semester_name?: string;
  }[];
};

export type CalendarResponse = {
  days?: {
    id: string;
    date: string;
    topic_taught?: string;
    subject_code?: string;
    status?: string;
    class_number?: number;
  }[];
};

type DashboardErrors = Partial<Record<"analytics" | "hierarchy" | "students" | "calendar" | "adminUsers", string>>;

export async function loginAdmin(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });
  const data = (await response.json()) as Partial<SessionResponse> & { message?: string };
  if (!response.ok || !data.accessToken) throw new Error(data.message ?? "Admin login failed");
  if (!["ADMIN", "SUPER_ADMIN"].includes(data.user?.role ?? "")) throw new Error("This account is not an admin account");
  return data as SessionResponse;
}

async function getToken() {
  const token = (await cookies()).get(adminTokenCookie)?.value;
  if (!token) redirect("/login");
  return token;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers
    },
    cache: "no-store"
  });
  const text = await response.text();
  const data = text ? safeJson(text) : {};
  if (response.status === 401) redirect("/login");
  if (!response.ok) {
    const errors = data?.errors && typeof data.errors === "object"
      ? Object.values(data.errors).flat().filter(Boolean).join(" ")
      : "";
    throw new Error([data?.message, errors].filter(Boolean).join(": ") || `API request failed: ${response.status}`);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}

export async function getAdminDashboardData() {
  const [analytics, hierarchy, students, calendar, adminUsers] = await Promise.allSettled([
    apiGet<AnalyticsResponse>("/analytics/faculty-dashboard"),
    apiGet<HierarchyResponse>("/academics/hierarchy"),
    apiGet<StudentsResponse>("/attendance/students"),
    apiGet<CalendarResponse>("/attendance/calendar"),
    apiGet<AdminUsersResponse>("/admin/users")
  ]);
  const errors: DashboardErrors = {};
  if (analytics.status === "rejected") errors.analytics = errorMessage(analytics.reason);
  if (hierarchy.status === "rejected") errors.hierarchy = errorMessage(hierarchy.reason);
  if (students.status === "rejected") errors.students = errorMessage(students.reason);
  if (calendar.status === "rejected") errors.calendar = errorMessage(calendar.reason);
  if (adminUsers.status === "rejected") errors.adminUsers = errorMessage(adminUsers.reason);
  if (errors.adminUsers?.includes("Admin access required")) redirect("/login");

  return {
    analytics: analytics.status === "fulfilled" ? analytics.value : {},
    hierarchy: hierarchy.status === "fulfilled" ? hierarchy.value : {},
    students: students.status === "fulfilled" ? students.value : { students: [] },
    calendar: calendar.status === "fulfilled" ? calendar.value : { days: [] },
    adminUsers: adminUsers.status === "fulfilled" ? adminUsers.value : { counts: { teachers: 0, students: 0, total: 0 }, teachers: [], students: [] },
    errors
  };
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Backend request failed";
}
