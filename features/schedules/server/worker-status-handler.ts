import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
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

  return NextResponse.json(
    {
      error: '调度器已由独立 Worker 管理，不能通过 Web API 启动',
      code: 'SCHEDULER_MANAGED_BY_WORKER',
    },
    { status: 409 },
  )
}
