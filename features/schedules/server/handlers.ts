import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/lib/db'
import { schedules, xiaomiAccounts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuid } from 'uuid'
import { deleteOwnedSchedule } from '@/lib/db/ownership'
import { getNextCronOccurrence, normalizeCronExpression } from '@/lib/scheduling/cron'
import { createScheduleSchema, updateScheduleSchema } from '@/features/schedules/contracts'
import { validationMessage } from '@/lib/api/validation'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUUID(id: string | null): string | null {
  if (!id) return null
  return UUID_RE.test(id) ? id : null
}

export async function GET() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const userSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, current.userId))

  const accountIds = [...new Set(userSchedules.map((s) => s.xiaomiAccountId))]

  let accountMap: Record<string, string> = {}
  if (accountIds.length > 0) {
    const accounts = await db
      .select({ id: xiaomiAccounts.id, nickname: xiaomiAccounts.nickname })
      .from(xiaomiAccounts)
      .where(eq(xiaomiAccounts.userId, current.userId))

    accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.nickname || '未知']))
  }

  return NextResponse.json(
    userSchedules.map((s) => ({
      id: s.id,
      xiaomiAccountId: s.xiaomiAccountId,
      accountNickname: accountMap[s.xiaomiAccountId] || '未知',
      cronExpression: s.cronExpression,
      minStep: s.minStep,
      maxStep: s.maxStep,
      isActive: s.isActive,
      lastRunAt: s.lastRunAt,
      nextRunAt: s.nextRunAt,
    }))
  )
}

export async function POST(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const parsed = createScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error), code: 'VALIDATION_FAILED' },
      { status: 400 },
    )
  }
  const { xiaomiAccountId, cronExpression, minStep, maxStep } = parsed.data

  // 验证 cron 格式
  const normalizedCron = normalizeCronExpression(cronExpression)
  if (!normalizedCron) {
    return NextResponse.json({ error: 'Cron 表达式格式或取值无效', code: 'CRON_INVALID' }, { status: 400 })
  }

  const account = await db
    .select()
    .from(xiaomiAccounts)
    .where(
      and(
        eq(xiaomiAccounts.id, xiaomiAccountId),
        eq(xiaomiAccounts.userId, current.userId)
      )
    )
    .limit(1)

  if (!account[0]) {
    return NextResponse.json({ error: '小米账号不存在', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })
  }

  const now = new Date()
  const id = uuid()

  await db.insert(schedules).values({
    id,
    userId: current.userId,
    xiaomiAccountId,
    cronExpression: normalizedCron,
    minStep,
    maxStep,
    isActive: true,
    nextRunAt: getNextCronOccurrence(normalizedCron, now),
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ id })
}

export async function PUT(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = validateUUID(searchParams.get('id'))

  if (!id) {
    return NextResponse.json({ error: '缺少有效的 id', code: 'MISSING_ID' }, { status: 400 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const parsed = updateScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error), code: 'VALIDATION_FAILED' },
      { status: 400 },
    )
  }
  const { cronExpression, minStep, maxStep, isActive, xiaomiAccountId } = parsed.data

  const existing = await db.select().from(schedules).where(
    and(eq(schedules.id, id), eq(schedules.userId, current.userId)),
  ).limit(1)
  if (!existing[0]) {
    return NextResponse.json({ error: '定时任务不存在', code: 'SCHEDULE_NOT_FOUND' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  // 校验 cron 表达式
  if (cronExpression !== undefined) {
    const normalizedCron = normalizeCronExpression(cronExpression)
    if (!normalizedCron) {
      return NextResponse.json({ error: 'Cron 表达式格式或取值无效', code: 'CRON_INVALID' }, { status: 400 })
    }
    updates.cronExpression = normalizedCron
    updates.nextRunAt = getNextCronOccurrence(normalizedCron, new Date())
  }

  if (minStep !== undefined || maxStep !== undefined) {
    updates.minStep = minStep
    updates.maxStep = maxStep
  }

  if (isActive !== undefined) {
    updates.isActive = isActive
    if (!isActive) updates.nextRunAt = null
    if (isActive && cronExpression === undefined) {
      updates.nextRunAt = getNextCronOccurrence(existing[0].cronExpression, new Date())
    }
  }
  if (xiaomiAccountId !== undefined) {
    const ownedAccount = await db.select({ id: xiaomiAccounts.id }).from(xiaomiAccounts).where(
      and(eq(xiaomiAccounts.id, xiaomiAccountId), eq(xiaomiAccounts.userId, current.userId)),
    ).limit(1)
    if (!ownedAccount[0]) {
      return NextResponse.json({ error: '小米账号不存在', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })
    }
    updates.xiaomiAccountId = xiaomiAccountId
  }

  await db
    .update(schedules)
    .set(updates as typeof schedules.$inferInsert)
    .where(and(eq(schedules.id, id), eq(schedules.userId, current.userId)))

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = validateUUID(searchParams.get('id'))

  if (!id) {
    return NextResponse.json({ error: '缺少有效的 id', code: 'MISSING_ID' }, { status: 400 })
  }

  const deleted = deleteOwnedSchedule(sqlite, id, current.userId)
  if (!deleted) {
    return NextResponse.json({ error: '定时任务不存在', code: 'SCHEDULE_NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
