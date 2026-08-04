"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/lib/api";

export async function approveUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await apiRequest(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: true })
  });
  revalidatePath("/users");
}

export async function deactivateUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await apiRequest(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false })
  });
  revalidatePath("/users");
}

export async function deleteUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await apiRequest(`/admin/users/${userId}`, { method: "DELETE" });
  revalidatePath("/users");
}

export async function updateUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await apiRequest(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      mobileNumber: String(formData.get("mobileNumber") ?? "") || null,
      isActive: formData.get("isActive") === "true",
      designation: String(formData.get("designation") ?? "") || null,
      institutionName: String(formData.get("institutionName") ?? "") || null,
      employeeCode: String(formData.get("employeeCode") ?? "") || null,
      rollNumber: String(formData.get("rollNumber") ?? "") || null
    })
  });
  revalidatePath("/users");
}
