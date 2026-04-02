import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'

export async function GET() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const result = await db
    .select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      locale: users.locale,
      barkUrl: users.barkUrl,
      telegramBotToken: users.telegramBotToken,
      telegramChatId: users.telegramChatId,
    })
    .from(users)
    .where(eq(users.id, current.userId))
    .limit(1)

  return NextResponse.json(result[0])
}

export async function PUT(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const body = await request.json()
  const { username, password, barkUrl, telegramBotToken, telegramChatId, locale, currentPassword } = body

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (username && username !== current.username) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (existing[0]) {
      return NextResponse.json({ error: '用户名已被使用', code: 'USERNAME_IN_USE' }, { status: 400 })
    }
    updates.username = username
  }

  if (password) {
    if (!currentPassword) {
      return NextResponse.json({ error: '需要当前密码', code: 'CURRENT_PASSWORD_REQUIRED' }, { status: 400 })
    }

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, current.userId))
      .limit(1)

    const valid = await verifyPassword(currentPassword, userResult[0].passwordHash)
    if (!valid) {
      return NextResponse.json({ error: '当前密码错误', code: 'CURRENT_PASSWORD_WRONG' }, { status: 400 })
    }

    updates.passwordHash = await hashPassword(password)
  }

  if (barkUrl !== undefined) {
    updates.barkUrl = barkUrl || null
  }

  if (telegramBotToken !== undefined) {
    updates.telegramBotToken = telegramBotToken || null
  }

  if (telegramChatId !== undefined) {
    updates.telegramChatId = telegramChatId || null
  }

  if (locale !== undefined) {
    updates.locale = locale || 'zh'
  }

  await db.update(users).set(updates as typeof users.$inferInsert).where(eq(users.id, current.userId))

  return NextResponse.json({ success: true })
}
