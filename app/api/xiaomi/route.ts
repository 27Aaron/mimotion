import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/lib/db'
import { xiaomiAccounts, schedules } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuid } from 'uuid'
import { encrypt } from '@/lib/crypto'
import { loginXiaomiAccount } from '@/lib/xiaomi/auth'
import { deleteOwnedXiaomiAccount } from '@/lib/ownership'
import { createXiaomiAccountSchema, updateXiaomiAccountSchema, validationMessage } from '@/lib/api/contracts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  // Let SQLite select one latest row per account instead of loading all logs
  // into application memory as the history grows.
  const latestSteps = sqlite.prepare(`
    SELECT xiaomi_account_id AS accountId, step_written AS stepWritten
    FROM (
      SELECT
        s.xiaomi_account_id,
        rl.step_written,
        row_number() OVER (
          PARTITION BY s.xiaomi_account_id
          ORDER BY rl.executed_at DESC, rl.id DESC
        ) AS row_number
      FROM schedules s
      JOIN run_logs rl ON rl.schedule_id = s.id
      WHERE s.user_id = ?
    )
    WHERE row_number = 1
  `).all(current.userId) as Array<{ accountId: string; stepWritten: number | null }>
  const lastStepMap = new Map(latestSteps.map((row) => [row.accountId, row.stepWritten]))

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

  let postBody
  try {
    postBody = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const parsed = createXiaomiAccountSchema.safeParse(postBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error), code: 'VALIDATION_FAILED' },
      { status: 400 },
    )
  }
  const { account, password, nickname } = parsed.data

  let loginResult
  try {
    loginResult = await loginXiaomiAccount(account, password)
  } catch {
    console.error('[Xiaomi API] Login exception')
    return NextResponse.json(
      { error: '小米账号登录异常，请稍后再试', code: 'XIAOMI_LOGIN_EXCEPTION' },
      { status: 500 }
    )
  }

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

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: '缺少有效的 id', code: 'MISSING_ID' }, { status: 400 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const parsed = updateXiaomiAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error), code: 'VALIDATION_FAILED' },
      { status: 400 },
    )
  }
  const { nickname, status, account, password } = parsed.data

  const existingAccount = await db.select({ id: xiaomiAccounts.id }).from(xiaomiAccounts).where(
    and(eq(xiaomiAccounts.id, id), eq(xiaomiAccounts.userId, current.userId)),
  ).limit(1)
  if (!existingAccount[0]) {
    return NextResponse.json({ error: '小米账号不存在', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (nickname !== undefined) {
    updates.nickname = nickname
  }
  if (status !== undefined) {
    updates.status = status
  }

  // 重新登录刷新 token
  if (account && password) {
    let loginResult
    try {
      loginResult = await loginXiaomiAccount(account, password)
    } catch {
      return NextResponse.json(
        { error: '小米账号登录异常，请稍后再试' },
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

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: '缺少有效的 id', code: 'MISSING_ID' }, { status: 400 })
  }

  const deleted = deleteOwnedXiaomiAccount(sqlite, id, current.userId)
  if (!deleted) {
    return NextResponse.json({ error: '小米账号不存在', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
