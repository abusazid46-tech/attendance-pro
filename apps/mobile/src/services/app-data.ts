import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useAppForegroundEffect } from "./app-lifecycle";
import { apiBackend } from "./api-backend";
import { syncOfflineAttendance } from "./offline-attendance";

export type TeacherProfile = {
  id?: string;
  teacherId?: string;
  name: string;
  designation: string;
  department: string;
  institutionName?: string;
  mobileNumber?: string;
  email?: string;
  avatarUrl?: string;
  academicSession: string;
};
export type Paper = { id: string; code: string; name: string; semester: string; departmentId?: string; courseId?: string; semesterId?: string; sectionId?: string };
export type Student = {
  id: string;
  rollNumber: string;
  name: string;
  attendance: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
  remark: string;
  departmentId?: string;
  courseId?: string;
  semesterId?: string;
  sectionId?: string;
  enrolledSubjectIds?: string[];
};
export type ClassSession = {
  id?: string;
  date: string;
  classDate?: string;
  status: string;
  color: string;
  topic: string;
  subjectId?: string;
  classNumber?: number;
  durationMinutes?: number;
};
export type MonthlyTrend = { month: string; percentage: number };
export type MasterOption = { id: string; name: string; departmentId?: string; courseId?: string; semesterId?: string };
export type AttendanceRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
  remark?: string;
  studentName?: string;
  rollNumber?: string;
  subjectCode?: string;
  subjectName?: string;
  classNumber?: number;
  topic?: string;
};

type RawPaper = Partial<Paper> & { id: string; code: string; name: string; department_id?: string; course_id?: string; semester_id?: string; section_id?: string };
type RawStudent = Partial<Student> & {
  id: string;
  roll_number?: string;
  full_name?: string;
  user?: { fullName?: string };
  department_id?: string;
  course_id?: string;
  semester_id?: string;
  section_id?: string;
  leave_count?: number;
  enrolled_subject_ids?: string[];
};
type RawAttendanceRecord = Partial<AttendanceRecord> & {
  id: string;
  student_id?: string;
  subject_id?: string;
  full_name?: string;
  roll_number?: string;
  subject_code?: string;
  subject_name?: string;
  class_number?: number;
  topic_taught?: string;
};
type RawClassSession = Partial<ClassSession> & {
  id: string;
  topic_taught?: string;
  subject_id?: string;
  class_number?: number;
  duration_minutes?: number;
};
type RawHierarchy = {
  departments?: Array<{ id: string; name: string; courses?: Array<{ id: string; name: string; departmentId?: string; department_id?: string; semesters?: Array<{ id: string; name: string; courseId?: string; course_id?: string; sections?: Array<{ id: string; name: string; semesterId?: string; semester_id?: string; subjects?: RawPaper[] }> }> }> }>;
  courses?: Array<{ id: string; name: string; departmentId?: string; department_id?: string; semesters?: Array<{ id: string; name: string; courseId?: string; course_id?: string; sections?: Array<{ id: string; name: string; semesterId?: string; semester_id?: string; subjects?: RawPaper[] }> }> }>;
  semesters?: Array<{ id: string; name: string; courseId?: string; course_id?: string; sections?: Array<{ id: string; name: string; semesterId?: string; semester_id?: string; subjects?: RawPaper[] }> }>;
  sections?: Array<{ id: string; name: string; semesterId?: string; semester_id?: string; subjects?: RawPaper[] }>;
  subjects?: RawPaper[];
  papers?: RawPaper[];
  students?: RawStudent[];
};

export type BackendDashboard = {
  teacherProfile: TeacherProfile;
  papers: Paper[];
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  classSessions: ClassSession[];
  monthlyTrend: MonthlyTrend[];
  masters: {
    departments: MasterOption[];
    courses: MasterOption[];
    semesters: MasterOption[];
    sections: MasterOption[];
  };
  ids: {
    teacherId: string;
    academicSessionId: string;
    departmentId: string;
    courseId: string;
    semesterId: string;
    sectionId: string;
  };
  cards: {
    totalClasses: number;
    averageAttendance: number;
    totalStudents: number;
    defaulters: number;
  };
};

const emptyDashboard: BackendDashboard = {
  teacherProfile: {
    name: "Faculty",
    designation: "Teacher",
    department: "Department",
    academicSession: "Academic Session"
  },
  papers: [],
  students: [],
  attendanceRecords: [],
  classSessions: [],
  monthlyTrend: [],
  masters: {
    departments: [],
    courses: [],
    semesters: [],
    sections: []
  },
  ids: {
    teacherId: "",
    academicSessionId: "",
    departmentId: "",
    courseId: "",
    semesterId: "",
    sectionId: ""
  },
  cards: {
    totalClasses: 0,
    averageAttendance: 0,
    totalStudents: 0,
    defaulters: 0
  }
};

