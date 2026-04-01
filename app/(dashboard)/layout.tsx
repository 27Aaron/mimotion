import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import {
  LayoutDashboard,
  Smartphone,
  Clock,
  Settings,
  Ticket,
  LogOut,
  CircleUser,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const navItems = [
    { href: "/dashboard", label: "控制台", icon: LayoutDashboard },
    { href: "/xiaomi", label: "小米账号", icon: Smartphone },
    { href: "/schedules", label: "定时任务", icon: Clock },
    { href: "/settings", label: "设置", icon: Settings },
  ];

  if (user.isAdmin) {
    navItems.push({ href: "/invite", label: "邀请码", icon: Ticket });
    navItems.push({ href: "/admin", label: "用户管理", icon: Users });
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-xs font-bold">m</span>
          </div>
          <span className="font-mono text-base font-bold tracking-tight">
            <span className="text-primary">mi</span>
            <span className="text-sidebar-foreground/40">motion</span>
          </span>
        </div>
        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            菜单
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <Separator />

        {/* User section */}
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
              <CircleUser className="h-4 w-4 text-sidebar-foreground/60" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground/80">
                {user.email}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40">
                {user.isAdmin ? "管理员" : "用户"}
              </p>
            </div>
          </div>
          <Link
            href="/api/auth/logout"
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/40 transition-all hover:bg-sidebar-accent hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出登录
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-muted/30">
        {/* Top bar */}
        <div className="flex h-12 items-center justify-between border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <span className="text-[10px] font-bold text-primary-foreground">m</span>
            </div>
            <span className="font-mono text-sm font-bold">
              <span className="text-primary">mi</span>
              <span className="text-muted-foreground">motion</span>
            </span>
          </div>
          <div className="hidden md:block" />
          <ThemeToggle />
        </div>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b bg-background px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
