const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
