"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { loginAction } from "../actions";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <form action={formAction} className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-primary text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black">Admin Login</h1>
          <p className="mt-1 text-sm text-muted">Use an ADMIN or SUPER_ADMIN backend account.</p>
        </div>
        {state?.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{state.error}</div>
        ) : null}
        <label className="mb-2 block text-sm font-black">Email</label>
        <input name="email" type="email" required className="mb-4 w-full rounded-md border border-border bg-slate-50 px-3 py-3 text-sm font-bold outline-none focus:border-primary" />
        <label className="mb-2 block text-sm font-black">Password</label>
        <input name="password" type="password" required minLength={8} className="mb-5 w-full rounded-md border border-border bg-slate-50 px-3 py-3 text-sm font-bold outline-none focus:border-primary" />
        <button disabled={pending} className="w-full rounded-md bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          {pending ? "Signing in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
