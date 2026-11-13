import { NavLink, Outlet } from "react-router";
import { Database, FileStack, LayoutDashboard, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Process", icon: Receipt, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: false },
  { to: "/master", label: "Master data", icon: Database, end: false },
] as const;

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:gap-6">
          <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-900">
            <FileStack className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Invoice Desk</span>
          </div>
          <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
            {LINKS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-sm font-medium sm:px-2.5",
                    isActive ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
