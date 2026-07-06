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

  async ensureMasterData() {
    const { data } = await api.get("/academics/hierarchy");
    return data;
  },

  async saveTeacherProfile(input: TeacherProfileInput) {
    const { data } = await api.post("/academics/profile", input);
    return data;
  },

  async createAcademicSession(name: string) {
    const { data } = await api.post("/academics/sessions", { name });
    return data;
  },

  async addSubject(input: { code: string; name: string; semesterId?: string; departmentId?: string; sectionId?: string }) {
    const { data } = await api.post("/academics/subjects", input);
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

  async generateReport(input: { type: string; format: "PDF" | "EXCEL"; title: string; filters: Record<string, unknown> }) {
    const { data } = await api.post("/reports", input);
    return data;
  },

  async createBackup(input: { target: "GOOGLE_DRIVE" | "LOCAL_STORAGE"; metadata: Record<string, unknown> }) {
    const { data } = await api.post("/backups", input);
    return data;
  }
};
