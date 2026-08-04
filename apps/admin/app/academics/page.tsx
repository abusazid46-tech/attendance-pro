import { deleteAcademicAction, updateAcademicAction } from "./actions";
import { getAdminDashboardData, type HierarchyResponse } from "@/lib/api";

type GroupKey = "departments" | "courses" | "semesters" | "sections" | "subjects";
type AcademicItem = NonNullable<HierarchyResponse[GroupKey]>[number];

const groups: { key: GroupKey; label: string }[] = [
  { key: "departments", label: "Departments" },
  { key: "courses", label: "Courses" },
  { key: "semesters", label: "Semesters" },
  { key: "sections", label: "Sections" },
  { key: "subjects", label: "Subjects" }
];

type AcademicsPageProps = {
  searchParams?: Promise<{ error?: string; saved?: string; deleted?: string }>;
};

export default async function AcademicsPage({ searchParams }: AcademicsPageProps) {
  const params = await searchParams;
  const { hierarchy } = await getAdminDashboardData();
  const message = params?.error ?? params?.saved ?? params?.deleted;
  const isError = Boolean(params?.error);

  return (
    <div className="p-5 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Academic Management</h1>
          <p className="mt-1 text-sm text-muted">Edit or delete live departments, courses, semesters, sections, and papers.</p>
        </div>
        <div className="rounded-md border border-border bg-white px-4 py-2 text-sm font-black text-primary">
          {(hierarchy.departments?.length ?? 0) + (hierarchy.courses?.length ?? 0) + (hierarchy.semesters?.length ?? 0) + (hierarchy.sections?.length ?? 0) + (hierarchy.subjects?.length ?? 0)} Records
        </div>
      </div>

      {message ? (
        <div className={`mt-5 rounded-md border px-4 py-3 text-sm font-bold ${isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-primary"}`}>
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {groups.map((group) => {
          const items = (hierarchy[group.key] ?? []) as AcademicItem[];
          return (
            <section key={group.key} className="rounded-lg border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">{group.label}</h2>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-primary">{items.length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {items.length ? items.map((item) => <AcademicEditor key={item.id} type={group.key} item={item} />) : <p className="rounded-md border border-border p-3 text-sm font-bold text-muted">No records yet.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AcademicEditor({ type, item }: { type: GroupKey; item: AcademicItem }) {
  const code = "code" in item ? String(item.code ?? "") : "";
  const number = "number" in item ? String(item.number ?? 1) : "";
  const departmentId = "department_id" in item ? String(item.department_id ?? "") : "";
  const courseId = "course_id" in item ? String(item.course_id ?? "") : "";
  const semesterId = "semester_id" in item ? String(item.semester_id ?? "") : "";
  const sectionId = "section_id" in item ? String(item.section_id ?? "") : "";

  return (
    <div className="rounded-md border border-border p-3">
      <form action={updateAcademicAction} className="grid gap-2">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="departmentId" value={departmentId} />
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="semesterId" value={semesterId} />
        <input type="hidden" name="sectionId" value={sectionId} />

        <div className="grid gap-2 sm:grid-cols-2">
          {(type === "departments" || type === "courses" || type === "subjects") ? (
            <label className="grid gap-1 text-xs font-black text-muted">
              Code
              <input name="code" defaultValue={code} className="rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground" />
            </label>
          ) : null}
          {type === "semesters" ? (
            <label className="grid gap-1 text-xs font-black text-muted">
              Number
              <input name="number" defaultValue={number} className="rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground" />
            </label>
          ) : null}
          <label className="grid gap-1 text-xs font-black text-muted">
            Name
            <input name="name" defaultValue={String(item.name ?? "")} className="rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground" />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-muted">ID: {item.id}</p>
          <div className="flex gap-2">
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-black text-white" type="submit">Save</button>
          </div>
        </div>
      </form>

      <form action={deleteAcademicAction} className="mt-2 flex justify-end">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="id" value={item.id} />
        <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-black text-red-600" type="submit">Delete</button>
      </form>
    </div>
  );
}
