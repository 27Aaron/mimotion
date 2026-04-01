import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { xiaomiAccounts, schedules, runLogs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Smartphone, ClockCheck, Footprints } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

  const stats = [
    { title: '小米账号', value: accounts.length, icon: Smartphone },
    { title: '活跃任务', value: activeSchedules.filter((s) => s.isActive).length, icon: ClockCheck },
    { title: '今日执行', value: todayCount, icon: Footprints },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">控制台</h1>
        <p className="text-muted-foreground">查看你的步数同步状态</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          最近执行记录
        </h2>
        {recentLogs.length === 0 ? (
          <Card>
            <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
              暂无执行记录
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>步数</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {log.executedAt ? new Date(log.executedAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="font-mono">
                      {log.stepWritten || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status === 'success' ? '成功' : '失败'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  )
}
