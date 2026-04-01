import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, inviteCodes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, verifyPassword, createToken, verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { v4 as uuid } from 'uuid'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const { action } = await params
  const actionStr = action.join('/')

  if (actionStr === 'login') {
    return handleLogin(request)
  }

  if (actionStr === 'register') {
    return handleRegister(request)
  }

  if (actionStr === 'logout') {
    return handleLogout()
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const { action } = await params
  const actionStr = action.join('/')

  if (actionStr === 'me') {
    return handleMe()
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function handleLogin(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = result[0]
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
  }

  const token = await createToken({
    userId: user.id,
    email: user.email,
    isAdmin: user.isAdmin ?? false,
  })

  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
  })

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    },
  })
}

async function handleRegister(request: NextRequest) {
  const { email, password, inviteCode } = await request.json()

  if (!email || !password || !inviteCode) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  }

  // 校验邀请码
  const codeResult = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, inviteCode))
    .limit(1)

  const code = codeResult[0]
  if (!code) {
    return NextResponse.json({ error: '邀请码无效' }, { status: 400 })
  }
  if (code.usedBy) {
    return NextResponse.json({ error: '邀请码已使用' }, { status: 400 })
  }

  // 校验邮箱唯一
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing[0]) {
    return NextResponse.json({ error: '邮箱已被注册' }, { status: 400 })
  }

  const userId = uuid()
  const passwordHash = await hashPassword(password)
  const now = new Date()

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  })

  // 标记邀请码已使用
  await db
    .update(inviteCodes)
    .set({ usedBy: userId, usedAt: now })
    .where(eq(inviteCodes.code, inviteCode))

  const token = await createToken({
    userId,
    email,
    isAdmin: false,
  })

  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
  })

  return NextResponse.json({ user: { id: userId, email, isAdmin: false } })
}

async function handleLogout() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
  return NextResponse.json({ success: true })
}

async function handleMe() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.json({ error: 'Token 无效' }, { status: 401 })
  }

  return NextResponse.json({ user: payload })
}