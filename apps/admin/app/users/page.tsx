export default function UsersPage() {
  const users = [
    { name: "Ananya Sharma", role: "Faculty", status: "Active", scope: "CSE / CS101" },
    { name: "Rohan Das", role: "Student", status: "Active", scope: "Semester 1 / Section A" },
    { name: "Institute Admin", role: "Admin", status: "Active", scope: "All Departments" }
  ];

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">User Management</h1>
          <p className="mt-1 text-sm text-muted">Create faculty, students, assign subjects and suspend accounts.</p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-black text-white">Create User</button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-muted">
            <tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Scope</th><th className="p-4">Status</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.name} className="border-t border-border">
                <td className="p-4 font-black">{user.name}</td>
                <td className="p-4">{user.role}</td>
                <td className="p-4 text-muted">{user.scope}</td>
                <td className="p-4"><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-primary">{user.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
