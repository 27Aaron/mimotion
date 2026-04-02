import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { xiaomiAccounts, schedules, runLogs } from '@/lib/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuid } from 'uuid'
import { encrypt } from '@/lib/crypto'
import { loginXiaomiAccount } from '@/lib/xiaomi/auth'

export async function GET() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const accounts = await db
    .select()
    .from(xiaomiAccounts)
    .where(eq(xiaomiAccounts.userId, current.userId))

  // 任务统计 + scheduleId 映射合并为一条查询
  const scheduleStats = await db
    .select({
      xiaomiAccountId: schedules.xiaomiAccountId,
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${schedules.isActive} = 1 then 1 else 0 end)`,
    })
    .from(schedules)
    .where(eq(schedules.userId, current.userId))
    .groupBy(schedules.xiaomiAccountId)

  const scheduleMap = new Map(scheduleStats.map(s => [s.xiaomiAccountId, s]))

  const userSchedules = await db
    .select({ id: schedules.id, xiaomiAccountId: schedules.xiaomiAccountId })
    .from(schedules)
    .where(eq(schedules.userId, current.userId))

  const scheduleToAccount = new Map(userSchedules.map(s => [s.id, s.xiaomiAccountId]))
  const scheduleIds = userSchedules.map(s => s.id)

  // 查最近执行记录
  const lastStepMap = new Map<string, number | null>()
  if (scheduleIds.length > 0) {
    const logs = await db
      .select({
        scheduleId: runLogs.scheduleId,
        stepWritten: runLogs.stepWritten,
        executedAt: runLogs.executedAt,
      })
      .from(runLogs)
      .where(inArray(runLogs.scheduleId, scheduleIds))
      .orderBy(desc(runLogs.executedAt))

    const seen = new Set<string>()
    for (const log of logs) {
      const accId = scheduleToAccount.get(log.scheduleId)
      if (accId && !seen.has(accId)) {
        seen.add(accId)
        lastStepMap.set(accId, log.stepWritten)
      }
    }
  }

  return NextResponse.json(
    accounts.map((a) => {
      const ss = scheduleMap.get(a.id)
      const ls = lastStepMap.get(a.id)
      return {
        id: a.id,
        nickname: a.nickname,
        account: a.account,
        status: a.status,
        lastSyncAt: a.lastSyncAt,
        lastError: a.lastError,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        scheduleCount: ss?.total ?? 0,
        activeScheduleCount: ss?.active ?? 0,
        lastStep: ls ?? null,
      }
    })
  )
}

export async function POST(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { account, password, nickname } = await request.json()

  if (!account || !password) {
    return NextResponse.json({ error: '缺少参数', code: 'MISSING_PARAMS' }, { status: 400 })
  }

  console.log('[Xiaomi API] Login attempt:', account)
  let loginResult
  try {
    loginResult = await loginXiaomiAccount(account, password)
  } catch (err) {
    console.error('[Xiaomi API] Login exception:', err)
    return NextResponse.json(
      { error: `登录异常: ${err instanceof Error ? err.message : String(err)}`, code: 'XIAOMI_LOGIN_EXCEPTION' },
      { status: 500 }
    )
  }
  console.log('[Xiaomi API] Login result:', JSON.stringify({
    success: loginResult.success,
    error: loginResult.error,
    userId: loginResult.userId,
    hasToken: !!loginResult.token,
  }))

  if (!loginResult.success || !loginResult.token) {
    return NextResponse.json(
      { error: loginResult.error || '小米账号验证失败', code: 'XIAOMI_LOGIN_FAILED' },
      { status: 400 }
    )
  }

  const { encrypted, iv } = encrypt(loginResult.token)
  const loginToken = loginResult.loginToken
  const ltEncrypted = loginToken ? encrypt(loginToken) : null
  const pwdEncrypted = encrypt(password)

  const now = new Date()
  const id = uuid()

  await db.insert(xiaomiAccounts).values({
    id,
    userId: current.userId,
    xiaomiUserId: loginResult.userId || null,
    account: account,
    tokenData: encrypted,
    tokenIv: iv,
    loginTokenData: ltEncrypted?.encrypted || null,
    loginTokenIv: ltEncrypted?.iv || null,
    passwordData: pwdEncrypted.encrypted,
    passwordIv: pwdEncrypted.iv,
    deviceId: loginResult.deviceId || null,
    nickname: nickname || account,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({
    id,
    nickname: nickname || account,
    status: 'active',
  })
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
  const { nickname, status, account, password } = body

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (nickname !== undefined) updates.nickname = nickname
  if (status !== undefined) updates.status = status

  // 重新登录刷新 token
  if (account && password) {
    let loginResult
    try {
      loginResult = await loginXiaomiAccount(account, password)
    } catch (err) {
      return NextResponse.json(
        { error: `登录异常: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      )
    }

    if (!loginResult.success || !loginResult.token) {
      return NextResponse.json(
        { error: loginResult.error || '小米账号验证失败' },
        { status: 400 }
      )
    }

    const { encrypted, iv } = encrypt(loginResult.token)
    updates.tokenData = encrypted
    updates.tokenIv = iv
    updates.xiaomiUserId = loginResult.userId || null
    updates.deviceId = loginResult.deviceId || null
    updates.status = 'active'
    updates.lastError = null

    const loginToken = loginResult.loginToken
    if (loginToken) {
      const ltEncrypted = encrypt(loginToken)
      updates.loginTokenData = ltEncrypted.encrypted
      updates.loginTokenIv = ltEncrypted.iv
    }

    const pwdEncrypted = encrypt(password)
    updates.passwordData = pwdEncrypted.encrypted
    updates.passwordIv = pwdEncrypted.iv
  }

  await db
    .update(xiaomiAccounts)
    .set(updates as typeof xiaomiAccounts.$inferInsert)
    .where(and(eq(xiaomiAccounts.id, id), eq(xiaomiAccounts.userId, current.userId)))

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

  // 级联删除
  const accountSchedules = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(and(eq(schedules.xiaomiAccountId, id), eq(schedules.userId, current.userId)))

  for (const s of accountSchedules) {
    await db.delete(runLogs).where(eq(runLogs.scheduleId, s.id))
  }
  await db.delete(schedules).where(and(eq(schedules.xiaomiAccountId, id), eq(schedules.userId, current.userId)))

  await db
    .delete(xiaomiAccounts)
    .where(and(eq(xiaomiAccounts.id, id), eq(xiaomiAccounts.userId, current.userId)))

  return NextResponse.json({ success: true })
}
