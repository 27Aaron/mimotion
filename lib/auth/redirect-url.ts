/** Build an absolute redirect URL from the current request origin. */
export function buildRedirectUrl(
  requestUrl: URL,
  pathname: string
): URL {
  return new URL(pathname, requestUrl.origin)
}
