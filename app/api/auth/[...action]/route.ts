import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, verifyPassword, createToken, getCurrentUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { v4 as uuid } from 'uuid'
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { registerUserWithInvite } from '@/lib/registration'

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
    return handleLogout(request)
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

  if (actionStr === 'logout') {
    return handleLogout(request)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function parseJson(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function handleLogin(request: NextRequest) {
  // Rate limit: 10 attempts per IP per 15 minutes
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
      { status: 429, headers: getRateLimitHeaders(rl.remaining, rl.resetAt) },
    )
  }

  const body = await parseJson(request)
  if (!body) return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })

  const { username, password } = body

  if (!username || !password) {
    return NextResponse.json({ error: '缺少参数', code: 'MISSING_PARAMS' }, { status: 400 })
  }

  if (typeof username !== 'string' || username.length < 2 || username.length > 32) {
    return NextResponse.json({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  if (typeof password !== 'string' || password.length > 128) {
    return NextResponse.json({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  const user = result[0]
  if (!user) {
    return NextResponse.json({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  const token = await createToken({
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin ?? false,
  })

  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    },
  })
}

async function handleRegister(request: NextRequest) {
  // Rate limit: 5 registrations per IP per hour
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '注册请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
      { status: 429, headers: getRateLimitHeaders(rl.remaining, rl.resetAt) },
    )
  }

  const body = await parseJson(request)
  if (!body) return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })

  const { username, password, inviteCode } = body

  if (!username || !password || !inviteCode) {
    return NextResponse.json({ error: '缺少参数', code: 'MISSING_PARAMS' }, { status: 400 })
  }

  if (typeof username !== 'string' || username.length < 2 || username.length > 32) {
    return NextResponse.json({ error: '用户名长度需在 2-32 之间', code: 'USERNAME_LENGTH' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: '密码长度需在 8-128 之间', code: 'PASSWORD_LENGTH' }, { status: 400 })
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: '密码需包含字母和数字', code: 'PASSWORD_COMPLEXITY' }, { status: 400 })
  }
  if (typeof inviteCode !== 'string' || !/^[A-F0-9]{8}$/i.test(inviteCode)) {
    return NextResponse.json({ error: '邀请码无效', code: 'INVALID_CODE' }, { status: 400 })
  }

  // 事务防止邀请码竞态
  const userId = uuid()
  const passwordHash = await hashPassword(password)
  const now = new Date()

  try {
    const result = registerUserWithInvite(sqlite, {
      userId,
      username,
      passwordHash,
      inviteCode: inviteCode.toUpperCase(),
      now,
    })
    if (result === 'invalid_code') throw new Error('INVALID_CODE')
    if (result === 'code_used') throw new Error('CODE_USED')
    if (result === 'username_taken') throw new Error('USERNAME_TAKEN')
  } catch (err) {
    const msg = err instanceof Error ? err.message : '注册失败'
    if (msg === 'INVALID_CODE') return NextResponse.json({ error: '邀请码无效', code: 'INVALID_CODE' }, { status: 400 })
    if (msg === 'CODE_USED') return NextResponse.json({ error: '邀请码已使用', code: 'CODE_USED' }, { status: 400 })
    if (msg === 'USERNAME_TAKEN') return NextResponse.json({ error: '注册失败，请检查输入信息', code: 'REGISTER_FAILED' }, { status: 400 })
    return NextResponse.json({ error: '注册失败', code: 'REGISTER_FAILED' }, { status: 500 })
  }

  const token = await createToken({
    userId,
    username,
    isAdmin: false,
  })

  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  return NextResponse.json({ user: { id: userId, username, isAdmin: false } })
}

async function handleLogout(request: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')

  // Detect locale from cookie or default to zh
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value
  const locale = (localeCookie === 'en') ? 'en' : 'zh'

  // A relative Location avoids trusting spoofable Host/X-Forwarded-Host values.
  return new NextResponse(null, {
    status: request.method === 'GET' ? 302 : 303,
    headers: { Location: `/${locale}/login` },
  })
}

async function handleMe() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Token 无效', code: 'TOKEN_INVALID' }, { status: 401 })
  }

  return NextResponse.json({ user })
}
