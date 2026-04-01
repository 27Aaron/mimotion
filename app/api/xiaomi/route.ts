import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { xiaomiAccounts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuid } from 'uuid'
import { encrypt } from '@/lib/crypto'
import { loginXiaomiAccount } from '@/lib/xiaomi/auth'

export async function GET() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const accounts = await db
    .select()
    .from(xiaomiAccounts)
    .where(eq(xiaomiAccounts.userId, current.userId))

  return NextResponse.json(
    accounts.map((a) => ({
      id: a.id,
      nickname: a.nickname,
      status: a.status,
      lastSyncAt: a.lastSyncAt,
      lastError: a.lastError,
      createdAt: a.createdAt,
    }))
  )
}

export async function POST(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { account, password, nickname } = await request.json()

  if (!account || !password) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  }

  console.log('[Xiaomi API] Login attempt:', account)
  let loginResult
  try {
    loginResult = await loginXiaomiAccount(account, password)
  } catch (err) {
    console.error('[Xiaomi API] Login exception:', err)
    return NextResponse.json(
      { error: `登录异常: ${err instanceof Error ? err.message : String(err)}` },
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
      { error: loginResult.error || '小米账号验证失败' },
      { status: 400 }
    )
  }

  // 加密存储 app_token
  const { encrypted, iv } = encrypt(loginResult.token)

  const now = new Date()
  const id = uuid()

  await db.insert(xiaomiAccounts).values({
    id,
    userId: current.userId,
    xiaomiUserId: loginResult.userId || null,
    tokenData: encrypted,
    tokenIv: iv,
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
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  const body = await request.json()
  const { nickname, status } = body

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (nickname !== undefined) updates.nickname = nickname
  if (status !== undefined) updates.status = status

  await db
    .update(xiaomiAccounts)
    .set(updates as typeof xiaomiAccounts.$inferInsert)
    .where(and(eq(xiaomiAccounts.id, id), eq(xiaomiAccounts.userId, current.userId)))

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
    .delete(xiaomiAccounts)
    .where(and(eq(xiaomiAccounts.id, id), eq(xiaomiAccounts.userId, current.userId)))

  return NextResponse.json({ success: true })
}
