import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'

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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 200, background: '#f5f5f5', padding: 20 }}>
        <h2 style={{ marginBottom: 20 }}>mimotion</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/dashboard">控制台</Link>
          <Link href="/xiaomi">小米账号</Link>
          <Link href="/schedules">定时任务</Link>
          <Link href="/settings">设置</Link>
          {user.isAdmin && <Link href="/invite">邀请码</Link>}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 20 }}>{children}</main>
    </div>
  )
}