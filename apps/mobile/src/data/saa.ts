export const teacherProfile = {
  id: "seed-teacher-1",
  name: "Ananya Sharma",
  designation: "Assistant Professor",
  department: "Library and Information Science",
  institution: "Central University",
  mobile: "9876543210",
  email: "teacher@attendance.local",
  academicSession: "2026-27"
};

export const semesters = ["Semester I", "Semester II", "Semester III", "Semester IV", "Semester V", "Semester VI"];

export const papers = [
  { id: "seed-subject-1", semester: "Semester II", code: "LIS201", name: "Knowledge Organization" },
  { id: "seed-subject-2", semester: "Semester II", code: "LIS202", name: "Information Sources" },
  { id: "seed-subject-3", semester: "Semester II", code: "LIS203", name: "ICT Applications" }
];

export const students = [
  { id: "seed-student-1", rollNumber: "01", name: "Rahul Das", attendance: 88, present: 37, total: 42, remark: "" },
  { id: "seed-student-2", rollNumber: "02", name: "Anita Sharma", attendance: 76, present: 32, total: 42, remark: "" },
  { id: "seed-student-3", rollNumber: "14", name: "Rina Das", attendance: 62, present: 26, total: 42, remark: "Sports event" },
  { id: "seed-student-4", rollNumber: "21", name: "S. Ahmed", attendance: 49, present: 21, total: 43, remark: "Medical leave" },
  { id: "seed-student-5", rollNumber: "27", name: "Meghna Borah", attendance: 92, present: 39, total: 42, remark: "" }
];

export const classSessions = [
  { date: "15 Jul", status: "Class Taken", color: "#16a34a", topic: "Reference Sources" },
  { date: "16 Jul", status: "No Class", color: "#94a3b8", topic: "Department work" },
  { date: "17 Jul", status: "Attendance Missing", color: "#dc2626", topic: "Digital Libraries" },
  { date: "18 Jul", status: "Class Taken", color: "#16a34a", topic: "Information Services" }
];

export const monthlyTrend = [
  { month: "Jul", percentage: 81 },
  { month: "Aug", percentage: 77 },
  { month: "Sep", percentage: 74 },
  { month: "Oct", percentage: 82 }
];

export const reportTypes = [
  "Individual Student Report",
  "Subject Report",
  "Semester Report",
  "Monthly Report",
  "Defaulter Report",
  "University Examination Eligibility",
  "Teaching Diary + Attendance Register"
];

