import { api } from "./api";

type LoginValues = {
  email?: string;
  mobileNumber?: string;
  password: string;
};

type TeacherProfileInput = {
  name: string;
  designation: string;
  department: string;
  institutionName: string;
  mobileNumber: string;
  email: string;
};

type TeacherRegistrationInput = TeacherProfileInput & {
  password: string;
  passwordConfirmation: string;
  employeeCode?: string;
  academicSession: string;
};

type ClassSessionInput = {
  teacherId?: string;
  academicSessionId?: string;
  departmentId?: string;
  courseId?: string;
  semesterId?: string;
  sectionId?: string;
  subjectId?: string;
  date: Date | string;
  classNumber: number;
  topicTaught: string;
  durationMinutes: number;
  assignmentGiven?: string;
  notes?: string;
  observations?: string;
};

type AttendancePayload = ClassSessionInput & {
  classSessionId?: string;
  latitude?: number;
  longitude?: number;
  records: {
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
    remark?: string;
  }[];
};

const apiDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const withApiDate = <T extends { date: Date | string }>(payload: T) => ({ ...payload, date: apiDate(payload.date) });
const academicSessionRange = (name: string) => {
  const match = name.match(/(20\d{2})\D*(\d{2,4})?/);
  const startYear = match ? Number(match[1]) : new Date().getFullYear();
  const endYear = match?.[2] ? Number(match[2].length === 2 ? `20${match[2]}` : match[2]) : startYear + 1;
  return {
    startsOn: `${startYear}-07-01`,
    endsOn: `${endYear}-06-30`
  };
};

export const apiBackend = {
  async login(values: LoginValues) {
    const { data } = await api.post("/auth/login", values);
    return data;
  },

  async registerTeacher(values: TeacherRegistrationInput) {
    const { data } = await api.post("/auth/register-teacher", {
      ...values,
      password_confirmation: values.passwordConfirmation
    });
    return data;
  },

  async forgotPassword(values: { email?: string; mobileNumber?: string }) {
    const { data } = await api.post("/auth/forgot-password", values);
    return data as { message: string; recoveryCode?: string };
  },

  async resetPassword(values: { token: string; password: string; passwordConfirmation: string }) {
    const { data } = await api.post("/auth/reset-password", {
      token: values.token,
      password: values.password,
      password_confirmation: values.passwordConfirmation
    });
    return data;
  },

  async uploadAvatar(imageData: string) {
    const { data } = await api.post("/users/avatar", { imageData });
    return data;
  },

  async ensureMasterData() {
    const { data } = await api.get("/academics/hierarchy");
    return data;
  },

  async dashboard() {
    const { data } = await api.get("/analytics/faculty-dashboard");
    return data;
  },

  async students(params?: { semesterId?: string; subjectId?: string; sectionId?: string }) {
    const { data } = await api.get("/attendance/students", { params });
    return data;
  },

  async attendanceRecords(params?: { semesterId?: string; subjectId?: string; date?: string; classSessionId?: string }) {
    const { data } = await api.get("/attendance", { params });
    return data;
  },

  async studentRecords(studentId: string, params?: { subjectId?: string }) {
    const { data } = await api.get(`/attendance/students/${studentId}/records`, { params });
    return data;
  },

  async attendanceCalendar(params?: { subjectId?: string; month?: string }) {
    const { data } = await api.get("/attendance/calendar", { params });
    return data;
  },

  async saveTeacherProfile(input: TeacherProfileInput) {
    const { data } = await api.post("/academics/profile", input);
    return data;
  },

  async createAcademicSession(name: string) {
    const { data } = await api.post("/academics/sessions", { name, ...academicSessionRange(name), isActive: true });
    return data;
  },

  async createSemester(input: { name: string; number?: number; courseId?: string; sectionName?: string }) {
    const { data } = await api.post("/academics/semesters", input);
    return data;
  },

  async updateSemester(semesterId: string, input: { name: string; number?: number; courseId?: string }) {
    const { data } = await api.patch(`/academics/semesters/${semesterId}`, input);
    return data;
  },

  async deleteSemester(semesterId: string) {
    const { data } = await api.delete(`/academics/semesters/${semesterId}`);
    return data;
  },

  async addSubject(input: { code: string; name: string; semesterId?: string; departmentId?: string; sectionId?: string }) {
    const { data } = await api.post("/academics/subjects", input);
    return data;
  },

  async updateSubject(subjectId: string, input: { code: string; name: string; semesterId?: string; departmentId?: string; sectionId?: string }) {
    const { data } = await api.put(`/academics/subjects/${subjectId}`, input);
    return data;
  },

  async deleteSubject(subjectId: string) {
    const { data } = await api.delete(`/academics/subjects/${subjectId}`);
    return data;
  },

  async createStudent(input: { rollNumber: string; name: string; email?: string; departmentId: string; courseId: string; semesterId: string; sectionId: string }) {
    const { data } = await api.post("/attendance/students", input);
    return data;
  },

  async updateStudent(studentId: string, input: { rollNumber: string; name: string; email?: string; departmentId: string; courseId: string; semesterId: string; sectionId: string }) {
    const { data } = await api.patch(`/attendance/students/${studentId}`, input);
    return data;
  },

  async bulkStudents(input: { students: { rollNumber: string; name: string; email?: string }[]; departmentId: string; courseId: string; semesterId: string; sectionId: string }) {
    const { data } = await api.post("/attendance/students/bulk", input);
    return data;
  },

  async deleteStudent(studentId: string) {
    const { data } = await api.delete(`/attendance/students/${studentId}`);
    return data;
  },

  async enrollStudents(input: { subjectId: string; semesterId: string; studentIds: string[] }) {
    const { data } = await api.post("/academics/enrollments", input);
    return data;
  },

  async createClassSession(input: ClassSessionInput) {
    const { data } = await api.post("/attendance/classes", withApiDate(input));
    return data;
  },

  async submitAttendance(payload: AttendancePayload) {
    const { data } = await api.post("/attendance", withApiDate(payload));
    return data;
  },

  async updateAttendance(attendanceId: string, input: { status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE"; remark?: string }) {
    const { data } = await api.patch(`/attendance/${attendanceId}`, input);
    return data;
  },

  async generateReport(input: { type: string; format: "PDF" | "EXCEL"; title: string; filters: Record<string, unknown> }) {
    const { data } = await api.post("/reports", input);
    return data as {
      message: string;
      fileName: string;
      mimeType: string;
      encoding: "base64";
      contentBase64: string;
      report?: unknown;
    };
  },

  async createBackup(input: { target: "GOOGLE_DRIVE" | "LOCAL_STORAGE"; metadata: Record<string, unknown> }) {
    const { data } = await api.post("/backups", input);
    return data;
  },

  async backups() {
    const { data } = await api.get("/backups");
    return data;
  },

  async createQrSession(input: { teacherId?: string; subjectId: string; sectionId?: string }) {
    const { data } = await api.post("/qr-attendance/sessions", {
      teacherId: input.teacherId,
      subjectId: input.subjectId,
      sectionId: input.sectionId
    });
    return data;
  }
};
