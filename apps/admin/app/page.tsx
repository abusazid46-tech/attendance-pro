import { AlertTriangle, GraduationCap, Percent, Users } from "lucide-react";
import { AttendanceTrend, PresentAbsentPie, SubjectBars } from "@/components/dashboard-charts";
import { StatCard } from "@/components/stat-card";
import { getAdminDashboardData } from "@/lib/api";

export default async function DashboardPage() {
  const { analytics, adminUsers, errors } = await getAdminDashboardData();
  const cards = analytics.cards ?? {};
  const teacher = analytics.teacherAnalytics ?? {};
  const totalStudents = adminUsers.counts?.students ?? adminUsers.students?.length ?? cards.totalStudents ?? 0;
  const totalFaculty = adminUsers.counts?.teachers ?? adminUsers.teachers?.length ?? 0;
  const trend = (analytics.charts?.monthlyTrend ?? []).map((item) => ({
    month: item.month,
    attendance: item.attendance ?? item.percentage ?? 0
  }));
  const subjectWise = (analytics.charts?.subjectWise ?? teacher.subjectPerformance ?? []).map((item) => ({
    subject: item.subject,
    attendance: ("attendance" in item ? item.attendance : undefined) ?? item.percentage ?? 0
  }));
  const lowAttendanceStudents = teacher.studentsBelowThreshold ?? 0;

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-normal lg:text-3xl">Institution Attendance Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Live backend data from attendance, academics, and analytics.</p>
        </div>
        <div className={`rounded-md border bg-white px-4 py-2 text-sm font-black ${Object.keys(errors).length ? "border-red-200 text-red-600" : "border-border text-primary"}`}>
          {Object.keys(errors).length ? "Backend Needs Attention" : "Backend Connected"}
        </div>
      </div>

      {Object.keys(errors).length ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {Object.entries(errors).map(([key, value]) => `${key}: ${value}`).join(" | ")}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={totalStudents} icon={Users} />
        <StatCard label="Faculty Accounts" value={totalFaculty} icon={GraduationCap} />
        <StatCard label="Average Attendance" value={`${cards.attendancePercentage ?? teacher.attendanceAverage ?? 0}%`} icon={Percent} />
        <StatCard label="Low Attendance Students" value={lowAttendanceStudents} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-lg font-black">Monthly Attendance Trend</h2>
          <AttendanceTrend data={trend.length ? trend : [{ month: "Current", attendance: cards.attendancePercentage ?? 0 }]} />
        </section>
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-lg font-black">Present vs Absent</h2>
          <PresentAbsentPie data={analytics.charts?.presentVsAbsent} />
        </section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-lg font-black">Subject-wise Attendance</h2>
          <SubjectBars data={subjectWise.length ? subjectWise : [{ subject: "No records", attendance: 0 }]} />
        </section>
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-lg font-black">Students</h2>
          <div className="space-y-3">
            {(adminUsers.students ?? []).slice(0, 5).map((student) => (
              <div key={student.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="font-black">{student.full_name ?? "Student"}</p>
                  <p className="text-sm text-muted">Roll {student.roll_number ?? "-"} / {student.semester_name ?? student.section_name ?? "Section"}</p>
                </div>
                <span className="font-black text-primary">Active</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
