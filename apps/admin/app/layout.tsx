import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Bell, GraduationCap, LayoutDashboard, Users } from "lucide-react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Attendance Admin",
  description: "Institution attendance management dashboard"
};

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/academics", label: "Academics", icon: GraduationCap },
  { href: "/monitoring", label: "Monitoring", icon: Bell }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen">
          <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white p-5 lg:block">
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-lg font-black text-white">A</div>
              <div>
                <p className="text-sm font-black">Attendance Pro</p>
                <p className="text-xs text-muted">Admin Console</p>
              </div>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-primary">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="lg:pl-64">{children}</main>
        </div>
      </body>
    </html>
  );
}
