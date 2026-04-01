import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import {
  LayoutDashboard,
  Smartphone,
  Clock,
  Settings,
  Ticket,
  LogOut,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Separator } from '@/components/ui/separator'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const navItems = [
    { href: '/dashboard', label: '控制台', icon: LayoutDashboard },
    { href: '/xiaomi', label: '小米账号', icon: Smartphone },
    { href: '/schedules', label: '定时任务', icon: Clock },
    { href: '/settings', label: '设置', icon: Settings },
  ]

  if (user.isAdmin) {
    navItems.push({ href: '/invite', label: '邀请码', icon: Ticket })
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center px-4 font-mono text-lg font-bold">
          <span className="text-primary">mi</span>
          <span className="text-sidebar-foreground/50">motion</span>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Separator />
        <div className="flex items-center justify-between p-3">
          <ThemeToggle />
          <Link
            href="/api/auth/logout"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            退出
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <div className="flex h-14 items-center justify-between border-b px-4 md:hidden">
          <div className="font-mono text-lg font-bold">
            <span className="text-primary">mi</span>
            <span className="text-muted-foreground">motion</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b px-4 py-2 md:hidden">
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
  )
}
