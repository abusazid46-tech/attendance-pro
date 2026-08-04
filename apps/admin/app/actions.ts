"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminTokenCookie, loginAdmin } from "@/lib/api";

export async function loginAction(_: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const session = await loginAdmin(email, password);
    (await cookies()).set(adminTokenCookie, session.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 8
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Login failed" };
  }

  redirect("/");
}

export async function logoutAction() {
  (await cookies()).delete(adminTokenCookie);
  redirect("/login");
}