const semesterName = (id?: string, semesters?: Array<{ id: string; name: string }>) => semesters?.find((item) => item.id === id)?.name ?? "Semester";
const firstId = (items?: Array<{ id: string }>) => items?.[0]?.id ?? "";
const settledValue = <T,>(result: PromiseSettledResult<T>, fallback: T) => (result.status === "fulfilled" ? result.value : fallback);

const flattenHierarchy = (hierarchy: RawHierarchy) => {
  const departments = hierarchy.departments ?? [];
  const courses = (hierarchy.courses?.length ? hierarchy.courses : departments.flatMap((department) => department.courses ?? [])).map((course) => ({
    ...course,
    departmentId: course.departmentId ?? course.department_id
  }));
  const semesters = (hierarchy.semesters?.length ? hierarchy.semesters : courses.flatMap((course) => course.semesters ?? [])).map((semester) => ({
    ...semester,
    courseId: semester.courseId ?? semester.course_id
  }));
  const sections = (hierarchy.sections?.length ? hierarchy.sections : semesters.flatMap((semester) => semester.sections ?? [])).map((section) => ({
    ...section,
    semesterId: section.semesterId ?? section.semester_id
  }));
  const subjects = hierarchy.subjects ?? hierarchy.papers ?? sections.flatMap((section) => section.subjects ?? []);
  return { departments, courses, semesters, sections, subjects };
};

const normalizePaper = (item: RawPaper, semesters?: Array<{ id: string; name: string; courseId?: string }>, sections?: Array<{ id: string; semesterId?: string }>): Paper => ({
  id: item.id,
  code: item.code,
  name: item.name,
  semester: "semester" in item && item.semester ? item.semester : semesterName(item.semesterId ?? item.semester_id, semesters),
  departmentId: item.departmentId ?? item.department_id,
  courseId: item.courseId ?? item.course_id ?? semesters?.find((semester) => semester.id === (item.semesterId ?? item.semester_id))?.courseId,
  semesterId: item.semesterId ?? item.semester_id ?? sections?.find((section) => section.id === (item.sectionId ?? item.section_id))?.semesterId,
  sectionId: item.sectionId ?? item.section_id
});

const normalizeStudent = (item: RawStudent): Student => ({
  id: item.id,
  rollNumber: "rollNumber" in item && item.rollNumber ? item.rollNumber : item.roll_number ?? "",
  name: "name" in item && item.name ? item.name : item.full_name ?? item.user?.fullName ?? "Student",
  attendance: Number(item.attendance ?? 0),
  present: Number(item.present ?? 0),
  absent: Number(item.absent ?? 0),
  late: Number(item.late ?? 0),
  leave: Number(item.leave ?? item.leave_count ?? 0),
  total: Number(item.total ?? 0),
  remark: item.remark ?? "",
  departmentId: item.departmentId ?? item.department_id,
  courseId: item.courseId ?? item.course_id,
  semesterId: item.semesterId ?? item.semester_id,
  sectionId: item.sectionId ?? item.section_id,
  enrolledSubjectIds: item.enrolledSubjectIds ?? item.enrolled_subject_ids ?? []
});

const normalizeAttendanceRecord = (item: RawAttendanceRecord): AttendanceRecord => ({
  id: item.id,
  studentId: item.studentId ?? item.student_id ?? "",
  subjectId: item.subjectId ?? item.subject_id ?? "",
  date: item.date ?? "",
  status: (item.status ?? "ABSENT") as AttendanceRecord["status"],
  remark: item.remark,
  studentName: item.studentName ?? item.full_name,
  rollNumber: item.rollNumber ?? item.roll_number,
  subjectCode: item.subjectCode ?? item.subject_code,
  subjectName: item.subjectName ?? item.subject_name,
  classNumber: item.classNumber ?? item.class_number,
  topic: item.topic ?? item.topic_taught
});

