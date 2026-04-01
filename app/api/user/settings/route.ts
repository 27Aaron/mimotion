import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'

export async function GET() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      isAdmin: users.isAdmin,
      barkUrl: users.barkUrl,
    })
    .from(users)
    .where(eq(users.id, current.userId))
    .limit(1)

  return NextResponse.json(result[0])
}

export async function PUT(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json()
  const { email, password, barkUrl, currentPassword } = body

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (email && email !== current.email) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existing[0]) {
      return NextResponse.json({ error: '邮箱已被使用' }, { status: 400 })
    }
    updates.email = email
  }

  if (password) {
    if (!currentPassword) {
      return NextResponse.json({ error: '需要当前密码' }, { status: 400 })
    }

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, current.userId))
      .limit(1)

    const valid = await verifyPassword(currentPassword, userResult[0].passwordHash)
    if (!valid) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 400 })
    }

    updates.passwordHash = await hashPassword(password)
  }

  if (barkUrl !== undefined) {
    updates.barkUrl = barkUrl || null
  }

  await db.update(users).set(updates as typeof users.$inferInsert).where(eq(users.id, current.userId))

  return NextResponse.json({ success: true })
}