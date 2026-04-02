function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

export function isSafeBarkUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (url.username || url.password) return false

    const hostname = url.hostname.toLowerCase()
    if (!hostname) return false
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      return false
    }
    if (hostname === '::1' || hostname === '[::1]') return false
    if (isPrivateIpv4(hostname)) return false

    return true
  } catch {
    return false
  }
}