const normalizeClassSession = (item: RawClassSession): ClassSession => {
  const rawDate = item.classDate ?? item.date ?? "";
  const displayDate = rawDate.includes("-") ? new Date(rawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : rawDate;
  const completed = item.status === "ATTENDANCE_COMPLETED" || item.status === "Class Taken";
  return {
    id: item.id,
    date: displayDate,
    classDate: rawDate,
    status: completed ? "Class Taken" : item.status === "ATTENDANCE_PENDING" ? "Attendance Missing" : item.status ?? "Class Taken",
    color: completed ? "#16a34a" : item.status === "ATTENDANCE_PENDING" ? "#dc2626" : "#94a3b8",
    topic: item.topic ?? item.topic_taught ?? "Class session",
    subjectId: item.subjectId ?? item.subject_id,
    classNumber: item.classNumber ?? item.class_number,
    durationMinutes: item.durationMinutes ?? item.duration_minutes
  };
};

const attachAttendanceTotals = (students: Student[], records: AttendanceRecord[]) => {
  if (!records.length) return students;
  const counts = new Map<string, { present: number; absent: number; late: number; leave: number; total: number }>();
  records.forEach((record) => {
    if (!record.studentId) return;
    const current = counts.get(record.studentId) ?? { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    current.total += 1;
    if (record.status === "PRESENT") current.present += 1;
    if (record.status === "ABSENT") current.absent += 1;
    if (record.status === "LATE") current.late += 1;
    if (record.status === "LEAVE") current.leave += 1;
    counts.set(record.studentId, current);
  });
  return students.map((student) => {
    const current = counts.get(student.id);
    if (!current) return student;
    return {
      ...student,
      ...current,
      attendance: current.total ? Math.round((current.present / current.total) * 100) : 0
    };
  });
};

export function useBackendDashboard() {
  const authUser = useAuthStore((state) => state.user);
  const [data, setData] = useState<BackendDashboard>(emptyDashboard);
  const [online, setOnline] = useState(false);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;

    try {
      const [analyticsResult, hierarchyResult, studentResult, calendarResult, recordsResult] = await Promise.allSettled([
        apiBackend.dashboard(),
        apiBackend.ensureMasterData(),
        apiBackend.students(),
        apiBackend.attendanceCalendar(),
        apiBackend.attendanceRecords()
      ]);
    const analytics = settledValue(analyticsResult, {});
    const rawHierarchy = settledValue(hierarchyResult, {}) as RawHierarchy;
    const hierarchy = flattenHierarchy(rawHierarchy);
    const studentResponse = settledValue(studentResult, {});
    const calendarResponse = settledValue(calendarResult, {});
    const normalizedPapers = (hierarchy.subjects as RawPaper[]).map((item) => normalizePaper(item, hierarchy.semesters, hierarchy.sections));
    const recordsResponse = settledValue(recordsResult, {});
    const normalizedRecords = ((recordsResponse.records ?? []) as RawAttendanceRecord[]).map(normalizeAttendanceRecord);
    const normalizedStudents = attachAttendanceTotals(((studentResponse.students ?? rawHierarchy.students ?? []) as RawStudent[]).map(normalizeStudent), normalizedRecords);
    const normalizedSessions = ((calendarResponse.days ?? calendarResponse.classSessions ?? []) as RawClassSession[]).map(normalizeClassSession);
      const averageAttendance = analytics.teacherAnalytics?.attendanceAverage ?? analytics.cards?.averageAttendance ?? analytics.cards?.attendancePercentage ?? 0;
      const totalClasses = analytics.teacherAnalytics?.totalClassesConducted ?? analytics.cards?.totalClasses ?? normalizedSessions.length;
      const defaulters = analytics.teacherAnalytics?.studentsBelowThreshold ?? analytics.cards?.defaulters ?? normalizedStudents.filter((item) => item.total > 0 && item.attendance < 75).length;
      const profile = analytics.teacherProfile ?? {
        ...emptyDashboard.teacherProfile,
        name: authUser?.fullName ?? emptyDashboard.teacherProfile.name,
        email: authUser?.email
      };
      setData({
        ...emptyDashboard,
        teacherProfile: profile,
        papers: normalizedPapers,
        students: normalizedStudents,
        attendanceRecords: normalizedRecords,
        classSessions: normalizedSessions,
        monthlyTrend: analytics.charts?.monthlyTrend?.length ? analytics.charts.monthlyTrend : analytics.monthlyTrend?.length ? analytics.monthlyTrend : [],
        masters: {
          departments: hierarchy.departments,
          courses: hierarchy.courses,
          semesters: hierarchy.semesters,
          sections: hierarchy.sections
        },
        ids: {
          teacherId: analytics.teacherProfile?.teacherId ?? analytics.teacherProfile?.id ?? "",
          academicSessionId: firstId(analytics.academicSessions),
          departmentId: firstId(hierarchy.departments),
          courseId: firstId(hierarchy.courses),
          semesterId: firstId(hierarchy.semesters),
          sectionId: firstId(hierarchy.sections)
        },
        cards: {
          totalClasses,
          averageAttendance,
          totalStudents: analytics.cards?.totalStudents ?? normalizedStudents.length,
          defaulters
        }
      });
    setOnline([analyticsResult, hierarchyResult, studentResult, calendarResult, recordsResult].some((result) => result.status === "fulfilled"));
    } finally {
      refreshInFlight.current = false;
    }
  }, [authUser?.email, authUser?.fullName]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useAppForegroundEffect(async () => {
    await syncOfflineAttendance().catch(() => undefined);
    await refresh().catch(() => undefined);
  });

  return { data, online, refresh };
}
