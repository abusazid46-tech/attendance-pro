import { getAdminDashboardData } from "@/lib/api";

export default async function MonitoringPage() {
  const { calendar } = await getAdminDashboardData();
  const rows = calendar.days ?? [];

  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-2xl font-black">Attendance Monitoring</h1>
      <p className="mt-1 text-sm text-muted">Live class sessions and attendance completion status.</p>
      <div className="my-5 grid gap-3 md:grid-cols-5">
        {["Date", "Faculty", "Department", "Subject", "Section"].map((filter) => (
          <button key={filter} className="rounded-md border border-border bg-white px-3 py-2 text-left text-sm font-bold text-muted">{filter}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-muted">
            <tr><th className="p-4">Date</th><th className="p-4">Class</th><th className="p-4">Subject</th><th className="p-4">Topic</th><th className="p-4">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-4">{row.date}</td>
                <td className="p-4 font-black">{row.class_number ?? "-"}</td>
                <td className="p-4">{row.subject_code ?? "-"}</td>
                <td className="p-4 text-muted">{row.topic_taught ?? "Class session"}</td>
                <td className="p-4 font-black text-primary">{row.status ?? "Recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
