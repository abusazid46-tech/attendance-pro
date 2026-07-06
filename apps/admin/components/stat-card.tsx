import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, icon: Icon, tone = "green" }: { label: string; value: string | number; icon: LucideIcon; tone?: "green" | "orange" | "red" }) {
  const colors = {
    green: "bg-emerald-50 text-primary",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600"
  };

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-muted">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-normal text-slate-950">{value}</p>
        </div>
        <div className={`rounded-md p-2 ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
