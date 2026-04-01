import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { xiaomiAccounts, schedules, runLogs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const accounts = await db
    .select()
    .from(xiaomiAccounts)
    .where(eq(xiaomiAccounts.userId, user.userId))

  const activeSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, user.userId))

  const recentLogs = await db
    .select()
    .from(runLogs)
    .orderBy(desc(runLogs.executedAt))
    .limit(10)

  const todayCount = recentLogs.filter(
    (l) => l.executedAt && new Date(l.executedAt).toDateString() === new Date().toDateString()
  ).length

  return (
    <div>
      <h1>控制台</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 20 }}>
        <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8 }}>
          <h3>小米账号</h3>
          <p style={{ fontSize: 32, margin: 0 }}>{accounts.length}</p>
        </div>
        <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8 }}>
          <h3>活跃任务</h3>
          <p style={{ fontSize: 32, margin: 0 }}>
            {activeSchedules.filter((s) => s.isActive).length}
          </p>
        </div>
        <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8 }}>
          <h3>今日执行</h3>
          <p style={{ fontSize: 32, margin: 0 }}>{todayCount}</p>
        </div>
      </div>

      <h2 style={{ marginTop: 30 }}>最近执行记录</h2>
      {recentLogs.length === 0 ? (
        <p>暂无执行记录</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>时间</th>
              <th>步数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{log.executedAt ? new Date(log.executedAt).toLocaleString() : '-'}</td>
                <td>{log.stepWritten || '-'}</td>
                <td>
                  <span style={{ color: log.status === 'success' ? 'green' : 'red' }}>
                    {log.status === 'success' ? '成功' : '失败'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}