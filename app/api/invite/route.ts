import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/lib/db'
import { inviteCodes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { randomBytes } from 'crypto'
import { deleteOwnedUnusedInviteCode } from '@/lib/ownership'

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

  const result = deleteOwnedUnusedInviteCode(sqlite, code, current.userId)
  if (result === 'not_found') {
    return NextResponse.json({ error: '邀请码不存在', code: 'CODE_NOT_FOUND' }, { status: 404 })
  }
  if (result === 'used') {
    return NextResponse.json({ error: '只能删除未使用的邀请码', code: 'CODE_ONLY_DELETE_UNUSED' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
