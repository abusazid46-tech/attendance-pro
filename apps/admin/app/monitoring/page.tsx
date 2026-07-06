export default function MonitoringPage() {
  const rows = [
    { date: "2026-06-15", faculty: "Ananya Sharma", subject: "CS101", section: "A", attendance: "88%" },
    { date: "2026-06-15", faculty: "Rahul Sen", subject: "MATH101", section: "B", attendance: "72%" },
    { date: "2026-06-15", faculty: "Nazia Ahmed", subject: "PHY101", section: "A", attendance: "58%" }
  ];

  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-2xl font-black">Attendance Monitoring</h1>
      <p className="mt-1 text-sm text-muted">Filter by date, faculty, department, subject, section, and student.</p>
      <div className="my-5 grid gap-3 md:grid-cols-5">
        {["Date", "Faculty", "Department", "Subject", "Section"].map((filter) => (
          <button key={filter} className="rounded-md border border-border bg-white px-3 py-2 text-left text-sm font-bold text-muted">{filter}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-muted">
            <tr><th className="p-4">Date</th><th className="p-4">Faculty</th><th className="p-4">Subject</th><th className="p-4">Section</th><th className="p-4">Attendance</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.faculty}-${row.subject}`} className="border-t border-border">
                <td className="p-4">{row.date}</td>
                <td className="p-4 font-black">{row.faculty}</td>
                <td className="p-4">{row.subject}</td>
                <td className="p-4">{row.section}</td>
                <td className="p-4 font-black text-primary">{row.attendance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
