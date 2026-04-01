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
  Footprints,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="relative flex min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background ambient glow — larger & more visible */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute right-[10%] top-[5%] h-[700px] w-[700px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="absolute bottom-[10%] left-[5%] h-[600px] w-[600px] rounded-full bg-primary/[0.05] blur-[100px]" />
        <div className="absolute left-[40%] top-[50%] h-[400px] w-[400px] rounded-full bg-primary/[0.03] blur-[80px]" />
      </div>

      {/* Sidebar */}
      <aside className="fade-border-r relative z-10 hidden md:flex w-60 flex-col bg-gradient-to-b from-primary/10 via-primary/[0.06] to-sidebar text-sidebar-foreground">
        {/* Brand */}
        <div className="fade-border-b flex h-12 items-center justify-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
            <Footprints className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-mono text-base font-bold tracking-tight">
            <span className="text-primary">Mi</span>Motion
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            菜单
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-all hover:bg-primary/8 hover:text-primary"
            >
              <item.icon className="h-4 w-4 transition-colors group-hover:text-primary" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="fade-divider" />

        {/* User section */}
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <CircleUser className="h-4 w-4 text-primary/60" />
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
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/40 transition-all hover:bg-primary/8 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出登录
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-auto">
        {/* Green accent line at top */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* Top bar */}
        <div className="fade-border-b flex h-12 items-center justify-between bg-background/80 backdrop-blur-sm px-4 md:px-6">
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
          <ThemeToggle />
        </div>

        {/* Mobile nav */}
        <div className="fade-border-b flex gap-1 overflow-x-auto bg-background/80 backdrop-blur-sm px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
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
