type AuthCookieEnvironment = {
  NODE_ENV?: string
  AUTH_COOKIE_SECURE?: string
}

export function shouldUseSecureAuthCookie(
  environment: AuthCookieEnvironment = process.env,
): boolean {
  const configured = environment.AUTH_COOKIE_SECURE?.trim().toLowerCase()

  if (configured === 'false') return false
  if (configured === 'true') return true

  return environment.NODE_ENV === 'production'
}
