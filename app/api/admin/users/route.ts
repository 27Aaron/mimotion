import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, xiaomiAccounts, schedules, runLogs } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload || !payload.isAdmin) return null

  return payload
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      barkUrl: users.barkUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  // Get stats per user
  const userStats = await db
    .select({
      userId: xiaomiAccounts.userId,
      accountCount: sql<number>`count(distinct ${xiaomiAccounts.id})`,
    })
    .from(xiaomiAccounts)
    .groupBy(xiaomiAccounts.userId)

  const scheduleStats = await db
    .select({
      userId: schedules.userId,
      activeCount: sql<number>`sum(case when ${schedules.isActive} = 1 then 1 else 0 end)`,
      totalSchedules: sql<number>`count(*)`,
    })
    .from(schedules)
    .groupBy(schedules.userId)

  const statsMap = new Map(userStats.map((s) => [s.userId, s]))
  const schedMap = new Map(scheduleStats.map((s) => [s.userId, s]))

  const result = allUsers.map((u) => ({
    ...u,
    accountCount: statsMap.get(u.id)?.accountCount ?? 0,
    activeSchedules: schedMap.get(u.id)?.activeCount ?? 0,
    totalSchedules: schedMap.get(u.id)?.totalSchedules ?? 0,
  }))

  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('id')

  if (!userId) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  }

  if (userId === admin.userId) {
    return NextResponse.json({ error: '不能删除自己' }, { status: 400 })
  }

  // Delete in order: logs -> schedules -> accounts -> user
  const userSchedules = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.userId, userId))

  for (const s of userSchedules) {
    await db.delete(runLogs).where(eq(runLogs.scheduleId, s.id))
  }
  await db.delete(schedules).where(eq(schedules.userId, userId))
  await db.delete(xiaomiAccounts).where(eq(xiaomiAccounts.userId, userId))
  await db.delete(users).where(eq(users.id, userId))

  return NextResponse.json({ success: true })
}
