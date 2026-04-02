import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const publicPaths = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/me']

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // API routes — no locale handling, just auth
  if (pathname.startsWith('/api/')) {
    if (isPublicPath(pathname)) {
      return NextResponse.next()
    }
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json(
        { error: '未登录', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token 无效', code: 'TOKEN_INVALID' },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // Page routes — run intl middleware first
  const response = intlMiddleware(request)

  // Detect locale: URL > cookie > default
  const localePattern = new RegExp(`^/(${routing.locales.join('|')})`)
  const urlLocaleMatch = pathname.match(localePattern)
  const urlLocale = urlLocaleMatch ? urlLocaleMatch[1] : null
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value
  const locale = urlLocale
    || (localeCookie && routing.locales.includes(localeCookie as 'zh' | 'en') ? localeCookie : null)
    || routing.defaultLocale

  // Extract path without locale prefix for auth check
  const pathWithoutLocale = pathname.replace(localePattern, '') || '/'

  // Public pages — let intl middleware handle it
  if (isPublicPath(pathWithoutLocale)) {
    return response
  }

  // Auth check for protected pages
  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `/${locale}/login`
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyToken(token)
  if (!payload) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `/${locale}/login`
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/', '/(zh|en)/:path*', '/((?!_next|favicon.ico|api).*)*'],
}
