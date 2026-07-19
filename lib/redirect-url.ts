/**
 * Build an absolute redirect URL without trusting forwarded host headers.
 * Next.js requires Proxy redirects to use an absolute URL.
 */
export function buildRedirectUrl(
  requestUrl: URL,
  pathname: string,
  configuredAppUrl = process.env.APP_URL
): URL {
  let origin = requestUrl.origin

  if (configuredAppUrl) {
    try {
      const appUrl = new URL(configuredAppUrl)
      if (
        (appUrl.protocol === 'http:' || appUrl.protocol === 'https:') &&
        !appUrl.username &&
        !appUrl.password
      ) {
        origin = appUrl.origin
      }
    } catch {
      // Fall back to Next.js' parsed request origin for invalid configuration.
    }
  }

  return new URL(pathname, origin)
}
