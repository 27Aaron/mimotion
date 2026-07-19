import path from 'node:path'
import { fileURLToPath } from 'node:url'
import createNextIntlPlugin from 'next-intl/plugin'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'bcryptjs'],
  outputFileTracingRoot: projectDir,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
