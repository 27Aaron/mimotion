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
  const body = await parseJson(request)
  if (!body) return NextResponse.json({ error: '请求格式错误', code: 'BAD_REQUEST' }, { status: 400 })

  const { username, password, inviteCode } = body

  if (!username || !password || !inviteCode) {
    return NextResponse.json({ error: '缺少参数', code: 'MISSING_PARAMS' }, { status: 400 })
  }

  if (typeof username !== 'string' || username.length < 2 || username.length > 32) {
    return NextResponse.json({ error: '用户名长度需在 2-32 之间', code: 'USERNAME_LENGTH' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: '密码长度需在 6-128 之间', code: 'PASSWORD_LENGTH' }, { status: 400 })
  }

  // 事务防止邀请码竞态
  const userId = uuid()
  const passwordHash = await hashPassword(password)
  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      // 校验邀请码
      const codeResult = await tx
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, inviteCode))
        .limit(1)

      const code = codeResult[0]
      if (!code) throw new Error('INVALID_CODE')
      if (code.usedBy) throw new Error('CODE_USED')

      // 校验用户名唯一
      const existing = await tx
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1)

      if (existing[0]) throw new Error('USERNAME_TAKEN')

      await tx.insert(users).values({
        id: userId,
        username,
        passwordHash,
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
      })

      await tx
        .update(inviteCodes)
        .set({ usedBy: userId })
        .where(eq(inviteCodes.code, inviteCode))
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '注册失败'
    if (msg === 'INVALID_CODE') return NextResponse.json({ error: '邀请码无效', code: 'INVALID_CODE' }, { status: 400 })
    if (msg === 'CODE_USED') return NextResponse.json({ error: '邀请码已使用', code: 'CODE_USED' }, { status: 400 })
    if (msg === 'USERNAME_TAKEN') return NextResponse.json({ error: '用户名已被注册', code: 'USERNAME_TAKEN' }, { status: 400 })
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
  })

  return NextResponse.json({ user: { id: userId, username, isAdmin: false } })
}

async function handleLogout(request: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')

  // Detect locale from cookie or default to zh
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value
  const locale = (localeCookie === 'en') ? 'en' : 'zh'

  // Use X-Forwarded-Host to avoid redirecting to internal Docker hostname
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    request.headers.get('host') ||
    'localhost'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const url = new URL(`${protocol}://${host}/${locale}/login`)
  return NextResponse.redirect(url)
}

async function handleMe() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.json({ error: 'Token 无效', code: 'TOKEN_INVALID' }, { status: 401 })
  }

  return NextResponse.json({ user: payload })
}
