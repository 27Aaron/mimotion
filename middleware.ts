import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// 不需要鉴权的路径
const publicPaths = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/me']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公开路径直接放行
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // 静态资源和 Next.js 内部路径放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 检查 auth cookie
  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    // API 路由返回 401，页面路由重定向到登录
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // 验证 token 有效性
  const payload = await verifyToken(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token 无效' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next (静态文件)
     * - favicon.ico
     */
    '/((?!_next|favicon.ico).*)',
  ],
}
