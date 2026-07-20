import Database from 'better-sqlite3'

import { sqlite } from '../db'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

let lastCleanup = 0
const CLEANUP_INTERVAL = 10 * 60 * 1000

export function rateLimitWithDatabase(
  database: Database.Database,
  key: string,
  maxRequests: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const transaction = database.transaction(() => {
    if (now - lastCleanup >= CLEANUP_INTERVAL) {
      database.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').run(now)
      lastCleanup = now
    }

    const entry = database.prepare(
      'SELECT count, reset_at AS resetAt FROM rate_limits WHERE key = ?',
    ).get(key) as { count: number; resetAt: number } | undefined

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs
      database.prepare(`
        INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at
      `).run(key, resetAt)
      return { allowed: true, remaining: Math.max(0, maxRequests - 1), resetAt }
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    const nextCount = entry.count + 1
    database.prepare('UPDATE rate_limits SET count = ? WHERE key = ?').run(nextCount, key)
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - nextCount),
      resetAt: entry.resetAt,
    }
  })

  return transaction.immediate()
}

export function rateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  return rateLimitWithDatabase(sqlite, key, maxRequests, windowMs)
}

export function getRateLimitHeaders(remaining: number, resetAt: number) {
  return {
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  }
}
