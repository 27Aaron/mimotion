import { useState } from "react";
import { CircleUser, Footprints, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { currentLocale, navigate } from "../runtime/navigation";

interface SessionUser {
  username: string;
  isAdmin: boolean;
}

export default function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const [loggingOut, setLoggingOut] = useState(false);
  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: "LayoutDashboard" },
    { href: "/xiaomi", label: t("xiaomiAccounts"), icon: "Smartphone" },
    { href: "/schedules", label: t("schedules"), icon: "Clock" },
    { href: "/settings", label: t("settings"), icon: "Settings" },
  ];
  if (user.isAdmin) {
    navItems.push(
      { href: "/invite", label: t("inviteCodes"), icon: "Ticket" },
      { href: "/admin", label: t("userManagement"), icon: "Users" },
    );
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    navigate("/login", currentLocale(), true);
  }

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute right-[10%] top-[5%] h-[700px] w-[700px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="absolute bottom-[10%] left-[5%] h-[600px] w-[600px] rounded-full bg-primary/[0.05] blur-[100px]" />
        <div className="absolute left-[40%] top-[50%] h-[400px] w-[400px] rounded-full bg-primary/[0.03] blur-[80px]" />
      </div>

      <aside className="fade-border-r relative z-10 hidden w-60 flex-col bg-gradient-to-b from-primary/10 via-primary/[0.06] to-sidebar text-sidebar-foreground md:flex">
        <div className="fade-border-b flex h-12 items-center justify-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
            <Footprints className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-mono text-base font-bold tracking-tight">
            <span className="text-primary">Mi</span>Motion
          </span>
        </div>

        <nav className="flex-1 p-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            {t("menu")}
          </p>
          <NavLinks items={navItems} />
        </nav>

        <div className="fade-divider" />
        <div className="p-3">
          <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CircleUser className="h-4 w-4 text-primary/60" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground/80">
                {user.username}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40">
                {user.isAdmin ? t("roleAdmin") : t("roleUser")}
              </p>
            </div>
            <button
              type="button"
              disabled={loggingOut}
              onClick={logout}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/30 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={t("logout")}
              aria-label={t("logout")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="fade-border-b flex h-12 items-center justify-between bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/20">
              <Footprints className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-mono text-sm font-bold">
              <span className="text-primary">Mi</span>
              <span className="text-muted-foreground">Motion</span>
            </span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="fade-border-b flex gap-1 overflow-x-auto bg-background/80 px-4 py-2 backdrop-blur-sm md:hidden">
          <NavLinks items={navItems} variant="mobile" />
        </div>
        <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
