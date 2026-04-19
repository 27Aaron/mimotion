import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, xiaomiAccounts, schedules, runLogs, inviteCodes } from '@/lib/db/schema'
import { eq, sql, isNull } from 'drizzle-orm'
import { verifyToken, hashPassword } from '@/lib/auth'
import { cookies } from 'next/headers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    return NextResponse.json({ error: '无权限', code: 'FORBIDDEN' }, { status: 403 })
  }

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      barkUrl: users.barkUrl,
      telegramBotToken: users.telegramBotToken,
      telegramChatId: users.telegramChatId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(users.createdAt)

  // 用户统计
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

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '无权限', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const { userId, newPassword } = body

  if (!userId || !newPassword) {
    return NextResponse.json({ error: '缺少参数', code: 'MISSING_PARAMS' }, { status: 400 })
  }

  if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: '无效的用户 ID', code: 'INVALID_USER_ID' }, { status: 400 })
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: '密码需 8 位以上，包含字母和数字', code: 'PASSWORD_INVALID' }, { status: 400 })
  }

  // Admin 不能重置自己的密码（应通过设置页）
  if (userId === admin.userId) {
    return NextResponse.json({ error: '请通过设置页修改自己的密码', code: 'CANNOT_RESET_SELF' }, { status: 400 })
  }

  const passwordHash = await hashPassword(newPassword)
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId))

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '无权限', code: 'FORBIDDEN' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('id')

  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: '缺少有效的用户 ID', code: 'MISSING_PARAMS' }, { status: 400 })
  }

  if (userId === admin.userId) {
    return NextResponse.json({ error: '不能删除自己', code: 'CANNOT_DELETE_SELF' }, { status: 400 })
  }

  // 级联删除
  await db.transaction(async (tx) => {
    const userSchedules = await tx
      .select({ id: schedules.id })
      .from(schedules)
      .where(eq(schedules.userId, userId))

    for (const s of userSchedules) {
      await tx.delete(runLogs).where(eq(runLogs.scheduleId, s.id))
    }
    await tx.delete(schedules).where(eq(schedules.userId, userId))
    await tx.delete(xiaomiAccounts).where(eq(xiaomiAccounts.userId, userId))

    // 释放邀请码关联
    await tx.update(inviteCodes).set({ usedBy: null }).where(eq(inviteCodes.usedBy, userId))
    await tx.delete(inviteCodes).where(eq(inviteCodes.createdBy, userId))

    await tx.delete(users).where(eq(users.id, userId))
  })

  return NextResponse.json({ success: true })
}
