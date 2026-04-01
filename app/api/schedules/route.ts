import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { schedules, xiaomiAccounts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuid } from 'uuid'

export async function GET() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
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
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { xiaomiAccountId, cronExpression, minStep, maxStep } = await request.json()

  if (!xiaomiAccountId || !cronExpression || minStep === undefined || maxStep === undefined) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 })
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
    return NextResponse.json({ error: '小米账号不存在' }, { status: 404 })
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
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  const body = await request.json()
  const { cronExpression, minStep, maxStep, isActive } = body

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (cronExpression !== undefined) updates.cronExpression = cronExpression
  if (minStep !== undefined) updates.minStep = minStep
  if (maxStep !== undefined) updates.maxStep = maxStep
  if (isActive !== undefined) updates.isActive = isActive

  await db
    .update(schedules)
    .set(updates as typeof schedules.$inferInsert)
    .where(and(eq(schedules.id, id), eq(schedules.userId, current.userId)))

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  await db
    .delete(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, current.userId)))

  return NextResponse.json({ success: true })
}