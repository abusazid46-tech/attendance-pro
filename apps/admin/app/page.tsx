import { AlertTriangle, GraduationCap, Percent, Users } from "lucide-react";
import { AttendanceTrend, PresentAbsentPie, SubjectBars } from "@/components/dashboard-charts";
import { StatCard } from "@/components/stat-card";
import { demo } from "@/lib/api";

export default function DashboardPage() {
  const data = demo.analytics;

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-normal lg:text-3xl">Institution Attendance Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Live attendance, threshold risk, and academic performance overview.</p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-black text-white">Export Report</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={data.cards.totalStudents} icon={Users} />
        <StatCard label="Total Teachers" value={data.cards.totalTeachers} icon={GraduationCap} />
        <StatCard label="Average Attendance" value={`${data.cards.averageAttendance}%`} icon={Percent} />
        <StatCard label="Low Attendance Students" value={data.cards.lowAttendanceStudents} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-lg font-black">Monthly Attendance Trend</h2>
          <AttendanceTrend data={data.trend} />
        </section>
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-lg font-black">Present vs Absent</h2>
          <PresentAbsentPie />
        </section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-lg font-black">Subject-wise Attendance</h2>
          <SubjectBars data={data.subjects} />
        </section>
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="mb-4 text-lg font-black">Students Below Threshold</h2>
          <div className="space-y-3">
            {["Priya Bora", "Imran Ali", "Rakesh Nath"].map((student, index) => (
              <div key={student} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="font-black">{student}</p>
                  <p className="text-sm text-muted">CSE / Semester 1 / Section A</p>
                </div>
                <span className={index === 0 ? "font-black text-orange-600" : "font-black text-red-600"}>{index === 0 ? "72%" : "58%"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
