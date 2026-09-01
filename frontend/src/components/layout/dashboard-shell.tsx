import { useState } from "react";
import {
  Clock,
  CircleUser,
  Footprints,
  LayoutDashboard,
  LogOut,
  Settings,
  Smartphone,
  Ticket,
  Users,
} from "lucide-react";
import { useTranslations } from "@/platform/i18n";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavLinks } from "@/components/layout/nav-links";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import Link from "@/platform/link";
import { currentLocale, navigate, usePathname } from "@/platform/navigation";

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
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/xiaomi", label: t("xiaomiAccounts"), icon: Smartphone },
    { href: "/schedules", label: t("schedules"), icon: Clock },
    { href: "/settings", label: t("settings"), icon: Settings },
    ...(user.isAdmin
      ? [
          { href: "/invite", label: t("inviteCodes"), icon: Ticket },
          { href: "/admin", label: t("userManagement"), icon: Users },
        ]
      : []),
  ];
  const currentPage = navItems.find((item) => item.href === pathname);
  const primaryItems = navItems.slice(0, 4);
  const adminItems = navItems.slice(4);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    navigate("/login", currentLocale(), true);
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader className="h-14 justify-center p-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary">
              <Footprints className="size-3.5 text-primary-foreground" />
            </div>
            <span className="font-heading text-base font-bold tracking-tight">
              <span className="text-primary">Mi</span>Motion
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("menu")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavLinks items={primaryItems} />
            </SidebarGroupContent>
          </SidebarGroup>

          {adminItems.length > 0 && (
            <SidebarGroup className="pt-2">
              <SidebarGroupLabel>{t("management")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavLinks items={adminItems} />
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25">
                  <CircleUser className="size-4 text-primary/60" />
                </div>
                <div className="min-w-0 flex-1">
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
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/30 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={t("logout")}
                  aria-label={t("logout")}
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:inline-flex">
                <BreadcrumbLink render={<Link href="/dashboard" />}>
                  MiMotion
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:inline-flex" />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentPage?.label ?? t("dashboard")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
