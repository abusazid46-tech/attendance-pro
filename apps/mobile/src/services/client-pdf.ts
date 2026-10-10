import type { AttendanceRecord, ClassSession, Paper, Student } from "./app-data";

function base64EncodeString(str: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let i = 0;
  while (i < str.length) {
    const chr1 = str.charCodeAt(i++);
    const chr2 = i < str.length ? str.charCodeAt(i++) : Number.NaN;
    const chr3 = i < str.length ? str.charCodeAt(i++) : Number.NaN;

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (isNaN(chr2) ? 0 : chr2 >> 4);
    let enc3 = isNaN(chr2) ? 64 : ((chr2 & 15) << 2) | (isNaN(chr3) ? 0 : chr3 >> 6);
    let enc4 = isNaN(chr3) ? 64 : chr3 & 63;

    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }

    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }
  return output;
}

export type ClientReportOptions = {
  title: string;
  type: string;
  paper?: Paper;
  semesterName?: string;
  teacherName?: string;
  startDate?: string;
  endDate?: string;
  students: Student[];
  records: AttendanceRecord[];
  classSessions?: ClassSession[];
};

export function buildClientExcelReport(options: ClientReportOptions) {
  const { title, type, paper, semesterName, teacherName, startDate, endDate, students, records, classSessions = [] } = options;
  const safeTitle = (title || "Attendance-Report").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const dateStr = new Date().toISOString().slice(0, 10);

  const rows: string[][] = [
    [title],
    [`Faculty: ${teacherName || "Teacher"}`],
    [`Semester: ${semesterName || paper?.semester || "All"}`],
    [`Paper: ${paper?.code || ""} - ${paper?.name || ""}`],
    [`Period: ${startDate || "Start"} to ${endDate || "Today"}`],
    []
  ];

  if (type === "DEFAULTER") {
    rows.push(["Roll No.", "Student Name", "Classes Attended", "Total Classes", "Attendance %"]);
    students
      .filter((s) => s.total > 0 && s.attendance < 75)
      .forEach((s) => {
        rows.push([s.rollNumber, s.name, String(s.present), String(s.total), `${s.attendance}%`]);
      });
  } else if (type === "DAILY") {
    rows.push(["Date", "Class No.", "Roll No.", "Student Name", "Paper Code", "Status", "Remark"]);
    records.forEach((r) => {
      rows.push([r.date, String(r.classNumber ?? 1), r.rollNumber || "", r.studentName || "", r.subjectCode || "", r.status, r.remark || ""]);
    });
  } else if (type === "TEACHING_DIARY") {
    rows.push(["Date", "Class No.", "Paper Code", "Topic Taught", "Present", "Absent"]);
    classSessions.forEach((c) => {
      rows.push([
        c.classDate || c.date || "",
        String(c.classNumber ?? 1),
        paper?.code || "",
        c.topic || "",
        String(records.filter((r) => r.classNumber === c.classNumber && r.status === "PRESENT").length),
        String(records.filter((r) => r.classNumber === c.classNumber && r.status === "ABSENT").length)
      ]);
    });
  } else {
    rows.push(["Roll No.", "Student Name", "Present", "Absent", "Late", "Leave", "Total", "Attendance %"]);
    students.forEach((s) => {
      rows.push([s.rollNumber, s.name, String(s.present), String(s.absent), String(s.late), String(s.leave), String(s.total), `${s.attendance}%`]);
    });
  }

  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return {
    fileName: `${safeTitle}-${dateStr}.csv`,
    mimeType: "text/csv" as const,
    encoding: "base64" as const,
    contentBase64: base64EncodeString(csv)
  };
}
