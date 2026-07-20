/**
 * Keep redirects on the browser's current origin.
 *
 * An absolute URL built from NextRequest.nextUrl can expose an internal bind
 * address such as 0.0.0.0 when the app runs behind a proxy. A relative
 * Location header avoids trusting proxy headers while still preventing open
 * redirects.
 */
export function buildSameOriginRedirectLocation(pathname: string): string {
  if (
    !pathname.startsWith('/')
    || pathname.startsWith('//')
    || pathname.includes('\\')
    || /[\r\n]/.test(pathname)
  ) {
    throw new Error('Redirect location must be a same-origin absolute path')
  }

  return pathname
}
