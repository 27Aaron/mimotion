import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { inviteCodes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { randomBytes } from 'crypto'

export async function GET() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (!current.isAdmin) {
    return NextResponse.json({ error: '需要管理员权限', code: 'ADMIN_REQUIRED' }, { status: 403 })
  }

  const codes = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.createdBy, current.userId))

  return NextResponse.json(codes)
}

export async function POST() {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (!current.isAdmin) {
    return NextResponse.json({ error: '需要管理员权限', code: 'ADMIN_REQUIRED' }, { status: 403 })
  }

  const code = randomBytes(4).toString('hex').toUpperCase()
  const now = new Date()

  await db.insert(inviteCodes).values({
    code,
    createdBy: current.userId,
    createdAt: now,
  })

  return NextResponse.json({ code })
}

export async function DELETE(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  if (!current.isAdmin) {
    return NextResponse.json({ error: '需要管理员权限', code: 'ADMIN_REQUIRED' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: '缺少 code', code: 'MISSING_CODE' }, { status: 400 })
  }

  const result = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code))
    .limit(1)

  const inviteCode = result[0]
  if (!inviteCode) {
    return NextResponse.json({ error: '邀请码不存在', code: 'CODE_NOT_FOUND' }, { status: 404 })
  }
  if (inviteCode.usedBy) {
    return NextResponse.json({ error: '只能删除未使用的邀请码', code: 'CODE_ONLY_DELETE_UNUSED' }, { status: 400 })
  }

  await db.delete(inviteCodes).where(eq(inviteCodes.code, code))

  return NextResponse.json({ success: true })
}
