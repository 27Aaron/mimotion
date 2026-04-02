import { NextRequest, NextResponse } from 'next/server'
import { startScheduler } from '@/lib/scheduler'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

let schedulerStarted = false

export async function POST(_request: NextRequest) {
  // 验证管理员身份
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) {
    return NextResponse.json({ error: '未登录', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  const payload = await verifyToken(token)
  if (!payload?.isAdmin) {
    return NextResponse.json({ error: '无权限', code: 'FORBIDDEN' }, { status: 403 })
  }

  if (!schedulerStarted) {
    startScheduler()
    schedulerStarted = true
  }

  return NextResponse.json({ success: true })
}
