import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import {
  IconLayoutDashboard,
  IconDeviceMobile,
  IconClock,
  IconSettings,
  IconTicket,
  IconLogout,
} from '@tabler/icons-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          mi<span>motion</span>
        </div>
        <nav>
          <Link href="/dashboard">
            <IconLayoutDashboard size={18} stroke={1.5} /> 控制台
          </Link>
          <Link href="/xiaomi">
            <IconDeviceMobile size={18} stroke={1.5} /> 小米账号
          </Link>
          <Link href="/schedules">
            <IconClock size={18} stroke={1.5} /> 定时任务
          </Link>
          <Link href="/settings">
            <IconSettings size={18} stroke={1.5} /> 设置
          </Link>
          {user.isAdmin && (
            <Link href="/invite">
              <IconTicket size={18} stroke={1.5} /> 邀请码
            </Link>
          )}
        </nav>
        <div className="sidebar-footer">
          <Link href="/api/auth/logout">
            <IconLogout size={16} stroke={1.5} /> 退出登录
          </Link>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </>
  )
}
