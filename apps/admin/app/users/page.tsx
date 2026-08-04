import { CheckCircle, Power, Save, Trash2 } from "lucide-react";
import { getAdminDashboardData } from "@/lib/api";
import { approveUserAction, deactivateUserAction, deleteUserAction, updateUserAction } from "./actions";

export default async function UsersPage() {
  const { adminUsers } = await getAdminDashboardData();
  const teachers = adminUsers.teachers ?? [];
  const students = adminUsers.students ?? [];
  const users = [
    ...teachers.map((user) => ({
      id: user.user_id,
      entityId: user.id,
      name: user.full_name ?? "Faculty",
      email: user.email ?? "",
      mobileNumber: user.mobile_number ?? "",
      role: "Faculty",
      scope: `${user.designation ?? "Teacher"} / ${user.department_name ?? "Department"} / ${user.employee_code ?? "-"}`,
      active: user.is_active ?? true,
      designation: user.designation ?? "",
      institutionName: user.institution_name ?? "",
      employeeCode: user.employee_code ?? "",
      rollNumber: ""
    })),
    ...students.map((user) => ({
      id: user.user_id,
      entityId: user.id,
      name: user.full_name ?? "Student",
      email: user.email ?? "",
      mobileNumber: "",
      role: "Student",
      scope: `Roll ${user.roll_number ?? "-"} / ${user.semester_name ?? "Semester"} / ${user.section_name ?? "Section"}`,
      active: user.is_active ?? true,
      designation: "",
      institutionName: "",
      employeeCode: "",
      rollNumber: user.roll_number ?? ""
    }))
  ];

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">User Management</h1>
          <p className="mt-1 text-sm text-muted">Approve, edit, deactivate, or delete live backend accounts.</p>
        </div>
        <div className="rounded-md border border-border bg-white px-4 py-2 text-sm font-black text-primary">{teachers.length} Faculty / {students.length} Students</div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="grid grid-cols-[1.5fr_1.1fr_1fr_1.5fr_210px] gap-3 bg-slate-50 p-4 text-xs font-black uppercase text-muted">
          <span>Name / Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Edit</span>
          <span>Actions</span>
        </div>
        {users.map((user) => (
          <div key={`${user.role}-${user.entityId}`} className="grid grid-cols-[1.5fr_1.1fr_1fr_1.5fr_210px] gap-3 border-t border-border p-4 text-sm">
            <div>
              <p className="font-black">{user.name}</p>
              <p className="mt-1 text-xs font-bold text-muted">{user.email}</p>
              <p className="mt-1 text-xs text-muted">{user.scope}</p>
            </div>
            <div className="font-bold">{user.role}</div>
            <div>
              <span className={user.active ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-primary" : "rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-600"}>
                {user.active ? "Approved" : "Inactive"}
              </span>
            </div>
            <form action={updateUserAction} className="grid gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="isActive" value={String(user.active)} />
              <input name="fullName" defaultValue={user.name} className="rounded-md border border-border px-2 py-2 text-xs font-bold" />
              <input name="email" defaultValue={user.email} className="rounded-md border border-border px-2 py-2 text-xs font-bold" />
              <input name="mobileNumber" defaultValue={user.mobileNumber} placeholder="Mobile" className="rounded-md border border-border px-2 py-2 text-xs font-bold" />
              {user.role === "Faculty" ? (
                <>
                  <input name="designation" defaultValue={user.designation} placeholder="Designation" className="rounded-md border border-border px-2 py-2 text-xs font-bold" />
                  <input name="employeeCode" defaultValue={user.employeeCode} placeholder="Employee code" className="rounded-md border border-border px-2 py-2 text-xs font-bold" />
                  <input name="institutionName" defaultValue={user.institutionName} placeholder="Institution" className="rounded-md border border-border px-2 py-2 text-xs font-bold" />
                </>
              ) : (
                <input name="rollNumber" defaultValue={user.rollNumber} placeholder="Roll number" className="rounded-md border border-border px-2 py-2 text-xs font-bold" />
              )}
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-black text-white">
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            </form>
            <div className="flex flex-col gap-2">
              <form action={approveUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-primary">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </button>
              </form>
              <form action={deactivateUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                  <Power className="h-3.5 w-3.5" />
                  Deactivate
                </button>
              </form>
              <form action={deleteUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
        {!users.length ? <div className="border-t border-border p-4 text-sm text-muted">No users found in backend.</div> : null}
      </div>
    </div>
  );
}
