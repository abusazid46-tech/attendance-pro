export default function AcademicsPage() {
  const items = ["Departments", "Courses", "Semesters", "Sections", "Subjects", "Academic Sessions"];
  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-2xl font-black">Academic Management</h1>
      <p className="mt-1 text-sm text-muted">Manage the complete institution hierarchy.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <section key={item} className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-lg font-black">{item}</h2>
            <p className="mt-2 text-sm text-muted">Create, edit, archive, and map records with audit visibility.</p>
            <button className="mt-4 rounded-md border border-border px-3 py-2 text-sm font-black text-slate-700">Manage {item}</button>
          </section>
        ))}
      </div>
    </div>
  );
}
