import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { xiaomiAccounts, schedules, runLogs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { IconDeviceMobile, IconClockCheck, IconRun } from '@tabler/icons-react'

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

      <div className="stats-grid">
        <div className="card card-stat">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <IconDeviceMobile size={18} stroke={1.5} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>小米账号</h3>
          </div>
          <div className="stat-value">{accounts.length}</div>
        </div>
        <div className="card card-stat">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <IconClockCheck size={18} stroke={1.5} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>活跃任务</h3>
          </div>
          <div className="stat-value">
            {activeSchedules.filter((s) => s.isActive).length}
          </div>
        </div>
        <div className="card card-stat">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <IconRun size={18} stroke={1.5} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>今日执行</h3>
          </div>
          <div className="stat-value">{todayCount}</div>
        </div>
      </div>

      <div className="section-title">最近执行记录</div>
      {recentLogs.length === 0 ? (
        <div className="empty-state">暂无执行记录</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>步数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                    {log.executedAt ? new Date(log.executedAt).toLocaleString() : '-'}
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {log.stepWritten || '-'}
                  </td>
                  <td>
                    <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                      {log.status === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
