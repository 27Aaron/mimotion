import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { schedules, xiaomiAccounts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuid } from 'uuid'

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

  const { xiaomiAccountId, cronExpression, minStep, maxStep } = body

  if (!xiaomiAccountId || !cronExpression || minStep === undefined || maxStep === undefined) {
    return NextResponse.json({ error: '缺少参数', code: 'MISSING_PARAMS' }, { status: 400 })
  }

  // 验证 cron 格式
  const cronParts = String(cronExpression).trim().split(/\s+/)
  if (cronParts.length !== 5) {
    return NextResponse.json({ error: 'Cron 表达式格式错误，需 5 段（分 时 日 月 周）', code: 'CRON_INVALID_FORMAT' }, { status: 400 })
  }
  const cronFieldPattern = /^(\*|\*\/\d+|\d+|\d+-\d+|\d+(,\d+)+)$/
  if (!cronParts.every(p => cronFieldPattern.test(p))) {
    return NextResponse.json({ error: 'Cron 表达式包含无效字符', code: 'CRON_INVALID_CHARS' }, { status: 400 })
  }

  // 验证步数
  const min = Number(minStep)
  const max = Number(maxStep)
  if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max <= 0) {
    return NextResponse.json({ error: '步数必须为正整数', code: 'STEP_MUST_BE_POSITIVE' }, { status: 400 })
  }
  if (min > max) {
    return NextResponse.json({ error: '最小步数不能大于最大步数', code: 'STEP_MIN_EXCEEDS_MAX' }, { status: 400 })
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
    cronExpression,
    minStep,
    maxStep,
    isActive: true,
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
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少 id', code: 'MISSING_ID' }, { status: 400 })
  }

  const body = await request.json()
  const { cronExpression, minStep, maxStep, isActive, xiaomiAccountId } = body

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  // 校验 cron 表达式
  if (cronExpression !== undefined) {
    const cronParts = String(cronExpression).trim().split(/\s+/)
    if (cronParts.length !== 5) {
      return NextResponse.json({ error: 'Cron 表达式格式错误', code: 'CRON_INVALID_FORMAT_SHORT' }, { status: 400 })
    }
    const cronFieldPattern = /^(\*|\*\/\d+|\d+|\d+-\d+|\d+(,\d+)+)$/
    if (!cronParts.every(p => cronFieldPattern.test(p))) {
      return NextResponse.json({ error: 'Cron 表达式包含无效字符', code: 'CRON_INVALID_CHARS' }, { status: 400 })
    }
    updates.cronExpression = cronExpression
  }

  // 校验步数
  if (minStep !== undefined || maxStep !== undefined) {
    const min = Number(minStep)
    const max = Number(maxStep)
    if (!Number.isInteger(min) || min <= 0) {
      return NextResponse.json({ error: '最小步数必须为正整数', code: 'STEP_MIN_INVALID' }, { status: 400 })
    }
    if (!Number.isInteger(max) || max <= 0) {
      return NextResponse.json({ error: '最大步数必须为正整数', code: 'STEP_MAX_INVALID' }, { status: 400 })
    }
    if (min > max) {
      return NextResponse.json({ error: '最小步数不能大于最大步数', code: 'STEP_MIN_EXCEEDS_MAX' }, { status: 400 })
    }
    updates.minStep = min
    updates.maxStep = max
  }

  if (isActive !== undefined) updates.isActive = isActive
  if (xiaomiAccountId !== undefined) updates.xiaomiAccountId = xiaomiAccountId

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
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少 id', code: 'MISSING_ID' }, { status: 400 })
  }

  await db
    .delete(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, current.userId)))

  return NextResponse.json({ success: true })
}