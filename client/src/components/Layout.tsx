import { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import RecoveryKeyModal from "./RecoveryKeyModal";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const links = [
  { to: "/", label: "Dashboard", short: "Home", icon: icon(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>) },
  { to: "/transactions", label: "Transactions", short: "Transactions", icon: icon(<><path d="M7 4v16M3 8l4-4 4 4" /><path d="M17 20V4M13 16l4 4 4-4" /></>) },
  { to: "/budgets", label: "Budgets", short: "Budgets", icon: icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12l6 4" /></>) },
  { to: "/import", label: "Import", short: "Import", icon: icon(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></>) },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-black/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-xs text-white dark:bg-white dark:text-black">₹</span>Finance Tracker</span>
            {/* desktop: links in the top bar */}
            <nav className="hidden gap-1 md:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm ${isActive ? "font-medium text-neutral-900 dark:text-white" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle />
            <NavLink to="/account" className="muted hidden hover:text-neutral-900 md:inline dark:hover:text-white" title="Account">Hi, {user?.name}</NavLink>
            <button className="btn-ghost hidden md:inline-block" onClick={logout}>Log out</button>
            {/* phone: a small avatar opens Account (which has Log out) */}
            <NavLink
              to="/account"
              aria-label="Account"
              className={({ isActive }) =>
                `flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold md:hidden ${isActive ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black" : "border-neutral-300 dark:border-neutral-700"}`
              }
            >
              {initial}
            </NavLink>
          </div>
        </div>
      </header>

      {/* extra bottom padding on phones so the tab bar never covers content */}
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-10 md:pt-6">
        <Outlet />
      </main>

      {/* phone: app-style tab bar at the bottom */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-black/90"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? "font-semibold text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-neutral-500"}`
              }
            >
              {l.icon}
              {l.short}
            </NavLink>
          ))}
        </div>
      </nav>
      <RecoveryKeyModal />
    </div>
  );
}
