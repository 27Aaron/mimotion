const path = require('path')
const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = withNextIntl(nextConfig)
