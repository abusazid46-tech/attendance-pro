"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const academicsPath = (status: "saved" | "deleted" | "error", message: string) => `/academics?${status}=${encodeURIComponent(message)}` as Parameters<typeof redirect>[0];

export async function updateAcademicAction(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id");
  const body: Record<string, string | number> = {};

  if (type === "departments") {
    body.name = text(formData, "name");
    body.code = text(formData, "code");
  }
  if (type === "courses") {
    body.name = text(formData, "name");
    body.code = text(formData, "code");
    body.departmentId = text(formData, "departmentId");
  }
  if (type === "semesters") {
    body.name = text(formData, "name");
    body.number = Number(text(formData, "number") || 1);
    body.courseId = text(formData, "courseId");
  }
  if (type === "sections") {
    body.name = text(formData, "name");
    body.semesterId = text(formData, "semesterId");
  }
  if (type === "subjects") {
    body.code = text(formData, "code");
    body.name = text(formData, "name");
    body.departmentId = text(formData, "departmentId");
    body.semesterId = text(formData, "semesterId");
    body.sectionId = text(formData, "sectionId");
  }

  try {
    await apiRequest(`/academics/${type}/${id}`, {
      method: type === "subjects" ? "PUT" : "PATCH",
      body: JSON.stringify(body)
    });
    revalidatePath("/academics");
  } catch (error) {
    redirect(academicsPath("error", error instanceof Error ? error.message : "Save failed"));
  }

  redirect(academicsPath("saved", "Academic record saved"));
}

export async function deleteAcademicAction(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id");
  try {
    await apiRequest(`/academics/${type}/${id}`, { method: "DELETE" });
    revalidatePath("/academics");
  } catch (error) {
    redirect(academicsPath("error", error instanceof Error ? error.message : "Delete failed"));
  }

  redirect(academicsPath("deleted", "Academic record deleted"));
}
